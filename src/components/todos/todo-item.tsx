"use client";

import { useId, useRef, useState } from "react";

import { cn } from "@/components/ui/cn";
import { TITLE_MAX_LENGTH } from "@/modules/todos/domain/todo";
import type { TodoListItem } from "@/modules/todos/read/todo-query-builder";

/**
 * Item mutations require JavaScript, which is the one deliberate gap in this
 * app's progressive enhancement. The optimistic overlay lives in the parent
 * list, and driving it needs a client transition. Creating todos, filtering,
 * searching and paginating all still work without JavaScript.
 */
export function TodoItem({
  todo,
  onToggle,
  onRename,
  onDelete,
}: {
  todo: TodoListItem;
  onToggle: () => Promise<void>;
  onRename: (title: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const editId = useId();

  return (
    <li className="rounded-md border border-line bg-surface-raised px-3 py-2.5">
      {editing ? (
        <form
          className="flex items-center gap-2"
          action={async (formData) => {
            const title = String(formData.get("title") ?? "").trim();
            if (title.length === 0 || title === todo.title) {
              setEditing(false);
              return;
            }
            setEditing(false);
            await onRename(title);
          }}
        >
          <label htmlFor={editId} className="sr-only">
            Novo título para {todo.title}
          </label>
          <input
            ref={inputRef}
            id={editId}
            name="title"
            defaultValue={todo.title}
            maxLength={TITLE_MAX_LENGTH}
            autoFocus
            onKeyDown={(event) => {
              if (event.key === "Escape") setEditing(false);
            }}
            className="flex-1 rounded-md border border-line bg-surface px-2 py-1 text-sm"
          />
          <button type="submit" className="rounded-md border border-line px-2.5 py-1 text-sm">
            Salvar
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-md px-2.5 py-1 text-sm text-ink-muted"
          >
            Cancelar
          </button>
        </form>
      ) : (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void onToggle()}
            aria-pressed={todo.done}
            className="rounded-md border border-line px-2.5 py-1 text-xs"
          >
            {todo.done ? "Concluída" : "Pendente"}
            {/* Distinguishes otherwise identical buttons when navigating by
                element list in a screen reader. */}
            <span className="sr-only"> — {todo.title}</span>
          </button>

          <span
            className={cn(
              "flex-1 text-sm",
              todo.done && "text-ink-muted line-through",
            )}
          >
            {todo.title}
          </span>

          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-md px-2 py-1 text-sm text-ink-muted hover:text-ink"
          >
            Editar<span className="sr-only"> {todo.title}</span>
          </button>

          <button
            type="button"
            onClick={() => void onDelete()}
            className="rounded-md px-2 py-1 text-sm text-danger"
          >
            Excluir<span className="sr-only"> {todo.title}</span>
          </button>
        </div>
      )}
    </li>
  );
}
