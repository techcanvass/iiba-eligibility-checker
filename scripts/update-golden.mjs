// Regenerates packages/core/tests/conformance/expected.json from the TypeScript core.
// Run after an INTENTIONAL logic change: pnpm golden   (works on Windows, macOS, Linux)
import { spawnSync } from "node:child_process";

const r = spawnSync("pnpm", ["exec", "vitest", "run", "packages/core/tests/conformance.test.ts"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, UPDATE_GOLDEN: "1" },
});
console.log(r.status === 0 ? "Golden file updated: packages/core/tests/conformance/expected.json" : "Failed");
process.exit(r.status ?? 1);
