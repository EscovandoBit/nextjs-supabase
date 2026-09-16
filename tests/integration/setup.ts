import { config } from "dotenv";

// Integration tests read the same local configuration the app does.
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

// The unit of work talks to the pool, which insists on knowing which pooling
// mode it is in. Locally that is a direct connection to the Supabase CLI.
process.env.DB_CONNECTION_MODE ??= "direct";
process.env.DATABASE_URL ??=
  process.env.INTEGRATION_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
