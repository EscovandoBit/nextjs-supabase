import { sql } from "drizzle-orm";
import { boolean, index, pgPolicy, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { authUid, authUsers, authenticatedRole } from "drizzle-orm/supabase";

export const todos = pgTable(
  "todos",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    title: text().notNull(),
    done: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // One index per supported sort, each ending in `id` to match the
    // tiebreaker the read query appends. Without that trailing column the
    // index stops being useful exactly where pagination needs it most.
    index("todos_owner_created_idx").on(t.userId, t.createdAt.desc(), t.id),
    index("todos_owner_updated_idx").on(t.userId, t.updatedAt.desc(), t.id),
    index("todos_owner_title_idx").on(t.userId, t.title, t.id),

    pgPolicy("todos_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${authUid} = ${t.userId}`,
    }),
    pgPolicy("todos_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${authUid} = ${t.userId}`,
    }),
    pgPolicy("todos_update_own", {
      for: "update",
      to: authenticatedRole,
      using: sql`${authUid} = ${t.userId}`,
      // `using` decides what you can see; `withCheck` validates the resulting
      // row. Omitting withCheck here would let a user reassign a todo to
      // somebody else - the single most common RLS hole.
      withCheck: sql`${authUid} = ${t.userId}`,
    }),
    pgPolicy("todos_delete_own", {
      for: "delete",
      to: authenticatedRole,
      using: sql`${authUid} = ${t.userId}`,
    }),
  ],
);

export type TodoRow = typeof todos.$inferSelect;
export type TodoInsert = typeof todos.$inferInsert;
