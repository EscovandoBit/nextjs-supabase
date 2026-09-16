/**
 * The contract between Server Actions and `useActionState`.
 *
 * Deliberately NOT marked `server-only`: client components import these types
 * to render errors. Nothing here reaches the server-only module graph.
 *
 * Actions return this instead of throwing because Next.js replaces error
 * messages with an opaque digest in production builds. A carefully modelled
 * `PendingLimitReached` would reach the user as "An unexpected error occurred",
 * so the domain-error-to-user-message translation has to happen server-side.
 */
export type FieldErrors = Record<string, string[] | undefined>;

export type ActionState<T = unknown> =
  | { status: "idle" }
  | { status: "success"; message: string; data: T }
  | { status: "error"; message: string; errors: FieldErrors; formError?: string };

export const idleActionState: ActionState<never> = { status: "idle" };

export function fieldError(state: ActionState<unknown>, field: string): string | undefined {
  return state.status === "error" ? state.errors[field]?.[0] : undefined;
}

export function formError(state: ActionState<unknown>): string | undefined {
  return state.status === "error" ? (state.formError ?? state.message) : undefined;
}
