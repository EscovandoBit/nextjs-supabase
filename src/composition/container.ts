import "server-only";

import { randomUUID } from "node:crypto";
import { cache } from "react";

import { CreateTodo } from "@/modules/todos/application/create-todo";
import { DeleteTodo } from "@/modules/todos/application/delete-todo";
import { RenameTodo } from "@/modules/todos/application/rename-todo";
import { ToggleTodo } from "@/modules/todos/application/toggle-todo";
import type { Clock, IdGenerator, TodoUseCaseDeps } from "@/modules/todos/domain/ports";
import type { TodoId } from "@/shared/domain/ids";
import type { AuthenticatedSession } from "@/shared/domain/session";
import { getDb } from "@/shared/infrastructure/db/pool";
import { RlsUnitOfWork } from "@/shared/infrastructure/db/rls-unit-of-work";

// Stateless, so module singletons. Ports rather than direct `new Date()` calls
// so the "no-op when unchanged" branches stay testable without faking time.
const systemClock: Clock = { now: () => new Date() };
const uuidGenerator: IdGenerator = { nextTodoId: () => randomUUID() as TodoId };

export type Container = {
  readonly createTodo: CreateTodo;
  readonly renameTodo: RenameTodo;
  readonly toggleTodo: ToggleTodo;
  readonly deleteTodo: DeleteTodo;
};

/**
 * The only module that knows concrete adapter types.
 *
 * The graph is per-request rather than a singleton because the unit of work
 * carries this user's verified session. Memoized on the session object, which
 * `verifySession()` makes stable within a request, so a page and an action in
 * the same request share one instance.
 */
export const containerFor = cache((session: AuthenticatedSession): Container => {
  const deps: TodoUseCaseDeps = {
    uow: new RlsUnitOfWork(getDb(), session),
    clock: systemClock,
    ids: uuidGenerator,
    user: { id: session.userId },
  };

  return {
    createTodo: new CreateTodo(deps),
    renameTodo: new RenameTodo(deps),
    toggleTodo: new ToggleTodo(deps),
    deleteTodo: new DeleteTodo(deps),
  };
});
