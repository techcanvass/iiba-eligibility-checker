// Assembles the Apps Script project in dist/ (what `clasp push` uploads):
//   appsscript.json  manifest
//   Code.js          menu, sidebar and Sheets formulas (thin wrapper)
//   Core.js          the shared core — an exact copy of packages/core/dist/ba-core.js
//   Sidebar.html     the shared UI inlined into one HTML file
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const core = "../../packages/core/dist/ba-core.js";
const sidebarJs = "build/sidebar.js";
for (const f of [core, sidebarJs]) {
  if (!existsSync(f)) {
    console.error(`Missing ${f} — run: pnpm --filter google-workspace build`);
    process.exit(1);
  }
}

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist");
copyFileSync("src/appsscript.json", "dist/appsscript.json");
copyFileSync("src/Code.js", "dist/Code.js");
copyFileSync(core, "dist/Core.js");

// "</script" inside inline JS would end the <script> tag early.
const js = readFileSync(sidebarJs, "utf8").replace(/<\/script/gi, "<\\/script");
writeFileSync(
  "dist/Sidebar.html",
  `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { margin: 0; background: #f5f8fc; }
      #root { padding: 12px; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script>
${js}
    </script>
  </body>
</html>
`,
);
const kb = (f) => (readFileSync(f).length / 1024).toFixed(1) + " kB";
console.log(
  `Apps Script project ready in apps/google-workspace/dist/ (Code.js ${kb("dist/Code.js")}, Core.js ${kb("dist/Core.js")}, Sidebar.html ${kb("dist/Sidebar.html")})`,
);
