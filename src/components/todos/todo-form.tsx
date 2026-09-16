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
import { createTodoAction } from "@/actions/todo.actions";
import { Field } from "@/components/ui/field";
import { CreateTodoInput } from "@/modules/todos/contracts/todo.contracts";
import { MAX_PENDING_TODOS, TITLE_MAX_LENGTH } from "@/modules/todos/domain/todo";

type CreateResult = { id: string };

/**
 * Bound through `useActionState`, which Next.js progressively enhances: this
 * form still submits and still works with JavaScript disabled.
 */
export function TodoForm() {
  const [state, formAction, isPending] = useActionState<ActionState<CreateResult>, FormData>(
    createTodoAction,
    idleActionState,
  );
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});

  const formRef = useRef<HTMLFormElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  const titleError = clientErrors.title?.[0] ?? fieldError(state, "title");
  const pageError = formError(state);

  useEffect(() => {
    if (pageError) summaryRef.current?.focus();
  }, [pageError, state]);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      setClientErrors({});
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      noValidate
      aria-busy={isPending}
      className="mt-6 space-y-2"
      onSubmit={(event) => {
        if (isPending) {
          event.preventDefault();
          return;
        }

        const entries = Object.fromEntries(new FormData(event.currentTarget));
        const parsed = CreateTodoInput.safeParse(entries);

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

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Field
            label="Nova tarefa"
            name="title"
            type="text"
            autoComplete="off"
            maxLength={TITLE_MAX_LENGTH}
            placeholder="Comprar leite"
            aria-required="true"
            hint={`Até ${TITLE_MAX_LENGTH} caracteres. Máximo de ${MAX_PENDING_TODOS} tarefas pendentes.`}
            error={titleError}
          />
        </div>

        <button
          type="submit"
          aria-disabled={isPending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition-opacity aria-disabled:opacity-60"
        >
          Adicionar
        </button>
      </div>

      {/* Announces success without stealing focus - the form resets and
          visually "nothing happens", which is silent to a screen reader. */}
      <p
        role="status"
        aria-live="polite"
        aria-label="Estado do formulário de nova tarefa"
        className="sr-only"
      >
        {isPending ? "Salvando tarefa." : state.status === "success" ? state.message : ""}
      </p>
    </form>
  );
}
