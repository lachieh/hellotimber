import { describe, expect, it } from "vite-plus/test";
import {
  SANDBOX_PROBES,
  SELF_TEST_WORKER_SOURCE,
  runSelfTest,
  selfTestReport,
  type SandboxProbe,
} from "../src/self-test";

const ALL_BLOCKED = {
  fetch: "blocked",
  WebSocket: "blocked",
  importScripts: "blocked",
  Worker: "blocked",
  XMLHttpRequest: "blocked",
} as const;

describe("selfTestReport", () => {
  it("passes when every probe was blocked", () => {
    expect(selfTestReport({ ...ALL_BLOCKED })).toEqual({ ok: true, probes: ALL_BLOCKED });
  });

  it.each(SANDBOX_PROBES)("fails when %s was allowed", (probe) => {
    const report = selfTestReport({ ...ALL_BLOCKED, [probe]: "allowed" });
    expect(report.ok).toBe(false);
    expect(report.probes).toEqual({ ...ALL_BLOCKED, [probe]: "allowed" });
  });

  it("counts a probe the reply does not vouch for as allowed", () => {
    const { fetch: _, ...withoutFetch } = ALL_BLOCKED;
    expect(selfTestReport(withoutFetch).probes.fetch).toBe("allowed");
    expect(selfTestReport({ ...ALL_BLOCKED, Worker: true }).probes.Worker).toBe("allowed");
    for (const reply of [undefined, null, "blocked", 1, []]) {
      const report = selfTestReport(reply);
      expect(report.ok).toBe(false);
      expect(Object.values(report.probes)).toEqual(SANDBOX_PROBES.map(() => "allowed"));
    }
  });

  it("reports only the known probes", () => {
    expect(selfTestReport({ ...ALL_BLOCKED, eval: "allowed" })).toEqual({
      ok: true,
      probes: ALL_BLOCKED,
    });
  });
});

describe("runSelfTest", () => {
  it("starts the probe worker, reports its reply and terminates it", async () => {
    const started: string[] = [];
    let terminated = 0;
    const report = await runSelfTest((source) => {
      started.push(source);
      return {
        reply: Promise.resolve({ ...ALL_BLOCKED, WebSocket: "allowed" }),
        terminate: () => void terminated++,
      };
    });
    expect(started).toEqual([SELF_TEST_WORKER_SOURCE]);
    expect(report).toEqual({ ok: false, probes: { ...ALL_BLOCKED, WebSocket: "allowed" } });
    expect(terminated).toBe(1);
  });

  it("rejects and terminates when the worker does not reply in time", async () => {
    let terminated = 0;
    const run = runSelfTest(
      () => ({ reply: new Promise(() => {}), terminate: () => void terminated++ }),
      { timeoutMs: 10 },
    );
    await expect(run).rejects.toThrow("no reply within 10 ms");
    expect(terminated).toBe(1);
  });

  it("rejects and terminates when the plumbing fails", async () => {
    let terminated = 0;
    const run = runSelfTest(() => ({
      reply: Promise.reject(new Error("no iframe")),
      terminate: () => void terminated++,
    }));
    await expect(run).rejects.toThrow("no iframe");
    expect(terminated).toBe(1);
  });
});

/** What a worker scope does when a probe reaches for the network. */
type Behaviour = "csp" | "succeeds" | "fails" | "hangs" | "absent";

