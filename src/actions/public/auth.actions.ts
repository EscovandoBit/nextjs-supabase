"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import {
  safeInternalPath,
  SignInInput,
  SignUpInput,
} from "@/modules/auth/contracts/auth.contracts";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server";
import type { ActionState, FieldErrors } from "../action-state";

/**
 * The only unguarded actions in the codebase, and the reason
 * `src/actions/public/` exists as a directory: sign-in and sign-up cannot
 * require a session. `actions-are-guarded.test.ts` asserts this is the single
 * exemption, so adding another one fails the suite rather than passing quietly.
 */

/**
 * Deliberately identical for "unknown e-mail" and "wrong password". Telling
 * them apart is a user-enumeration oracle.
 */
const INVALID_CREDENTIALS = "E-mail ou senha inválidos.";

function invalid(error: z.ZodError): ActionState<never> {
  return {
    status: "error",
    message: "Corrija os campos destacados.",
    errors: z.flattenError(error).fieldErrors as FieldErrors,
  };
}

export async function signInAction(
  _previous: ActionState<never>,
  formData: FormData,
): Promise<ActionState<never>> {
  const parsed = SignInInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return {
      status: "error",
      message: INVALID_CREDENTIALS,
      errors: {},
      formError: INVALID_CREDENTIALS,
    };
  }

  // Outside any try/catch: redirect() signals by throwing, and swallowing it
  // here would leave the user staring at a submitted form.
  redirect(safeInternalPath(parsed.data.next));
}

export async function signUpAction(
  _previous: ActionState<never>,
  formData: FormData,
): Promise<ActionState<never>> {
  const parsed = SignUpInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return {
      status: "error",
      message: error.message,
      errors: {},
      formError: error.message,
    };
  }

  // With e-mail confirmation enabled there is no session yet, so there is
  // nothing to redirect into.
  if (!data.session) {
    return {
      status: "success",
      message: "Conta criada. Confira seu e-mail para confirmar o acesso.",
      data: undefined as never,
    };
  }

  redirect("/todos");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
