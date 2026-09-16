import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type { PgTransaction } from "drizzle-orm/pg-core";

import type * as schema from "./schema";

/**
 * The handle Drizzle hands to a `transaction()` callback.
 *
 * Kept in its own module, free of any import of `pool.ts`, so that repository
 * adapters can be typed against a transaction without pulling the connection
 * pool into their dependency graph.
 */
export type Transaction = PgTransaction<
  NodePgQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;
