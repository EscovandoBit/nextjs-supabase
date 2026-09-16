import { z } from "zod";

/**
 * The allowlist of sortable fields. This is a security boundary, not a
 * convenience: a sort column interpolated from user input is an injection
 * vector, so the raw string never reaches the query builder. Same discipline
 * as the role allowlist in the unit of work.
 */
export const SORT_FIELDS = ["createdAt", "updatedAt", "title"] as const;
export type SortField = (typeof SORT_FIELDS)[number];

export const STATUS_FILTERS = ["all", "pending", "done"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export const SORT_DIRECTIONS = ["asc", "desc"] as const;

export const DEFAULT_PER_PAGE = 10;
export const PER_PAGE_OPTIONS = [5, 10, 20, 50] as const;
export const SEARCH_MAX_LENGTH = 80;

/**
 * Every field carries `.catch()`, which is the opposite of how the write
 * contracts behave, and deliberately so. People edit URLs by hand, so
 * `?page=abc` must render page 1 rather than a 500. In a Server Action the
 * same input is a sign of a bug or an attack and fails loudly.
 */
export const TodoQueryParams = z.object({
  q: z
    .string()
    .trim()
    .max(SEARCH_MAX_LENGTH)
    // `?q=` should behave as "no filter", not as a match-everything pattern.
    .transform((value) => (value.length === 0 ? undefined : value))
    .optional()
    .catch(undefined),
  status: z.enum(STATUS_FILTERS).default("all").catch("all"),
  sort: z.enum(SORT_FIELDS).default("createdAt").catch("createdAt"),
  dir: z.enum(SORT_DIRECTIONS).default("desc").catch("desc"),
  page: z.coerce.number().int().min(1).max(10_000).default(1).catch(1),
  perPage: z.coerce
    .number()
    .int()
    .min(PER_PAGE_OPTIONS[0])
    .max(50)
    .default(DEFAULT_PER_PAGE)
    .catch(DEFAULT_PER_PAGE),
});

export type TodoQuery = z.output<typeof TodoQueryParams>;

export type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseTodoQuery(raw: RawSearchParams): TodoQuery {
  return TodoQueryParams.parse({
    q: firstValue(raw.q),
    status: firstValue(raw.status),
    sort: firstValue(raw.sort),
    dir: firstValue(raw.dir),
    page: firstValue(raw.page),
    perPage: firstValue(raw.perPage),
  });
}

/**
 * Serializes a query back into a search string, omitting defaults so the URL
 * stays readable.
 *
 * Changing any filter resets `page` to 1. Forgetting that is the classic bug
 * of this feature combination: you search from page 4 and land on an empty
 * result set that looks like "no matches".
 */
export function buildTodoQueryString(
  current: TodoQuery,
  overrides: Partial<TodoQuery> = {},
): string {
  const next: TodoQuery = { ...current, ...overrides };

  const filterKeys = ["q", "status", "sort", "dir", "perPage"] as const;
  const filterChanged = filterKeys.some((key) => key in overrides);
  if (filterChanged && overrides.page === undefined) next.page = 1;

  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.status !== "all") params.set("status", next.status);
  if (next.sort !== "createdAt") params.set("sort", next.sort);
  if (next.dir !== "desc") params.set("dir", next.dir);
  if (next.page !== 1) params.set("page", String(next.page));
  if (next.perPage !== DEFAULT_PER_PAGE) params.set("perPage", String(next.perPage));

  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

/**
 * `%` and `_` are ILIKE wildcards. Unescaped, a user typing `%` matches every
 * row - not a security hole, but a search box that silently lies.
 */
export function escapeLikePattern(term: string): string {
  return term.replace(/[\\%_]/g, "\\$&");
}
