import { signOutAction } from "@/actions/public/auth.actions";
import { PaginationNav } from "@/components/todos/pagination-nav";
import { TodoFilters } from "@/components/todos/todo-filters";
import { TodoForm } from "@/components/todos/todo-form";
import { TodoList } from "@/components/todos/todo-list";
import {
  parseTodoQuery,
  type RawSearchParams,
} from "@/modules/todos/contracts/todo-query.contracts";
import { listTodos } from "@/modules/todos/read/todo-queries";
import { verifySession } from "@/shared/infrastructure/auth/verify-session";

export default async function TodosPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  // Reads are authenticated too. `proxy.ts` already redirected anonymous
  // traffic, but that is UX; this is the check that actually holds.
  const session = await verifySession();

  const query = parseTodoQuery(await searchParams);

  // Straight to PostgREST under RLS: no use case, no port, no pool connection.
  const page = await listTodos(query, session.userId);

  return (
    <main id="conteudo" className="mx-auto max-w-2xl p-6 pb-16">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Minhas tarefas</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {page.total === 0
              ? "Nenhuma tarefa cadastrada"
              : `${page.total} no total, página ${page.page} de ${page.totalPages}`}
          </p>
        </div>

        <form action={signOutAction}>
          <button type="submit" className="text-sm text-ink-muted underline hover:text-ink">
            Sair
          </button>
        </form>
      </header>

      <TodoForm />

      <TodoFilters query={query} total={page.total} />

      <TodoList initialPage={page} query={query} userId={session.userId} />

      <PaginationNav query={query} totalPages={page.totalPages} />
    </main>
  );
}
