"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";

import {
  buildTodoQueryString,
  PER_PAGE_OPTIONS,
  SEARCH_MAX_LENGTH,
  type SortField,
  type StatusFilter,
  type TodoQuery,
} from "@/modules/todos/contracts/todo-query.contracts";

const SORT_LABELS: Record<SortField, string> = {
  createdAt: "Criação",
  updatedAt: "Atualização",
  title: "Título",
};

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "Todas",
  pending: "Pendentes",
  done: "Concluídas",
};

export function TodoFilters({ query, total }: { query: TodoQuery; total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const [term, setTerm] = useState(query.q ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const baseId = useId();
  const searchId = `${baseId}-search`;
  const statusId = `${baseId}-status`;
  const sortId = `${baseId}-sort`;
  const dirId = `${baseId}-dir`;
  const perPageId = `${baseId}-per-page`;

  // Keep the input in sync when navigation changes the URL (back button,
  // deep link) without fighting the user mid-typing.
  useEffect(() => {
    setTerm(query.q ?? "");
  }, [query.q]);

  // `buildTodoQueryString` resets page to 1 for any filter change, so none of
  // these callers has to remember to.
  function navigate(overrides: Partial<TodoQuery>) {
    const search = buildTodoQueryString(query, overrides);
    startTransition(() => {
      router.replace(`${pathname}${search}`, { scroll: false });
    });
  }

  function onSearchChange(value: string) {
    setTerm(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const trimmed = value.trim();
      navigate({ q: trimmed.length === 0 ? undefined : trimmed });
    }, 300);
  }

  return (
    <section aria-label="Filtros" className="mt-6 space-y-3" aria-busy={isPending}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1 space-y-1.5">
          <label htmlFor={searchId} className="block text-sm font-medium">
            Buscar
          </label>
          <input
            id={searchId}
            type="search"
            name="q"
            value={term}
            maxLength={SEARCH_MAX_LENGTH}
            placeholder="Título da tarefa"
            onChange={(event) => onSearchChange(event.currentTarget.value)}
            className="w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm placeholder:text-ink-muted"
          />
        </div>

        <Select
          id={statusId}
          label="Situação"
          value={query.status}
          options={Object.entries(STATUS_LABELS)}
          onChange={(value) => navigate({ status: value as StatusFilter })}
        />

        <Select
          id={sortId}
          label="Ordenar por"
          value={query.sort}
          options={Object.entries(SORT_LABELS)}
          onChange={(value) => navigate({ sort: value as SortField })}
        />

        <Select
          id={dirId}
          label="Direção"
          value={query.dir}
          options={[
            ["desc", "Decrescente"],
            ["asc", "Crescente"],
          ]}
          onChange={(value) => navigate({ dir: value as "asc" | "desc" })}
        />

        <Select
          id={perPageId}
          label="Por página"
          value={String(query.perPage)}
          options={PER_PAGE_OPTIONS.map((size) => [String(size), String(size)])}
          onChange={(value) => navigate({ perPage: Number(value) })}
        />
      </div>

      {/* Named so it is addressable: several live regions coexist on this page. */}
      <p
        role="status"
        aria-live="polite"
        aria-label="Resultados da busca"
        className="text-sm text-ink-muted"
      >
        {total === 1 ? "1 tarefa encontrada" : `${total} tarefas encontradas`}
      </p>
    </section>
  );
}

function Select({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="rounded-md border border-line bg-surface-raised px-3 py-2 text-sm"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}
