import { Client } from "pg";

export const DATABASE_URL =
  process.env.INTEGRATION_DATABASE_URL ??
  process.env.MIGRATION_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
export const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/**
 * These tests need a real Postgres with the migrations applied, because they
 * exist precisely to verify behaviour no in-memory double can reproduce: that
 * SET LOCAL survives the pooler, that RLS turns a forbidden UPDATE into zero
 * affected rows, and that an advisory lock actually serializes.
 *
 * When the database is absent the suites skip. The warning below is loud on
 * purpose - a silently-passing integration suite is worse than none at all.
 */
export async function integrationAvailable(): Promise<boolean> {
  if (!SERVICE_ROLE_KEY) {
    warn("SUPABASE_SERVICE_ROLE_KEY is not set");
    return false;
  }

  const client = new Client({ connectionString: DATABASE_URL, connectionTimeoutMillis: 2_000 });

  try {
    await client.connect();
    // Also assert the migrations ran: connecting to an empty database and
    // reporting "available" would produce a confusing cascade of failures.
    await client.query("select 1 from public.todos limit 1");
    return true;
  } catch (error) {
    warn(error instanceof Error ? error.message : String(error));
    return false;
  } finally {
    await client.end().catch(() => undefined);
  }
}

function warn(reason: string): void {
  console.warn(
    [
      "",
      "  ┌─────────────────────────────────────────────────────────────────┐",
      "  │ SKIPPING INTEGRATION TESTS - no usable database                 │",
      "  └─────────────────────────────────────────────────────────────────┘",
      `  reason: ${reason}`,
      "",
      "  To run them:",
      "    supabase start",
      "    npm run db:migrate",
      "    cp .env.example .env.local   # then fill in the keys from `supabase status`",
      "",
    ].join("\n"),
  );
}
