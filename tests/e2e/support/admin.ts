import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/**
 * Fixture-only Supabase client. The service_role key bypasses RLS completely,
 * so this is one of exactly two places it may appear in the repository - the
 * other being `drizzle.config.ts` for migrations. It must never be reachable
 * from `src/`.
 */
export function admin() {
  if (!SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for end-to-end tests. Copy it from `supabase status`.",
    );
  }

  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type Account = {
  id: string;
  email: string;
  password: string;
};

export async function createAccount(label: string): Promise<Account> {
  const email = `${label}-${crypto.randomUUID()}@e2e.test`;
  const password = `Pw-${crypto.randomUUID()}`;

  const { data, error } = await admin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(`Could not create account: ${error?.message ?? "unknown error"}`);
  }

  return { id: data.user.id, email, password };
}

export async function deleteAccount(id: string): Promise<void> {
  // Cascades to todos via the foreign key.
  await admin().auth.admin.deleteUser(id);
}

/**
 * Seeds rows straight past RLS and past the domain's pending-todo limit.
 *
 * Going through the UI would cap the fixture at five pending todos, which is
 * not enough to exercise pagination. Seeded rows default to `done: true` so
 * they never compete with the limit in tests that also create todos.
 */
export async function seedTodos(
  userId: string,
  titles: string[],
  options: { done?: boolean } = {},
): Promise<void> {
  const done = options.done ?? true;

  const { error } = await admin()
    .from("todos")
    .insert(titles.map((title) => ({ user_id: userId, title, done })));

  if (error) throw new Error(`Could not seed todos: ${error.message}`);
}
