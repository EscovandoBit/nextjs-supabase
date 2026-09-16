import type { TodoId } from "@/shared/domain/ids";
import type { TodoUseCaseDeps } from "../domain/ports";
import { assertOwnedBy, TodoNotFound } from "../domain/todo";

export class DeleteTodo {
  constructor(private readonly deps: TodoUseCaseDeps) {}

  async execute(input: { id: TodoId }): Promise<{ id: TodoId }> {
    const { uow, user } = this.deps;

    return uow.run(async ({ todos }) => {
      // Locking before deleting looks like overkill for a todo, and for a todo
      // it is. It stops mattering the day this row acquires an audit trail or
      // a side effect: the lock is what guarantees nobody renamed it between
      // the read and the delete.
      const current = await todos.findByIdForUpdate(input.id);
      if (!current) throw new TodoNotFound();
      assertOwnedBy(current, user.id);

      await todos.remove(current.id);
      return { id: current.id };
    });
  }
}
