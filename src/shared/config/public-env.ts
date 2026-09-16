/**
 * Deliberately NOT marked `server-only`: the browser Supabase client needs
 * these. Next.js inlines `NEXT_PUBLIC_*` at build time, so they must be read
 * as static property accesses rather than through a dynamic lookup.
 *
 * Nothing secret belongs in this file. Secrets live in `env.ts`, which is
 * server-only and would fail the build if a client component reached it.
 */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
} as const;

export function assertPublicEnv(): void {
  if (!publicEnv.supabaseUrl || !publicEnv.supabaseAnonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set. Copy .env.example to .env.local.",
    );
  }
}
