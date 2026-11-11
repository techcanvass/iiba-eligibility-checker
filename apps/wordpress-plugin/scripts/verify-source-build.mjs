// Proves the shipped source/ folder rebuilds the shipped JavaScript exactly, the way a
// WordPress.org reviewer would: fresh folder, `pnpm install --frozen-lockfile`, `pnpm build`.
// Run after `pnpm --filter wordpress-plugin package`:  pnpm --filter wordpress-plugin source:verify
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stageSource } from "./stage-source.mjs";

const shipped = "assets/build/ba-certification-finder.js";
const dir = mkdtempSync(join(tmpdir(), "bacf-verify-"));
const run = (args) =>
  spawnSync("pnpm", args, { cwd: dir, stdio: "inherit", shell: process.platform === "win32" }).status === 0;

try {
  stageSource(dir);
  if (!run(["install", "--frozen-lockfile"])) {
    console.error("✗ pnpm install --frozen-lockfile failed. If dependencies changed, run: pnpm --filter wordpress-plugin source:lock");
    process.exit(1);
  }
  if (!run(["build"])) process.exit(1);
  const rebuilt = readFileSync(join(dir, "apps/wordpress-plugin", shipped));
  if (!rebuilt.equals(readFileSync(shipped))) {
    console.error(`✗ Rebuilt ${shipped} differs from the shipped file.`);
    process.exit(1);
  }
  console.log(`✓ source/ rebuilds ${shipped} byte-for-byte (${rebuilt.length} bytes)`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
