import { defineConfig } from "vitest/config";

export default defineConfig({
  server: {
    // Use PORT when a launcher assigns one; otherwise Vite's usual 5173.
    port: Number(process.env.PORT) || 5173,
    strictPort: !!process.env.PORT,
  },
  build: {
    // The polyfill uses fetch(); the page's CSP (vercel.json) blocks all fetches and one bundle needs no preloading.
    modulePreload: { polyfill: false },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
