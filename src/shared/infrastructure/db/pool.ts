import "server-only";

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { serverEnv } from "@/shared/config/env";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

/**
 * The only place in the codebase that opens a database connection.
 *
 * `node-postgres` rather than `postgres.js` for two concrete reasons: Vercel's
 * `attachDatabasePool` lifecycle hook is documented for `pg`, and `pg` only
 * uses a prepared statement when the query is given a name, which makes
 * Supavisor's transaction mode safe by default instead of safe-if-you-remember.
 */
const globalRef = globalThis as typeof globalThis & {
  __todoPool?: Pool;
  __todoDb?: Database;
};

function registerLifecycle(pool: Pool): void {
  const onSignal = () => {
    for (const signal of ["SIGTERM", "SIGINT"] as const) {
      process.once(signal, () => {
        void pool.end();
      });
    }
  };

  if (!process.env.VERCEL) {
    onSignal();
    return;
  }

  // Fluid compute keeps the instance alive just long enough to close idle
  // connections before suspension, which is what makes TCP pooling safe there.
  // Optional dependency, so fall back to signals if it is not installed.
  void import("@vercel/functions")
    .then((mod) => mod.attachDatabasePool(pool))
    .catch(onSignal);
}

function createPool(): Pool {
  const env = serverEnv();

  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: env.DB_POOL_MAX,
    idleTimeoutMillis: env.DB_POOL_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: env.DB_POOL_CONNECT_TIMEOUT_MS,
    allowExitOnIdle: true,
  });

  // An error raised on an *idle* client surfaces on the pool rather than on a
  // query promise. With no listener attached, Node treats it as unhandled and
  // takes the process down.
  pool.on("error", (error) => {
    console.error("[db] idle client error", error);
  });

  registerLifecycle(pool);
  return pool;
}

/**
 * Cached on `globalThis` for two different reasons that happen to want the
 * same fix: in dev, HMR re-evaluates this module on every save and would open
 * a fresh pool each time until Postgres refuses connections; in production,
 * warm serverless invocations reuse the instance and should reuse the pool.
 *
 * Resolved lazily so that `next build` - which has no database - never
 * connects, and so a cold start pays the TCP handshake only if it writes.
 */
export function getPool(): Pool {
  return (globalRef.__todoPool ??= createPool());
}

export function getDb(): Database {
  return (globalRef.__todoDb ??= drizzle(getPool(), { schema, casing: "snake_case" }));
}

/** Test teardown only. Production relies on the lifecycle hooks above. */
export async function closePool(): Promise<void> {
  const pool = globalRef.__todoPool;
  globalRef.__todoPool = undefined;
  globalRef.__todoDb = undefined;
  if (pool) await pool.end();
}
