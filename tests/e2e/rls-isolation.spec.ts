import { seedTodos } from "./support/admin";
import { expect, signIn, test, todoItem, todoList } from "./support/fixtures";

/**
 * The suite that matters most. Everything else is a feature; this is the
 * promise that one user's data is not another's.
 */
test.describe("isolation between users", () => {
  test("does not show one user's task to another", async ({ page, accountA, accountB }) => {
    await seedTodos(accountA.id, ["Segredo da Alice"]);
    await seedTodos(accountB.id, ["Coisa do Bob"]);

    await signIn(page, accountB);

    await expect(todoItem(page, "Coisa do Bob")).toBeVisible();
    await expect(todoItem(page, "Segredo da Alice")).toHaveCount(0);
  });

  test("does not leak another user's task through the search box", async ({
    page,
    accountA,
    accountB,
  }) => {
    await seedTodos(accountA.id, ["Termo exclusivo da Alice"]);
    await signIn(page, accountB);

    await page.getByLabel("Buscar").fill("exclusivo da Alice");

    await expect(
      page.getByRole("status", { name: "Resultados da busca" }),
    ).toHaveText("0 tarefas encontradas");
    await expect(todoList(page)).toBeHidden();
  });

  test("leaves one user's task untouched while another works in parallel", async ({
    browser,
    accountA,
    accountB,
  }) => {
    await seedTodos(accountA.id, ["Intocada"], { done: false });

    const aliceContext = await browser.newContext();
    const alicePage = await aliceContext.newPage();
    await signIn(alicePage, accountA);
    await expect(todoItem(alicePage, "Intocada")).toBeVisible();

    const bobContext = await browser.newContext();
    const bobPage = await bobContext.newPage();
    await signIn(bobPage, accountB);

    // Bob has a full session and exercises the same actions on his own data.
    await bobPage.getByLabel("Nova tarefa").fill("Coisa do Bob");
    await bobPage.getByRole("button", { name: "Adicionar" }).click();
    await expect(todoItem(bobPage, "Coisa do Bob")).toBeVisible();
    await expect(todoItem(bobPage, "Intocada")).toHaveCount(0);

    // Alice's row is byte-for-byte unchanged.
    await alicePage.reload();
    const toggle = todoItem(alicePage, "Intocada")
      .getByRole("button", { name: /Intocada/ })
      .first();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");

    await aliceContext.close();
    await bobContext.close();
  });

  // Forging another user's todo id against the Server Action cannot be driven
  // from a browser: the id never reaches Bob's DOM, which is itself part of the
  // defense. That case is covered where a session can be constructed directly -
  // see "turns a cross-user rename into an error" in
  // tests/integration/rls-unit-of-work.test.ts.

  test("keeps the pending limit per user rather than global", async ({
    page,
    accountA,
    accountB,
  }) => {
    await seedTodos(accountA.id, ["A1", "A2", "A3", "A4", "A5"], { done: false });

    await signIn(page, accountB);
    await page.getByLabel("Nova tarefa").fill("Do Bob, tranquilo");
    await page.getByRole("button", { name: "Adicionar" }).click();

    await expect(todoItem(page, "Do Bob, tranquilo")).toBeVisible();
  });
});
