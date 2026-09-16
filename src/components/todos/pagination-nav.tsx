import Link from "next/link";

import { cn } from "@/components/ui/cn";
import {
  buildTodoQueryString,
  type TodoQuery,
} from "@/modules/todos/contracts/todo-query.contracts";

/**
 * A Server Component on purpose: real `<a>` elements, so pagination works with
 * JavaScript disabled and every page is a shareable URL.
 */
export function PaginationNav({
  query,
  totalPages,
  pathname = "/todos",
}: {
  query: TodoQuery;
  totalPages: number;
  pathname?: string;
}) {
  if (totalPages <= 1) return null;

  const pages = pageWindow(query.page, totalPages);
  const href = (page: number) => `${pathname}${buildTodoQueryString(query, { page })}`;

  return (
    <nav aria-label="Paginação" className="mt-6 flex items-center justify-between gap-2">
      <PageLink
        href={href(query.page - 1)}
        disabled={query.page <= 1}
        label="Página anterior"
      >
        Anterior
      </PageLink>

      <ol className="flex items-center gap-1">
        {pages.map((page, index) =>
          page === null ? (
            <li
              key={`gap-${index}`}
              aria-hidden="true"
              className="px-1 text-sm text-ink-muted"
            >
              &hellip;
            </li>
          ) : (
            <li key={page}>
              <Link
                href={href(page)}
                aria-current={page === query.page ? "page" : undefined}
                aria-label={`Página ${page}`}
                className={cn(
                  "block min-w-9 rounded-md border px-2 py-1.5 text-center text-sm",
                  page === query.page
                    ? "border-accent font-medium text-accent"
                    : "border-line text-ink-muted hover:text-ink",
                )}
              >
                {page}
              </Link>
            </li>
          ),
        )}
      </ol>

      <PageLink
        href={href(query.page + 1)}
        disabled={query.page >= totalPages}
        label="Próxima página"
      >
        Próxima
      </PageLink>
    </nav>
  );
}

function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  if (disabled) {
    // A span rather than a disabled link: there is no such thing as a disabled
    // anchor, and aria-disabled on a focusable link that still navigates lies.
    return (
      <span aria-hidden="true" className="rounded-md px-3 py-1.5 text-sm text-ink-muted opacity-40">
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={label}
      className="rounded-md border border-line px-3 py-1.5 text-sm hover:text-ink"
    >
      {children}
    </Link>
  );
}

/** First, last, current and its neighbours; `null` renders an ellipsis. */
function pageWindow(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);

  const pages = new Set<number>([1, total, current]);
  if (current - 1 > 1) pages.add(current - 1);
  if (current + 1 < total) pages.add(current + 1);

  const sorted = [...pages].sort((a, b) => a - b);
  const result: (number | null)[] = [];

  for (const [index, page] of sorted.entries()) {
    const previous = sorted[index - 1];
    if (previous !== undefined && page - previous > 1) result.push(null);
    result.push(page);
  }

  return result;
}
