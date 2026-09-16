"use client";

import { useId, type ComponentPropsWithoutRef } from "react";

import { cn } from "./cn";

type FieldProps = Omit<
  ComponentPropsWithoutRef<"input">,
  "id" | "aria-invalid" | "aria-describedby"
> & {
  label: string;
  hint?: string;
  error?: string;
  labelSuffix?: React.ReactNode;
};

/**
 * Label, hint, input and error wired together correctly, in one place, so the
 * accessibility story cannot drift between forms.
 */
export function Field({ label, hint, error, labelSuffix, className, ...input }: FieldProps) {
  const base = useId();
  const inputId = `${base}-input`;
  const hintId = `${base}-hint`;
  const errorId = `${base}-error`;

  // Both ids, hint before error. A common mistake is to swap the hint out for
  // the error, which drops the instruction exactly when the user needs it most.
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={inputId} className="block text-sm font-medium">
          {label}
        </label>
        {labelSuffix}
      </div>

      {hint ? (
        <p id={hintId} className="text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}

      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm",
          "placeholder:text-ink-muted aria-invalid:border-danger",
          className,
        )}
        {...input}
      />

      {/* role="alert" already implies aria-live="assertive"; do not add both. */}
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
