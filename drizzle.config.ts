import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Next.js loads `.env` then `.env.local` (local wins). `dotenv/config` only
// reads `.env`, which is why drizzle-kit was failing with vars sitting in
// `.env.local`.
config({ path: ".env" });
config({ path: ".env.local", override: true });

// Migrations run as the table owner, which is the one context where bypassing
// RLS is correct. Application code never sees this connection string.
const url = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    "MIGRATION_DATABASE_URL (or DATABASE_URL) must be set to run drizzle-kit. Put it in .env.local (see .env.example).",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/shared/infrastructure/db/schema.ts",
  out: "./supabase/migrations",
  dbCredentials: { url },
  casing: "snake_case",
  verbose: true,
  strict: true,
  // Supabase ships its own roles (anon, authenticated, service_role, ...).
  // Without this, drizzle-kit tries to manage and drop them.
  entities: {
    roles: { provider: "supabase" },
  },
});
