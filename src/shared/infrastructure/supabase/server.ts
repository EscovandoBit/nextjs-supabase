import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { assertPublicEnv, publicEnv } from "@/shared/config/public-env";
import type { Database } from "./database.types";

/**
 * A fresh client per request, never shared. `@supabase/ssr` delivers the
 * anti-caching headers only on the first cookie write of a given client, so
 * reusing one across requests would leave later responses unprotected.
 */
export async function createSupabaseServerClient() {
  assertPublicEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet, _headers) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies. `proxy.ts` refreshes the
          // session and writes both the cookies and the cache headers, so
          // there is nothing to do here and nothing to report.
        }
      },
    },
  });
}
