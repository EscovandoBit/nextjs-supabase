/**
 * Layer boundaries, enforced in CI. This is the TypeScript equivalent of
 * import-linter in a Python project: without it the architecture decays into
 * folders that merely look layered.
 *
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  forbidden: [
    {
      name: "domain-is-pure",
      comment:
        "Domain depends on nothing. Not React, not Next, not Drizzle, not Zod. " +
        "If you need a framework type here, the code belongs in another layer.",
      severity: "error",
      from: { path: "^src/modules/[^/]+/domain" },
      to: { pathNot: "^src/(modules/[^/]+/domain|shared/domain)" },
    },
    {
      name: "application-no-infra",
      comment:
        "Use cases talk to ports only. Importing a concrete adapter here defeats the whole pattern.",
      severity: "error",
      from: { path: "^src/modules/[^/]+/application" },
      to: { path: "^src/(shared/infrastructure|modules/[^/]+/infrastructure)" },
    },
    {
      name: "only-composition-knows-adapters",
      comment:
        "Concrete repositories are wired in composition/ (and referenced by the " +
        "unit of work that owns the transaction). Nowhere else.",
      severity: "error",
      from: {
        pathNot: "^src/(composition|modules/[^/]+/infrastructure|shared/infrastructure)",
      },
      to: { path: "^src/modules/[^/]+/infrastructure" },
    },
    {
      name: "pool-is-private",
      comment:
        "The connection pool is a singleton with exactly one owner. Reaching for it " +
        "elsewhere is how you end up with four pools and an exhausted Supavisor.",
      severity: "error",
      from: { pathNot: "^src/(composition|shared/infrastructure/db)" },
      to: { path: "^src/shared/infrastructure/db/pool\\.ts$" },
    },
    {
      name: "actions-no-direct-persistence",
      comment:
        "Server Actions go through the container. They never touch the database or a repository directly.",
      severity: "error",
      from: { path: "^src/actions" },
      to: { path: "^src/(shared/infrastructure/db|modules/[^/]+/infrastructure)" },
    },
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
  ],

  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.json" },
    // Count type-only imports too: a type import from infrastructure still
    // couples the layers at build time.
    tsPreCompilationDeps: true,
    exclude: { path: "\\.test\\.ts$|/__tests__/|^tests/" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
    },
  },
};
