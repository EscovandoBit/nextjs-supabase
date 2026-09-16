"use server";

import {
  CreateTodoInput,
  DeleteTodoInput,
  RenameTodoInput,
  ToggleTodoInput,
} from "@/modules/todos/contracts/todo.contracts";
import type { TodoId } from "@/shared/domain/ids";
import { authenticatedAction } from "./authenticated-action";

/**
 * Every export in this file is a public HTTP endpoint with a stable id.
 * Authorization lives inside `authenticatedAction`, which is why no action is
 * written by hand here.
 *
 * Note the absence of `revalidatePath`. These routes are dynamic (they depend
 * on `cookies()`), so the Server Component re-renders with fresh rows after an
 * action anyway, which covers the no-JavaScript path. With JavaScript, the
 * Realtime refetch is the update channel; doing both would fight the optimistic
 * state and update the list twice.
 */
export const createTodoAction = authenticatedAction({
  input: CreateTodoInput,
  successMessage: "Tarefa criada.",
  execute: async (input, { useCases }) => {
    const todo = await useCases.createTodo.execute({ title: input.title });
    return { id: todo.id as string };
  },
});

export const renameTodoAction = authenticatedAction({
  input: RenameTodoInput,
  successMessage: "Tarefa renomeada.",
  execute: async (input, { useCases }) => {
    const todo = await useCases.renameTodo.execute({
      id: input.id as TodoId,
      title: input.title,
    });
    return { id: todo.id as string };
  },
});

export const toggleTodoAction = authenticatedAction({
  input: ToggleTodoInput,
  successMessage: "Tarefa atualizada.",
  execute: async (input, { useCases }) => {
    const todo = await useCases.toggleTodo.execute({
      id: input.id as TodoId,
      done: input.done,
    });
    return { id: todo.id as string };
  },
});

export const deleteTodoAction = authenticatedAction({
  input: DeleteTodoInput,
  successMessage: "Tarefa removida.",
  execute: async (input, { useCases }) => {
    const result = await useCases.deleteTodo.execute({ id: input.id as TodoId });
    return { id: result.id as string };
  },
});
