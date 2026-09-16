import { createBrowserClient } from "@supabase/ssr";

import { assertPublicEnv, publicEnv } from "@/shared/config/public-env";
import type { Database } from "./database.types";

/**
 * `createBrowserClient` is internally a singleton, so calling this from
 * several components still yields one client and one Realtime socket.
 */
export function createSupabaseBrowserClient() {
  assertPublicEnv();
  return createBrowserClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
}
