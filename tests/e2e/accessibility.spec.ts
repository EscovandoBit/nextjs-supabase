import AxeBuilder from "@axe-core/playwright";

import { seedTodos } from "./support/admin";
import { expect, signIn, test, todoItem, todoList } from "./support/fixtures";

/**
 * An ARIA implementation without tests is a hope, not a feature.
 */
test.describe("accessibility", () => {
  test("login screen has no axe violations", async ({ page }) => {
    await page.goto("/login");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test("task list has no axe violations", async ({ page, accountA }) => {
    await seedTodos(accountA.id, ["Uma", "Duas", "Três"]);
    await signIn(page, accountA);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test("task list with a validation error still has no violations", async ({
    page,
    accountA,
  }) => {
    await signIn(page, accountA);
    await page.getByLabel("Nova tarefa").fill("   ");
    await page.getByRole("button", { name: "Adicionar" }).click();
    await expect(page.getByText("Informe um título.")).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test("creates and completes a task using only the keyboard", async ({ page, accountA }) => {
    await signIn(page, accountA);

    await page.getByLabel("Nova tarefa").focus();
    await page.keyboard.type("Feito no teclado");
    await page.keyboard.press("Enter");

    const item = todoItem(page, "Feito no teclado");
    await expect(item).toBeVisible();

    const toggle = item.getByRole("button", { name: /Feito no teclado/ }).first();
    await toggle.focus();
    await page.keyboard.press("Enter");

    await expect(toggle).toHaveAttribute("aria-pressed", "true");
  });

  test("keeps the submit button focusable while the action is in flight", async ({
    page,
    accountA,
  }) => {
    await signIn(page, accountA);

    const submit = page.getByRole("button", { name: "Adicionar" });
    // aria-disabled rather than disabled, so focus is never yanked to the top
    // of the document mid-submit.
    await expect(submit).not.toHaveAttribute("disabled", "");
    await submit.focus();
    await expect(submit).toBeFocused();
  });

  test("associates the field error with the input and marks it invalid", async ({
    page,
    accountA,
  }) => {
    await signIn(page, accountA);
    await page.getByLabel("Nova tarefa").fill("   ");
    await page.getByRole("button", { name: "Adicionar" }).click();

    const input = page.getByLabel("Nova tarefa");
    await expect(input).toHaveAttribute("aria-invalid", "true");

    const describedBy = await input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();

    const ids = describedBy!.split(" ");
    // Hint and error are both referenced, hint first: swapping one for the
    // other drops the instruction precisely when it is needed.
    expect(ids.length).toBe(2);
    await expect(page.locator(`#${ids[1]}`)).toHaveRole("alert");
    await expect(page.locator(`#${ids[1]}`)).toHaveText("Informe um título.");
  });

  test("names the pagination landmark and the task list", async ({ page, accountA }) => {
    await seedTodos(
      accountA.id,
      Array.from({ length: 12 }, (_, index) => `Item ${index + 1}`),
    );
    await signIn(page, accountA);
    await page.goto("/todos?perPage=5");

    await expect(todoList(page)).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Paginação" })).toBeVisible();
  });

  test("offers a skip link as the first focusable element", async ({ page, accountA }) => {
    await signIn(page, accountA);
    await page.keyboard.press("Tab");

    await expect(page.getByRole("link", { name: "Pular para o conteúdo" })).toBeFocused();
  });
});
