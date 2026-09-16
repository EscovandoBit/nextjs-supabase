"use client";

import { useCallback, useEffect, useOptimistic, useRef, useState } from "react";

import { formError, idleActionState, type ActionState } from "@/actions/action-state";
import {
  deleteTodoAction,
  renameTodoAction,
  toggleTodoAction,
} from "@/actions/todo.actions";
import { TodoItem } from "@/components/todos/todo-item";
import type { TodoQuery } from "@/modules/todos/contracts/todo-query.contracts";
import { fetchTodoPage, type TodoListItem, type TodoPage } from "@/modules/todos/read/todo-query-builder";
import { createSupabaseBrowserClient } from "@/shared/infrastructure/supabase/browser";

const REALTIME_DEBOUNCE_MS = 250;

type OptimisticOp =
  | { type: "toggle"; id: string; done: boolean }
  | { type: "rename"; id: string; title: string }
  | { type: "remove"; id: string };

function applyOp(items: readonly TodoListItem[], op: OptimisticOp): TodoListItem[] {
  switch (op.type) {
    case "toggle":
      return items.map((item) => (item.id === op.id ? { ...item, done: op.done } : item));
    case "rename":
      return items.map((item) => (item.id === op.id ? { ...item, title: op.title } : item));
    case "remove":
      return items.filter((item) => item.id !== op.id);
  }
}

const idle = idleActionState as ActionState<{ id: string }>;

export function TodoList({
  initialPage,
  query,
  userId,
}: {
  initialPage: TodoPage;
  query: TodoQuery;
  userId: string;
}) {
  const [page, setPage] = useState(initialPage);
  const [optimisticItems, addOp] = useOptimistic(page.items, applyOp);
  const [error, setError] = useState<string | null>(null);

  const errorRef = useRef<HTMLDivElement>(null);

  // The server re-renders after every action (these routes are dynamic), so
  // fresh props are authoritative and replace local state.
  useEffect(() => {
    setPage(initialPage);
  }, [initialPage]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const refetch = useCallback(async () => {
    try {
      const supabase = createSupabaseBrowserClient();
      setPage(await fetchTodoPage(supabase, query, userId));
    } catch {
      // A failed background refresh should not replace the list with an error.
      // The next event, or the next navigation, will reconcile.
    }
  }, [query, userId]);

  // Held in a ref so the subscription below depends only on the user, instead
  // of tearing down and rebuilding the channel on every filter change.
  const refetchRef = useRef(refetch);
  useEffect(() => {
    refetchRef.current = refetch;
  }, [refetch]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    // Debounced: a burst of writes should cost one round-trip, not one each.
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        void refetchRef.current();
      }, REALTIME_DEBOUNCE_MS);
    };

    const channelPromise = (async () => {
      // Required for Realtime Authorization. Without it the private channel
      // join is rejected.
      await supabase.realtime.setAuth();
      if (cancelled) return undefined;

      return supabase
        .channel(`todos:${userId}`, { config: { private: true } })
        .on("broadcast", { event: "INSERT" }, schedule)
        .on("broadcast", { event: "UPDATE" }, schedule)
        .on("broadcast", { event: "DELETE" }, schedule)
        .subscribe((status) => {
          // Reseed on every successful (re)subscribe. A dropped socket would
          // otherwise leave the list showing rows from before the outage.
          if (status === "SUBSCRIBED") schedule();
        });
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      void channelPromise.then((channel) => {
        if (channel) void supabase.removeChannel(channel);
      });
    };
  }, [userId]);

  /**
   * Applies the change optimistically, calls the action, then commits it
   * locally on success. Committing matters: `useOptimistic` discards its
   * overlay when the transition ends, so without it the row would visibly
   * snap back until the Realtime refetch arrived.
   */
  async function mutate(
    op: OptimisticOp,
    call: () => Promise<ActionState<{ id: string }>>,
    onCommit?: (current: TodoPage) => TodoPage,
  ) {
    addOp(op);
    const result = await call();

    if (result.status === "error") {
      setError(formError(result) ?? "Não foi possível concluir.");
      return;
    }

    setError(null);
    setPage((current) => {
      const next = { ...current, items: applyOp(current.items, op) };
      return onCommit ? onCommit(next) : next;
    });
  }

  function onToggle(item: TodoListItem) {
    const done = !item.done;
    return mutate({ type: "toggle", id: item.id, done }, () => {
      const formData = new FormData();
      formData.set("id", item.id);
      formData.set("done", String(done));
      return toggleTodoAction(idle, formData);
    });
  }

  function onRename(item: TodoListItem, title: string) {
    return mutate({ type: "rename", id: item.id, title }, () => {
      const formData = new FormData();
      formData.set("id", item.id);
      formData.set("title", title);
      return renameTodoAction(idle, formData);
    });
  }

  function onDelete(item: TodoListItem) {
    return mutate(
      { type: "remove", id: item.id },
      () => {
        const formData = new FormData();
        formData.set("id", item.id);
        return deleteTodoAction(idle, formData);
      },
      (current) => ({ ...current, total: Math.max(0, current.total - 1) }),
    );
  }

  if (optimisticItems.length === 0) {
    return (
      <>
        <ErrorRegion ref={errorRef} message={error} />
        <EmptyState query={query} />
      </>
    );
  }

  return (
    <>
      <ErrorRegion ref={errorRef} message={error} />

      <ul aria-label="Lista de tarefas" className="mt-4 space-y-2">
        {optimisticItems.map((item) => (
          <TodoItem
            key={item.id}
            todo={item}
            onToggle={() => onToggle(item)}
            onRename={(title) => onRename(item, title)}
            onDelete={() => onDelete(item)}
          />
        ))}
      </ul>
    </>
  );
}

function ErrorRegion({
  ref,
  message,
}: {
  ref: React.RefObject<HTMLDivElement | null>;
  message: string | null;
}) {
  if (!message) return null;

  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      className="mt-4 rounded-md border border-danger bg-danger-surface px-3 py-2 text-sm text-danger"
    >
      {message}
    </div>
  );
}

function EmptyState({ query }: { query: TodoQuery }) {
  const filtered = Boolean(query.q) || query.status !== "all";
  const beyondEnd = query.page > 1;

  return (
    <p className="mt-6 text-sm text-ink-muted">
      {beyondEnd ? (
        <>
          Nada nesta página.{" "}
          <a href="/todos" className="underline">
            Voltar para a primeira
          </a>
          .
        </>
      ) : filtered ? (
        "Nenhuma tarefa corresponde aos filtros."
      ) : (
        "Nenhuma tarefa ainda. Crie a primeira acima."
      )}
    </p>
  );
}
