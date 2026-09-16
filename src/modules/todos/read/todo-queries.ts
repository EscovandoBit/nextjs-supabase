import "server-only";

import type { UserId } from "@/shared/domain/ids";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server";
import type { TodoQuery } from "../contracts/todo-query.contracts";
import { fetchTodoPage, type TodoPage } from "./todo-query-builder";

export type { TodoListItem, TodoPage } from "./todo-query-builder";

/**
 * Server-side entry to the display read path. Authorization is RLS: the
 * anon-key client carries the caller's JWT, so a policy violation returns zero
 * rows rather than somebody else's data.
 */
export async function listTodos(query: TodoQuery, ownerId: UserId): Promise<TodoPage> {
  const supabase = await createSupabaseServerClient();
  return fetchTodoPage(supabase, query, ownerId);
}
