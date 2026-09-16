/**
 * Stand-in for the `server-only` and `client-only` guard packages.
 *
 * Their real entry points throw outside the bundler condition they expect, so
 * importing a server module under Vitest would blow up on line one. Next.js
 * resolves them through its own bundler alias; this is the test-runner
 * equivalent.
 */
export {};
