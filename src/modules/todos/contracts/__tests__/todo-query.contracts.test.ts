import { describe, expect, it } from "vitest";

import {
  buildTodoQueryString,
  DEFAULT_PER_PAGE,
  escapeLikePattern,
  parseTodoQuery,
  SEARCH_MAX_LENGTH,
} from "../todo-query.contracts";

describe("parseTodoQuery", () => {
  it("applies defaults for an empty query string", () => {
    expect(parseTodoQuery({})).toEqual({
      q: undefined,
      status: "all",
      sort: "createdAt",
      dir: "desc",
      page: 1,
      perPage: DEFAULT_PER_PAGE,
    });
  });

  it("falls back instead of throwing on a hand-edited URL", () => {
    const parsed = parseTodoQuery({
      page: "abc",
      perPage: "9999",
      sort: "'; drop table todos; --",
      dir: "sideways",
      status: "maybe",
    });

    expect(parsed.page).toBe(1);
    expect(parsed.perPage).toBe(DEFAULT_PER_PAGE);
    expect(parsed.sort).toBe("createdAt");
    expect(parsed.dir).toBe("desc");
    expect(parsed.status).toBe("all");
  });

  it("clamps a page below the minimum", () => {
    expect(parseTodoQuery({ page: "0" }).page).toBe(1);
    expect(parseTodoQuery({ page: "-4" }).page).toBe(1);
  });

  it("treats an empty search term as no filter", () => {
    expect(parseTodoQuery({ q: "" }).q).toBeUndefined();
    expect(parseTodoQuery({ q: "   " }).q).toBeUndefined();
  });

  it("trims the search term and rejects one that is too long", () => {
    expect(parseTodoQuery({ q: "  leite  " }).q).toBe("leite");
    expect(parseTodoQuery({ q: "x".repeat(SEARCH_MAX_LENGTH + 1) }).q).toBeUndefined();
  });

  it("takes the first value when a param is repeated", () => {
    expect(parseTodoQuery({ sort: ["title", "createdAt"] }).sort).toBe("title");
  });

  it("accepts every valid combination", () => {
    const parsed = parseTodoQuery({
      q: "leite",
      status: "pending",
      sort: "title",
      dir: "asc",
      page: "3",
      perPage: "20",
    });

    expect(parsed).toEqual({
      q: "leite",
      status: "pending",
      sort: "title",
      dir: "asc",
      page: 3,
      perPage: 20,
    });
  });
});

describe("buildTodoQueryString", () => {
  const base = parseTodoQuery({});

  it("omits default values to keep the URL readable", () => {
    expect(buildTodoQueryString(base)).toBe("");
  });

  it("resets the page whenever a filter changes", () => {
    const onPageFour = parseTodoQuery({ page: "4" });

    expect(buildTodoQueryString(onPageFour, { q: "leite" })).toBe("?q=leite");
    expect(buildTodoQueryString(onPageFour, { status: "done" })).toBe("?status=done");
    expect(buildTodoQueryString(onPageFour, { sort: "title" })).toBe("?sort=title");
    expect(buildTodoQueryString(onPageFour, { dir: "asc" })).toBe("?dir=asc");
    expect(buildTodoQueryString(onPageFour, { perPage: 20 })).toBe("?perPage=20");
  });

  it("keeps the page when only the page changes", () => {
    const filtered = parseTodoQuery({ q: "leite", sort: "title" });

    expect(buildTodoQueryString(filtered, { page: 3 })).toBe("?q=leite&sort=title&page=3");
  });

  it("preserves unrelated filters when one changes", () => {
    const filtered = parseTodoQuery({ q: "leite", status: "pending", page: "2" });

    expect(buildTodoQueryString(filtered, { dir: "asc" })).toBe(
      "?q=leite&status=pending&dir=asc",
    );
  });
});

describe("escapeLikePattern", () => {
  it("escapes ILIKE wildcards so they match literally", () => {
    expect(escapeLikePattern("100%")).toBe("100\\%");
    expect(escapeLikePattern("a_b")).toBe("a\\_b");
    expect(escapeLikePattern("back\\slash")).toBe("back\\\\slash");
  });

  it("leaves ordinary text untouched", () => {
    expect(escapeLikePattern("comprar leite")).toBe("comprar leite");
  });
});
