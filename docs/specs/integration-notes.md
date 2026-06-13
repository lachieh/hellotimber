# Integration Notes — Vite+ / TanStack Start / R3F patterns

Research findings for this repo, verified 2026-06-12 against the installed packages,
the local Vite+ docs (`node_modules/vite-plus/docs`), the npm registry, and TanStack
Router/R3F documentation. Plan files embed the relevant parts; this is the reference.

**Verified versions:**

| Package                         | Version                                                                               | Source    |
| ------------------------------- | ------------------------------------------------------------------------------------- | --------- |
| vite-plus                       | 0.1.24 (`@voidzero-dev/vite-plus-core` 0.1.24, `@voidzero-dev/vite-plus-test` 0.1.24) | lockfile  |
| react / react-dom               | 19.2.7                                                                                | installed |
| @tanstack/react-router          | 1.170.15 (router-core 1.171.13)                                                       | installed |
| @tanstack/react-start           | 1.168.25                                                                              | installed |
| @vitejs/plugin-react            | 6.0.2                                                                                 | installed |
| typescript                      | 6.0.3                                                                                 | installed |
| three (npm latest)              | **0.184.0**                                                                           | registry  |
| @types/three (npm latest)       | 0.184.1                                                                               | registry  |
| @react-three/fiber (npm latest) | **9.6.1**                                                                             | registry  |
| @react-three/drei (npm latest)  | **10.7.7**                                                                            | registry  |

---

## 1. Workspace packages: export TypeScript source directly

**Decision: packages export source; no build step for workspace consumption.**

- pnpm symlinks `packages/*` into `website/node_modules/`. Vite resolves symlinks to
  the real path (default `resolve.preserveSymlinks: false`), so the website's Vite
  pipeline compiles package `.ts`/`.tsx` source like first-party code. **React Fast
  Refresh works across the package boundary** — editing a package component
  hot-updates in place without remounting the Canvas.
- The alternative (`vp pack --watch` → dist) means a second long-running process per
  package, and dist files bypass Fast Refresh (full-page reload kills 3D state).
  `vp pack` is built on tsdown and does handle `.tsx` (Rolldown bundles JSX with the
  automatic runtime by default) — viable for future npm publishing, just worse local DX.
- The lint rule `vite-plus/prefer-vite-plus-imports` does **not** interfere with
  workspace source imports (verified its implementation: it only rewrites
  `vite`→`vite-plus`, `vitest`→`vite-plus/test`, `vitest/config`→`vite-plus`,
  `@vitest/browser*`→`vite-plus/test/...` specifiers).
- The `vite:library` template is fetched from `github:sxzz/tsdown-templates/vite-plus`.
  Its package.json points at `./dist/index.mjs` — **replace with source exports** when
  scaffolding (see AGENTS.md recipe).

**Package.json shape for a pure-TS package:**

```json
{
  "name": "@hellotimber/phone-core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./package.json": "./package.json"
  },
  "scripts": {
    "test": "vp test run"
  },
  "devDependencies": {
    "typescript": "catalog:",
    "vite-plus": "catalog:"
  }
}
```

No `main`/`types` needed: with `exports` pointing at `.ts`, both Vite and tsgo resolve
types from source. No `build` script — `vp run -r build` skips packages without one;
the website's `vp build` compiles package source into the app bundle.

**Website vite.config.ts additions:**

```ts
resolve: {
  tsconfigPaths: true,
  dedupe: ["three", "react", "react-dom", "@react-three/fiber"],
},
ssr: {
  // raw .ts exports can't be require()'d by Node at SSR runtime;
  // force-bundle workspace source into the server build
  noExternal: ["@hellotimber/phone-core", "@hellotimber/phone-screen", "@hellotimber/phone-3d", "@hellotimber/snake"],
},
```

(`ssr.noExternal` is defensive — not exercised against a production server run yet;
harmless either way.)

**Each package needs its own tsconfig.json** (the root one is minimal nodenext/noEmit,
no JSX). `vp check` (tsgolint, typeAware+typeCheck on) picks up per-package tsconfigs:

```json
{
  "include": ["src/**/*.ts", "src/**/*.tsx", "tests/**/*.ts", "tests/**/*.tsx"],
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["vite-plus/client"]
  }
}
```

