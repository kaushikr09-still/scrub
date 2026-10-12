import { defineConfig } from "vitest/config";

/**
 * onnxruntime-web's bundle also points at its larger "asyncify" runtime, which the page never loads
 * (the worker sets the runtime paths itself). Leave it out of dist/ so users never download it.
 */
const dropUnusedRuntimes = {
  name: "drop-unused-onnx-runtimes",
  generateBundle(_: unknown, bundle: Record<string, unknown>) {
    for (const file of Object.keys(bundle)) {
      if (/ort-wasm-simd-threaded.(asyncify|jsep|jspi)[^/]*.(wasm|mjs)$/.test(file)) delete bundle[file];
    }
  },
};

export default defineConfig({
  plugins: [dropUnusedRuntimes],
  worker: { format: "es" },
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
    include: ["src/**/*.test.ts", "bakeoff/**/*.test.ts", "eval/**/*.test.ts"],
  },
});
