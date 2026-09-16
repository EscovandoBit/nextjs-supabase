import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 8;

/** bcrypt truncates past 72 bytes, and Supabase rejects longer passwords. */
export const PASSWORD_MAX_LENGTH = 72;

export const EmailSchema = z
  .email({ error: "Informe um e-mail válido." })
  .trim()
  .toLowerCase();

export const PasswordSchema = z
  .string({ error: "Informe uma senha." })
  .min(PASSWORD_MIN_LENGTH, `A senha deve ter ao menos ${PASSWORD_MIN_LENGTH} caracteres.`)
  .max(PASSWORD_MAX_LENGTH, `A senha deve ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`);

export const SignInInput = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  // Where to land after signing in. Validated as a safe internal path at the
  // point of use, never trusted as given.
  next: z.string().optional(),
});

export const SignUpInput = z.object({
  email: EmailSchema,
  password: PasswordSchema,
});

/**
 * Rejects absolute URLs and protocol-relative paths (`//evil.example`), which
 * is what turns a `?next=` parameter into an open redirect.
 */
export function safeInternalPath(candidate: string | undefined, fallback = "/todos"): string {
  if (!candidate) return fallback;
  if (!candidate.startsWith("/")) return fallback;
  if (candidate.startsWith("//")) return fallback;
  return candidate;
}