**Monorepo lint:** add a `lint.overrides` entry in root `vite.config.ts` for
`packages/phone-3d/**` with `plugins: ['typescript', 'react']` (per
`docs/guide/monorepo.md`, an override's `plugins` _replaces_ the base list).

**Task graph:** `vp run` orders tasks by `package.json` dependency edges
(`workspace:*` counts), so `vp run -r test` / `-r build` just works.

---

## 2. R3F library packaging (`@hellotimber/phone-3d`)

**peerDependencies** (singletons owned by the host app) + devDependencies repeating
them (so the package type-checks/tests standalone; the catalog makes pnpm resolve the
same physical modules the website uses):

```json
{
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "three": ">=0.180 <0.200",
    "@react-three/fiber": "^9.0.0",
    "@react-three/drei": "^10.0.0"
  },
  "devDependencies": {
    "react": "catalog:",
    "react-dom": "catalog:",
    "three": "catalog:",
    "@types/three": "catalog:",
    "@react-three/fiber": "catalog:",
    "@react-three/drei": "catalog:",
    "@types/react": "catalog:",
    "typescript": "catalog:",
    "vite-plus": "catalog:"
  }
}
```

**Why `three` must never be duplicated** (and is always a peer, never a dep):
three classes are compared with `instanceof` throughout the ecosystem (fiber
attach/dispose, drei helpers, raycasting, loader caches). Two copies produce
referentially distinct classes — raycasts silently miss (pointer events go dead),
materials don't dispose, and three logs "Multiple instances of Three.js being
imported". Also ~600 KB min of duplicate bundle. Defenses, in order: peer-only in
libraries → single catalog version → `resolve.dedupe: ['three']` in the website.

**Peer-range facts (npm registry, 2026-06-12):**

- `@react-three/fiber@9.6.1` peers: `react >=19 <19.3`, `react-dom >=19 <19.3`
  (optional), `three >=0.156`. Note the **<19.3 cap** — react 19.2.7 is fine; expect
  pnpm peer warnings if react 19.3 ships (suppress via `peerDependencyRules` if needed).
- `@react-three/drei@10.7.7` peers: `react ^19`, `react-dom ^19` (optional),
  `three >=0.159`, `@react-three/fiber ^9.0.0`.
- A fiber v10 branch exists upstream but **9.6.1 is npm latest; do not target v10**.

**tsconfig jsx:** `"jsx": "react-jsx"` (automatic runtime). If `vp pack` is ever
adopted, pack config goes in the package's `vite.config.ts` `pack` block (NOT a
`tsdown.config.ts`).

---

## 3. TanStack Start + client-only 3D

**`<ClientOnly>` is built into the router** (verified export in installed
`@tanstack/react-router@1.170.15`):

```tsx
import { ClientOnly } from "@tanstack/react-router";
// props: { children: React.ReactNode; fallback?: React.ReactNode }
// sibling export: useHydrated(): boolean
```

Renders `fallback` during SSR and first client render, children after hydration —
exactly what R3F `<Canvas>` needs. There is no ClientOnly in `@tanstack/react-start`.
Per-route selective SSR (`ssr: false`) exists but isn't needed — the canvas lives in a
layout route, not a leaf.

**Persistent canvas: pathless layout route.** A component in a route that stays
matched across navigations never remounts; only changed child matches swap through
`<Outlet/>`. File prefixed with `_` creates a layout with no URL segment:

```
website/src/routes/
  __root.tsx          (unchanged shell)
  _phone.tsx          ← layout: canvas mounts here, persists
  _phone/index.tsx    ← matches "/"
  _phone/menu.tsx     ← matches "/menu"   (etc.)
```

```tsx
// website/src/routes/_phone.tsx
import { Outlet, createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const PhoneStage = lazy(() =>
  import("@hellotimber/phone-3d").then((m) => ({ default: m.PhoneStage })),
);

export const Route = createFileRoute("/_phone")({ component: PhoneLayout });

function PhoneLayout() {
  return (
    <div className="phone-layout">
      {/* persists across /, /menu, ... — never remounts */}
      <ClientOnly fallback={<div className="phone-skeleton" />}>
        <Suspense fallback={<div className="phone-skeleton" />}>
          {/* stage wrapper wires canvas/version/onKey — see plan 05 */}
        </Suspense>
      </ClientOnly>
      <Outlet /> {/* only this subtree swaps on navigation */}
    </div>
  );
}
```

`lazy(() => import(...))` keeps three out of the initial chunk. Caveats: don't key the
layout by pathname; don't put the canvas inside a leaf route component.

---

## 4. Router ⇄ state machine sync

**Verified API surface (router-core 1.171.13):**

