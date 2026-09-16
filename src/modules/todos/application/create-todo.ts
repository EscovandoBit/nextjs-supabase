import type { TodoUseCaseDeps } from "../domain/ports";
import { assertPendingLimit, createTodo, type Todo } from "../domain/todo";

export class CreateTodo {
  constructor(private readonly deps: TodoUseCaseDeps) {}

  async execute(input: { title: string }): Promise<Todo> {
    const { uow, clock, ids, user } = this.deps;

    // Title is normalized and validated before the transaction opens: there is
    // no reason to hold a connection while rejecting bad input.
    const todo = createTodo({
      id: ids.nextTodoId(),
      ownerId: user.id,
      title: input.title,
      now: clock.now(),
    });

    return uow.run(
      async ({ todos }) => {
        assertPendingLimit(await todos.countPending(user.id));
        await todos.insert(todo);
        return todo;
      },
      // Count-then-insert is not safe under READ COMMITTED: two concurrent
      // transactions both count 4 and both insert. Row locks cannot fix it
      // because the conflicting row does not exist yet.
      { serializeBy: `todos:${user.id}` },
    );
  }
}
