import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Vite resolves a leading "/" against the project root, which avoids
    // pulling in @types/node just to build a path here.
    alias: { "@": "/src" },
  },
  build: {
    outDir: "dist",
    // The only chunk over the default limit is three.js, which is lazily
    // loaded by the 3D warehouse view and never reaches a user who does not
    // open it. Splitting the dashboards further would trade a one-off load for
    // a visible pause mid-presentation, which is the wrong trade here.
    chunkSizeWarningLimit: 1300,
    rollupOptions: {
      output: {
        // Recharts and its d3 dependencies are roughly half the bundle and
        // change far less often than the application code, so they are split
        // into their own long-lived chunk.
        manualChunks: {
          charts: ["recharts"],
          // three.js only loads when the 3D warehouse view is opened.
          three: ["three", "@react-three/fiber", "@react-three/drei"],
          react: ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
});
