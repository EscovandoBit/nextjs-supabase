import "server-only";

import { cache } from "react";

import type { UserId } from "@/shared/domain/ids";
import type { AuthenticatedSession } from "@/shared/domain/session";
import { createSupabaseServerClient } from "../supabase/server";

export class Unauthenticated extends Error {
  readonly code = "UNAUTHENTICATED";

  constructor() {
    super("Sua sessão expirou. Entre novamente.");
    this.name = "Unauthenticated";
  }
}

/**
 * The only producer of `AuthenticatedSession` in the codebase.
 *
 * `getClaims()` and not `getSession()`: `getSession()` reads the cookie and
 * returns whatever is in it, unverified. Since these claims are injected
 * verbatim into `request.jwt.claims` and Postgres trusts them blindly for
 * `auth.uid()`, an unverified claim set would hand an attacker every row in
 * the table. `getClaims()` verifies the JWT signature - locally via WebCrypto
 * when the project uses asymmetric signing keys, otherwise against the Auth
 * server.
 *
 * Memoized with React's `cache()` so a page and the code it calls share one
 * verification per request. The action phase and the re-render that follows
 * are separate scopes, so a single user gesture verifies twice; that is
 * correct and cheap.
 */
export const verifySession = cache(async (): Promise<AuthenticatedSession> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data) throw new Unauthenticated();

  const { claims } = data;

  if (typeof claims.sub !== "string" || claims.sub.length === 0) throw new Unauthenticated();
  if (claims.role !== "authenticated") throw new Unauthenticated();

  // getClaims() already rejects expired tokens; re-checking costs nothing and
  // keeps the invariant local to the one place that mints a session.
  if (typeof claims.exp === "number" && claims.exp * 1000 <= Date.now()) {
    throw new Unauthenticated();
  }

  return {
    userId: claims.sub as UserId,
    role: "authenticated",
    claimsJson: JSON.stringify(claims),
  } as AuthenticatedSession;
});

/** Returns null instead of throwing. For layouts that render for both states. */
export async function currentSession(): Promise<AuthenticatedSession | null> {
  try {
    return await verifySession();
  } catch {
    return null;
  }
}
