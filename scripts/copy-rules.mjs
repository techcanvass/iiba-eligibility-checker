// Copies the rules JSON into a build folder so it can be hosted at e.g. /iiba-rules.json
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(process.cwd(), process.argv[2] ?? "dist");
mkdirSync(outDir, { recursive: true });
copyFileSync(join(root, "packages/core/rules/iiba-rules.json"), join(outDir, "iiba-rules.json"));
console.log(`Copied iiba-rules.json → ${outDir}`);
