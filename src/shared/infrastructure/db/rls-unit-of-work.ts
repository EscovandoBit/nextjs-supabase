import "server-only";

import { sql } from "drizzle-orm";

import { DrizzleTodoRepository } from "@/modules/todos/infrastructure/drizzle-todo.repository";
import type {
  TransactionalRepositories,
  UnitOfWork,
  UnitOfWorkOptions,
} from "@/modules/todos/domain/ports";
import type { AuthenticatedSession } from "@/shared/domain/session";
import type { Database } from "./pool";
import type { Transaction } from "./transaction";

/**
 * `SET ROLE` does not accept a bind parameter, so the role has to be
 * interpolated raw. This allowlist is the only thing standing between a claim
 * value and arbitrary SQL, which is why it exists even though the session type
 * already narrows `role` to a literal.
 */
const ALLOWED_ROLES = new Set(["authenticated", "anon"]);

/**
 * One write = one transaction = one RLS scope.
 *
 * Supabase evaluates RLS from `auth.uid()`, which reads `request.jwt.claims`,
 * and that GUC can only be set with transaction scope. So the transaction
 * requirement and the RLS requirement are not two concerns that happen to
 * coexist - they are the same primitive.
 *
 * Requiring `AuthenticatedSession` in the constructor is what makes the
 * project's central rule true by construction: no verified session means no
 * transaction, which means no write. A compile error, not a review comment.
 */
export class RlsUnitOfWork implements UnitOfWork {
  constructor(
    private readonly db: Database,
    private readonly session: AuthenticatedSession,
  ) {}

  async run<T>(
    work: (repos: TransactionalRepositories) => Promise<T>,
    options?: UnitOfWorkOptions,
  ): Promise<T> {
    const role = ALLOWED_ROLES.has(this.session.role) ? this.session.role : "anon";

    return this.db.transaction(async (tx) => {
      await this.applyTimeouts(tx);

      // Before the role switch on purpose: advisory locks are not role-scoped,
      // and taking it as the connection role means no policy or grant can
      // interfere with the serialization the use case asked for.
      if (options?.serializeBy) {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${options.serializeBy}))`);
      }

      await this.applyAuthContext(tx, role);

      return work({ todos: new DrizzleTodoRepository(tx) });
    });
  }

  private async applyTimeouts(tx: Transaction): Promise<void> {
    // With FOR UPDATE, waiting on a lock holds a pooled connection. Unbounded,
    // one stuck lock takes down the whole write capacity of the app.
    await tx.execute(sql`set local lock_timeout = '3s'`);
    await tx.execute(sql`set local statement_timeout = '10s'`);
  }

  private async applyAuthContext(tx: Transaction, role: string): Promise<void> {
    // Parameterized deliberately. The documented Drizzle example uses
    // sql.raw(JSON.stringify(token)), which breaks - and opens an injection -
    // the moment a claim contains a single quote, e.g. a user named O'Brien.
    await tx.execute(
      sql`select set_config('request.jwt.claims', ${this.session.claimsJson}::text, true)`,
    );
    await tx.execute(
      sql`select set_config('request.jwt.claim.sub', ${this.session.userId}::text, true)`,
    );

    await tx.execute(sql`set local role ${sql.raw(role)}`);

    // No reset afterwards, and that is not an omission: SET LOCAL and
    // set_config(..., is_local => true) are both reverted when the transaction
    // ends, on commit and on rollback alike. The `finally` block that circulates
    // in examples online is dead code that looks load-bearing.
  }
}
