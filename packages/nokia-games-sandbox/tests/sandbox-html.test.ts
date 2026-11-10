import { createHash } from "node:crypto";
import { MessageChannel } from "node:worker_threads";
import { describe, expect, it } from "vite-plus/test";
import { SANDBOX_CSP, SANDBOX_HTML } from "../src/sandbox-html";

function bootstrapScript(): string {
  const scripts = [...SANDBOX_HTML.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  expect(scripts).toHaveLength(1);
  return scripts[0]![1]!;
}

function directives(csp: string): Record<string, string[]> {
  return Object.fromEntries(
    csp.split(";").map((directive) => {
      const [name, ...values] = directive.trim().split(/\s+/);
      return [name!, values];
    }),
  );
}

describe("SANDBOX_CSP", () => {
  it("is D7's L4 policy with the hash of the bootstrap script", () => {
    const hash = createHash("sha256").update(bootstrapScript(), "utf8").digest("base64");
    expect(directives(SANDBOX_CSP)).toEqual({
      "default-src": ["'none'"],
      "script-src": [`'sha256-${hash}'`, "'unsafe-eval'", "'wasm-unsafe-eval'"],
      "worker-src": ["blob:"],
    });
  });

  it("allows no network and no inline script other than the bootstrap", () => {
    expect(SANDBOX_CSP).not.toMatch(/connect-src|https?:|\*|'unsafe-inline'|data:/);
  });
});

describe("SANDBOX_HTML", () => {
  it("declares the policy in a meta element before its only script", () => {
    const meta = `<meta http-equiv="Content-Security-Policy" content="${SANDBOX_CSP}">`;
    expect(SANDBOX_HTML.startsWith("<!doctype html>")).toBe(true);
    expect(SANDBOX_HTML.indexOf(meta)).toBeGreaterThan(0);
    expect(SANDBOX_HTML.indexOf(meta)).toBeLessThan(SANDBOX_HTML.indexOf("<script>"));
    expect(SANDBOX_HTML.match(/<script/g)).toHaveLength(1);
    // The markup is ASCII, so the hash does not depend on how a host serves or embeds it.
    expect(SANDBOX_HTML).toMatch(/^[\x20-\x7e\n]*$/);
  });
});

/** Runs the bootstrap against a fake frame; nothing here needs a DOM. */
function frame() {
  const parent = {};
  const listeners: ((event: unknown) => void)[] = [];
  const revoked: string[] = [];
  const blobs = new Map<string, { parts: unknown[]; options: unknown }>();
  class FakeBlob {
    constructor(
      readonly parts: unknown[],
      readonly options: unknown,
    ) {}
  }
  class FakeWorker {
    static readonly made: FakeWorker[] = [];
    readonly posted: { message: unknown; transfer: unknown }[] = [];
    terminated = false;
    constructor(readonly url: string) {
      FakeWorker.made.push(this);
    }
    postMessage(message: unknown, transfer: unknown) {
      this.posted.push({ message, transfer });
    }
    terminate() {
      this.terminated = true;
    }
  }
  const url = {
    createObjectURL(blob: FakeBlob) {
      const made = `blob:null/${blobs.size}`;
      blobs.set(made, blob);
      return made;
    },
    revokeObjectURL(revokedUrl: string) {
      revoked.push(revokedUrl);
    },
  };
  // oxlint-disable-next-line typescript/no-implied-eval -- the script under test is a string
  new Function("addEventListener", "parent", "Blob", "Worker", "URL", bootstrapScript())(
    (type: string, listener: (event: unknown) => void) => {
      expect(type).toBe("message");
      listeners.push(listener);
    },
    parent,
    FakeBlob,
    FakeWorker,
    url,
  );
  return {
    parent,
    workers: FakeWorker.made,
    blobs,
    revoked,
    send: (event: unknown) => {
      for (const listener of listeners) listener(event);
    },
  };
}

describe("the bootstrap script", () => {
  it("starts a blob worker from the parent's source and hands it the port", () => {
    const { parent, workers, blobs, revoked, send } = frame();
    const { port1 } = new MessageChannel();
    send({ source: parent, data: { source: "postMessage(1)", port: port1 } });
    expect(workers).toHaveLength(1);
    expect(blobs.get(workers[0]!.url)).toEqual({
      parts: ["postMessage(1)"],
      options: { type: "text/javascript" },
    });
    expect(workers[0]!.posted).toEqual([{ message: { port: port1 }, transfer: [port1] }]);
    expect(revoked).toEqual([]);
    port1.close();
  });

  it("starts one worker per message", () => {
    const { parent, workers, send } = frame();
    const first = new MessageChannel();
    const second = new MessageChannel();
    send({ source: parent, data: { source: "1", port: first.port1 } });
    send({ source: parent, data: { source: "2", port: second.port1 } });
    expect(workers.map((worker) => worker.posted[0]!.message)).toEqual([
      { port: first.port1 },
      { port: second.port1 },
    ]);
    first.port1.close();
    second.port1.close();
  });

  it("ignores messages that are not the parent's or not a start request", () => {
    const { parent, workers, send } = frame();
    const { port1 } = new MessageChannel();
    send({ source: {}, data: { source: "1", port: port1 } });
    send({ source: parent, data: null });
    send({ source: parent, data: "start" });
    send({ source: parent, data: { source: 1, port: port1 } });
    send({ source: parent, data: { source: "1", port: {} } });
    expect(workers).toEqual([]);
    port1.close();
  });

  it("terminates the worker and revokes its blob on a message to the stop port", async () => {
    const { parent, workers, revoked, send } = frame();
    const session = new MessageChannel();
    const first = new MessageChannel();
    const second = new MessageChannel();
    send({ source: parent, data: { source: "1", port: session.port1, stop: first.port2 } });
    send({ source: parent, data: { source: "2", port: session.port2, stop: second.port2 } });
    second.port1.postMessage(null);
    await expect.poll(() => workers[1]!.terminated).toBe(true);
    expect(workers[0]!.terminated).toBe(false);
    expect(revoked).toEqual([workers[1]!.url]);
    for (const port of [session.port1, session.port2, first.port1, first.port2, second.port1])
      port.close();
    second.port2.close();
  });
});
