import { z } from "zod";

import { TITLE_MAX_LENGTH } from "../domain/todo";

/**
 * Boundary DTOs, shared by the Server Action (authoritative) and the browser
 * form (fast feedback). One schema, two roles - they cannot drift.
 *
 * No `server-only` marker: client components import this on purpose. It is the
 * payoff of keeping the domain framework-free, since `TITLE_MAX_LENGTH` comes
 * from the domain rather than being restated here as a magic 120.
 */
export const TodoIdSchema = z.uuid({ error: "Identificador inválido." });

export const TitleSchema = z
  .string({ error: "Informe um título." })
  .trim()
  .min(1, "Informe um título.")
  .max(TITLE_MAX_LENGTH, `Use no máximo ${TITLE_MAX_LENGTH} caracteres.`);

export const CreateTodoInput = z.object({ title: TitleSchema });

export const RenameTodoInput = z.object({ id: TodoIdSchema, title: TitleSchema });

export const ToggleTodoInput = z.object({
  id: TodoIdSchema,
  // z.stringbool() and not z.coerce.boolean(): the latter turns the string
  // "false" into true, which is exactly the value a hidden input sends.
  done: z.stringbool(),
});

export const DeleteTodoInput = z.object({ id: TodoIdSchema });

export type CreateTodoInputType = z.output<typeof CreateTodoInput>;
export type RenameTodoInputType = z.output<typeof RenameTodoInput>;
