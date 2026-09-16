import { expect, signIn, test } from "./support/fixtures";

test.describe("authentication", () => {
  test("sends an anonymous visitor to the login screen", async ({ page }) => {
    await page.goto("/todos");

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Tarefas" })).toBeVisible();
  });

  test("remembers where the visitor was heading", async ({ page }) => {
    await page.goto("/todos?status=done");

    // The proxy preserves the destination so signing in lands where intended.
    await expect(page).toHaveURL(/next=/);
  });

  test("signs in and reaches the task list", async ({ page, accountA }) => {
    await signIn(page, accountA);

    await expect(page.getByRole("heading", { name: "Minhas tarefas" })).toBeVisible();
  });

  test("announces a bad credential in an alert without saying which half was wrong", async ({
    page,
    accountA,
  }) => {
    await page.goto("/login?mode=signin");
    await page.getByLabel("E-mail").fill(accountA.email);
    await page.getByLabel("Senha").fill("definitely-not-the-password");
    await page.getByRole("button", { name: "Entrar" }).click();

    // Identical message for unknown e-mail and wrong password: telling them
    // apart would be a user-enumeration oracle.
    await expect(
      page.getByRole("alert").filter({ hasText: "E-mail ou senha inválidos." }),
    ).toBeVisible();
  });

  test("validates the form in the browser before reaching the server", async ({ page }) => {
    await page.goto("/login?mode=signin");
    await page.getByLabel("E-mail").fill("not-an-email");
    await page.getByLabel("Senha").fill("short");
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page.getByText("Informe um e-mail válido.")).toBeVisible();
    // Never left the page: the client-side check short-circuited the submit.
    await expect(page).toHaveURL(/\/login/);
  });

  test("marks an invalid field with aria-invalid and points at its message", async ({ page }) => {
    await page.goto("/login?mode=signin");
    await page.getByLabel("E-mail").fill("nope");
    await page.getByLabel("Senha").fill("password123");
    await page.getByRole("button", { name: "Entrar" }).click();

    const email = page.getByLabel("E-mail");
    await expect(email).toHaveAttribute("aria-invalid", "true");

    const describedBy = await email.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();

    // The error node must actually exist and be an alert, otherwise
    // aria-describedby points at nothing.
    const errorId = describedBy!.split(" ").at(-1)!;
    await expect(page.locator(`#${errorId}`)).toHaveRole("alert");
  });

  test("signs out and blocks the back button from restoring the list", async ({
    page,
    accountA,
  }) => {
    await signIn(page, accountA);
    await page.getByRole("button", { name: "Sair" }).click();

    await expect(page).toHaveURL(/\/login/);

    await page.goto("/todos");
    await expect(page).toHaveURL(/\/login/);
  });

  test("redirects an authenticated visitor away from the login screen", async ({
    page,
    accountA,
  }) => {
    await signIn(page, accountA);
    await page.goto("/login");

    await expect(page).toHaveURL(/\/todos/);
  });
});
