import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CreateTodo } from "@/modules/todos/application/create-todo";
import type { TodoUseCaseDeps } from "@/modules/todos/domain/ports";
import { MAX_PENDING_TODOS, PendingLimitReached } from "@/modules/todos/domain/todo";
import type { TodoId } from "@/shared/domain/ids";
import { closePool, getDb } from "@/shared/infrastructure/db/pool";
import { RlsUnitOfWork } from "@/shared/infrastructure/db/rls-unit-of-work";
import { integrationAvailable } from "./environment";
import { sessionForTests } from "./session-factory";
import { createTestUser, deleteTestUser, type TestUser } from "./users";

const available = await integrationAvailable();

/**
 * The suite that justifies the plan's central claim about pooling.
 *
 * Supabase's self-hosting docs say transaction mode "does not support SET or
 * advisory locks". That is shorthand: in transaction mode the *transaction* is
 * the pooling unit, so transaction-scoped state works and session-scoped state
 * does not. Everything the unit of work uses - set_config(is_local => true),
 * SET LOCAL, pg_advisory_xact_lock - is transaction-scoped. These tests prove
 * it rather than arguing it.
 */
describe.skipIf(!available)("write concurrency", () => {
  let user: TestUser;

  const deps = (): TodoUseCaseDeps => ({
    uow: new RlsUnitOfWork(getDb(), sessionForTests(user.id)),
    clock: { now: () => new Date() },
    ids: { nextTodoId: () => crypto.randomUUID() as TodoId },
    user: { id: sessionForTests(user.id).userId },
  });

  beforeAll(async () => {
    user = await createTestUser("race");
  });

  afterAll(async () => {
    if (user) await deleteTestUser(user.id);
    await closePool();
  });

  it("lets exactly one of two simultaneous creates take the last pending slot", async () => {
    const useCase = new CreateTodo(deps());

    for (let index = 0; index < MAX_PENDING_TODOS - 1; index += 1) {
      await useCase.execute({ title: `Preenchendo ${index}` });
    }

    // One slot left, two writers starting together. Without the advisory lock
    // both would count MAX-1 under READ COMMITTED and both would insert: row
    // locks cannot help, because the conflicting row does not exist yet.
    const results = await Promise.allSettled([
      useCase.execute({ title: "Corrida A" }),
      useCase.execute({ title: "Corrida B" }),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(PendingLimitReached);

    const { rows } = await getDb().execute(
      sql`select count(*)::int as total from public.todos where user_id = ${user.id} and not done`,
    );
    expect((rows[0] as { total: number }).total).toBe(MAX_PENDING_TODOS);
  });

  it("serializes the second transaction behind FOR UPDATE and bounds the wait", async () => {
    const created = await new CreateTodo(deps()).execute({ title: "Disputada" });

    let firstHoldsLock = false;
    let releaseFirst: () => void = () => {};
    const firstHasLocked = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    // Transaction 1 takes the row lock and keeps the transaction open.
    const first = new RlsUnitOfWork(getDb(), sessionForTests(user.id)).run(
      async ({ todos }) => {
        await todos.findByIdForUpdate(created.id);
        firstHoldsLock = true;
        releaseFirst();
        // Longer than the 3s lock_timeout the unit of work sets, so the second
        // transaction is guaranteed to give up rather than merely be slow.
        await new Promise((resolve) => setTimeout(resolve, 4_000));
        return "done";
      },
    );

    await firstHasLocked;
    expect(firstHoldsLock).toBe(true);

    // Transaction 2 wants the same row and must abort on lock_timeout instead
    // of hanging on to a pooled connection indefinitely.
    await expect(
      new RlsUnitOfWork(getDb(), sessionForTests(user.id)).run(({ todos }) =>
        todos.findByIdForUpdate(created.id),
      ),
    ).rejects.toThrow(/lock timeout|canceling statement/i);

    await expect(first).resolves.toBe("done");
  });
});
