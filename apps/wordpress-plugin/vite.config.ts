import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Bundles React + core + UI into ONE self-contained JS file and ONE CSS file
// that the PHP plugin enqueues. No React needed on the WordPress side.
export default defineConfig({
  plugins: [react()],
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    outDir: "assets/build",
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: "src/wp-entry.tsx",
      name: "IIBAEligibility",
      formats: ["iife"],
      fileName: () => "iiba-eligibility-checker.js",
    },
    rollupOptions: {
      output: { assetFileNames: "iiba-eligibility-checker.[ext]" },
    },
  },
});
