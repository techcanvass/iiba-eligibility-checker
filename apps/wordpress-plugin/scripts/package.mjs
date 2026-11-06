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

const slug = "ba-certification-finder";
const stage = `dist/${slug}`;
rmSync("dist", { recursive: true, force: true });
mkdirSync(`${stage}/assets`, { recursive: true });
for (const f of [`${slug}.php`, "readme.txt", "uninstall.php"]) cpSync(f, `${stage}/${f}`);
cpSync("assets/build", `${stage}/assets/build`, { recursive: true });

// Readable source for the compiled assets/build/ file.
const src = `${stage}/source`;
cpSync("../../packages/core/src", `${src}/packages/core/src`, { recursive: true });
cpSync("../../packages/core/rules", `${src}/packages/core/rules`, { recursive: true });
cpSync("../../packages/ui/src", `${src}/packages/ui/src`, { recursive: true });
cpSync("src", `${src}/apps/wordpress-plugin/src`, { recursive: true });
cpSync("vite.config.ts", `${src}/apps/wordpress-plugin/vite.config.ts`);
writeFileSync(
  `${src}/README.md`,
  `# Source for assets/build/

assets/build/ba-certification-finder.js is compiled from this TypeScript/React source with Vite
(the styles are bundled inside it). This folder is not loaded by WordPress.

- packages/core  — certification rules (rules/iiba-rules.json) and matching logic
- packages/ui    — the finder interface (React) and styles
- apps/wordpress-plugin/src/wp-entry.tsx — mounts the finder where the shortcode is used

To rebuild from the full project: \`pnpm install\` then \`pnpm --filter wordpress-plugin build\`
(Node.js 22.9+, pnpm 9+).
`,
);

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
