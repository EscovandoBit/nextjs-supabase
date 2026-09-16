import type { TodoId, UserId } from "@/shared/domain/ids";
import type {
  Clock,
  IdGenerator,
  TodoWriter,
  TransactionalRepositories,
  UnitOfWork,
  UnitOfWorkOptions,
} from "../../domain/ports";
import type { Todo } from "../../domain/todo";

class InMemoryTodoWriter implements TodoWriter {
  constructor(private readonly rows: Map<TodoId, Todo>) {}

  async findByIdForUpdate(id: TodoId): Promise<Todo | null> {
    return this.rows.get(id) ?? null;
  }

  async countPending(ownerId: UserId): Promise<number> {
    let count = 0;
    for (const row of this.rows.values()) {
      if (row.ownerId === ownerId && !row.done) count += 1;
    }
    return count;
  }

  async insert(todo: Todo): Promise<void> {
    this.rows.set(todo.id, todo);
  }

  async update(todo: Todo): Promise<void> {
    // Mirrors the real adapter, which turns "zero rows affected" into an
    // error rather than a silent success.
    if (!this.rows.has(todo.id)) throw new Error("row disappeared before update");
    this.rows.set(todo.id, todo);
  }

  async remove(id: TodoId): Promise<void> {
    if (!this.rows.delete(id)) throw new Error("row disappeared before delete");
  }
}

/**
 * Substitutable for `RlsUnitOfWork` without the use cases noticing, which is
 * the whole return on the port. Emulates the two behaviours the use cases
 * actually depend on: rollback on throw, and serialization by key.
 */
export class InMemoryUnitOfWork implements UnitOfWork {
  private readonly rows: Map<TodoId, Todo>;
  private readonly gates = new Map<string, Promise<void>>();

  constructor(seed: readonly Todo[] = []) {
    this.rows = new Map(seed.map((todo) => [todo.id, todo]));
  }

  snapshot(): Todo[] {
    return [...this.rows.values()];
  }

  async run<T>(
    work: (repos: TransactionalRepositories) => Promise<T>,
    options?: UnitOfWorkOptions,
  ): Promise<T> {
    const execute = async (): Promise<T> => {
      const before = new Map(this.rows);
      try {
        return await work({ todos: new InMemoryTodoWriter(this.rows) });
      } catch (error) {
        this.rows.clear();
        for (const [id, todo] of before) this.rows.set(id, todo);
        throw error;
      }
    };

    const key = options?.serializeBy;
    if (!key) return execute();

    const settled = (): Promise<void> => Promise.resolve();
    const gate = (this.gates.get(key) ?? Promise.resolve()).then(settled, settled);
    const current = gate.then(execute);
    this.gates.set(key, current.then(settled, settled));
    return current;
  }
}

export class FixedClock implements Clock {
  constructor(private value: Date) {}

  now(): Date {
    return this.value;
  }

  advance(ms: number): void {
    this.value = new Date(this.value.getTime() + ms);
  }
}

export class SequentialIds implements IdGenerator {
  private next = 1;

  nextTodoId(): TodoId {
    return `00000000-0000-4000-8000-${String(this.next++).padStart(12, "0")}` as TodoId;
  }
}
