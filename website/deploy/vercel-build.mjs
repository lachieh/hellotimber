// Assembles a Vercel Build Output API directory (.vercel/output/) from the
// Vite SSR build (dist/client + dist/server/server.js). TanStack Start (this
// post-Nitro version) emits a plain Web-fetch server handler, which maps
// cleanly onto a single Vercel serverless function with everything not found on
// the static filesystem routed to it.
//
// Run AFTER `vp build`. See website/package.json "vercel-build".
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const websiteRoot = resolve(here, "..");
const repoRoot = resolve(websiteRoot, "..");
const dist = resolve(websiteRoot, "dist");
// Build Output API must live at the directory Vercel treats as the project root.
// We deploy from the repo root (workspace install needs it), so emit there.
const out = resolve(repoRoot, ".vercel/output");
const fnDir = resolve(out, "functions/_serve.func");

await rm(out, { recursive: true, force: true });

// 1) Static assets → output/static (served from the filesystem first).
await mkdir(resolve(out, "static"), { recursive: true });
await cp(resolve(dist, "client"), resolve(out, "static"), { recursive: true });

// 2) The SSR handler → a Node serverless function.
await mkdir(fnDir, { recursive: true });
await cp(resolve(dist, "server"), fnDir, { recursive: true });

// Function entry: Vercel invokes the default export with a Web Request and
// expects a Web Response. Our build's default export already has that shape.
await writeFile(
  resolve(fnDir, "index.mjs"),
  `import handler from "./server.js";
export default (request) => handler.fetch(request);
`,
);

// Node serverless function config — uses the Web (fetch) handler signature.
await writeFile(
  resolve(fnDir, ".vc-config.json"),
  JSON.stringify(
    {
      runtime: "nodejs22.x",
      handler: "index.mjs",
      launcherType: "Nodejs",
      supportsResponseStreaming: true,
    },
    null,
    2,
  ),
);

// 3) Top-level build output config: try the filesystem (static assets), then
// fall back to the SSR function for everything else (SSR routes + 404s).
await writeFile(
  resolve(out, "config.json"),
  JSON.stringify(
    {
      version: 3,
      routes: [{ handle: "filesystem" }, { src: "/.*", dest: "/_serve" }],
    },
    null,
    2,
  ),
);

console.log("Vercel Build Output assembled at", out);
