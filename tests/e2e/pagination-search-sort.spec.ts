import { seedTodos } from "./support/admin";
import { expect, signIn, test, todoItem, todoList } from "./support/fixtures";

const TITLES = [
  "Alface",
  "Banana",
  "Cebola",
  "Damasco",
  "Espinafre",
  "Feijão",
  "Goiaba",
  "Hortelã",
  "Inhame",
  "Jaca",
  "Kiwi",
  "Limão",
];

test.describe("pagination, search and sorting", () => {
  test.beforeEach(async ({ page, accountA }) => {
    await seedTodos(accountA.id, TITLES);
    await signIn(page, accountA);
  });

  test("paginates with real links and marks the current page", async ({ page }) => {
    await page.goto("/todos?perPage=5&sort=title&dir=asc");

    await expect(todoList(page).getByRole("listitem")).toHaveCount(5);
    await expect(todoItem(page, "Alface")).toBeVisible();

    const nav = page.getByRole("navigation", { name: "Paginação" });
    await expect(nav.getByRole("link", { name: "Página 1" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await nav.getByRole("link", { name: "Próxima página" }).click();

    await expect(page).toHaveURL(/page=2/);
    await expect(todoItem(page, "Feijão")).toBeVisible();
    await expect(todoItem(page, "Alface")).toHaveCount(0);
  });

  test("never repeats a row across pages", async ({ page }) => {
    // The guard against a missing ORDER BY tiebreaker: with equal sort values
    // and an OFFSET, Postgres is free to return the same row on both pages.
    await page.goto("/todos?perPage=5&sort=title&dir=asc");
    const first = await todoList(page).getByRole("listitem").allInnerTexts();

    await page.goto("/todos?perPage=5&sort=title&dir=asc&page=2");
    const second = await todoList(page).getByRole("listitem").allInnerTexts();

    const overlap = first.filter((row) => second.includes(row));
    expect(overlap).toEqual([]);
  });

  test("honours a deep link to a sorted page", async ({ page }) => {
    await page.goto("/todos?page=2&sort=title&dir=asc&perPage=5");

    await expect(page.getByRole("heading", { name: "Minhas tarefas" })).toBeVisible();
    await expect(todoItem(page, "Feijão")).toBeVisible();
    await expect(page.getByLabel("Ordenar por")).toHaveValue("title");
    await expect(page.getByLabel("Direção")).toHaveValue("asc");
  });

  test("falls back to sane values for a hand-edited URL", async ({ page }) => {
    await page.goto("/todos?page=abc&sort=DROP+TABLE&dir=sideways&perPage=99999");

    await expect(page.getByRole("heading", { name: "Minhas tarefas" })).toBeVisible();
    await expect(page.getByLabel("Ordenar por")).toHaveValue("createdAt");
    await expect(page.getByLabel("Direção")).toHaveValue("desc");
    await expect(page.getByLabel("Por página")).toHaveValue("10");
  });

  test("searches by title and reports the count", async ({ page }) => {
    await page.goto("/todos");
    await page.getByLabel("Buscar").fill("Banana");

    await expect(page).toHaveURL(/q=Banana/);
    await expect(todoItem(page, "Banana")).toBeVisible();
    await expect(
      page.getByRole("status", { name: "Resultados da busca" }),
    ).toHaveText("1 tarefa encontrada");
  });

  test("treats a percent sign as literal text rather than a wildcard", async ({
    page,
    accountA,
  }) => {
    await seedTodos(accountA.id, ["Desconto de 50% na loja"]);
    await page.goto("/todos");

    await page.getByLabel("Buscar").fill("50%");

    await expect(todoItem(page, "Desconto de 50%")).toBeVisible();
    // Unescaped, "%" would match every row in the table.
    await expect(
      page.getByRole("status", { name: "Resultados da busca" }),
    ).toHaveText("1 tarefa encontrada");
  });

  test("returns to page 1 whenever a filter changes", async ({ page }) => {
    await page.goto("/todos?perPage=5&page=3");
    await expect(page).toHaveURL(/page=3/);

    await page.getByLabel("Situação").selectOption("done");

    // The classic bug of this feature combination: filtering from page 3 and
    // landing on an empty result that looks like "no matches".
    await expect(page).toHaveURL(/status=done/);
    await expect(page).not.toHaveURL(/page=3/);
  });

  test("filters by status", async ({ page, accountA }) => {
    await seedTodos(accountA.id, ["Ainda pendente"], { done: false });
    await page.goto("/todos?status=pending");

    await expect(todoItem(page, "Ainda pendente")).toBeVisible();
    await expect(todoItem(page, "Alface")).toHaveCount(0);
  });

  test("explains an empty page past the end and offers a way back", async ({ page }) => {
    await page.goto("/todos?page=99");

    await expect(page.getByText("Nada nesta página.")).toBeVisible();
    await page.getByRole("link", { name: "Voltar para a primeira" }).click();
    await expect(todoList(page).getByRole("listitem").first()).toBeVisible();
  });
});
