import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { isAuthGuarded } from "../authenticated-action";
import * as todoActions from "../todo.actions";

const actionsDir = fileURLToPath(new URL("../", import.meta.url));

/**
 * Every action module, registered by hand.
 *
 * The registry is not busywork: the first test compares it against the actual
 * directory listing, so a new `*.actions.ts` file that nobody registered fails
 * the suite, which forces it through the guard test below. Dynamic imports
 * would have skipped the new file silently, which is the one outcome that
 * matters to avoid.
 */
const ACTION_MODULES: Record<string, Record<string, unknown>> = {
  "todo.actions.ts": todoActions,
};

/**
 * The only directory allowed to export unguarded actions: sign-in and sign-up
 * cannot require a session, by definition. Declared here so the exemption is
 * auditable rather than implicit.
 */
const UNGUARDED_BY_DESIGN = ["public"];

describe("Server Action auth guard", () => {
  it("has every action module registered in this test", () => {
    const onDisk = readdirSync(actionsDir)
      .filter((entry) => entry.endsWith(".actions.ts"))
      .sort();

    expect(onDisk).toEqual(Object.keys(ACTION_MODULES).sort());
  });

  it("exempts only the directories declared above", () => {
    const directories = readdirSync(actionsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== "__tests__")
      .map((entry) => entry.name)
      .sort();

    expect(directories).toEqual([...UNGUARDED_BY_DESIGN].sort());
  });

  it.each(Object.entries(ACTION_MODULES))(
    "%s exports only guarded actions",
    (_file, module) => {
      const exported = Object.entries(module).filter(
        ([, value]) => typeof value === "function",
      );

      expect(exported.length).toBeGreaterThan(0);

      for (const [name, value] of exported) {
        expect(isAuthGuarded(value), `${name} was not produced by authenticatedAction()`).toBe(
          true,
        );
      }
    },
  );
});
