import { expect, signIn, test, todoItem, todoList } from "./support/fixtures";
import { seedTodos } from "./support/admin";

test.describe("todo CRUD", () => {
  test.beforeEach(async ({ page, accountA }) => {
    await signIn(page, accountA);
  });

  test("creates a task and clears the form", async ({ page }) => {
    await page.getByLabel("Nova tarefa").fill("Comprar leite");
    await page.getByRole("button", { name: "Adicionar" }).click();

    await expect(todoItem(page, "Comprar leite")).toBeVisible();
    await expect(page.getByLabel("Nova tarefa")).toHaveValue("");
  });

  test("normalizes whitespace in the title", async ({ page }) => {
    await page.getByLabel("Nova tarefa").fill("  Comprar    pão  ");
    await page.getByRole("button", { name: "Adicionar" }).click();

    await expect(todoItem(page, "Comprar pão")).toBeVisible();
  });

  test("rejects an empty title in the browser", async ({ page }) => {
    await page.getByLabel("Nova tarefa").fill("   ");
    await page.getByRole("button", { name: "Adicionar" }).click();

    await expect(page.getByText("Informe um título.")).toBeVisible();
    await expect(todoList(page)).toBeHidden();
  });

  test("toggles a task between pending and done", async ({ page }) => {
    await page.getByLabel("Nova tarefa").fill("Lavar louça");
    await page.getByRole("button", { name: "Adicionar" }).click();

    const item = todoItem(page, "Lavar louça");
    const toggle = item.getByRole("button", { name: /Lavar louça/ }).first();

    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
  });

  test("renames a task inline", async ({ page }) => {
    await page.getByLabel("Nova tarefa").fill("Titulo antigo");
    await page.getByRole("button", { name: "Adicionar" }).click();

    await todoItem(page, "Titulo antigo")
      .getByRole("button", { name: /^Editar/ })
      .click();

    const input = page.getByLabel(/Novo título para/);
    await input.fill("Titulo novo");
    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(todoItem(page, "Titulo novo")).toBeVisible();
    await expect(todoItem(page, "Titulo antigo")).toHaveCount(0);
  });

  test("abandons an inline rename on Escape", async ({ page }) => {
    await page.getByLabel("Nova tarefa").fill("Permanece");
    await page.getByRole("button", { name: "Adicionar" }).click();

    await todoItem(page, "Permanece")
      .getByRole("button", { name: /^Editar/ })
      .click();
    await page.getByLabel(/Novo título para/).fill("Descartado");
    await page.keyboard.press("Escape");

    await expect(todoItem(page, "Permanece")).toBeVisible();
  });

  test("deletes a task", async ({ page }) => {
    await page.getByLabel("Nova tarefa").fill("Para excluir");
    await page.getByRole("button", { name: "Adicionar" }).click();

    await todoItem(page, "Para excluir")
      .getByRole("button", { name: /^Excluir/ })
      .click();

    await expect(todoItem(page, "Para excluir")).toHaveCount(0);
  });

  test("refuses the sixth pending task and says why", async ({ page, accountA }) => {
    // Five pending already, which is the domain limit.
    await seedTodos(
      accountA.id,
      ["P1", "P2", "P3", "P4", "P5"],
      { done: false },
    );
    await page.reload();

    await page.getByLabel("Nova tarefa").fill("A sexta");
    await page.getByRole("button", { name: "Adicionar" }).click();

    // The domain message survives to the user because the action returns it in
    // ActionState. Thrown, Next.js would have redacted it in this prod build.
    await expect(
      page.getByRole("alert").filter({ hasText: "tarefas pendentes" }),
    ).toBeVisible();
    await expect(todoItem(page, "A sexta")).toHaveCount(0);
  });
});