/** Runs the probe worker's source against a fake worker scope and returns what it posts. */
function probeIn(behaviours: Record<SandboxProbe, Behaviour>): Promise<unknown> {
  const listeners = new Map<string, ((event: unknown) => void)[]>();
  const addEventListener = (type: string, listener: (event: unknown) => void) => {
    listeners.set(type, [...(listeners.get(type) ?? []), listener]);
  };
  const dispatch = (type: string, event: unknown) => {
    for (const listener of listeners.get(type) ?? []) listener(event);
  };
  const DIRECTIVE: Record<SandboxProbe, string> = {
    fetch: "connect-src",
    WebSocket: "connect-src",
    XMLHttpRequest: "connect-src",
    importScripts: "script-src-elem",
    Worker: "worker-src",
  };
  /** The policy refused: the violation event is a task of its own, as in a browser. */
  const violate = (probe: SandboxProbe) =>
    setTimeout(
      () => dispatch("securitypolicyviolation", { effectiveDirective: DIRECTIVE[probe] }),
      0,
    );
  /** `settle` is called with the outcome once the fake network answers. */
  const attempt = (probe: SandboxProbe, settle: (reached: boolean) => void) => {
    const behaviour = behaviours[probe];
    if (behaviour === "csp") violate(probe);
    if (behaviour !== "hangs") setTimeout(() => settle(behaviour === "succeeds"), 0);
  };

  const fetch = (url: string) =>
    new Promise<void>((resolve, reject) => {
      expect(url).toMatch(/^https:\/\//);
      attempt("fetch", (reached) => (reached ? resolve() : reject(new TypeError("Failed"))));
    });
  class FakeWebSocket {
    onopen: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(url: string) {
      expect(url).toMatch(/^wss:\/\//);
      // Chromium and Firefox throw from the constructor when the policy refuses.
      if (behaviours.WebSocket === "csp") {
        violate("WebSocket");
        throw new Error("SecurityError");
      }
      attempt("WebSocket", (reached) => (reached ? this.onopen?.() : this.onerror?.()));
    }
    close() {}
  }
  const importScripts = (url: string) => {
    expect(url).toMatch(/^data:text\/javascript,/);
    if (behaviours.importScripts === "csp") violate("importScripts");
    if (behaviours.importScripts !== "succeeds") throw new Error("NetworkError");
  };
  class FakeWorker {
    onmessage: (() => void) | null = null;
    onerror: ((event: { preventDefault(): void }) => void) | null = null;
    constructor(url: string) {
      expect(url).toMatch(/^data:text\/javascript,/);
      attempt("Worker", (reached) =>
        reached ? this.onmessage?.() : this.onerror?.({ preventDefault() {} }),
      );
    }
    terminate() {}
  }
  class FakeXhr {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    open(method: string, url: string) {
      expect([method, url.slice(0, 8)]).toEqual(["GET", "https://"]);
    }
    send() {
      attempt("XMLHttpRequest", (reached) => (reached ? this.onload?.() : this.onerror?.()));
    }
  }
  const present = <T>(probe: SandboxProbe, api: T) =>
    behaviours[probe] === "absent" ? undefined : api;
  /** The probe gives up on an attempt after seconds; the fake clock makes that 5 ms. */
  const fastTimeout = (callback: (...args: unknown[]) => void, ms: number, ...args: unknown[]) =>
    setTimeout(callback, ms > 0 ? 5 : 0, ...args);

  // oxlint-disable-next-line typescript/no-implied-eval -- the script under test is a string
  new Function(
    "addEventListener",
    "fetch",
    "WebSocket",
    "importScripts",
    "Worker",
    "XMLHttpRequest",
    "setTimeout",
    SELF_TEST_WORKER_SOURCE,
  )(
    addEventListener,
    present("fetch", fetch),
    present("WebSocket", FakeWebSocket),
    present("importScripts", importScripts),
    present("Worker", FakeWorker),
    present("XMLHttpRequest", FakeXhr),
    fastTimeout,
  );
  return new Promise((resolve) => {
    dispatch("message", { data: { port: { postMessage: resolve } } });
  });
}

const all = (behaviour: Behaviour): Record<SandboxProbe, Behaviour> => ({
  fetch: behaviour,
  WebSocket: behaviour,
  importScripts: behaviour,
  Worker: behaviour,
  XMLHttpRequest: behaviour,
});

describe("the probe worker", () => {
  it("has no SES and no imports: it is one classic script", () => {
    expect(SELF_TEST_WORKER_SOURCE).not.toMatch(/lockdown|Compartment|\bimport\b|\bexport\b/);
  });

  it("reports every probe blocked where the policy refuses each attempt", async () => {
    const reply = await probeIn(all("csp"));
    expect(reply).toEqual(ALL_BLOCKED);
    expect(selfTestReport(reply).ok).toBe(true);
  });

  it("reports every probe allowed where nothing is enforced", async () => {
    expect(await probeIn(all("succeeds"))).toEqual(
      Object.fromEntries(SANDBOX_PROBES.map((probe) => [probe, "allowed"])),
    );
  });

  it.each(SANDBOX_PROBES)("reports %s allowed when only it gets through", async (probe) => {
    expect(await probeIn({ ...all("csp"), [probe]: "succeeds" })).toEqual({
      ...ALL_BLOCKED,
      [probe]: "allowed",
    });
  });

  it.each(SANDBOX_PROBES)(
    "does not take a failure of %s for a block unless the policy reported it",
    async (probe) => {
      // Offline, or a host that refuses: the attempt failed, but nothing shows the browser stopped it.
      expect(await probeIn({ ...all("csp"), [probe]: "fails" })).toEqual({
        ...ALL_BLOCKED,
        [probe]: "allowed",
      });
    },
  );

  it("does not credit one probe with the violation of another directive", async () => {
    // importScripts fails with no violation of its own right after fetch's connect-src violation.
    const reply = await probeIn({ ...all("csp"), importScripts: "fails", Worker: "fails" });
    expect(reply).toEqual({ ...ALL_BLOCKED, importScripts: "allowed", Worker: "allowed" });
  });

  it("gives up on an attempt that never settles and reports it allowed", async () => {
    expect(await probeIn({ ...all("csp"), fetch: "hangs", Worker: "hangs" })).toEqual({
      ...ALL_BLOCKED,
      fetch: "allowed",
      Worker: "allowed",
    });
  });

  it("reports an API the worker scope lacks as blocked", async () => {
    expect(await probeIn({ ...all("csp"), Worker: "absent" })).toEqual(ALL_BLOCKED);
  });
});
