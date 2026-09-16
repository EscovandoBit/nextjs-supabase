import type { UserId } from "./ids";

/**
 * A session whose JWT signature has actually been verified.
 *
 * The brand key is a `unique symbol` that is declared but never exported, so
 * no other module can write an object literal of this type: there is no way to
 * name the key. That makes the unsafe path unrepresentable rather than merely
 * discouraged, which matters because `RlsUnitOfWork` requires one of these to
 * open a transaction. No session means no transaction means no write, checked
 * by the compiler.
 *
 * The remaining escape hatch is a deliberate `as AuthenticatedSession` cast.
 * TypeScript always allows that, so the guarantee is precisely: accidental
 * construction is impossible, and intentional forgery is a one-line grep
 * (`rg 'as AuthenticatedSession'`) that should only ever match
 * `shared/infrastructure/auth/verify-session.ts`.
 */
declare const authenticatedSessionBrand: unique symbol;

export type AuthenticatedSession = {
  readonly [authenticatedSessionBrand]: true;
  readonly userId: UserId;
  readonly role: "authenticated";
  /**
   * The verified claim set, serialized. Injected verbatim into
   * `request.jwt.claims` so Postgres RLS can evaluate `auth.uid()`.
   */
  readonly claimsJson: string;
};
