import type { TodoId, UserId } from "@/shared/domain/ids";

export const TITLE_MAX_LENGTH = 120;

/**
 * The invariant that makes a pessimistic lock necessary. Enforcing it means
 * counting rows before inserting, which `SELECT ... FOR UPDATE` cannot protect
 * because the rows being counted may not exist yet (phantom read at READ
 * COMMITTED). The unit of work serializes per user instead.
 */
export const MAX_PENDING_TODOS = 5;

export type Todo = {
  readonly id: TodoId;
  readonly ownerId: UserId;
  readonly title: string;
  readonly done: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class TodoNotFound extends DomainError {
  readonly code = "TODO_NOT_FOUND";

  constructor() {
    super("Tarefa não encontrada.");
  }
}

export class TodoAccessDenied extends DomainError {
  readonly code = "TODO_ACCESS_DENIED";

  constructor() {
    // Same user-facing message as TodoNotFound, deliberately. Distinguishing
    // "does not exist" from "exists but is not yours" tells an attacker which
    // ids are real. The codes differ so logs can still tell them apart.
    super("Tarefa não encontrada.");
  }
}

export class InvalidTitle extends DomainError {
  readonly code = "INVALID_TITLE";
}

export class PendingLimitReached extends DomainError {
  readonly code = "PENDING_LIMIT_REACHED";

  constructor() {
    super(
      `Você já tem ${MAX_PENDING_TODOS} tarefas pendentes. Conclua uma antes de criar outra.`,
    );
  }
}

/**
 * A write that matched zero rows.
 *
 * Lives in the domain rather than in the Drizzle adapter because it is a
 * business-meaningful outcome - somebody else changed this row first - and
 * because it lets the action layer translate it through `DomainError` without
 * importing persistence code.
 */
export class TodoWriteConflict extends DomainError {
  readonly code = "TODO_WRITE_CONFLICT";

  constructor() {
    super("A tarefa foi alterada por outra operação. Recarregue e tente de novo.");
  }
}

function normalizeTitle(raw: string): string {
  const title = raw.trim().replace(/\s+/g, " ");

  if (title.length === 0) throw new InvalidTitle("Informe um título.");
  if (title.length > TITLE_MAX_LENGTH) {
    throw new InvalidTitle(`O título deve ter no máximo ${TITLE_MAX_LENGTH} caracteres.`);
  }

  return title;
}

export function createTodo(input: {
  id: TodoId;
  ownerId: UserId;
  title: string;
  now: Date;
}): Todo {
  return {
    id: input.id,
    ownerId: input.ownerId,
    title: normalizeTitle(input.title),
    done: false,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

/** Returns the same reference when nothing changed, so callers can skip the write. */
export function renameTodo(todo: Todo, title: string, now: Date): Todo {
  const next = normalizeTitle(title);
  if (next === todo.title) return todo;
  return { ...todo, title: next, updatedAt: now };
}

export function setDone(todo: Todo, done: boolean, now: Date): Todo {
  if (todo.done === done) return todo;
  return { ...todo, done, updatedAt: now };
}

/**
 * Redundant with the RLS policies, on purpose. RLS is the last line of defense
 * inside the database; this is the check that produces a legible error and
 * that keeps working if Postgres policies ever stop being the enforcement
 * mechanism.
 */
export function assertOwnedBy(todo: Todo, userId: UserId): void {
  if (todo.ownerId !== userId) throw new TodoAccessDenied();
}

export function assertPendingLimit(pendingCount: number): void {
  if (pendingCount >= MAX_PENDING_TODOS) throw new PendingLimitReached();
}
