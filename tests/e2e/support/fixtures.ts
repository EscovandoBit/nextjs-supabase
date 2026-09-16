import { test as base, expect, type Page } from "@playwright/test";

import { createAccount, deleteAccount, type Account } from "./admin";

/**
 * Accounts are worker-scoped, created once per worker and torn down after.
 *
 * Per-worker rather than shared: these tests subscribe to a Realtime channel
 * keyed by user id, so two tests sharing an account would see each other's
 * writes arrive mid-assertion.
 */
type WorkerFixtures = {
  accountA: Account;
  accountB: Account;
};

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Playwright's
// documented shape for "no test-scoped fixtures".
type TestFixtures = {};

export const test = base.extend<TestFixtures, WorkerFixtures>({
  accountA: [
    async ({}, use, workerInfo) => {
      const account = await createAccount(`a-w${workerInfo.workerIndex}`);
      await use(account);
      await deleteAccount(account.id);
    },
    { scope: "worker" },
  ],

  accountB: [
    async ({}, use, workerInfo) => {
      const account = await createAccount(`b-w${workerInfo.workerIndex}`);
      await use(account);
      await deleteAccount(account.id);
    },
    { scope: "worker" },
  ],
});

export { expect };

export async function signIn(page: Page, account: Account): Promise<void> {
  await page.goto("/login?mode=signin");
  await page.getByLabel("E-mail").fill(account.email);
  await page.getByLabel("Senha").fill(account.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/todos/);
}

export function todoList(page: Page) {
  return page.getByRole("list", { name: "Lista de tarefas" });
}

export function todoItem(page: Page, title: string) {
  return todoList(page).getByRole("listitem").filter({ hasText: title });
}
