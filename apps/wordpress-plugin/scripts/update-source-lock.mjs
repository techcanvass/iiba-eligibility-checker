// Regenerates source-template/pnpm-lock.yaml (exact versions for the plugin's source/ folder).
// Run after changing dependencies of packages/core, packages/ui or this plugin:
//   pnpm --filter wordpress-plugin source:lock
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stageSource } from "./stage-source.mjs";

const dir = mkdtempSync(join(tmpdir(), "bacf-source-"));
try {
  stageSource(dir, { withLock: false });
  const r = spawnSync("pnpm", ["install", "--lockfile-only"], {
    cwd: dir,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
  cpSync(join(dir, "pnpm-lock.yaml"), "source-template/pnpm-lock.yaml");
  console.log("Updated apps/wordpress-plugin/source-template/pnpm-lock.yaml");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
