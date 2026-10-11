// Runs the name model inside a Web Worker, off the page's main thread.
// Text arrives from the page by postMessage and is only ever read here; this file makes no requests of its
// own. The one network use is the library's one-time download of the model files (see vercel.json).
import { env, pipeline } from "@huggingface/transformers";
import ortFactory from "onnxruntime-web/ort-wasm-simd-threaded.mjs?url";
import ortWasm from "onnxruntime-web/ort-wasm-simd-threaded.wasm?url";
import { MAX_MODEL_TOKENS } from "../engine/names";
import type { FromWorker, ToWorker } from "./modelProtocol";

const MODEL_ID = "Xenova/bert-base-NER";

env.allowLocalModels = false; // never look for model files on our own site
// Run the ONNX runtime from our own site (copied into dist/ by the build), not from a CDN.
// useWasmCache off keeps the library from turning the runtime into a blob: URL, which the CSP does not allow.
env.useWasmCache = false;
const wasm = env.backends.onnx.wasm;
if (wasm) {
  wasm.wasmPaths = {
    mjs: new URL(ortFactory, import.meta.url).href,
    wasm: new URL(ortWasm, import.meta.url).href,
  };
  wasm.numThreads = 1; // threads need cross-origin isolation, which this page does not use
}

interface Tokenizer {
  encode(text: string): number[];
}
type Classifier = ((text: string, options?: { ignore_labels: string[] }) => Promise<unknown>) & { tokenizer: Tokenizer };

let classifier: Classifier | null = null;

function post(message: FromWorker): void {
  self.postMessage(message);
}

async function load(): Promise<void> {
  try {
    const pipe = await pipeline("token-classification", MODEL_ID, {
      dtype: "q8",
      device: "wasm",
      progress_callback: (e) => {
        if (e.status === "progress" && "file" in e && typeof e.loaded === "number" && typeof e.total === "number") {
          post({ type: "progress", file: e.file, loaded: e.loaded, total: e.total });
        }
      },
    });
    classifier = pipe as unknown as Classifier;
    post({ type: "ready" });
  } catch {
    post({ type: "load-error" });
  }
}

async function run(id: number, text: string): Promise<void> {
  try {
    if (!classifier) throw new Error("not loaded");
    // Count first, and never rely on the library cutting long input short: if it does not fit, say so.
    if (classifier.tokenizer.encode(text).length > MAX_MODEL_TOKENS) {
      post({ type: "result", id, predictions: null });
      return;
    }
    // ignore_labels: [] returns every token, "O" ones too. Without them we lose track of where each piece sits in the text.
    const out = (await classifier(text, { ignore_labels: [] })) as { entity: string; word: string; score: number }[];
    post({ type: "result", id, predictions: out.map((p) => ({ entity: p.entity, word: p.word, score: p.score })) });
  } catch {
    post({ type: "run-error", id });
  }
}

self.onmessage = (e: MessageEvent<ToWorker>) => {
  if (e.data.type === "load") void load();
  else void run(e.data.id, e.data.text);
};
