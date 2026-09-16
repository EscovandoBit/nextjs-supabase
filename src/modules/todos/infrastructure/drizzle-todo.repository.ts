import "server-only";

import { and, eq, sql } from "drizzle-orm";

import type { TodoId, UserId } from "@/shared/domain/ids";
import { todos, type TodoRow } from "@/shared/infrastructure/db/schema";
import type { Transaction } from "@/shared/infrastructure/db/transaction";
import type { TodoWriter } from "../domain/ports";
import { TodoWriteConflict, type Todo } from "../domain/todo";

function toDomain(row: TodoRow): Todo {
  return {
    id: row.id as TodoId,
    ownerId: row.userId as UserId,
    title: row.title,
    done: row.done,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleTodoRepository implements TodoWriter {
  constructor(private readonly tx: Transaction) {}

  async findByIdForUpdate(id: TodoId): Promise<Todo | null> {
    const rows = await this.tx
      .select()
      .from(todos)
      .where(eq(todos.id, id))
      .limit(1)
      // Held until commit. Also note this only locks rows RLS lets us see, so
      // "not yours" and "does not exist" collapse into the same result - which
      // is exactly what the domain errors already decided to expose.
      .for("update");

    const row = rows[0];
    return row ? toDomain(row) : null;
  }

  async countPending(ownerId: UserId): Promise<number> {
    const rows = await this.tx
      .select({ pending: sql<number>`count(*)::int` })
      .from(todos)
      .where(and(eq(todos.userId, ownerId), eq(todos.done, false)));

    return rows[0]?.pending ?? 0;
  }

  async insert(todo: Todo): Promise<void> {
    await this.tx.insert(todos).values({
      id: todo.id,
      userId: todo.ownerId,
      title: todo.title,
      done: todo.done,
      createdAt: todo.createdAt,
      updatedAt: todo.updatedAt,
    });
  }

  async update(todo: Todo): Promise<void> {
    const affected = await this.tx
      .update(todos)
      .set({ title: todo.title, done: todo.done, updatedAt: todo.updatedAt })
      .where(and(eq(todos.id, todo.id), eq(todos.userId, todo.ownerId)))
      .returning({ id: todos.id });

    // The failure mode that catches people out with RLS: an INSERT violating
    // WITH CHECK raises, but an UPDATE or DELETE blocked by USING simply finds
    // no row and reports success. Unchecked, the use case "succeeds" having
    // written nothing at all.
    if (affected.length === 0) throw new TodoWriteConflict();
  }

  async remove(id: TodoId): Promise<void> {
    const affected = await this.tx
      .delete(todos)
      .where(eq(todos.id, id))
      .returning({ id: todos.id });

    if (affected.length === 0) throw new TodoWriteConflict();
  }
}
