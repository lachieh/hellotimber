/** What the probe worker tries, each of which the sandbox's policy must refuse (plan 28 D7 (5)). */
export const SANDBOX_PROBES = [
  "fetch",
  "WebSocket",
  "importScripts",
  "Worker",
  "XMLHttpRequest",
] as const;
export type SandboxProbe = (typeof SANDBOX_PROBES)[number];
export type SandboxProbeResult = "blocked" | "allowed";

export interface SandboxSelfTest {
  /** True when the browser blocked every probe; the sandbox installs nothing otherwise. */
  readonly ok: boolean;
  readonly probes: Readonly<Record<SandboxProbe, SandboxProbeResult>>;
}

/**
 * The probe: a worker script with no SES, started like a game's worker (`{ port }` from the
 * sandbox document). It tries each way out and posts `{ [probe]: "blocked" | "allowed" }`.
 *
 * `blocked` means the attempt failed and the worker saw the policy violation for that probe's
 * directive, or the scope has no such API. A failure with no violation (offline, a host that
 * refuses) proves nothing about the browser, so it is `allowed`, as is an attempt that has not
 * settled after 2 s.
 */
export const SELF_TEST_WORKER_SOURCE = `addEventListener("message", function (event) {
  var port = event.data && event.data.port;
  if (!port) return;
  var violations = [];
  addEventListener("securitypolicyviolation", function (violation) {
    violations.push(String(violation.effectiveDirective || violation.violatedDirective));
  });
  function reached(attempt) {
    return Promise.race([
      new Promise(function (resolve) {
        resolve(attempt());
      }).then(
        function () {
          return true;
        },
        function () {
          return false;
        },
      ),
      new Promise(function (resolve) {
        setTimeout(resolve, 2000, true);
      }),
    ]);
  }
  function probe(api, directives, attempt) {
    if (api !== "function") return Promise.resolve("blocked");
    violations.length = 0;
    return reached(attempt)
      .then(function (through) {
        return new Promise(function (resolve) {
          setTimeout(resolve, 0, through);
        });
      })
      .then(function (through) {
        var reported = violations.some(function (violated) {
          return directives.some(function (directive) {
            return violated.indexOf(directive) === 0;
          });
        });
        return !through && reported ? "blocked" : "allowed";
      });
  }
  var connect = ["connect-src", "default-src"];
  var result = {};
  probe(typeof fetch, connect, function () {
    return fetch("https://example.com/", { mode: "no-cors" });
  })
    .then(function (outcome) {
      result.fetch = outcome;
      return probe(typeof WebSocket, connect, function () {
        return new Promise(function (resolve, reject) {
          var socket = new WebSocket("wss://example.com/");
          socket.onopen = function () {
            socket.close();
            resolve();
          };
          socket.onerror = reject;
        });
      });
    })
    .then(function (outcome) {
      result.WebSocket = outcome;
      return probe(typeof importScripts, ["script-src"], function () {
        importScripts("data:text/javascript,void 0");
      });
    })
    .then(function (outcome) {
      result.importScripts = outcome;
      return probe(typeof Worker, ["worker-src"], function () {
        return new Promise(function (resolve, reject) {
          var worker = new Worker("data:text/javascript,postMessage(1)");
          worker.onmessage = function () {
            worker.terminate();
            resolve();
          };
          worker.onerror = function (error) {
            error.preventDefault();
            worker.terminate();
            reject(error);
          };
        });
      });
    })
    .then(function (outcome) {
      result.Worker = outcome;
      return probe(typeof XMLHttpRequest, connect, function () {
        return new Promise(function (resolve, reject) {
          var request = new XMLHttpRequest();
          request.open("GET", "https://example.com/");
          request.onload = resolve;
          request.onerror = reject;
          request.send();
        });
      });
    })
    .then(function (outcome) {
      result.XMLHttpRequest = outcome;
      port.postMessage(result);
    });
});`;

/**
 * The report for the probe worker's reply. The reply crossed a message port, so nothing about it
 * is assumed: a probe it does not say was blocked counts as allowed.
 */
export function selfTestReport(reply: unknown): SandboxSelfTest {
  const said: Record<string, unknown> =
    typeof reply === "object" && reply !== null ? { ...reply } : {};
  const result = (probe: SandboxProbe): SandboxProbeResult =>
    said[probe] === "blocked" ? "blocked" : "allowed";
  const probes: Record<SandboxProbe, SandboxProbeResult> = {
    fetch: result("fetch"),
    WebSocket: result("WebSocket"),
    importScripts: result("importScripts"),
    Worker: result("Worker"),
    XMLHttpRequest: result("XMLHttpRequest"),
  };
  return { ok: SANDBOX_PROBES.every((probe) => probes[probe] === "blocked"), probes };
}

/** A worker the host started in the sandbox document: its first message, and how to end it. */
export interface SelfTestWorker {
  readonly reply: Promise<unknown>;
  terminate(): void;
}

/** Long enough for five attempts to time out in the worker (2 s each) before the host gives up. */
export const SELF_TEST_TIMEOUT_MS = 15_000;

/**
 * Runs the probe. `start` is the host's plumbing: it starts a worker from the given source inside
 * the sandbox document, as it does for a game. Rejects when the worker never replies, which is
 * what a browser that cannot start the worker at all looks like.
 */
export async function runSelfTest(
  start: (source: string) => SelfTestWorker,
  options: { readonly timeoutMs?: number } = {},
): Promise<SandboxSelfTest> {
  const timeoutMs = options.timeoutMs ?? SELF_TEST_TIMEOUT_MS;
  const worker = start(SELF_TEST_WORKER_SOURCE);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`sandbox self-test: no reply within ${timeoutMs} ms`)),
      timeoutMs,
    );
  });
  try {
    return selfTestReport(await Promise.race([worker.reply, timeout]));
  } finally {
    clearTimeout(timer);
    worker.terminate();
  }
}
