import { defineConfig } from "vite";

// `pnpm build --base=/fuse-bombers/` for GitHub Pages; the default base `/` serves `pnpm dev`.
export default defineConfig({
  // Phaser alone is about 1.4 MB minified; one bundle is fine for a static party game.
  build: { target: "es2022", chunkSizeWarningLimit: 2000 },
  server: { host: "0.0.0.0" },
});
