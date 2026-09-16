import type { TodoId } from "@/shared/domain/ids";
import type { TodoUseCaseDeps } from "../domain/ports";
import { assertOwnedBy, renameTodo, TodoNotFound, type Todo } from "../domain/todo";

export class RenameTodo {
  constructor(private readonly deps: TodoUseCaseDeps) {}

  async execute(input: { id: TodoId; title: string }): Promise<Todo> {
    const { uow, clock, user } = this.deps;

    return uow.run(async ({ todos }) => {
      const current = await todos.findByIdForUpdate(input.id);
      if (!current) throw new TodoNotFound();
      assertOwnedBy(current, user.id);

      const next = renameTodo(current, input.title, clock.now());
      if (next === current) return current;

      await todos.update(next);
      return next;
    });
  }
}
