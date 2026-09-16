import "server-only";

import { z } from "zod";

const ConnectionMode = z.enum(["transaction", "session", "direct"]);
export type ConnectionMode = z.infer<typeof ConnectionMode>;

/**
 * Supavisor exposes transaction pooling on 6543 and session pooling on 5432.
 * Pointing the app at the wrong one is silently wrong rather than broken, so
 * the mode is declared explicitly and cross-checked against the port here.
 */
const EXPECTED_PORT: Record<Exclude<ConnectionMode, "direct">, number> = {
  transaction: 6543,
  session: 5432,
};

const ServerEnvSchema = z
  .object({
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    DB_CONNECTION_MODE: ConnectionMode.default("direct"),
    DB_POOL_MAX: z.coerce.number().int().min(1).max(50).default(5),
    DB_POOL_IDLE_TIMEOUT_MS: z.coerce.number().int().min(1_000).default(20_000),
    DB_POOL_CONNECT_TIMEOUT_MS: z.coerce.number().int().min(1_000).default(10_000),
  })
  .superRefine((env, ctx) => {
    if (env.DB_CONNECTION_MODE === "direct") return;

    let port: string;
    try {
      port = new URL(env.DATABASE_URL).port;
    } catch {
      ctx.addIssue({
        code: "custom",
        path: ["DATABASE_URL"],
        message:
          "DATABASE_URL could not be parsed as a URL. If the password contains @ : / or ?, percent-encode it.",
      });
      return;
    }

    const expected = EXPECTED_PORT[env.DB_CONNECTION_MODE];
    if (Number(port) !== expected) {
      ctx.addIssue({
        code: "custom",
        path: ["DATABASE_URL"],
        message:
          `DB_CONNECTION_MODE="${env.DB_CONNECTION_MODE}" expects port ${expected}, ` +
          `but DATABASE_URL uses port ${port || "(none)"}. ` +
          "Transaction pooling is 6543 and session pooling is 5432.",
      });
    }
  });

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

let cached: ServerEnv | undefined;

/**
 * Parsed lazily and memoized: nothing here should run during `next build`,
 * which has no database to talk to and no reason to need one.
 */
export function serverEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = ServerEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid server environment:\n${details}`);
  }

  cached = parsed.data;
  return cached;
}
