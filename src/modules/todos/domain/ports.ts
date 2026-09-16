import type { TodoId, UserId } from "@/shared/domain/ids";
import type { Todo } from "./todo";

/**
 * Write-side persistence. Every method here runs inside a transaction, which
 * is why the two read operations live on this port rather than on a reader:
 * they exist to inform a write, not to render a screen.
 *
 * The display read path has no port at all - it goes straight through
 * supabase-js under RLS. That is a deliberate CQRS split: a port earns its
 * cost when there is an invariant to protect or a second implementation to
 * swap in, and a paginated list has neither.
 */
export interface TodoWriter {
  /**
   * `SELECT ... FOR UPDATE`. The name states the intent - "I am about to write
   * this" - and lets the adapter decide that this means a row lock.
   */
  findByIdForUpdate(id: TodoId): Promise<Todo | null>;
  countPending(ownerId: UserId): Promise<number>;
  insert(todo: Todo): Promise<void>;
  update(todo: Todo): Promise<void>;
  remove(id: TodoId): Promise<void>;
}

export type TransactionalRepositories = {
  readonly todos: TodoWriter;
};

export type UnitOfWorkOptions = {
  /**
   * Serialize concurrent transactions that share this key.
   *
   * Exposed because the use case genuinely knows it needs serialization - the
   * pending-todo limit counts rows that may not exist yet, so row locks cannot
   * help. The Postgres adapter implements it with `pg_advisory_xact_lock`; the
   * in-memory adapter uses a promise chain.
   */
  readonly serializeBy?: string;
};

export interface UnitOfWork {
  run<T>(
    work: (repos: TransactionalRepositories) => Promise<T>,
    options?: UnitOfWorkOptions,
  ): Promise<T>;
}

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  nextTodoId(): TodoId;
}

/**
 * Just the identity the use case needs. Deliberately narrower than
 * `AuthenticatedSession`: the unit of work is what must hold a verified
 * session, so use cases stay ignorant of how authentication happened.
 */
export interface CurrentUser {
  readonly id: UserId;
}

export type TodoUseCaseDeps = {
  readonly uow: UnitOfWork;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly user: CurrentUser;
};