- `router.subscribe(eventType, fn) => unsubscribe`; events include `onResolved`;
  payload `{ fromLocation?, toLocation, pathChanged, hrefChanged, ... }`.
  Use **`onResolved`** (fires only for settled navigations; preloads don't fire it).
- `router.navigate({ to, replace? }) => Promise<void>` — usable outside components.
- `router.state.location` — current committed location.
- In components: `useRouterState({ select: (s) => s.location.pathname })`.

**Wire once, client-only, inside `getRouter()`** (`website/src/router.tsx`) — on the
server a router is created per request, so guard with `typeof window !== "undefined"`.

**Echo suppression — two loop-breakers** (idempotence guard + sync re-entry flag):

```ts
export function connectPhoneToRouter(router: AppRouter, phone: Phone) {
  let echo = false;

  // URL -> phone (URL is source of truth)
  const unsubRouter = router.subscribe("onResolved", ({ toLocation, pathChanged }) => {
    if (!pathChanged) return;
    const phonePath = phonePathFromUrl(toLocation.pathname);
    if (phone.path === phonePath) return; // idempotence guard
    echo = true;
    try {
      phone.navigate(phonePath);
    } finally {
      echo = false;
    }
  });

  // phone -> URL
  const unsubPhone = phone.on("pathchange", (path) => {
    if (echo) return; // we caused this emit
    const url = urlFromPhonePath(path);
    if (router.state.location.pathname === url) return; // idempotence guard
    void router.navigate({ to: url });
  });

  // initial alignment: URL wins (also covers any onResolved-on-hydration variance)
  phone.navigate(phonePathFromUrl(router.state.location.pathname));

  return () => {
    unsubRouter();
    unsubPhone();
  };
}
```

The phone's `pathchange` must not emit when `navigate(path)` is a no-op (already
there) — that plus both guards makes loops impossible even with async timing. Use
`replace: true` for "soft" states that shouldn't pollute history.

---

## 5. CanvasTexture screen pattern

Keep the offscreen canvas at **native 84×48** and let `NearestFilter` magnification do
the upscaling — crisp pixels, minimal draw cost.

```tsx
const texture = new THREE.CanvasTexture(canvas);
texture.colorSpace = THREE.SRGBColorSpace; // canvas 2D pixels are sRGB; required since r152 color mgmt
texture.magFilter = THREE.NearestFilter; // crisp pixels when upscaled on the mesh
texture.minFilter = THREE.NearestFilter;
texture.generateMipmaps = false; // 84x48 NPOT + nearest: mips wrong and wasteful
// flipY stays true (default) — matches planeGeometry 0..1 UVs
```

- Re-upload only when dirty: in `useFrame`, compare a version counter; set
  `texture.needsUpdate = true` only on change (avoids per-frame `texImage2D`).
- `meshBasicMaterial map={texture} toneMapped={false}` — unlit is right for an
  emissive LCD, and `toneMapped={false}` stops ACES tone mapping shifting the green.
  (Alternative: `<Canvas flat>` globally.)
- NPOT 84×48 is fine in WebGL2 as long as mipmaps are off.
- UVs: planeGeometry maps (0,0)→(1,1) upright. For a GLTF screen mesh, author the
  face to fill 0–1 UV space — or pragmatically float a flat plane 0.5–1 mm in front
  of dark glass (z-offset avoids z-fighting).

**Pointer interaction:** every key is its own mesh with
`onPointerDown={(e) => { e.stopPropagation(); onKey(id, 'down'); }}` (+ `onPointerUp`,
pointer-cursor on over/out). The raycast event exposes `e.point`, `e.uv`, `e.object`.

**Fallback:** detect WebGL2 (`!!document.createElement('canvas').getContext('webgl2')`);
without it render a DOM keypad + the same 84×48 canvas (CSS
`image-rendering: pixelated`), driving the same phone-core machine.

---

## 6. Vitest via `vp test`

- `vp test` = single run (unlike vitest), `vp test watch` = watch mode.
- Config lives in each package's `vite.config.ts` under a `test` block (docs
  discourage `vitest.config.ts`). Default environment: **node**.
- **Import test APIs from `vite-plus/test`**, not `vitest` — the
  `prefer-vite-plus-imports` lint rule auto-rewrites `vitest` imports anyway:
  `import { describe, it, expect } from "vite-plus/test"`.
- React component tests: `test: { environment: "jsdom" }` (jsdom 28 already installed
  in website) or a `// @vitest-environment jsdom` docblock per file.
- jsdom has no WebGL — never mount `<Canvas>` in jsdom tests. Test behavior in
  phone-core/phone-screen (node env, stub 2D context); `@react-three/test-renderer`
  exists for scene-graph tests but is not installed and v9-compat is unverified.
- Existing inconsistency: `website/vite.config.ts` imports `defineConfig` from
  `"vite"`; the lint rule will rewrite it to `"vite-plus"` when touched — safe superset.

---

## Flagged / unverified

1. `ssr.noExternal` necessity for source-exported packages in the production server
   build — defensive, not exercised.
2. Whether `onResolved` fires on initial hydration — moot due to explicit initial sync.
3. `@react-three/test-renderer` compat with fiber 9.6.1 — unchecked.
4. fiber's `react >=19 <19.3` peer cap — fine today (react 19.2.7).
5. tsdown `"use client"` preservation — moot under source exports.
