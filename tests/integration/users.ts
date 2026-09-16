import { createClient } from "@supabase/supabase-js";

import { SERVICE_ROLE_KEY, SUPABASE_URL } from "./environment";

/**
 * `todos.user_id` has a foreign key to `auth.users`, so integration tests need
 * genuine auth records rather than invented UUIDs.
 *
 * The service_role key bypasses RLS entirely. Test fixtures are one of exactly
 * two places it is allowed to appear in this repository (the other is
 * `drizzle.config.ts`, for migrations). It must never reach application code.
 */
function admin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type TestUser = {
  id: string;
  email: string;
  password: string;
};

export async function createTestUser(label: string): Promise<TestUser> {
  const email = `${label}-${crypto.randomUUID()}@integration.test`;
  const password = `pw-${crypto.randomUUID()}`;

  const { data, error } = await admin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(`Could not create test user: ${error?.message ?? "unknown error"}`);
  }

  return { id: data.user.id, email, password };
}

export async function deleteTestUser(userId: string): Promise<void> {
  // Cascades to todos through the foreign key, so no manual cleanup needed.
  await admin().auth.admin.deleteUser(userId);
}
