import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const emptyModule = fileURLToPath(new URL("./tests/stubs/empty-module.ts", import.meta.url));

const alias = {
  "@": fileURLToPath(new URL("./src", import.meta.url)),
  // Next.js aliases these in its bundler; outside it their real entry points
  // throw on import, which would take down any test touching a server module.
  "server-only": emptyModule,
  "client-only": emptyModule,
};

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          setupFiles: ["tests/integration/setup.ts"],
          // Real transactions, real lock waits. The advisory-lock test
          // deliberately blocks one of two concurrent writers.
          testTimeout: 30_000,
          hookTimeout: 30_000,
          // Shared database rows: parallel files would fight over the
          // pending-todo limit and produce flaky results.
          fileParallelism: false,
        },
      },
    ],
  },
});
