import { beforeEach, describe, expect, it } from "vitest";

import type { TodoId, UserId } from "@/shared/domain/ids";
import type { TodoUseCaseDeps } from "../../domain/ports";
import { MAX_PENDING_TODOS, TITLE_MAX_LENGTH, type Todo } from "../../domain/todo";
import { CreateTodo } from "../create-todo";
import { DeleteTodo } from "../delete-todo";
import { RenameTodo } from "../rename-todo";
import { ToggleTodo } from "../toggle-todo";
import { FixedClock, InMemoryUnitOfWork, SequentialIds } from "./in-memory-unit-of-work";

const OWNER = "11111111-1111-4111-8111-111111111111" as UserId;
const STRANGER = "22222222-2222-4222-8222-222222222222" as UserId;
const NOW = new Date("2026-01-15T12:00:00.000Z");

function todo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: "99999999-9999-4999-8999-999999999999" as TodoId,
    ownerId: OWNER,
    title: "Comprar leite",
    done: false,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function pending(count: number, owner: UserId = OWNER): Todo[] {
  return Array.from({ length: count }, (_, index) =>
    todo({
      id: `aaaaaaaa-0000-4000-8000-${String(index).padStart(12, "0")}` as TodoId,
      ownerId: owner,
      title: `Tarefa ${index}`,
    }),
  );
}

describe("todo use cases", () => {
  let uow: InMemoryUnitOfWork;
  let deps: TodoUseCaseDeps;

  function build(seed: readonly Todo[] = []) {
    uow = new InMemoryUnitOfWork(seed);
    deps = {
      uow,
      clock: new FixedClock(NOW),
      ids: new SequentialIds(),
      user: { id: OWNER },
    };
  }

  beforeEach(() => build());

  describe("CreateTodo", () => {
    it("normalizes surrounding and repeated whitespace in the title", async () => {
      const created = await new CreateTodo(deps).execute({ title: "  Comprar   leite \n" });

      expect(created.title).toBe("Comprar leite");
      expect(created.done).toBe(false);
      expect(uow.snapshot()).toHaveLength(1);
    });

    it("rejects an empty title without touching storage", async () => {
      await expect(new CreateTodo(deps).execute({ title: "   " })).rejects.toThrow(
        "Informe um título.",
      );
      expect(uow.snapshot()).toHaveLength(0);
    });

    it("rejects a title over the maximum length", async () => {
      const title = "a".repeat(TITLE_MAX_LENGTH + 1);

      await expect(new CreateTodo(deps).execute({ title })).rejects.toThrow(
        `no máximo ${TITLE_MAX_LENGTH} caracteres`,
      );
    });

    it("refuses to exceed the pending limit", async () => {
      build(pending(MAX_PENDING_TODOS));

      await expect(new CreateTodo(deps).execute({ title: "Uma mais" })).rejects.toThrow(
        "tarefas pendentes",
      );
      expect(uow.snapshot()).toHaveLength(MAX_PENDING_TODOS);
    });

    it("ignores completed todos when counting the pending limit", async () => {
      build(pending(MAX_PENDING_TODOS).map((item) => ({ ...item, done: true })));

      await expect(new CreateTodo(deps).execute({ title: "Pode criar" })).resolves.toMatchObject({
        title: "Pode criar",
      });
    });

    it("counts only the caller's todos toward the limit", async () => {
      build(pending(MAX_PENDING_TODOS, STRANGER));

      await expect(new CreateTodo(deps).execute({ title: "Minha" })).resolves.toMatchObject({
        ownerId: OWNER,
      });
    });

    it("serializes concurrent creates so the limit cannot be raced past", async () => {
      // One slot left, two simultaneous writers. Without serializeBy both
      // would count MAX-1 and both would insert.
      build(pending(MAX_PENDING_TODOS - 1));
      const useCase = new CreateTodo(deps);

      const results = await Promise.allSettled([
        useCase.execute({ title: "Corrida A" }),
        useCase.execute({ title: "Corrida B" }),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(uow.snapshot()).toHaveLength(MAX_PENDING_TODOS);
    });
  });

  describe("RenameTodo", () => {
    it("renames and stamps updatedAt", async () => {
      const existing = todo({ updatedAt: new Date("2020-01-01T00:00:00.000Z") });
      build([existing]);

      const renamed = await new RenameTodo(deps).execute({
        id: existing.id,
        title: "Comprar pão",
      });

      expect(renamed.title).toBe("Comprar pão");
      expect(renamed.updatedAt).toEqual(NOW);
    });

    it("is a no-op when the normalized title is unchanged", async () => {
      const existing = todo({ updatedAt: new Date("2020-01-01T00:00:00.000Z") });
      build([existing]);

      const renamed = await new RenameTodo(deps).execute({
        id: existing.id,
        title: "  Comprar   leite  ",
      });

      expect(renamed).toBe(existing);
      expect(renamed.updatedAt).toEqual(existing.updatedAt);
    });

    it("reports a missing todo", async () => {
      await expect(
        new RenameTodo(deps).execute({ id: todo().id, title: "Qualquer" }),
      ).rejects.toThrow("Tarefa não encontrada.");
    });

    it("refuses another user's todo with the same message as a missing one", async () => {
      const foreign = todo({ ownerId: STRANGER });
      build([foreign]);

      await expect(
        new RenameTodo(deps).execute({ id: foreign.id, title: "Invadido" }),
      ).rejects.toThrow("Tarefa não encontrada.");

      expect(uow.snapshot()[0]?.title).toBe(foreign.title);
    });
  });

  describe("ToggleTodo", () => {
    it("marks a todo as done", async () => {
      const existing = todo();
      build([existing]);

      const toggled = await new ToggleTodo(deps).execute({ id: existing.id, done: true });

      expect(toggled.done).toBe(true);
    });

    it("is a no-op when already in the requested state", async () => {
      const existing = todo({ done: true });
      build([existing]);

      const toggled = await new ToggleTodo(deps).execute({ id: existing.id, done: true });

      expect(toggled).toBe(existing);
    });

    it("refuses another user's todo", async () => {
      const foreign = todo({ ownerId: STRANGER });
      build([foreign]);

      await expect(
        new ToggleTodo(deps).execute({ id: foreign.id, done: true }),
      ).rejects.toThrow("Tarefa não encontrada.");
    });
  });

  describe("DeleteTodo", () => {
    it("removes the todo", async () => {
      const existing = todo();
      build([existing]);

      await expect(new DeleteTodo(deps).execute({ id: existing.id })).resolves.toEqual({
        id: existing.id,
      });
      expect(uow.snapshot()).toHaveLength(0);
    });

    it("refuses another user's todo and leaves it intact", async () => {
      const foreign = todo({ ownerId: STRANGER });
      build([foreign]);

      await expect(new DeleteTodo(deps).execute({ id: foreign.id })).rejects.toThrow(
        "Tarefa não encontrada.",
      );
      expect(uow.snapshot()).toHaveLength(1);
    });
  });
});
