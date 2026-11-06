// Replays the shared golden cases against the BUILT files every platform ships:
//   packages/core/dist/ba-core.js                       (used by the Python package)
//   apps/google-workspace/dist/Core.js (+ Code.js)       (Google Apps Script project)
// Each is loaded into a bare JavaScript context with no browser or Node features, like V8 in
// Python and Apps Script. Run after `pnpm build`:  pnpm verify:bundles
import { existsSync, readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const DIR = "packages/core/tests/conformance";
const { cases } = JSON.parse(readFileSync(`${DIR}/cases.json`, "utf8"));
const golden = JSON.parse(readFileSync(`${DIR}/expected.json`, "utf8"));

function runAll(files) {
  const ctx = {};
  vm.createContext(ctx);
  for (const f of files) vm.runInContext(readFileSync(f, "utf8"), ctx, { filename: f });
  vm.runInContext(
    `globalThis.__run = function (fn, input) {
       try { return JSON.stringify({ value: BACore[fn](JSON.parse(input), BACore.BUNDLED_RULES) }); }
       catch (e) { return JSON.stringify({ error: { name: e.name, message: e.message, errors: e.errors || null } }); }
     };`,
    ctx,
  );
  let pass = 0;
  for (const c of cases) {
    const got = JSON.parse(ctx.__run(c.fn, JSON.stringify(c.input)));
    assert.deepEqual(got, golden.results[c.name], `${files[0]}: "${c.name}" differs from golden`);
    pass++;
  }
  return pass;
}

const targets = [
  ["Shared core bundle (Python package)", ["packages/core/dist/ba-core.js"]],
  ["Google Workspace add-on", ["apps/google-workspace/dist/Core.js", "apps/google-workspace/dist/Code.js"]],
];
let failed = false;
for (const [label, files] of targets) {
  const missing = files.find((f) => !existsSync(f));
  if (missing) {
    console.error(`✗ ${label}: ${missing} not found — run pnpm build first`);
    failed = true;
    continue;
  }
  try {
    console.log(`✓ ${label}: ${runAll(files)}/${cases.length} golden cases identical`);
  } catch (e) {
    console.error(`✗ ${label}: ${e.message}`);
    failed = true;
  }
}
process.exit(failed ? 1 : 0);
