import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/shared/infrastructure/supabase/database.types";
import {
  escapeLikePattern,
  type SortField,
  type TodoQuery,
} from "../contracts/todo-query.contracts";

/**
 * Shared by the Server Component (initial render) and the browser (Realtime
 * refetch). Deliberately one implementation: if the two drifted, the tiebreaker
 * or the wildcard escaping would differ and the list would change contents
 * depending on who fetched it.
 *
 * Not `server-only` - the browser imports this on purpose.
 */
const COLUMN: Record<SortField, string> = {
  createdAt: "created_at",
  updatedAt: "updated_at",
  title: "title",
};

/** ISO strings rather than Date: these cross into client components. */
export type TodoListItem = {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TodoPage = {
  items: TodoListItem[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
};

export async function fetchTodoPage(
  supabase: SupabaseClient<Database>,
  query: TodoQuery,
  ownerId: string,
): Promise<TodoPage> {
  const offset = (query.page - 1) * query.perPage;

  let builder = supabase
    .from("todos")
    .select("id,title,done,created_at,updated_at", { count: "exact" })
    // RLS already restricts this to the caller. Filtering explicitly is
    // defense in depth, and makes use of the (user_id, ...) indexes a
    // certainty rather than a hope about how the planner treats the policy.
    .eq("user_id", ownerId)
    .order(COLUMN[query.sort], { ascending: query.dir === "asc" })
    // Mandatory tiebreaker. Without it, offset pagination duplicates and skips
    // rows whenever sort values tie - and titles tie constantly.
    .order("id", { ascending: true })
    .range(offset, offset + query.perPage - 1);

  if (query.status !== "all") {
    builder = builder.eq("done", query.status === "done");
  }

  if (query.q) {
    builder = builder.ilike("title", `%${escapeLikePattern(query.q)}%`);
  }

  const { data, error, count } = await builder;

  if (error) {
    throw new Error(`Falha ao listar tarefas: ${error.message}`);
  }

  const total = count ?? 0;

  return {
    items: (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      done: row.done,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    total,
    page: query.page,
    perPage: query.perPage,
    // `count: "exact"` is a full count, fine here because RLS scopes it to one
    // user. At real volume, switch to "planned" or "estimated".
    totalPages: Math.max(1, Math.ceil(total / query.perPage)),
  };
}
