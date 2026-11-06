import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Bundles the shared UI (React + core + styles) into one script that scripts/assemble.mjs
// inlines into dist/Sidebar.html. Apps Script serves the sidebar as a single HTML file.
export default defineConfig({
  plugins: [react()],
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    outDir: "build",
    emptyOutDir: true,
    lib: {
      entry: "src/sidebar.tsx",
      name: "BACFSidebar",
      formats: ["iife"],
      fileName: () => "sidebar.js",
    },
  },
});
