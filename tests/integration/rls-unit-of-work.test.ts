import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CreateTodo } from "@/modules/todos/application/create-todo";
import { DeleteTodo } from "@/modules/todos/application/delete-todo";
import { RenameTodo } from "@/modules/todos/application/rename-todo";
import type { TodoUseCaseDeps } from "@/modules/todos/domain/ports";
import { TodoWriteConflict } from "@/modules/todos/domain/todo";
import type { TodoId } from "@/shared/domain/ids";
import { closePool, getDb } from "@/shared/infrastructure/db/pool";
import { RlsUnitOfWork } from "@/shared/infrastructure/db/rls-unit-of-work";
import { integrationAvailable } from "./environment";
import { sessionForTests } from "./session-factory";
import { createTestUser, deleteTestUser, type TestUser } from "./users";

const available = await integrationAvailable();

describe.skipIf(!available)("RlsUnitOfWork against real Postgres", () => {
  let alice: TestUser;
  let bob: TestUser;

  const depsFor = (user: TestUser): TodoUseCaseDeps => ({
    uow: new RlsUnitOfWork(getDb(), sessionForTests(user.id)),
    clock: { now: () => new Date() },
    ids: { nextTodoId: () => crypto.randomUUID() as TodoId },
    user: { id: sessionForTests(user.id).userId },
  });

  beforeAll(async () => {
    alice = await createTestUser("alice");
    bob = await createTestUser("bob");
  });

  afterAll(async () => {
    if (alice) await deleteTestUser(alice.id);
    if (bob) await deleteTestUser(bob.id);
    await closePool();
  });

  it("injects the verified claims so auth.uid() resolves inside the transaction", async () => {
    const uow = new RlsUnitOfWork(getDb(), sessionForTests(alice.id));

    const seen = await uow.run(async () => {
      const result = await getDb().execute(sql`select (select auth.uid())::text as uid`);
      return (result.rows[0] as { uid: string | null }).uid;
    });

    // Runs on the same pooled connection inside the same transaction, which is
    // the only reason the transaction-scoped GUC is visible at all.
    expect(seen).toBe(alice.id);
  });

  it("switches to the authenticated role rather than staying the table owner", async () => {
    const uow = new RlsUnitOfWork(getDb(), sessionForTests(alice.id));

    const role = await uow.run(async () => {
      const result = await getDb().execute(sql`select current_user::text as role`);
      return (result.rows[0] as { role: string }).role;
    });

    expect(role).toBe("authenticated");
  });

  it("creates a todo the owner can read back", async () => {
    const created = await new CreateTodo(depsFor(alice)).execute({ title: "Tarefa da Alice" });

    const found = await new RlsUnitOfWork(getDb(), sessionForTests(alice.id)).run(
      ({ todos }) => todos.findByIdForUpdate(created.id),
    );

    expect(found?.title).toBe("Tarefa da Alice");
  });

  it("hides one user's todo from another entirely", async () => {
    const created = await new CreateTodo(depsFor(alice)).execute({ title: "Segredo da Alice" });

    const seenByBob = await new RlsUnitOfWork(getDb(), sessionForTests(bob.id)).run(
      ({ todos }) => todos.findByIdForUpdate(created.id),
    );

    // Not "forbidden" - invisible. FOR UPDATE can only lock rows the policy
    // lets you see, so "not yours" and "does not exist" collapse.
    expect(seenByBob).toBeNull();
  });

  it("turns a cross-user rename into an error instead of a silent no-op", async () => {
    const created = await new CreateTodo(depsFor(alice)).execute({ title: "Original" });

    // Bob cannot reach it through the use case (it is invisible), so drive the
    // repository directly to prove the zero-rows-affected guard is what stops
    // him rather than luck.
    const bobsUow = new RlsUnitOfWork(getDb(), sessionForTests(bob.id));

    await expect(
      bobsUow.run(({ todos }) =>
        todos.update({
          ...created,
          title: "Invadido",
          ownerId: created.ownerId,
        }),
      ),
    ).rejects.toThrow(TodoWriteConflict);

    const afterwards = await new RlsUnitOfWork(getDb(), sessionForTests(alice.id)).run(
      ({ todos }) => todos.findByIdForUpdate(created.id),
    );
    expect(afterwards?.title).toBe("Original");
  });

  it("rolls the whole transaction back when the domain rejects the change", async () => {
    const created = await new CreateTodo(depsFor(alice)).execute({ title: "Mantida" });

    await expect(
      new RenameTodo(depsFor(alice)).execute({ id: created.id, title: "   " }),
    ).rejects.toThrow("Informe um título.");

    const afterwards = await new RlsUnitOfWork(getDb(), sessionForTests(alice.id)).run(
      ({ todos }) => todos.findByIdForUpdate(created.id),
    );
    expect(afterwards?.title).toBe("Mantida");
  });

  it("reports a delete of somebody else's todo as not found", async () => {
    const created = await new CreateTodo(depsFor(alice)).execute({ title: "Não apague" });

    await expect(
      new DeleteTodo(depsFor(bob)).execute({ id: created.id }),
    ).rejects.toThrow("Tarefa não encontrada.");

    const afterwards = await new RlsUnitOfWork(getDb(), sessionForTests(alice.id)).run(
      ({ todos }) => todos.findByIdForUpdate(created.id),
    );
    expect(afterwards).not.toBeNull();
  });
});
