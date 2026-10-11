// The page's side of the name model: talks to the worker, tracks loading / ready / failed.
// Only chunks of the user's text go to the worker, which runs in this same browser; nothing leaves the page.
import { findNames, type NameRunner } from "../engine/names";
import type { RawPrediction } from "../engine/spans";
import type { Detection } from "../engine/types";
import type { ModelState, NameChecker } from "./app";
import type { FromWorker, ToWorker } from "./modelProtocol";

/** The part of a Worker this class uses, so tests can stand in for it. */
export interface WorkerLike {
  postMessage(message: ToWorker): void;
  terminate(): void;
  onmessage: ((event: { data: FromWorker }) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

export interface ModelClientOptions {
  /** How long one chunk may take before the model counts as failed. */
  timeoutMs?: number;
  /** Called whenever the state or progress changes. */
  onChange?: () => void;
}

interface Pending {
  resolve: (p: RawPrediction[] | null) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class ModelClient implements NameChecker {
  private current: ModelState = "loading";
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private readonly files = new Map<string, { loaded: number; total: number }>();
  private readonly timeoutMs: number;

  constructor(
    private readonly worker: WorkerLike,
    private readonly options: ModelClientOptions = {},
  ) {
    this.timeoutMs = options.timeoutMs ?? 120_000;
    worker.onmessage = (e) => this.onMessage(e.data);
    worker.onerror = () => this.fail();
    worker.postMessage({ type: "load" });
  }

  state(): ModelState {
    return this.current;
  }

  /** 0 to 1 while downloading, null before any news, 1 once ready. */
  progress(): number | null {
    if (this.current === "ready") return 1;
    let loaded = 0;
    let total = 0;
    for (const f of this.files.values()) {
      loaded += f.loaded;
      total += f.total;
    }
    return total > 0 ? Math.min(loaded / total, 1) : null;
  }

  readonly runner: NameRunner = (chunk) => {
    if (this.current !== "ready") return Promise.reject(new Error("model not ready"));
    return new Promise<RawPrediction[] | null>((resolve, reject) => {
      const id = this.nextId++;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("model timed out"));
        this.fail();
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.worker.postMessage({ type: "run", id, text: chunk });
    });
  };

  find(text: string): Promise<Detection[]> {
    return findNames(text, this.runner);
  }

  private onMessage(m: FromWorker): void {
    switch (m.type) {
      case "progress":
        this.files.set(m.file, { loaded: m.loaded, total: m.total });
        break;
      case "ready":
        if (this.current === "loading") this.current = "ready";
        break;
      case "load-error":
        this.fail();
        return;
      case "result":
      case "run-error": {
        const p = this.pending.get(m.id);
        if (!p) return;
        this.pending.delete(m.id);
        clearTimeout(p.timer);
        if (m.type === "result") p.resolve(m.predictions);
        else p.reject(new Error("model error"));
        return;
      }
    }
    this.options.onChange?.();
  }

  /** Stops the worker, rejects everything still waiting, and marks the names as not checkable. */
  private fail(): void {
    this.current = "failed";
    this.worker.terminate();
    for (const [id, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new Error("model failed"));
      this.pending.delete(id);
    }
    this.options.onChange?.();
  }
}
