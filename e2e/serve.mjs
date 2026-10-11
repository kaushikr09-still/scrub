// Tiny static server for /dist. Sends exactly the headers in vercel.json (Vite preview does not apply them).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dist = join(root, "dist");
const port = Number(process.env.E2E_PORT) || 4173;

const config = JSON.parse(await readFile(join(root, "vercel.json"), "utf8"));
const headers = {};
for (const block of config.headers) {
  if (block.source !== "/(.*)") throw new Error(`serve.mjs only understands the "/(.*)" source, got ${block.source}`);
  for (const h of block.headers) headers[h.key] = h.value;
}

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".wasm": "application/wasm",
  ".json": "application/json",
  ".svg": "image/svg+xml",
};

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
  const file = normalize(join(dist, path.endsWith("/") ? path + "index.html" : path));
  let body;
  let status = 200;
  let type = types[extname(file)] ?? "application/octet-stream";
  if (file.startsWith(dist)) {
    try {
      body = await readFile(file);
    } catch {
      /* fall through to 404 */
    }
  }
  if (!body) {
    status = 404;
    body = "Not found";
    type = "text/plain";
  }
  res.writeHead(status, { ...headers, "Content-Type": type });
  res.end(body);
}).listen(port, "127.0.0.1", () => console.log(`serving dist on http://127.0.0.1:${port}`));
