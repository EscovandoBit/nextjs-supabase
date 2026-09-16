import type { UserId } from "@/shared/domain/ids";
import type { AuthenticatedSession } from "@/shared/domain/session";

/**
 * The one legitimate forgery of `AuthenticatedSession` outside
 * `src/shared/infrastructure/auth/verify-session.ts`.
 *
 * Integration tests need a session without an HTTP request, and the opaque
 * brand makes that impossible to build by hand - which is the point. This file
 * lives under `tests/` rather than `src/` so application code cannot reach it,
 * and `dependency-cruiser` only cruises `src`.
 *
 * The claim set mirrors what Supabase Auth issues, because RLS reads it: the
 * `auth.uid()` helper resolves `request.jwt.claims -> sub`.
 */
export function sessionForTests(userId: string): AuthenticatedSession {
  const claims = {
    sub: userId,
    role: "authenticated",
    aud: "authenticated",
    iss: "integration-tests",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };

  return {
    userId: userId as UserId,
    role: "authenticated",
    claimsJson: JSON.stringify(claims),
  } as AuthenticatedSession;
}
