/**
 * The document of the sandbox iframe (plan 28 D7, layer L4). Its only script waits for the
 * parent's `{ source, port }`, starts a `blob:` worker from `source` and transfers `port` to it
 * as `{ port }`; the worker and the parent then talk with no hop through this frame. One worker
 * starts per message. An optional `stop` port ends that worker on its first message, since the
 * parent cannot reach a worker that lives in another frame.
 *
 * The blob worker inherits this document's policy, so the browser denies it the network whatever
 * its code does. Changing a character of the script changes its hash in `SANDBOX_CSP`.
 */
const BOOTSTRAP = `addEventListener("message", function (event) {
  if (event.source !== parent) return;
  var data = event.data;
  if (!data || typeof data.source !== "string" || !(data.port instanceof MessagePort)) return;
  var url = URL.createObjectURL(new Blob([data.source], { type: "text/javascript" }));
  var worker = new Worker(url);
  worker.postMessage({ port: data.port }, [data.port]);
  if (data.stop instanceof MessagePort)
    data.stop.onmessage = function () {
      worker.terminate();
      URL.revokeObjectURL(url);
    };
});`;

/** The sandbox document's policy. A host serving `SANDBOX_HTML` itself may also send it as a header. */
export const SANDBOX_CSP =
  "default-src 'none'; script-src 'sha256-oPPaWDE6MMTofIwe4XDA+5j21GRvt114+rqGS6d/YMw=' 'unsafe-eval' 'wasm-unsafe-eval'; worker-src blob:";

/** The sandbox document, for `<iframe sandbox="allow-scripts" srcdoc>` or a served copy. */
export const SANDBOX_HTML = `<!doctype html>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${SANDBOX_CSP}">
<script>${BOOTSTRAP}</script>
`;
