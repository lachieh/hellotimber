# Plan 03 — `@hellotimber/phone-3d`: the physical Nokia 3310 in react-three-fiber

> **For agentic workers:** execute task-by-task; tick checkboxes; commit per task.
> If this plan contradicts VISION.md contracts or the code, STOP and report.

**Prerequisites:** none. This package has **no internal dependencies** (AGENTS.md boundary
rules): it defines its **own** `Nokia3310Key` union, receives a ready-made
`HTMLCanvasElement` for the screen texture, and reports key presses via callback. It never
imports phone-core, the router, or anything from `website/`.

## Goal

Build `@hellotimber/phone-3d`: a convincing Nokia 3310 (113 × 48 × 22 mm, per
`docs/specs/nokia-3310.md` §1) as R3F components — `<Nokia3310/>` (body, pressable keypad,
canvas-textured screen, green backlight) and `<PhoneStage/>` (convenience Canvas + lighting

- idle motion) — exactly matching the VISION.md `@hellotimber/phone-3d` public contract,
  proven standalone by an in-package demo page with a test-pattern screen and a key-press log.

## Architecture

Pure primitive/parametric construction — **no GLTF assets**. One scale convention:
**1 world unit = 1 cm** (body `4.8 × 11.3 × 2.2`). All key positions/sizes live in a single
pure-data module `src/layout.ts` (node-unit-tested); materials are pure data in
`src/materials.ts`; thin `.tsx` components map that data to drei `RoundedBox`/capsule meshes
with pointer handlers. The screen is an 84×48 `CanvasTexture` (NearestFilter, no mipmaps)
on a plane floated proud of the bezel, re-uploaded only when `screenVersion` changes.

## Tech stack

- React 19.2, three ^0.184, `@react-three/fiber` ^9.6.1, `@react-three/drei` ^10.7.7 — all
  **peerDependencies** (+ catalog devDependencies for standalone dev/tests), per
  `docs/specs/integration-notes.md` §2. `three` must never be a regular dependency.
- Vite+ (`vp`) toolchain; package consumed from TypeScript source
  (`"exports": { ".": "./src/index.ts" }`), no build script.
- Tests: Vitest via `vp test`, imports from **`vite-plus/test`** only, environment `node`.
- Demo: in-package `index.html` + `src/demo/main.tsx`, served by `vp dev` from the package
  directory (`@vitejs/plugin-react` devDependency powers JSX/Fast Refresh).

## Testing approach (read before executing)

3D rendering **cannot be unit-tested in jsdom** — jsdom has no WebGL, and mounting an R3F
`<Canvas>` there is forbidden (AGENTS.md, integration-notes §6). So this package splits
verification in two:

1. **Pure logic gets node-env unit tests**: the keypad layout table (entry count, key
   uniqueness, no overlapping XY bounding boxes, column alignment), the key union, the
   digit-grid position function, and the material specs.
