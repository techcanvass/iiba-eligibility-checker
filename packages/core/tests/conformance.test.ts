/**
 * Golden conformance tests. The same cases + expected outputs are replayed by the Python
 * package (pytest) and the Google Workspace add-on (Apps Script test), so every platform is
 * proven to run identical logic. After an intentional logic change run: pnpm golden
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as core from "../src";

const DIR = join(__dirname, "conformance");
const { cases } = JSON.parse(readFileSync(join(DIR, "cases.json"), "utf8")) as {
  cases: { name: string; fn: "buildFinderReport" | "checkEligibility"; input: unknown }[];
};
const EXPECTED = join(DIR, "expected.json");

/** Run one case the same way every platform does: value, or {error:{name,message,errors}}. */
export function runCase(fn: string, input: unknown) {
  try {
    const f = core[fn as "buildFinderReport"] as (i: unknown, r: core.RuleSet) => unknown;
    return { value: f(input, core.BUNDLED_RULES) };
  } catch (e) {
    const err = e as Error & { errors?: unknown };
    return { error: { name: err.name, message: err.message, errors: err.errors ?? null } };
  }
}

const actual = Object.fromEntries(cases.map((c) => [c.name, runCase(c.fn, c.input)]));

if (process.env.UPDATE_GOLDEN === "1") {
  writeFileSync(EXPECTED, JSON.stringify({ rulesVersion: core.BUNDLED_RULES.version, results: actual }, null, 2) + "\n");
}

describe("golden conformance (TypeScript source)", () => {
  const golden = existsSync(EXPECTED) ? JSON.parse(readFileSync(EXPECTED, "utf8")) : { results: {} };
  for (const c of cases) {
    it(c.name, () => {
      expect(actual[c.name]).toEqual(golden.results[c.name]);
    });
  }
});
