import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RawPrediction } from "../engine/spans";
import { ModelClient, type WorkerLike } from "./modelClient";
import type { FromWorker, ToWorker } from "./modelProtocol";

class FakeWorker implements WorkerLike {
  sent: ToWorker[] = [];
  terminated = false;
  onmessage: ((e: { data: FromWorker }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  postMessage(m: ToWorker): void {
    this.sent.push(m);
  }
  terminate(): void {
    this.terminated = true;
  }
  say(data: FromWorker): void {
    this.onmessage?.({ data });
  }
  crash(): void {
    this.onerror?.({});
  }
  lastId(): number {
    return (this.sent[this.sent.length - 1] as { id: number }).id;
  }
}

const PRED: RawPrediction[] = [{ entity: "B-PER", word: "Priya", start: 0, end: 5, score: 0.9 }];

function setup(timeoutMs = 1000) {
  const worker = new FakeWorker();
  let changes = 0;
  const client = new ModelClient(worker, { timeoutMs, onChange: () => changes++ });
  return { worker, client, changes: () => changes };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("ModelClient state", () => {
  it("asks the worker to load as soon as it is created, and starts in loading", () => {
    const { worker, client } = setup();
    expect(worker.sent).toEqual([{ type: "load" }]);
    expect(client.state()).toBe("loading");
    expect(client.progress()).toBeNull();
  });

  it("becomes ready when the worker says so, and tells the page", () => {
    const { worker, client, changes } = setup();
    worker.say({ type: "ready" });
    expect(client.state()).toBe("ready");
    expect(client.progress()).toBe(1);
    expect(changes()).toBeGreaterThan(0);
  });

  it("becomes failed when loading fails", () => {
    const { worker, client } = setup();
    worker.say({ type: "load-error" });
    expect(client.state()).toBe("failed");
  });

  it("becomes failed when the worker itself crashes, and stops it", () => {
    const { worker, client } = setup();
    worker.crash();
    expect(client.state()).toBe("failed");
    expect(worker.terminated).toBe(true);
  });

  it("a ready model that crashes later becomes failed", () => {
    const { worker, client } = setup();
    worker.say({ type: "ready" });
    worker.crash();
    expect(client.state()).toBe("failed");
  });

  it("a late 'ready' cannot undo a failure", () => {
    const { worker, client } = setup();
    worker.say({ type: "load-error" });
    worker.say({ type: "ready" });
    expect(client.state()).toBe("failed");
  });

  it("reports download progress across files, counting each file once", () => {
    const { worker, client } = setup();
    worker.say({ type: "progress", file: "config.json", loaded: 500, total: 500 });
    worker.say({ type: "progress", file: "model.onnx", loaded: 25_000, total: 100_000 });
    worker.say({ type: "progress", file: "model.onnx", loaded: 50_000, total: 100_000 });
    expect(client.progress()).toBeCloseTo(50_500 / 100_500, 5);
    worker.say({ type: "ready" });
    expect(client.progress()).toBe(1);
  });
});

describe("ModelClient runner", () => {
  it("sends text to the worker and resolves with its predictions", async () => {
    const { worker, client } = setup();
    worker.say({ type: "ready" });
    const p = client.runner("Priya here");
    expect(worker.sent[1]).toMatchObject({ type: "run", text: "Priya here" });
    worker.say({ type: "result", id: worker.lastId(), predictions: PRED });
    await expect(p).resolves.toEqual(PRED);
  });

  it("passes on null (chunk over the token limit)", async () => {
    const { worker, client } = setup();
    worker.say({ type: "ready" });
    const p = client.runner("x");
    worker.say({ type: "result", id: worker.lastId(), predictions: null });
    await expect(p).resolves.toBeNull();
  });

  it("keeps simultaneous requests apart", async () => {
    const { worker, client } = setup();
    worker.say({ type: "ready" });
    const a = client.runner("a");
    const b = client.runner("b");
    const [ida, idb] = [worker.sent[1], worker.sent[2]].map((m) => (m as { id: number }).id);
    expect(ida).not.toBe(idb);
    worker.say({ type: "result", id: idb, predictions: [] });
    worker.say({ type: "result", id: ida, predictions: PRED });
    await expect(a).resolves.toEqual(PRED);
    await expect(b).resolves.toEqual([]);
  });

  it("rejects when the model is not ready, without sending anything", async () => {
    const { worker, client } = setup();
    await expect(client.runner("text")).rejects.toThrow();
    expect(worker.sent).toEqual([{ type: "load" }]);
  });

  it("rejects one request on run-error but stays ready", async () => {
    const { worker, client } = setup();
    worker.say({ type: "ready" });
    const p = client.runner("text");
    worker.say({ type: "run-error", id: worker.lastId() });
    await expect(p).rejects.toThrow();
    expect(client.state()).toBe("ready");
  });

  it("a worker crash rejects every request still waiting, and the model becomes failed", async () => {
    const { worker, client } = setup();
    worker.say({ type: "ready" });
    const a = client.runner("a");
    const b = client.runner("b");
    const checks = Promise.all([expect(a).rejects.toThrow(), expect(b).rejects.toThrow()]);
    worker.crash();
    await checks;
    expect(client.state()).toBe("failed");
  });

  it("times out a request that never answers: rejects and marks the model failed", async () => {
    const { worker, client } = setup(1000);
    worker.say({ type: "ready" });
    const p = client.runner("text");
    const assertion = expect(p).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(1001);
    await assertion;
    expect(client.state()).toBe("failed");
    expect(worker.terminated).toBe(true);
  });

  it("error messages never contain the text", async () => {
    const { worker, client } = setup();
    worker.say({ type: "ready" });
    const p = client.runner("Priya Sharma secret");
    worker.say({ type: "run-error", id: worker.lastId() });
    const err = await p.catch((e: unknown) => e);
    expect((err as Error).message).not.toContain("Priya");
  });
});

describe("ModelClient.find", () => {
  it("finds names through the engine", async () => {
    const { worker, client } = setup();
    worker.say({ type: "ready" });
    const p = client.find("Priya wrote");
    worker.say({ type: "result", id: worker.lastId(), predictions: PRED });
    const found = await p;
    expect(found.map((d) => [d.type, d.value])).toEqual([["PERSON", "Priya"]]);
  });

  it("a model failure during find rejects, so the scrub falls back to rules-only", async () => {
    const { worker, client } = setup();
    worker.say({ type: "ready" });
    const p = client.find("Priya wrote");
    const check = expect(p).rejects.toThrow();
    worker.say({ type: "run-error", id: worker.lastId() });
    await check;
  });
});
