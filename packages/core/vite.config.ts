import { defineConfig } from "vite";

// Builds the core (rules + logic) into ONE standalone file: dist/ba-core.js
// It defines a global `BACore` and has no dependencies, so any JavaScript engine can run it:
//   • Python package (V8 via mini-racer)   • Google Apps Script (V8)   • plain <script> tags
// The browser extension, WordPress plugin and web app import the TypeScript source directly.
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2019",
    minify: false, // readable in the Apps Script editor and in the Python package
    lib: {
      entry: "src/index.ts",
      name: "BACore",
      formats: ["iife"],
      fileName: () => "ba-core.js",
    },
  },
});
