// Copies the shared core (built by `pnpm --filter @iiba/core build`) into the Python package.
// The Python package contains NO logic of its own — it runs this exact file inside V8.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";

const out = "src/ba_cert_finder/_assets";
mkdirSync(out, { recursive: true });
const core = "../../packages/core/dist/ba-core.js";
if (!existsSync(core)) {
  console.error("Missing packages/core/dist/ba-core.js — run: pnpm --filter @iiba/core build");
  process.exit(1);
}
copyFileSync(core, `${out}/ba-core.js`);
copyFileSync("../../packages/core/rules/iiba-rules.json", `${out}/iiba-rules.json`);
console.log(`Synced shared core → apps/python-package/${out}/`);
