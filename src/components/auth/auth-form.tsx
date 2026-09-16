"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { z } from "zod";

import {
  fieldError,
  formError,
  idleActionState,
  type ActionState,
  type FieldErrors,
} from "@/actions/action-state";
import { signInAction, signUpAction } from "@/actions/public/auth.actions";
import { Field } from "@/components/ui/field";
import {
  PASSWORD_MIN_LENGTH,
  SignInInput,
  SignUpInput,
} from "@/modules/auth/contracts/auth.contracts";

type Mode = "signin" | "signup";

export function AuthForm({ mode, next }: { mode: Mode; next?: string }) {
  const action = mode === "signin" ? signInAction : signUpAction;
  const schema = mode === "signin" ? SignInInput : SignUpInput;

  const [state, formAction, isPending] = useActionState<ActionState<never>, FormData>(
    action,
    idleActionState,
  );
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});

  const summaryRef = useRef<HTMLDivElement>(null);
  const pageError = formError(state);

  // Without moving focus, a screen-reader user hears the alert but has no
  // context and no way back to the offending control.
  useEffect(() => {
    if (pageError) summaryRef.current?.focus();
  }, [pageError, state]);

  const errorFor = (field: "email" | "password") =>
    clientErrors[field]?.[0] ?? fieldError(state, field);

  return (
    <form
      action={formAction}
      noValidate
      aria-busy={isPending}
      className="space-y-4"
      onSubmit={(event) => {
        if (isPending) {
          event.preventDefault();
          return;
        }

        // Same schema the Server Action uses. This is UX; the server remains
        // the authority and validates again regardless.
        const entries = Object.fromEntries(new FormData(event.currentTarget));
        const parsed = schema.safeParse(entries);

        if (!parsed.success) {
          event.preventDefault();
          setClientErrors(z.flattenError(parsed.error).fieldErrors as FieldErrors);
          return;
        }

        setClientErrors({});
      }}
    >
      {pageError ? (
        <div
          ref={summaryRef}
          role="alert"
          tabIndex={-1}
          className="rounded-md border border-danger bg-danger-surface px-3 py-2 text-sm text-danger"
        >
          {pageError}
        </div>
      ) : null}

      {mode === "signin" && next ? <input type="hidden" name="next" value={next} /> : null}

      <Field
        label="E-mail"
        name="email"
        type="email"
        autoComplete="email"
        aria-required="true"
        error={errorFor("email")}
        onBlur={(event) => {
          const result = SignInInput.shape.email.safeParse(event.currentTarget.value);
          setClientErrors((previous) => ({
            ...previous,
            email: result.success ? undefined : z.flattenError(result.error).formErrors,
          }));
        }}
      />

      <Field
        label="Senha"
        name="password"
        type="password"
        autoComplete={mode === "signin" ? "current-password" : "new-password"}
        aria-required="true"
        hint={mode === "signup" ? `Ao menos ${PASSWORD_MIN_LENGTH} caracteres.` : undefined}
        error={errorFor("password")}
      />

      {/* aria-disabled rather than disabled: a disabled button leaves the tab
          order mid-submit and dumps focus at the top of the document. */}
      <button
        type="submit"
        aria-disabled={isPending}
        className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition-opacity aria-disabled:opacity-60"
      >
        {mode === "signin" ? "Entrar" : "Criar conta"}
      </button>

      <p
        role="status"
        aria-live="polite"
        aria-label="Estado do formulário"
        className="sr-only"
      >
        {isPending ? "Enviando." : state.status === "success" ? state.message : ""}
      </p>

      {state.status === "success" ? (
        <p className="rounded-md border border-line bg-surface-raised px-3 py-2 text-sm">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
