import { expect, signIn, test, todoItem } from "./support/fixtures";

test.describe("realtime", () => {
  test("shows a task created in one tab inside another", async ({ browser, accountA }) => {
    const context = await browser.newContext();
    const first = await context.newPage();
    const second = await context.newPage();

    await signIn(first, accountA);
    await signIn(second, accountA);

    await first.getByLabel("Nova tarefa").fill("Criada na primeira aba");
    await first.getByRole("button", { name: "Adicionar" }).click();
    await expect(todoItem(first, "Criada na primeira aba")).toBeVisible();

    // No polling and no navigation in the second tab: the broadcast trigger
    // fires, the private channel delivers it, and the list refetches.
    await expect(todoItem(second, "Criada na primeira aba")).toBeVisible({ timeout: 15_000 });

    await context.close();
  });

  test("propagates a deletion", async ({ browser, accountA }) => {
    const context = await browser.newContext();
    const first = await context.newPage();
    const second = await context.newPage();

    await signIn(first, accountA);
    await first.getByLabel("Nova tarefa").fill("Some daqui");
    await first.getByRole("button", { name: "Adicionar" }).click();
    await expect(todoItem(first, "Some daqui")).toBeVisible();

    await signIn(second, accountA);
    await expect(todoItem(second, "Some daqui")).toBeVisible();

    await first
      .getByRole("listitem")
      .filter({ hasText: "Some daqui" })
      .getByRole("button", { name: /^Excluir/ })
      .click();

    await expect(todoItem(second, "Some daqui")).toHaveCount(0, { timeout: 15_000 });

    await context.close();
  });

  test("does not deliver one user's broadcast to another", async ({
    browser,
    accountA,
    accountB,
  }) => {
    const aliceContext = await browser.newContext();
    const bobContext = await browser.newContext();
    const alicePage = await aliceContext.newPage();
    const bobPage = await bobContext.newPage();

    await signIn(alicePage, accountA);
    await signIn(bobPage, accountB);

    await alicePage.getByLabel("Nova tarefa").fill("Só da Alice");
    await alicePage.getByRole("button", { name: "Adicionar" }).click();
    await expect(todoItem(alicePage, "Só da Alice")).toBeVisible();

    // The realtime.messages policy is scoped with realtime.topic(). With the
    // `USING (true)` from the official docs, Bob would be able to subscribe to
    // Alice's topic and read her rows straight off the socket.
    await bobPage.waitForTimeout(5_000);
    await expect(todoItem(bobPage, "Só da Alice")).toHaveCount(0);

    await aliceContext.close();
    await bobContext.close();
  });
});