2. **Everything visual gets a runnable demo playground** (`index.html` +
   `src/demo/main.tsx`, run with `mise exec -- vp dev` from `packages/phone-3d/`): it
   renders the phone with a procedurally drawn test-pattern canvas (84×48 checkerboard +
   incrementing frame counter, so texture re-uploads are visibly provable) and an on-screen
   key-press log div. Tasks include precise visual verification steps (e.g. "click '5' →
   log shows `5 down` then `5 up`; the key visibly depresses"). The demo is this package's
   standalone proof per AGENTS.md rule 3.

## Coordinate frame & master dimensions (used by every task)

- Y up, phone centered at the origin. Body box `[x=4.8, y=11.3, z=2.2]` → front face plane
  at **z = 1.1**, top edge at **y = 5.65**.
- Face plate front at z = 1.12 (keys poke through it); screen bezel front at z = 1.15;
  screen plane at **z = 1.20** (0.05 proud of the bezel); screen center **y = +2.0**.
- Keys sit at z = 1.12–1.15 (entry-specific), depress by **Δz = −0.04** when pressed.
- Camera looks down −z from `[0, 0, 18]`, fov 40 (fits the 11.3-tall body with margin).

## Files at completion

```
packages/phone-3d/
├── package.json                peers + catalog devDeps (integration-notes §2)
├── tsconfig.json               jsx react-jsx (integration-notes §1 template)
├── vite.config.ts              react plugin (demo) + test block (env node)
├── index.html                  demo entry — `vp dev` from this directory
├── README.md                   usage outside this repo + props table
├── src/
│   ├── index.ts                public surface = the VISION contract
│   ├── types.ts                Nokia3310Key, Nokia3310Props, ALL_KEYS
│   ├── layout.ts               KEY_LAYOUT + geometry constants (pure data)
│   ├── materials.ts            MATERIALS color/roughness specs (pure data)
│   ├── PhoneBody.tsx           body + face plate + bezel + earpiece grille
│   ├── Key.tsx                 one pressable key mesh (pointer events, depress)
│   ├── Keypad.tsx              KEY_LAYOUT → <Key/> instances
│   ├── Screen.tsx              CanvasTexture plane (integration-notes §5)
│   ├── Nokia3310.tsx           assembly: body + keypad + screen + backlight
│   ├── PhoneStage.tsx          Canvas + lights + idle sway + pointer tilt
│   └── demo/
│       ├── main.tsx            demo app: stage, key log, backlight toggle
│       └── test-pattern.ts     84×48 checkerboard + frame counter canvas
└── tests/
    ├── types.test.ts           key union completeness/uniqueness
    ├── layout.test.ts          17 entries, overlap, alignment, arc
    └── materials.test.ts       valid color specs
```

## Contract deviations

Deviations from / interpretations of VISION.md and integration-notes (flag if wrong):

1. **`@vitejs/plugin-react` (`^6.0.2`) is added as a devDependency** beyond the
   integration-notes §2 list — required so the in-package demo (`vp dev`) compiles JSX with
   Fast Refresh. Dev-only; the package's consumed surface is unchanged.
2. **`backlightOn` defaults to `true`** — the contract marks it optional without a default;
   an unlit phone on first render would look broken in hosts that don't pass it.
3. **Root `vite.config.ts` is NOT touched** — integration-notes §1 calls for a
   `lint.overrides` entry for `packages/phone-3d/**`, but plan 05 owns root-config edits.
   If `vp check` raises react-lint noise from this package before plan 05 lands, report it
   rather than editing the root config.
4. **NaviKey width is 1.8 units** (not a wider pill) so its XY bounding box clears the C
   key and rocker — keeps the layout unit tests strict (zero overlaps, no exceptions).
   Internal modeling choice; not part of the public contract.

## Conventions for every task

- Run all commands from the **repo root** unless a step says otherwise; prefix with
  `mise exec --` (or activate mise).
- After completing a task: `mise exec -- vp check --fix` and
  `mise exec -- vp run @hellotimber/phone-3d#test` must pass.
- Visual gates: `cd packages/phone-3d && mise exec -- vp dev`, open the printed URL
  (default `http://localhost:5173`). Stop the server after verifying.
- Commit per task: `feat(phone-3d): <what>`.

---

### Task 1 — Scaffold the package

**Files:** `packages/phone-3d/package.json`, `packages/phone-3d/tsconfig.json`,
`packages/phone-3d/vite.config.ts`, `packages/phone-3d/src/types.ts`,
`packages/phone-3d/src/index.ts`, `packages/phone-3d/tests/types.test.ts`

- [ ] Scaffold:

  ```sh
  mise exec -- vp create vite:library --directory packages/phone-3d --no-interactive --no-git
  ```

- [ ] Delete the nested scaffold cruft (the monorepo root already provides these) and the
      template source:

  ```sh
  rm -rf packages/phone-3d/pnpm-workspace.yaml packages/phone-3d/pnpm-lock.yaml \
         packages/phone-3d/.vite-hooks packages/phone-3d/AGENTS.md packages/phone-3d/.gitignore \
         packages/phone-3d/node_modules packages/phone-3d/src packages/phone-3d/tests \
         packages/phone-3d/dist packages/phone-3d/README.md
  ```

- [ ] Replace `packages/phone-3d/package.json` entirely with (peers/devDeps per
      integration-notes §2, plus the demo's react plugin — deviation 1):

  ```json
  {
    "name": "@hellotimber/phone-3d",
    "version": "0.0.0",
    "private": true,
    "type": "module",
    "exports": {
      ".": "./src/index.ts",
      "./package.json": "./package.json"
    },
    "scripts": {
      "dev": "vp dev",
      "test": "vp test run"
    },
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
      "@types/react-dom": "catalog:",
      "@vitejs/plugin-react": "^6.0.2",
      "typescript": "catalog:",
      "vite-plus": "catalog:"
    }
  }
  ```

- [ ] Write `packages/phone-3d/tsconfig.json` (integration-notes §1 template):

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

- [ ] Write `packages/phone-3d/vite.config.ts` (test block per AGENTS.md — never a
      `vitest.config.ts`; react plugin for the demo):

  ```ts
  import { defineConfig } from "vite-plus";
  import react from "@vitejs/plugin-react";

  export default defineConfig({
    plugins: [react()],
    test: {
      environment: "node",
      include: ["tests/**/*.test.ts"],
    },
  });
  ```

- [ ] Write `packages/phone-3d/src/types.ts` — the contract's key union (same literals as
      phone-core's `PhoneKey`, but defined here; NO import from any sibling package):

  ```ts
  /** The 3310's physical keys. Same literals as phone-core's PhoneKey — defined
   *  independently here because phone-3d has no internal dependencies. */
  export type Nokia3310Key =
    | "power"
    | "navi"
    | "c"
    | "up"
    | "down"
    | "0"
    | "1"
    | "2"
    | "3"
    | "4"
    | "5"
    | "6"
    | "7"
    | "8"
    | "9"
    | "*"
    | "#";

  export interface Nokia3310Props {
    /** 84×48 canvas used as the screen texture source. */
    screenCanvas: HTMLCanvasElement;
    /** Bump to trigger texture.needsUpdate (re-upload) on the next frame. */
    screenVersion: number;
    onKey?: (key: Nokia3310Key, action: "down" | "up") => void;
    backlightOn?: boolean;
    /** Visually depress keys driven externally (e.g. keyboard input). */
    pressedKeys?: ReadonlySet<Nokia3310Key>;
  }

  /** Every physical key, exactly once (internal; used by layout + tests). */
  export const ALL_KEYS: readonly Nokia3310Key[] = [
    "power",
    "navi",
    "c",
    "up",
    "down",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "*",
    "0",
    "#",
  ];
  ```

- [ ] Write `packages/phone-3d/src/index.ts` (component exports are added by later tasks):

  ```ts
  export type { Nokia3310Key, Nokia3310Props } from "./types";
  ```

- [ ] Write `packages/phone-3d/tests/types.test.ts`:

  ```ts
  import { describe, expect, it } from "vite-plus/test";
  import { ALL_KEYS } from "../src/types";

  describe("Nokia3310Key union", () => {
    it("has exactly 17 keys", () => {
      expect(ALL_KEYS).toHaveLength(17);
    });

    it("has no duplicates", () => {
      expect(new Set(ALL_KEYS).size).toBe(ALL_KEYS.length);
    });

    it("contains the navigation cluster and the full digit grid", () => {
      for (const k of ["power", "navi", "c", "up", "down", "*", "0", "#"]) {
        expect(ALL_KEYS).toContain(k);
      }
      for (let d = 0; d <= 9; d++) expect(ALL_KEYS).toContain(String(d));
    });
  });
  ```

- [ ] Link into the workspace and verify:

  ```sh
  mise exec -- vp install
  mise exec -- vp run @hellotimber/phone-3d#test
  mise exec -- vp check --fix
  ```

  All three must succeed (3 tests pass).

- [ ] Commit: `feat(phone-3d): scaffold package with key union and contract types`

---

### Task 2 — Keypad layout table + unit tests

All 17 key positions in ONE pure-data module. Spec §1 layout: blue NaviKey pill centered
below the screen, C key below-left, up/down rocker below-right, then the 4×3 digit grid
whose rows arc upward in the middle column (the "smile"/wave styling), power button on the
top edge.

**Files:** `packages/phone-3d/src/layout.ts`, `packages/phone-3d/tests/layout.test.ts`

- [ ] Write `packages/phone-3d/src/layout.ts`:

  ```ts
  import type { Nokia3310Key } from "./types";

  export type KeyShape = "pill" | "rockerUp" | "rockerDown" | "wave" | "oval";

  export interface KeyLayoutEntry {
    key: Nokia3310Key;
    /** Center of the key at rest, world units (1 unit = 1 cm). */
    position: [number, number, number];
    /** Bounding size [x, y, z]. */
    size: [number, number, number];
    shape: KeyShape;
  }

  /** Z travel of a depressed key. */
  export const KEY_PRESS_DEPTH = 0.04;

  /** Digit-grid geometry: columns left/center/right, four rows top→bottom. */
  export const DIGIT_COLUMN_X = [-1.4, 0, 1.4] as const;
  export const DIGIT_ROW_Y = [-0.35, -0.95, -1.55, -2.15] as const;
  /** Per-column upward offset — center column raised = the 3310 keypad arc. */
  export const ARC_OFFSET = [0.08, 0.16, 0.08] as const;
  export const DIGIT_KEY_SIZE: [number, number, number] = [1.25, 0.48, 0.1];

  const DIGIT_GRID: ReadonlyArray<ReadonlyArray<Nokia3310Key>> = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["*", "0", "#"],
  ];

  /** Center of digit key at grid (row 0–3, col 0–2), including the arc offset. */
  export function digitKeyPosition(row: number, col: number): [number, number, number] {
    return [DIGIT_COLUMN_X[col], DIGIT_ROW_Y[row] + ARC_OFFSET[col], 1.12];
  }

  export const KEY_LAYOUT: ReadonlyArray<KeyLayoutEntry> = [
    // Blue NaviKey pill, centered directly below the screen (spec §1.3).
    { key: "navi", position: [0, 0.85, 1.15], size: [1.8, 0.55, 0.12], shape: "pill" },
    // C key below-left of the NaviKey (spec §1.4).
    { key: "c", position: [-1.35, 0.45, 1.12], size: [0.85, 0.45, 0.1], shape: "oval" },
    // Up/down scroll rocker below-right, two press zones abutting at y=0.45 (spec §1.5).
    { key: "up", position: [1.35, 0.62, 1.12], size: [0.85, 0.34, 0.1], shape: "rockerUp" },
    { key: "down", position: [1.35, 0.28, 1.12], size: [0.85, 0.34, 0.1], shape: "rockerDown" },
    // Stiff black oval power button on the top edge (spec §1, "Top edge").
    { key: "power", position: [0, 5.7, 0.3], size: [0.7, 0.22, 0.35], shape: "oval" },
    // 4×3 wave-styled digit grid (spec §1.6).
    ...DIGIT_GRID.flatMap((rowKeys, row) =>
      rowKeys.map(
        (key, col): KeyLayoutEntry => ({
          key,
          position: digitKeyPosition(row, col),
          size: DIGIT_KEY_SIZE,
          shape: "wave",
        }),
      ),
    ),
  ];
  ```

- [ ] Write `packages/phone-3d/tests/layout.test.ts`:

  ```ts
  import { describe, expect, it } from "vite-plus/test";
  import {
    ARC_OFFSET,
    DIGIT_COLUMN_X,
    digitKeyPosition,
    DIGIT_ROW_Y,
    KEY_LAYOUT,
    type KeyLayoutEntry,
  } from "../src/layout";
  import { ALL_KEYS } from "../src/types";

  const EPSILON = 1e-9;

  /** Strict XY bounding-box overlap (touching edges do NOT count as overlap). */
  function overlapsXY(a: KeyLayoutEntry, b: KeyLayoutEntry): boolean {
    const dx = Math.abs(a.position[0] - b.position[0]);
    const dy = Math.abs(a.position[1] - b.position[1]);
    return dx < (a.size[0] + b.size[0]) / 2 - EPSILON && dy < (a.size[1] + b.size[1]) / 2 - EPSILON;
  }

  describe("KEY_LAYOUT", () => {
    it("has exactly 17 entries — one per physical key", () => {
      expect(KEY_LAYOUT).toHaveLength(17);
    });

    it("covers every Nokia3310Key exactly once", () => {
      const keys = KEY_LAYOUT.map((e) => e.key);
      expect(new Set(keys).size).toBe(17);
      for (const k of ALL_KEYS) expect(keys).toContain(k);
    });

    it("has strictly positive sizes everywhere", () => {
      for (const e of KEY_LAYOUT) {
        for (const dim of e.size) expect(dim).toBeGreaterThan(0);
      }
    });

    it("places every front-face key proud of the face plate (z > 1.1)", () => {
      for (const e of KEY_LAYOUT) {
        if (e.key === "power") continue; // top edge, not the front face
        expect(e.position[2]).toBeGreaterThan(1.1);
      }
    });

    it("has no overlapping XY bounding boxes between any two keys", () => {
      for (let i = 0; i < KEY_LAYOUT.length; i++) {
        for (let j = i + 1; j < KEY_LAYOUT.length; j++) {
          const a = KEY_LAYOUT[i];
          const b = KEY_LAYOUT[j];
          expect(overlapsXY(a, b), `${a.key} overlaps ${b.key}`).toBe(false);
        }
      }
    });

    it("keeps digit columns vertically aligned", () => {
      const columns: ReadonlyArray<readonly string[]> = [
        ["1", "4", "7", "*"],
        ["2", "5", "8", "0"],
        ["3", "6", "9", "#"],
      ];
      columns.forEach((col, c) => {
        for (const key of col) {
          const entry = KEY_LAYOUT.find((e) => e.key === key);
          expect(entry?.position[0]).toBe(DIGIT_COLUMN_X[c]);
        }
      });
    });

    it("arcs each digit row with the center column highest (the smile/wave)", () => {
      expect(ARC_OFFSET[1]).toBeGreaterThan(ARC_OFFSET[0]);
      expect(ARC_OFFSET[1]).toBeGreaterThan(ARC_OFFSET[2]);
      expect(ARC_OFFSET[0]).toBe(ARC_OFFSET[2]); // symmetric
      for (let row = 0; row < DIGIT_ROW_Y.length; row++) {
        const [, yLeft] = digitKeyPosition(row, 0);
        const [, yMid] = digitKeyPosition(row, 1);
        const [, yRight] = digitKeyPosition(row, 2);
        expect(yMid).toBeGreaterThan(yLeft);
        expect(yMid).toBeGreaterThan(yRight);
      }
    });

    it("abuts the rocker press zones without a gap", () => {
      const up = KEY_LAYOUT.find((e) => e.key === "up")!;
      const down = KEY_LAYOUT.find((e) => e.key === "down")!;
      expect(up.shape).toBe("rockerUp");
      expect(down.shape).toBe("rockerDown");
      expect(up.position[0]).toBe(down.position[0]);
      const upBottom = up.position[1] - up.size[1] / 2;
      const downTop = down.position[1] + down.size[1] / 2;
      expect(Math.abs(upBottom - downTop)).toBeLessThan(1e-9);
    });

    it("puts the power button on the top edge", () => {
      const power = KEY_LAYOUT.find((e) => e.key === "power")!;
      expect(power.position[1]).toBeGreaterThan(5.65); // protrudes above body top
      expect(power.shape).toBe("oval");
    });
  });
  ```

- [ ] Verify:

  ```sh
  mise exec -- vp run @hellotimber/phone-3d#test
  mise exec -- vp check --fix
  ```

  12 tests pass (3 from Task 1 + 9 new).

- [ ] Commit: `feat(phone-3d): keypad layout table with geometry unit tests`

---

### Task 3 — Materials, `<PhoneBody>`, and the demo skeleton

**Files:** `packages/phone-3d/src/materials.ts`, `packages/phone-3d/tests/materials.test.ts`,
`packages/phone-3d/src/PhoneBody.tsx`, `packages/phone-3d/src/demo/test-pattern.ts`,
`packages/phone-3d/src/demo/main.tsx`, `packages/phone-3d/index.html`

- [ ] Write `packages/phone-3d/src/materials.ts` (pure data — components spread these into
      `<meshStandardMaterial/>`):

  ```ts
  export interface MaterialSpec {
    color: string;
    roughness: number;
    metalness: number;
  }

  /** Dark-blue Xpress-on shell, grey keys, blue NaviKey (spec §1). */
  export const MATERIALS = {
    body: { color: "#27406e", roughness: 0.55, metalness: 0.05 },
    face: { color: "#1d3358", roughness: 0.6, metalness: 0.05 },
    key: { color: "#b8bcc4", roughness: 0.45, metalness: 0.1 },
    navi: { color: "#2456c8", roughness: 0.4, metalness: 0.1 },
    bezel: { color: "#0c1014", roughness: 0.7, metalness: 0 },
    grille: { color: "#0c1014", roughness: 0.8, metalness: 0 },
  } as const satisfies Record<string, MaterialSpec>;

  /** Green LCD backlight glow (spec §9: backlight is green). */
  export const BACKLIGHT_COLOR = "#b4f5a0";
  /** Multiplier tint for the screen texture when the backlight is off. */
  export const SCREEN_DIM_TINT = "#7a8579";
  ```

- [ ] Write `packages/phone-3d/tests/materials.test.ts`:

  ```ts
  import { describe, expect, it } from "vite-plus/test";
  import { BACKLIGHT_COLOR, MATERIALS, SCREEN_DIM_TINT } from "../src/materials";

  const HEX = /^#[0-9a-f]{6}$/;

  describe("MATERIALS", () => {
    it("uses valid lowercase hex colors and 0–1 PBR params", () => {
      for (const spec of Object.values(MATERIALS)) {
        expect(spec.color).toMatch(HEX);
        expect(spec.roughness).toBeGreaterThanOrEqual(0);
        expect(spec.roughness).toBeLessThanOrEqual(1);
        expect(spec.metalness).toBeGreaterThanOrEqual(0);
        expect(spec.metalness).toBeLessThanOrEqual(1);
      }
      expect(BACKLIGHT_COLOR).toMatch(HEX);
      expect(SCREEN_DIM_TINT).toMatch(HEX);
    });

    it("keeps the NaviKey blue distinct from the grey keys", () => {
      expect(MATERIALS.navi.color).not.toBe(MATERIALS.key.color);
    });
  });
  ```

- [ ] Write `packages/phone-3d/src/PhoneBody.tsx` — body, face plate, screen bezel, and
      earpiece grille dots above the display (spec §1: earpiece grille above the display,
      display window in the upper third):

  ```tsx
  import { RoundedBox } from "@react-three/drei";
  import { MATERIALS } from "./materials";

  const GRILLE_DOT_XS = [-0.45, -0.15, 0.15, 0.45];

  /** Static phone shell: candy-bar body, face plate, screen bezel, earpiece grille.
   *  1 world unit = 1 cm; body is 4.8 × 11.3 × 2.2 (48 × 113 × 22 mm, spec §1). */
  export function PhoneBody() {
    return (
      <group>
        {/* Rounded "pebble" candy-bar shell */}
        <RoundedBox args={[4.8, 11.3, 2.2]} radius={0.6} smoothness={4}>
          <meshStandardMaterial {...MATERIALS.body} />
        </RoundedBox>
        {/* Face plate — front at z = 1.12, just proud of the shell */}
        <RoundedBox args={[4.2, 10.5, 0.12]} radius={0.06} smoothness={4} position={[0, 0, 1.06]}>
          <meshStandardMaterial {...MATERIALS.face} />
        </RoundedBox>
        {/* Near-black screen bezel, upper third — front at z = 1.15 */}
        <RoundedBox args={[3.2, 2.0, 0.1]} radius={0.05} smoothness={4} position={[0, 2.0, 1.1]}>
          <meshStandardMaterial {...MATERIALS.bezel} />
        </RoundedBox>
        {/* Earpiece grille dots above the display */}
        {GRILLE_DOT_XS.map((x) => (
          <mesh key={x} position={[x, 4.2, 1.13]}>
            <circleGeometry args={[0.07, 16]} />
            <meshStandardMaterial {...MATERIALS.grille} />
          </mesh>
        ))}
      </group>
    );
  }
  ```

- [ ] Write `packages/phone-3d/src/demo/test-pattern.ts` — the 84×48 test-pattern canvas.
      Every `drawFrame()` flips the checkerboard parity and increments a counter, so a
      live texture is unmistakable:

  ```ts
  export interface TestPattern {
    /** Native 84×48 canvas — the screen texture source. */
    canvas: HTMLCanvasElement;
    /** Increments on every drawFrame(); feed to screenVersion. */
    version: number;
    /** Redraw: alternate checkerboard, bump frame counter, bump version. */
    drawFrame(): void;
  }

  export function createTestPattern(): TestPattern {
    const canvas = document.createElement("canvas");
    canvas.width = 84;
    canvas.height = 48;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d context unavailable");
    let frame = 0;

    const pattern: TestPattern = {
      canvas,
      version: 0,
      drawFrame() {
        const cell = 6; // 14 × 8 cells
        for (let cy = 0; cy < 48 / cell; cy++) {
          for (let cx = 0; cx < 84 / cell; cx++) {
            ctx.fillStyle = (cx + cy + frame) % 2 === 0 ? "#9bbf3b" : "#2b3a1e";
            ctx.fillRect(cx * cell, cy * cell, cell, cell);
          }
        }
        // Frame counter plate, centered
        ctx.fillStyle = "#9bbf3b";
        ctx.fillRect(22, 18, 40, 12);
        ctx.strokeStyle = "#1c2a12";
        ctx.strokeRect(22.5, 18.5, 39, 11);
        ctx.fillStyle = "#1c2a12";
        ctx.font = "10px monospace";
        ctx.textBaseline = "top";
        ctx.fillText(String(frame).padStart(5, "0"), 26, 19);
        frame += 1;
        pattern.version += 1;
      },
    };
    pattern.drawFrame();
    return pattern;
  }
  ```

- [ ] Write `packages/phone-3d/index.html`:

  ```html
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>@hellotimber/phone-3d demo</title>
      <style>
        html,
        body,
        #root {
          height: 100%;
          margin: 0;
          background: #14161c;
          color: #d8dce4;
          font-family: monospace;
        }
        .demo {
          display: flex;
          height: 100%;
        }
        .stage {
          flex: 1;
          min-width: 0;
        }
        .sidebar {
          width: 280px;
          padding: 12px;
          overflow-y: auto;
          border-left: 1px solid #2a2e38;
        }
        .sidebar h2 {
          font-size: 13px;
          margin: 12px 0 6px;
        }
        .pattern-preview {
          width: 252px; /* 84 × 3 */
          height: 144px; /* 48 × 3 */
          image-rendering: pixelated;
          border: 1px solid #2a2e38;
        }
        #key-log {
          font-size: 12px;
          line-height: 1.5;
          white-space: pre;
        }
      </style>
    </head>
    <body>
      <div id="root"></div>
      <script type="module" src="/src/demo/main.tsx"></script>
    </body>
  </html>
  ```

- [ ] Write `packages/phone-3d/src/demo/main.tsx` (skeleton stage: inline `<Canvas>` —
      `<PhoneStage>` replaces it in Task 7; the test pattern animates in the sidebar
      preview; the 3D screen arrives in Task 4):

  ```tsx
  import { Canvas } from "@react-three/fiber";
  import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
  import { createRoot } from "react-dom/client";
  import { PhoneBody } from "../PhoneBody";
  import { createTestPattern } from "./test-pattern";

  function App() {
    const pattern = useMemo(() => createTestPattern(), []);
    const [version, setVersion] = useState(pattern.version);
    const previewRef = useRef<HTMLDivElement>(null);

    // Animate the test pattern at 2 fps — counter + checkerboard flip
    useEffect(() => {
      const id = setInterval(() => {
        pattern.drawFrame();
        setVersion(pattern.version);
      }, 500);
      return () => clearInterval(id);
    }, [pattern]);

    // Show the live pattern canvas itself in the sidebar
    useEffect(() => {
      const host = previewRef.current;
      if (!host) return;
      pattern.canvas.className = "pattern-preview";
      host.appendChild(pattern.canvas);
      return () => {
        pattern.canvas.remove();
      };
    }, [pattern]);

    return (
      <div className="demo">
        <div className="stage">
          <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 18], fov: 40 }}>
            <ambientLight intensity={0.7} />
            <directionalLight position={[4, 6, 8]} intensity={1.4} />
            <directionalLight position={[-5, -2, 4]} intensity={0.3} />
            <PhoneBody />
          </Canvas>
        </div>
        <aside className="sidebar">
          <h2>test pattern (version {version})</h2>
          <div ref={previewRef} />
          <h2>key log</h2>
          <div id="key-log">(keypad arrives in Task 5)</div>
        </aside>
      </div>
    );
  }

  const rootEl = document.getElementById("root");
  if (!rootEl) throw new Error("missing #root");
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  ```

- [ ] Verify tests and lint:

  ```sh
  mise exec -- vp run @hellotimber/phone-3d#test
  mise exec -- vp check --fix
  ```

- [ ] **Visual gate** — `cd packages/phone-3d && mise exec -- vp dev`, open the URL:
  - A dark-blue rounded candy-bar phone fills the left pane: lighter face plate, a
    near-black bezel rectangle in the upper third, four small grille dots above it.
  - Sidebar shows the 84×48 checkerboard scaled ×3 with a 5-digit counter incrementing
    twice per second; the checkerboard parity flips with it; "version N" climbs.
  - No console errors. Stop the server.

- [ ] Commit: `feat(phone-3d): materials, phone body, and demo playground skeleton`

---

### Task 4 — `<Screen>` with the CanvasTexture pattern

The texture configuration below is integration-notes §5 **verbatim** — do not change any
of the four settings or the upload strategy.

**Files:** `packages/phone-3d/src/Screen.tsx`, `packages/phone-3d/src/demo/main.tsx`

- [ ] Write `packages/phone-3d/src/Screen.tsx`:

  ```tsx
  import { useFrame } from "@react-three/fiber";
  import { useEffect, useMemo, useRef } from "react";
  import * as THREE from "three";
  import { SCREEN_DIM_TINT } from "./materials";

  export interface ScreenProps {
    screenCanvas: HTMLCanvasElement;
    screenVersion: number;
    backlightOn?: boolean;
  }

  /** 2.8 × 1.6 screen plane at [0, 2.0, 1.2] — 0.05 proud of the bezel front
   *  (z-offset avoids z-fighting, integration-notes §5). */
  export function Screen({ screenCanvas, screenVersion, backlightOn = true }: ScreenProps) {
    const texture = useMemo(() => {
      const t = new THREE.CanvasTexture(screenCanvas);
      t.colorSpace = THREE.SRGBColorSpace; // canvas 2D pixels are sRGB
      t.magFilter = THREE.NearestFilter; // crisp pixels when upscaled
      t.minFilter = THREE.NearestFilter;
      t.generateMipmaps = false; // 84×48 NPOT + nearest: mips wrong and wasteful
      // flipY stays true (default) — matches planeGeometry 0..1 UVs
      return t;
    }, [screenCanvas]);

    // Dispose the GPU texture on unmount / canvas swap
    useEffect(() => () => texture.dispose(), [texture]);

    // Re-upload only when dirty: compare version counters inside useFrame
    const versionRef = useRef(screenVersion);
    versionRef.current = screenVersion;
    const uploadedRef = useRef(-1);
    useFrame(() => {
      if (uploadedRef.current !== versionRef.current) {
        texture.needsUpdate = true;
        uploadedRef.current = versionRef.current;
      }
    });

    return (
      <mesh position={[0, 2.0, 1.2]}>
        <planeGeometry args={[2.8, 1.6]} />
        {/* Unlit is right for an emissive LCD; toneMapped={false} keeps the green true */}
        <meshBasicMaterial
          map={texture}
          toneMapped={false}
          color={backlightOn ? "#ffffff" : SCREEN_DIM_TINT}
        />
      </mesh>
    );
  }
  ```

- [ ] In `packages/phone-3d/src/demo/main.tsx`, render the screen on the phone. Add the
      import below the `PhoneBody` import:

  ```tsx
  import { Screen } from "../Screen";
  ```

  and inside the `<Canvas>`, directly after `<PhoneBody />`, add:

  ```tsx
  <Screen screenCanvas={pattern.canvas} screenVersion={version} />
  ```

- [ ] Verify tests and lint:

  ```sh
  mise exec -- vp run @hellotimber/phone-3d#test
  mise exec -- vp check --fix
  ```

- [ ] **Visual gate** — `cd packages/phone-3d && mise exec -- vp dev`:
  - The bezel now carries a bright green-checkerboard screen with the 5-digit frame
    counter, pixel-crisp (no blur — NearestFilter working).
  - The counter on the **3D screen** increments in lockstep with the sidebar preview —
    this proves the `screenVersion` → `needsUpdate` upload path.
  - The screen reads as self-lit (not dimmed by scene lighting). No console errors.

- [ ] Commit: `feat(phone-3d): screen mesh with version-gated CanvasTexture`

---

### Task 5 — `<Key>` + `<Keypad>`: pointer events, depress visuals, key log

**Files:** `packages/phone-3d/src/Key.tsx`, `packages/phone-3d/src/Keypad.tsx`,
`packages/phone-3d/src/demo/main.tsx`

- [ ] Write `packages/phone-3d/src/Key.tsx`. Every key is its own mesh; handlers call
      `e.stopPropagation()` (integration-notes §5). A key is depressed (z − 0.04) when
      pressed by pointer OR listed in `pressedKeys`. The pill renders as a flattened
      capsule; everything else as a `RoundedBox`:

  ```tsx
  import { RoundedBox } from "@react-three/drei";
  import type { ThreeEvent } from "@react-three/fiber";
  import { useState } from "react";
  import { KEY_PRESS_DEPTH, type KeyLayoutEntry } from "./layout";
  import { MATERIALS, type MaterialSpec } from "./materials";
  import type { Nokia3310Key } from "./types";

  export interface KeyProps {
    entry: KeyLayoutEntry;
    onKey?: (key: Nokia3310Key, action: "down" | "up") => void;
    /** Depress visually without pointer input (Nokia3310Props.pressedKeys). */
    externallyPressed?: boolean;
  }

  function materialFor(entry: KeyLayoutEntry): MaterialSpec {
    if (entry.shape === "pill") return MATERIALS.navi; // the blue NaviKey
    if (entry.key === "power") return MATERIALS.bezel; // stiff black top button
    return MATERIALS.key;
  }

  export function Key({ entry, onKey, externallyPressed = false }: KeyProps) {
    const [pointerPressed, setPointerPressed] = useState(false);
    const pressed = pointerPressed || externallyPressed;
    const [x, y, z] = entry.position;
    const position: [number, number, number] = [x, y, pressed ? z - KEY_PRESS_DEPTH : z];

    const release = () => {
      if (pointerPressed) {
        setPointerPressed(false);
        onKey?.(entry.key, "up");
      }
    };
    const handlers = {
      onPointerDown: (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        setPointerPressed(true);
        onKey?.(entry.key, "down");
      },
      onPointerUp: (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        release();
      },
      onPointerOver: (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      },
      onPointerOut: () => {
        document.body.style.cursor = "auto";
        release(); // dragging off a held key releases it — no stuck keys
      },
    };
    const spec = materialFor(entry);

    if (entry.shape === "pill") {
      // Horizontal capsule (axis X), flattened in z to the entry depth
      const radius = entry.size[1] / 2;
      const length = entry.size[0] - entry.size[1];
      return (
        <mesh
          position={position}
          rotation={[0, 0, Math.PI / 2]}
          scale={[1, 1, entry.size[2] / entry.size[1]]}
          {...handlers}
        >
          <capsuleGeometry args={[radius, length, 8, 16]} />
          <meshStandardMaterial {...spec} />
        </mesh>
      );
    }

    const cornerRadius = Math.min(...entry.size) / 2 - 0.005;
    return (
      <RoundedBox
        args={entry.size}
        radius={cornerRadius}
        smoothness={4}
        position={position}
        {...handlers}
      >
        <meshStandardMaterial {...spec} />
      </RoundedBox>
    );
  }
  ```

- [ ] Write `packages/phone-3d/src/Keypad.tsx`:

  ```tsx
  import { Key } from "./Key";
  import { KEY_LAYOUT } from "./layout";
  import type { Nokia3310Key } from "./types";

  export interface KeypadProps {
    onKey?: (key: Nokia3310Key, action: "down" | "up") => void;
    pressedKeys?: ReadonlySet<Nokia3310Key>;
  }

  /** All 17 keys from KEY_LAYOUT as independent pressable meshes. */
  export function Keypad({ onKey, pressedKeys }: KeypadProps) {
    return (
      <group>
        {KEY_LAYOUT.map((entry) => (
          <Key
            key={entry.key}
            entry={entry}
            onKey={onKey}
            externallyPressed={pressedKeys?.has(entry.key) ?? false}
          />
        ))}
      </group>
    );
  }
  ```

- [ ] Rewrite `packages/phone-3d/src/demo/main.tsx` — adds the keypad, the key-press log,
      and a keyboard → `pressedKeys` demo (hold a digit/`*`/`#` key on your physical
      keyboard to depress it externally):

  ```tsx
  import { Canvas } from "@react-three/fiber";
  import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
  import { createRoot } from "react-dom/client";
  import { Keypad } from "../Keypad";
  import { PhoneBody } from "../PhoneBody";
  import { Screen } from "../Screen";
  import type { Nokia3310Key } from "../types";
  import { createTestPattern } from "./test-pattern";

  const KEYBOARD_KEYS = new Set<string>([
    "*",
    "#",
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
  ]);

  function App() {
    const pattern = useMemo(() => createTestPattern(), []);
    const [version, setVersion] = useState(pattern.version);
    const [log, setLog] = useState<string[]>([]);
    const [pressedKeys, setPressedKeys] = useState<ReadonlySet<Nokia3310Key>>(new Set());
    const previewRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const id = setInterval(() => {
        pattern.drawFrame();
        setVersion(pattern.version);
      }, 500);
      return () => clearInterval(id);
    }, [pattern]);

    useEffect(() => {
      const host = previewRef.current;
      if (!host) return;
      pattern.canvas.className = "pattern-preview";
      host.appendChild(pattern.canvas);
      return () => {
        pattern.canvas.remove();
      };
    }, [pattern]);

    // Physical keyboard demo for the pressedKeys prop
    useEffect(() => {
      const update = (key: string, held: boolean) => {
        if (!KEYBOARD_KEYS.has(key)) return;
        setPressedKeys((prev) => {
          const next = new Set(prev);
          if (held) next.add(key as Nokia3310Key);
          else next.delete(key as Nokia3310Key);
          return next;
        });
      };
      const down = (e: KeyboardEvent) => update(e.key, true);
      const up = (e: KeyboardEvent) => update(e.key, false);
      window.addEventListener("keydown", down);
      window.addEventListener("keyup", up);
      return () => {
        window.removeEventListener("keydown", down);
        window.removeEventListener("keyup", up);
      };
    }, []);

    const handleKey = (key: Nokia3310Key, action: "down" | "up") => {
      setLog((prev) => [`${key} ${action}`, ...prev].slice(0, 30));
    };

    return (
      <div className="demo">
        <div className="stage">
          <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 18], fov: 40 }}>
            <ambientLight intensity={0.7} />
            <directionalLight position={[4, 6, 8]} intensity={1.4} />
            <directionalLight position={[-5, -2, 4]} intensity={0.3} />
            <PhoneBody />
            <Screen screenCanvas={pattern.canvas} screenVersion={version} />
            <Keypad onKey={handleKey} pressedKeys={pressedKeys} />
          </Canvas>
        </div>
        <aside className="sidebar">
          <h2>test pattern (version {version})</h2>
          <div ref={previewRef} />
          <h2>key log</h2>
          <div id="key-log">{log.join("\n")}</div>
        </aside>
      </div>
    );
  }

  const rootEl = document.getElementById("root");
  if (!rootEl) throw new Error("missing #root");
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  ```

- [ ] Verify tests and lint:

  ```sh
  mise exec -- vp run @hellotimber/phone-3d#test
  mise exec -- vp check --fix
  ```

- [ ] **Visual gate** — `cd packages/phone-3d && mise exec -- vp dev`:
  - The full keypad is visible: blue NaviKey pill under the screen, grey C key
    below-left, grey rocker (two zones) below-right, 4×3 grey digit grid with the center
    column raised (the smile arc), black power button peeking over the top edge.
  - Hovering any key shows a pointer cursor; leaving it restores the default cursor.
  - Click "5": the key visibly sinks while held; the log shows `5 down` then `5 up`.
  - Click every key once (all 17, including power on the top edge): each depresses and
    logs its own id (`navi`, `c`, `up`, `down`, `power`, `0`–`9`, `*`, `#`).
  - Press-drag off a key: it releases (`up` logged) — no stuck keys.
  - Hold "7" on the physical keyboard: the 3D "7" key stays depressed until release
    (the `pressedKeys` path) — note it does NOT log, which is correct: external presses
    are display-only.

- [ ] Commit: `feat(phone-3d): pressable keypad with pointer events and key log`

---

### Task 6 — `<Nokia3310>` assembly + backlight toggle in the demo

**Files:** `packages/phone-3d/src/Nokia3310.tsx`, `packages/phone-3d/src/index.ts`,
`packages/phone-3d/src/demo/main.tsx`

- [ ] Write `packages/phone-3d/src/Nokia3310.tsx` — the contract component:

  ```tsx
  import { Keypad } from "./Keypad";
  import { BACKLIGHT_COLOR } from "./materials";
  import { PhoneBody } from "./PhoneBody";
  import { Screen } from "./Screen";
  import type { Nokia3310Props } from "./types";

  /** The phone model; must be rendered inside an R3F <Canvas> (VISION contract). */
  export function Nokia3310({
    screenCanvas,
    screenVersion,
    onKey,
    backlightOn = true,
    pressedKeys,
  }: Nokia3310Props) {
    return (
      <group>
        <PhoneBody />
        <Keypad onKey={onKey} pressedKeys={pressedKeys} />
        <Screen
          screenCanvas={screenCanvas}
          screenVersion={screenVersion}
          backlightOn={backlightOn}
        />
        {/* Green backlight glow over screen + keypad (spec §9: backlight is green) */}
        {backlightOn && (
          <pointLight
            color={BACKLIGHT_COLOR}
            intensity={1.5}
            distance={4}
            decay={2}
            position={[0, 2, 1.8]}
          />
        )}
      </group>
    );
  }
  ```

- [ ] Replace `packages/phone-3d/src/index.ts` with:

  ```ts
  export type { Nokia3310Key, Nokia3310Props } from "./types";
  export { Nokia3310 } from "./Nokia3310";
  ```

- [ ] Update `packages/phone-3d/src/demo/main.tsx`: replace the three component imports

  ```tsx
  import { Keypad } from "../Keypad";
  import { PhoneBody } from "../PhoneBody";
  import { Screen } from "../Screen";
  ```

  with

  ```tsx
  import { Nokia3310 } from "../Nokia3310";
  ```

  Add backlight state inside `App` (next to the other `useState` calls):

  ```tsx
  const [backlightOn, setBacklightOn] = useState(true);
  ```

  Replace the three elements inside `<Canvas>`
  (`<PhoneBody />`, `<Screen … />`, `<Keypad … />`) with the single assembly:

  ```tsx
  <Nokia3310
    screenCanvas={pattern.canvas}
    screenVersion={version}
    onKey={handleKey}
    backlightOn={backlightOn}
    pressedKeys={pressedKeys}
  />
  ```

  In the sidebar, above the `test pattern` heading, add the toggle:

  ```tsx
  <h2>backlight</h2>
  <label>
    <input
      type="checkbox"
      checked={backlightOn}
      onChange={(e) => setBacklightOn(e.target.checked)}
    />{" "}
    backlight on
  </label>
  ```

- [ ] Verify tests and lint:

  ```sh
  mise exec -- vp run @hellotimber/phone-3d#test
  mise exec -- vp check --fix
  ```

- [ ] **Visual gate** — `cd packages/phone-3d && mise exec -- vp dev`:
  - The phone renders identically to Task 5 plus a soft green glow around the screen and
    upper keypad.
  - Untick "backlight on": the glow disappears AND the screen visibly dims to a murky
    green (the `SCREEN_DIM_TINT` multiplier). Re-tick: both return. Keys still click and
    log in both states.

- [ ] Commit: `feat(phone-3d): Nokia3310 assembly with green backlight`

---

### Task 7 — `<PhoneStage>`: Canvas, lights, idle sway, pointer tilt

**Files:** `packages/phone-3d/src/PhoneStage.tsx`, `packages/phone-3d/src/index.ts`,
`packages/phone-3d/src/demo/main.tsx`

- [ ] Write `packages/phone-3d/src/PhoneStage.tsx`:

  ```tsx
  import { Canvas, useFrame } from "@react-three/fiber";
  import { useRef } from "react";
  import type { ReactNode } from "react";
  import type { Group } from "three";
  import { Nokia3310 } from "./Nokia3310";
  import type { Nokia3310Props } from "./types";

  /** Gentle idle sway (sine) + pointer-follow tilt, eased toward the target. */
  function SwayRig({ children }: { children: ReactNode }) {
    const group = useRef<Group>(null);
    useFrame((state) => {
      const g = group.current;
      if (!g) return;
      const t = state.clock.elapsedTime;
      const targetY = Math.sin(t * 0.5) * 0.06 + state.pointer.x * 0.18;
      const targetX = Math.sin(t * 0.7) * 0.02 - state.pointer.y * 0.12;
      g.rotation.y += (targetY - g.rotation.y) * 0.05;
      g.rotation.x += (targetX - g.rotation.x) * 0.05;
    });
    return <group ref={group}>{children}</group>;
  }

  /** Convenience scene: Canvas + lighting + resize + subtle idle motion (VISION contract).
   *  R3F's Canvas tracks its container size, so resize works out of the box. */
  export function PhoneStage({ className, ...props }: Nokia3310Props & { className?: string }) {
    return (
      <Canvas className={className} dpr={[1, 2]} camera={{ position: [0, 0, 18], fov: 40 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[4, 6, 8]} intensity={1.4} />
        <directionalLight position={[-5, -2, 4]} intensity={0.3} />
        <SwayRig>
          <Nokia3310 {...props} />
        </SwayRig>
      </Canvas>
    );
  }
  ```

- [ ] Replace `packages/phone-3d/src/index.ts` with the final contract surface:

  ```ts
  export type { Nokia3310Key, Nokia3310Props } from "./types";
  export { Nokia3310 } from "./Nokia3310";
  export { PhoneStage } from "./PhoneStage";
  ```

- [ ] Update `packages/phone-3d/src/demo/main.tsx` to consume the stage exactly as a host
      app would. Replace the imports

  ```tsx
  import { Canvas } from "@react-three/fiber";
  ```

  and

  ```tsx
  import { Nokia3310 } from "../Nokia3310";
  ```

  with the single import

  ```tsx
  import { PhoneStage } from "../PhoneStage";
  ```

  Then replace the whole `<div className="stage">…</div>` block with:

  ```tsx
  <PhoneStage
    className="stage"
    screenCanvas={pattern.canvas}
    screenVersion={version}
    onKey={handleKey}
    backlightOn={backlightOn}
    pressedKeys={pressedKeys}
  />
  ```

  (R3F renders `className` onto the Canvas wrapper div, so the existing `.stage` flex
  CSS keeps sizing it.)

- [ ] Verify tests and lint:

  ```sh
  mise exec -- vp run @hellotimber/phone-3d#test
  mise exec -- vp check --fix
  ```

- [ ] **Visual gate** — `cd packages/phone-3d && mise exec -- vp dev`:
  - The phone sways gently on its own (slow, small-amplitude rotation — never nauseating).
  - Moving the mouse across the stage tilts the phone toward the pointer; it eases back
    when the pointer rests. Keys remain clickable while swaying (raycast tracks the
    moving meshes).
  - Resize the browser window: the canvas fills the left pane at every size with no
    distortion and no console errors.
  - The frame counter still animates and the backlight toggle still works.

- [ ] Commit: `feat(phone-3d): PhoneStage with idle sway and pointer tilt`

---

### Task 8 — README, final visual checklist, plan status

**Files:** `packages/phone-3d/README.md`, `docs/plans/README.md`

- [ ] Write `packages/phone-3d/README.md`:

  ````markdown
  # @hellotimber/phone-3d

  A Nokia 3310 as react-three-fiber components: parametric body (no GLTF assets),
  17 pressable keys, an 84×48 canvas-textured screen, and a green backlight.

  The package is host-agnostic: you hand it any `HTMLCanvasElement` as the screen
  texture source and it reports physical key presses via callback. It knows nothing
  about what's on the screen or what the keys mean.

  ## Install (outside this repo)

  ```sh
  npm install react react-dom three @react-three/fiber @react-three/drei
  # then add this package (peer deps above are required)
  ```

  ## Usage

  ```tsx
  import { PhoneStage, type Nokia3310Key } from "@hellotimber/phone-3d";
  import { useEffect, useMemo, useState } from "react";

  function MyPhone() {
    // Any 84×48 canvas works — drive it however you like
    const canvas = useMemo(() => {
      const c = document.createElement("canvas");
      c.width = 84;
      c.height = 48;
      c.getContext("2d")!.fillRect(0, 0, 84, 48);
      return c;
    }, []);
    const [version, setVersion] = useState(0);

    useEffect(() => {
      const id = setInterval(() => setVersion((v) => v + 1), 100); // after redrawing
      return () => clearInterval(id);
    }, []);

    return (
      <PhoneStage
        className="phone"
        screenCanvas={canvas}
        screenVersion={version}
        onKey={(key: Nokia3310Key, action) => console.log(key, action)}
      />
    );
  }
  ```

  `<PhoneStage>` creates its own R3F `<Canvas>` (lights, resize handling, idle sway,
  pointer tilt). To compose into an existing scene, render `<Nokia3310 {...props}/>`
  inside your own `<Canvas>` instead.

  ## Props (`Nokia3310Props`)

  | Prop            | Type                                                  | Required | Notes                                                               |
  | --------------- | ----------------------------------------------------- | -------- | ------------------------------------------------------------------- |
  | `screenCanvas`  | `HTMLCanvasElement`                                   | yes      | Texture source; native 84×48 recommended (NearestFilter upscales)   |
  | `screenVersion` | `number`                                              | yes      | Bump after drawing — triggers a texture re-upload on the next frame |
  | `onKey`         | `(key: Nokia3310Key, action: "down" \| "up") => void` | no       | Fired by pointer interaction with key meshes                        |
  | `backlightOn`   | `boolean`                                             | no       | Default `true`; off dims the screen and kills the green glow        |
  | `pressedKeys`   | `ReadonlySet<Nokia3310Key>`                           | no       | Visually depress keys from outside (e.g. keyboard input)            |

  `PhoneStage` additionally accepts `className` (applied to the canvas wrapper div —
  size it with CSS; the canvas tracks its container).

  `Nokia3310Key` is `"power" | "navi" | "c" | "up" | "down" | "0"–"9" | "*" | "#"`.

  ## Demo

  ```sh
  vp install
  cd packages/phone-3d && vp dev
  ```

  Test pattern screen, key-press log, backlight toggle. Hold a digit key on your
  keyboard to see `pressedKeys` in action.

  ## Tests

  ```sh
  vp run @hellotimber/phone-3d#test
  ```

  Pure logic only (layout table, key union, materials) — 3D rendering is verified
  through the demo, since jsdom has no WebGL.
  ````

- [ ] Run the **final visual checklist** against the demo
      (`cd packages/phone-3d && mise exec -- vp dev`) — every line must hold:
  - [ ] Phone proportions read as a 3310: tall rounded dark-blue candy-bar, screen in
        the upper third, earpiece dots above the screen.
  - [ ] Test-pattern screen is pixel-crisp; frame counter increments on the 3D screen
        and sidebar preview in lockstep.
  - [ ] Blue NaviKey pill, C below-left, rocker below-right, smiling 4×3 digit grid,
        black power button on the top edge.
  - [ ] Click each of the 17 keys → each depresses and logs `<key> down` / `<key> up`.
  - [ ] Hover cursor is `pointer` over keys, default elsewhere; drag-off releases.
  - [ ] Backlight toggle dims/relights screen and glow.
  - [ ] Idle sway + pointer tilt active; window resize never distorts or errors.
  - [ ] Browser console clean (no three.js warnings about multiple instances, no
        React key warnings).
  - [ ] `src/index.ts` exports exactly: `Nokia3310Key`, `Nokia3310Props`, `Nokia3310`,
        `PhoneStage` — the VISION contract, nothing else.
- [ ] Run the full verification suite one last time:

  ```sh
  mise exec -- vp run @hellotimber/phone-3d#test
  mise exec -- vp check --fix
  ```

- [ ] **Plan status:** in `docs/plans/README.md`, change plan 03's Status column from
      `not started` to `done` (or `in progress` if any checklist line above failed —
      and report the failure).

- [ ] Commit: `feat(phone-3d): README with usage and props table; mark plan 03 done`

---

## Done means

All 8 tasks committed; `mise exec -- vp run @hellotimber/phone-3d#test` green;
`mise exec -- vp check --fix` clean; the demo passes the Task 8 visual checklist; the
package's public surface is exactly the VISION.md `@hellotimber/phone-3d` contract; no
file outside `packages/phone-3d/` was modified except `docs/plans/README.md` (status).
