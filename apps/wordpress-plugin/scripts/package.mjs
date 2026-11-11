// Builds a WordPress-installable zip: dist/ba-certification-finder.zip
// with a top-level ba-certification-finder/ folder (what WordPress expects).
// Includes human-readable source in source/ (required by WordPress.org guideline 4).
//
// The zip is written in JavaScript (fflate) rather than with the OS zip tool, so it is
// identical on Windows, macOS and Linux. Windows PowerShell's Compress-Archive stores
// paths with backslashes, which WordPress on Linux (and WordPress Playground) unpacks as
// flat file names, causing "Plugin file does not exist" on activation.
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { zipSync } from "fflate";
import { stageSource } from "./stage-source.mjs";

const slug = "ba-certification-finder";
const stage = `dist/${slug}`;
rmSync("dist", { recursive: true, force: true });
mkdirSync(`${stage}/assets`, { recursive: true });
for (const f of [`${slug}.php`, "readme.txt", "uninstall.php"]) cpSync(f, `${stage}/${f}`);
cpSync("assets/build", `${stage}/assets/build`, { recursive: true });

// Complete, rebuildable source for the compiled assets/build/ file, with pinned
// dependency versions and build instructions (source/README.md).
stageSource(`${stage}/source`);

// Collect files with forward-slash paths (the zip standard), rooted at "ba-certification-finder/".
const entries = {};
function add(dir) {
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) add(full);
    else entries[relative("dist", full).split(sep).join("/")] = readFileSync(full);
  }
}
add(stage);

const zipPath = `dist/${slug}.zip`;
writeFileSync(zipPath, zipSync(entries, { level: 9 }));

const bad = Object.keys(entries).filter((p) => p.includes("\\") || !p.startsWith(`${slug}/`));
if (bad.length) throw new Error(`Bad zip paths: ${bad.join(", ")}`);
console.log(`Created apps/wordpress-plugin/${zipPath} (${Object.keys(entries).length} files)`);
