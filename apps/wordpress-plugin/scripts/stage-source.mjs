// Assembles the plugin's source/ folder: everything needed to rebuild
// assets/build/ba-certification-finder.js from scratch (WordPress.org guideline 4).
// Used by package.mjs (ships it), update-source-lock.mjs and verify-source-build.mjs.
// Paths are relative to apps/wordpress-plugin/.
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

const COPY = [
  // [from, to-inside-source]
  ["source-template/package.json", "package.json"],
  ["source-template/pnpm-workspace.yaml", "pnpm-workspace.yaml"],
  ["source-template/README.md", "README.md"],
  ["../../tsconfig.json", "tsconfig.json"],
  ["../../packages/core/package.json", "packages/core/package.json"],
  ["../../packages/core/vite.config.ts", "packages/core/vite.config.ts"],
  ["../../packages/core/src", "packages/core/src"],
  ["../../packages/core/rules", "packages/core/rules"],
  ["../../packages/ui/package.json", "packages/ui/package.json"],
  ["../../packages/ui/src", "packages/ui/src"],
  ["package.json", "apps/wordpress-plugin/package.json"],
  ["vite.config.ts", "apps/wordpress-plugin/vite.config.ts"],
  ["src", "apps/wordpress-plugin/src"],
];

/** Copy the source files into `dest`. With `withLock`, also add the pinned lockfile. */
export function stageSource(dest, { withLock = true } = {}) {
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  for (const [from, to] of COPY) {
    const target = join(dest, to);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(from, target, { recursive: true });
  }
  if (withLock) {
    if (!existsSync("source-template/pnpm-lock.yaml")) {
      throw new Error("Missing source-template/pnpm-lock.yaml — run: pnpm --filter wordpress-plugin source:lock");
    }
    cpSync("source-template/pnpm-lock.yaml", join(dest, "pnpm-lock.yaml"));
  }
}
