import "server-only";

import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { containerFor, type Container } from "@/composition/container";
import { DomainError } from "@/modules/todos/domain/todo";
import type { AuthenticatedSession } from "@/shared/domain/session";
import { Unauthenticated, verifySession } from "@/shared/infrastructure/auth/verify-session";
import type { ActionState, FieldErrors } from "./action-state";

/**
 * Stamped on every action this factory produces, so a test can prove that no
 * `"use server"` export escaped the guard. Enforcement, not decoration.
 */
export const AUTH_GUARD_MARKER = Symbol.for("todo.action.authGuarded");

export function isAuthGuarded(value: unknown): boolean {
  if (typeof value !== "function") return false;
  return (value as unknown as Record<symbol, unknown>)[AUTH_GUARD_MARKER] === true;
}

const GENERIC_FAILURE = "Não foi possível concluir. Tente novamente.";

function translate(error: unknown): ActionState<never> {
  // Must come first. `redirect()` and `notFound()` work by throwing internal
  // sentinels, and a broad catch would swallow them silently.
  unstable_rethrow(error);

  if (error instanceof Unauthenticated) redirect("/login");

  if (error instanceof DomainError) {
    return { status: "error", message: error.message, errors: {}, formError: error.message };
  }

  console.error("[action] unhandled error", error);
  return {
    status: "error",
    message: GENERIC_FAILURE,
    errors: {},
    formError: GENERIC_FAILURE,
  };
}

type ActionConfig<Schema extends z.ZodType, Result> = {
  input: Schema;
  successMessage: string;
  execute: (
    input: z.output<Schema>,
    context: { useCases: Container; session: AuthenticatedSession },
  ) => Promise<Result>;
};

/**
 * Every Server Action in this app is built here. None are hand-written.
 *
 * Each export of a `"use server"` file is a public HTTP endpoint with a stable
 * id, callable by anyone who can POST - no import and no UI interaction
 * required. Putting the session check inside the wrapper means it is not
 * something a new action can forget to call.
 */
export function authenticatedAction<Schema extends z.ZodType, Result>(
  config: ActionConfig<Schema, Result>,
) {
  const action = async (
    _previous: ActionState<Result>,
    formData: FormData,
  ): Promise<ActionState<Result>> => {
    // 1. Authenticate BEFORE parsing. An anonymous caller should not be able to
    //    use Zod's error messages as an oracle for the expected schema, nor
    //    spend our CPU on validation.
    let session: AuthenticatedSession;
    try {
      session = await verifySession();
    } catch {
      redirect("/login");
    }

    // 2. Validate. Untrusted input never reaches the domain.
    const parsed = config.input.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return {
        status: "error",
        message: "Corrija os campos destacados.",
        errors: z.flattenError(parsed.error).fieldErrors as FieldErrors,
      };
    }

    // 3. Execute against a graph wired from this session.
    try {
      const data = await config.execute(parsed.data, {
        useCases: containerFor(session),
        session,
      });
      return { status: "success", message: config.successMessage, data };
    } catch (error) {
      // 4. Translate. Nothing internal crosses the boundary.
      return translate(error);
    }
  };

  Object.defineProperty(action, AUTH_GUARD_MARKER, { value: true });
  return action;
}
