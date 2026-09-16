import type { TodoId } from "@/shared/domain/ids";
import type { TodoUseCaseDeps } from "../domain/ports";
import { assertOwnedBy, setDone, TodoNotFound, type Todo } from "../domain/todo";

export class ToggleTodo {
  constructor(private readonly deps: TodoUseCaseDeps) {}

  async execute(input: { id: TodoId; done: boolean }): Promise<Todo> {
    const { uow, clock, user } = this.deps;

    return uow.run(async ({ todos }) => {
      const current = await todos.findByIdForUpdate(input.id);
      if (!current) throw new TodoNotFound();
      assertOwnedBy(current, user.id);

      const next = setDone(current, input.done, clock.now());
      if (next === current) return current;

      await todos.update(next);
      return next;
    });
  }
}
