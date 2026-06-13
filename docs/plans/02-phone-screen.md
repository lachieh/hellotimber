# Plan 02 — `@hellotimber/phone-screen`

> **For agentic workers:** execute task-by-task; tick checkboxes; commit per task. If this plan contradicts VISION.md contracts or the code, STOP and report.

**Goal:** Build `@hellotimber/phone-screen` — the rasterizer that turns a phone-core `ScreenModel` into an 84×48 monochrome framebuffer (one byte per pixel, row-major, 0/1) and presents it on a 2D canvas, implementing the VISION.md `createScreenRenderer` contract verbatim: pixel font, status bars, menu icons, boot animation, and every screen kind.

**Architecture:** A pure-TS `Framebuffer` class (84×48 `Uint8Array`, one byte per pixel, 0 = background / 1 = ink) is the only drawing surface; a 5×7 string-art pixel font, string-art icons, and one renderer function per `ScreenModel` kind draw into it — all fully node-testable with zero DOM, asserted pixel-by-pixel against ASCII-art expectations. `createScreenRenderer` is the only DOM-touching code: it creates an `HTMLCanvasElement` (84×48 logical, × `opts.scale`), dispatches `render(screen)` to the right renderer, diffs the framebuffer against the previously painted frame, and only then repaints via `putImageData` (classic green LCD palette) and bumps `version`.

**Tech stack:** TypeScript (`catalog:`), Vite+ (`vp`) for test/lint/typecheck, Vitest via `vite-plus/test` in node environment (one jsdom test file for the canvas wrapper, via a `@vitest-environment jsdom` docblock). **Type-only** imports from `@hellotimber/phone-core` — declared as a devDependency `workspace:*`, never a runtime dependency (AGENTS.md boundary rule 2). `jsdom` as a devDependency for the wrapper test.

**Files at completion:**

```
packages/phone-screen/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── README.md
├── src/
│   ├── index.ts            public barrel
│   ├── bitmap.ts           Bitmap interface + bitmapFromArt (string-art parser)
│   ├── framebuffer.ts      Framebuffer: setPixel/getPixel/clear/fillRect/blitBitmap/drawText
│   ├── font/
│   │   ├── glyphs.ts       5×7 string-art glyph data (A–Z a–z 0–9 punctuation … ► ▲ ▼)
│   │   └── font.ts         PixelFont, FONT (compiled glyphs), textWidth
│   ├── icons/
│   │   ├── status.ts       antenna/battery/envelope/keyguard art + signal & battery bar stacks
│   │   ├── menu-icons.ts   13 menu icons (16×16) + fallback icon
│   │   └── boot.ts         connecting-hands sprites → 4 × 84×30 HANDS_FRAMES
│   ├── render/
│   │   ├── layout.ts       zone constants, wrapText, truncate, softkey/title/scroll-indicator helpers
│   │   ├── boot.ts         renderBoot (hands + welcome phases)
│   │   ├── standby.ts      renderStandby
│   │   ├── carousel.ts     renderCarousel
│   │   ├── list.ts         renderList + renderReader
│   │   ├── editor.ts       renderEditor + renderConfirm
│   │   └── index.ts        renderScreen dispatcher (incl. off + custom)
│   └── renderer.ts         createScreenRenderer — the canvas wrapper (only DOM code)
└── tests/
    ├── helpers.ts          regionToArt + expectPixels ASCII-art assertion helpers
    ├── framebuffer.test.ts
    ├── glyphs.test.ts
    ├── text.test.ts
    ├── status-icons.test.ts
    ├── menu-icons.test.ts
    ├── boot.test.ts
    ├── standby.test.ts
    ├── carousel.test.ts
    ├── list.test.ts
    ├── editor.test.ts
    └── renderer.test.ts    (jsdom)
```

## Contract deviations

`src/renderer.ts` implements the VISION.md `@hellotimber/phone-screen` contract (`ScreenRenderer`, `createScreenRenderer`) verbatim, with these deviations and interpretations (flag if any is wrong):

1. **`welcomeText` added to `createScreenRenderer` opts** (optional, default `"Welcome!"`). The boot `ScreenModel` variant (`{ kind: "boot"; phase: "welcome"; frame }`) carries **no text field**, yet spec §3 step 5 says the welcome note text is shown. Minimal fix: the host passes the text to the renderer. Ideally the contract's boot variant would carry it — flagged for a VISION update.
2. **Boot frame mapping:** `boot.frame` is an unbounded 200 ms counter (plan 01: `frame = floor(elapsed / 200)`) and the model carries no total/duration. The renderer maps it onto 4 hand-animation frames via `min(floor(frame / 3), 3)` (≈600 ms per art frame), holding the final "clasped" frame however long boot lasts.
3. **Bitmap encoding** adopts plan 01's interpretation: ONE BYTE per pixel, row-major, `pixels.length === width*height`, values 0/1. `src/bitmap.ts` declares a structurally identical local `Bitmap` so the framebuffer/icon modules never import phone-core (phone-core's `Bitmap` is assignable to it).
4. **Fixed softkey labels where the model has none:** `reader` → `"Back"`, `editor` → `"Options"`; `boot`/`off`/`custom` draw no softkey. (`list` and `confirm` carry their own `softkey` field and it is honored.)
5. **Envelope and keyguard status icons** are shipped as data + bitmaps (`ENVELOPE_ICON`, `KEYGUARD_ICON`) but no renderer draws them yet — no `ScreenModel` variant carries message/keyguard state. Exported for the future.
6. **`version` starts at 0** and the first `render()` call always paints and bumps to 1 (even `{ kind: "off" }`) — the canvas starts blank/transparent, so the first frame is always a visible change.
7. **UNVERIFIED spec details use the stated best guesses** (spec §2/§5): 5×7 glyphs + 1 px gap (14 chars/line), 4 bar segments for signal/battery, clock lower-right in standby, right-edge scroll indicator geometry, 2–4-frame menu icon treatment simplified to static icons (animation can layer on later without contract changes).
8. **`jsdom` devDependency** (`^28`, no catalog entry exists) added for the canvas wrapper test — flagged per AGENTS.md "do not add dependencies beyond what the plan specifies".

## Conventions for every task

- Package dir: `packages/phone-screen`. All paths below are repo-relative.
- Test command (from repo root): `mise exec -- vp run @hellotimber/phone-screen#test`.
- Tests import from `vite-plus/test`, **never** `vitest`.
- **Prerequisite:** `packages/phone-core` must exist with its `src/types.ts` (plan 01 Tasks 1–2) — this package's `workspace:*` devDependency and `import type { ScreenModel }` resolve against it. If `packages/phone-core/src/types.ts` is missing, STOP and report.
- Before the first task: `mise install` then `mise exec -- vp install` from the repo root (one-time setup, see AGENTS.md).
- The pre-commit hook runs `vp check --fix`; if it rewrites files, `git add` them and commit again.
- String-art convention everywhere: `#` = set pixel (ink), `.` = clear pixel. `bitmapFromArt` throws on ragged rows or other characters, so typos surface as loud test failures.

---

### Task 1: Package scaffold

Write the scaffold files directly (per AGENTS.md "Creating a new package" — `vp create` fetches a template we'd immediately rewrite). Key boundary decision encoded here: `@hellotimber/phone-core` is a **devDependency only** (`workspace:*`) because this package imports **types only** from it (`import type { ScreenModel } ...`); type imports are erased at compile time, so there is no runtime edge — exactly what AGENTS.md boundary rule 2 requires. Do NOT add a `dependencies` field at all.

**Files**

- Create: `packages/phone-screen/package.json`
- Create: `packages/phone-screen/tsconfig.json`
- Create: `packages/phone-screen/vite.config.ts`
- Create: `packages/phone-screen/src/index.ts`

**Steps**

- [ ] **Step 1: Write `packages/phone-screen/package.json`** (source-exports shape from `docs/specs/integration-notes.md` §1; phone-core type-only + jsdom for the Task 13 wrapper test):

  ```json
  {
    "name": "@hellotimber/phone-screen",
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
      "@hellotimber/phone-core": "workspace:*",
      "jsdom": "^28",
      "typescript": "catalog:",
      "vite-plus": "catalog:"
    }
  }
  ```

- [ ] **Step 2: Write `packages/phone-screen/tsconfig.json`** (template from integration-notes §1, verbatim):

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

- [ ] **Step 3: Write `packages/phone-screen/vite.config.ts`** — node test env (the rasterizer is DOM-free; the single jsdom test file opts in via docblock):

  ```ts
  import { defineConfig } from "vite-plus";

  export default defineConfig({
    test: {
      environment: "node",
      include: ["tests/**/*.test.ts"],
    },
  });
  ```

- [ ] **Step 4: Write `packages/phone-screen/src/index.ts`** as a placeholder module (replaced in Task 2):

  ```ts
  export {};
  ```

- [ ] **Step 5: Verify the prerequisite:** check that `packages/phone-core/src/types.ts` exists. If it does not, STOP and report (plan 01 Tasks 1–2 must land first).
- [ ] **Step 6: Link the package into the workspace:** run `mise exec -- vp install` from the repo root. Expect success with `@hellotimber/phone-screen` listed as a workspace project.
- [ ] **Step 7: Verify lint/typecheck:** run `mise exec -- vp check --fix` from the repo root. Expect pass. (No test files exist yet — do not run the test command.)
- [ ] **Step 8: Commit:**

  ```sh
  git add packages/phone-screen pnpm-lock.yaml
  git commit -m "feat(phone-screen): scaffold package"
  ```

---

### Task 2: Bitmap, Framebuffer & ASCII-art test helpers

The core abstraction. `Framebuffer` wraps an `Uint8Array` of one byte per pixel (row-major, 0/1) with bounds-safe drawing primitives. `bitmapFromArt` parses string-art into `Bitmap`s — every glyph and icon in this package flows through it, and it throws loudly on malformed art. The test helper `expectPixels(fb, x, y, asciiArt)` compares a framebuffer region against a multi-line `#`/`.` string, so pixel tests read like pictures.

**Files**

- Create: `packages/phone-screen/src/bitmap.ts`
- Create: `packages/phone-screen/src/framebuffer.ts`
- Create: `packages/phone-screen/tests/helpers.ts`
- Modify: `packages/phone-screen/src/index.ts`
- Test: `packages/phone-screen/tests/framebuffer.test.ts`

**Steps**

- [ ] **Step 1: Write the test helpers** `packages/phone-screen/tests/helpers.ts`:

  ```ts
  import { expect } from "vite-plus/test";
  import type { Framebuffer } from "../src/framebuffer";

  /** Dump a framebuffer region as '#'/'.' rows joined by newlines. */
  export function regionToArt(fb: Framebuffer, x: number, y: number, w: number, h: number): string {
    const rows: string[] = [];
    for (let ry = 0; ry < h; ry++) {
      let row = "";
      for (let rx = 0; rx < w; rx++) {
        row += fb.getPixel(x + rx, y + ry) === 1 ? "#" : ".";
      }
      rows.push(row);
    }
    return rows.join("\n");
  }

  /**
   * Assert that the region at (x, y) matches the ASCII art. The art is a
   * multi-line string of '#'/'.'; surrounding blank lines and per-line
   * indentation are trimmed, the first line defines the width.
   */
  export function expectPixels(fb: Framebuffer, x: number, y: number, art: string): void {
    const lines = art
      .trim()
      .split("\n")
      .map((line) => line.trim());
    const expected = lines.join("\n");
    const actual = regionToArt(fb, x, y, lines[0]!.length, lines.length);
    expect(actual).toBe(expected);
  }
  ```

- [ ] **Step 2: Write the failing test** `packages/phone-screen/tests/framebuffer.test.ts`:

  ```ts
  import { describe, expect, it } from "vite-plus/test";
  import { bitmapFromArt } from "../src/bitmap";
  import { Framebuffer } from "../src/framebuffer";
  import { expectPixels, regionToArt } from "./helpers";

  describe("bitmapFromArt", () => {
    it("parses string-art into a one-byte-per-pixel row-major bitmap", () => {
      const b = bitmapFromArt(["#.#", ".#."]);
      expect(b.width).toBe(3);
      expect(b.height).toBe(2);
      expect(Array.from(b.pixels)).toEqual([1, 0, 1, 0, 1, 0]);
      expect(b.pixels).toBeInstanceOf(Uint8Array);
      expect(b.pixels.length).toBe(b.width * b.height);
    });

    it("throws on ragged rows and on invalid characters", () => {
      expect(() => bitmapFromArt(["##", "#"])).toThrow(/row 1/);
      expect(() => bitmapFromArt(["#x"])).toThrow(/invalid char/);
      expect(() => bitmapFromArt([])).toThrow(/no rows/);
    });
  });

  describe("Framebuffer", () => {
    it("defaults to 84×48 with all pixels clear", () => {
      const fb = new Framebuffer();
      expect(fb.width).toBe(84);
      expect(fb.height).toBe(48);
      expect(fb.pixels.length).toBe(84 * 48);
      expect(fb.pixels.every((p) => p === 0)).toBe(true);
    });

    it("setPixel/getPixel round-trip; out-of-bounds is safe", () => {
      const fb = new Framebuffer();
      fb.setPixel(0, 0, 1);
      fb.setPixel(83, 47, 1);
      expect(fb.getPixel(0, 0)).toBe(1);
      expect(fb.getPixel(83, 47)).toBe(1);
      expect(fb.getPixel(1, 0)).toBe(0);
      fb.setPixel(-1, 0, 1);
      fb.setPixel(84, 0, 1);
      fb.setPixel(0, 48, 1);
      expect(fb.getPixel(-1, 0)).toBe(0);
      expect(fb.getPixel(84, 0)).toBe(0);
      expect(fb.pixels.filter((p) => p === 1)).toHaveLength(2);
    });

    it("clear fills every pixel", () => {
      const fb = new Framebuffer();
      fb.clear(1);
      expect(fb.pixels.every((p) => p === 1)).toBe(true);
      fb.clear();
      expect(fb.pixels.every((p) => p === 0)).toBe(true);
    });

    it("fillRect draws a clipped solid rectangle", () => {
      const fb = new Framebuffer();
      fb.fillRect(1, 1, 3, 2);
      expectPixels(
        fb,
        0,
        0,
        `
        .....
        .###.
        .###.
        .....
      `,
      );
      fb.fillRect(2, 2, 1, 1, 0); // erase one pixel
      expectPixels(
        fb,
        1,
        1,
        `
        ###
        #.#
      `,
      );
      fb.fillRect(82, 46, 10, 10); // clips at the edges without throwing
      expect(fb.getPixel(83, 47)).toBe(1);
    });

    it("blitBitmap is transparent: only set pixels are written", () => {
      const fb = new Framebuffer();
      fb.fillRect(0, 0, 5, 3, 1);
      fb.blitBitmap(bitmapFromArt(["..#..", ".....", "..#.."]), 0, 0, { value: 0 });
      expectPixels(
        fb,
        0,
        0,
        `
        ##.##
        #####
        ##.##
      `,
      );
    });

    it("blitBitmap scales each set pixel into a scale×scale block", () => {
      const fb = new Framebuffer();
      fb.blitBitmap(bitmapFromArt(["#.", ".#"]), 1, 1, { scale: 2 });
      expectPixels(
        fb,
        0,
        0,
        `
        ......
        .##...
        .##...
        ...##.
        ...##.
        ......
      `,
      );
    });

    it("regionToArt round-trips through bitmapFromArt", () => {
      const fb = new Framebuffer();
      fb.blitBitmap(bitmapFromArt(["#.#", ".#."]), 10, 10);
      expect(regionToArt(fb, 10, 10, 3, 2)).toBe("#.#\n.#.");
    });
  });
  ```

- [ ] **Step 3: Run & expect FAIL** (no `src/bitmap.ts` / `src/framebuffer.ts`): `mise exec -- vp run @hellotimber/phone-screen#test`
- [ ] **Step 4: Write `packages/phone-screen/src/bitmap.ts`:**

  ```ts
  /**
   * Same shape and encoding as @hellotimber/phone-core's Bitmap: monochrome,
   * row-major, ONE BYTE per pixel (pixels.length === width * height);
   * 0 = clear, 1 = set. Declared locally so drawing code never needs a
   * phone-core import; phone-core's Bitmap is structurally assignable.
   */
  export interface Bitmap {
    width: number;
    height: number;
    pixels: Uint8Array;
  }

  /** Parse string-art rows ('#' = set, '.' = clear) into a Bitmap. */
  export function bitmapFromArt(rows: readonly string[]): Bitmap {
    if (rows.length === 0) throw new Error("bitmapFromArt: no rows");
    const width = rows[0]!.length;
    const pixels = new Uint8Array(width * rows.length);
    rows.forEach((row, y) => {
      if (row.length !== width) {
        throw new Error(`bitmapFromArt: row ${y} is ${row.length} chars, expected ${width}`);
      }
      for (let x = 0; x < width; x++) {
        const ch = row[x]!;
        if (ch === "#") pixels[y * width + x] = 1;
        else if (ch !== ".") throw new Error(`bitmapFromArt: invalid char '${ch}' at ${x},${y}`);
      }
    });
    return { width, height: rows.length, pixels };
  }
  ```

- [ ] **Step 5: Write `packages/phone-screen/src/framebuffer.ts`** (text methods arrive in Task 5):

  ```ts
  import type { Bitmap } from "./bitmap";

  /**
   * An in-memory monochrome pixel surface: one byte per pixel, row-major,
   * 0 = clear (LCD background), 1 = set (ink). All operations are
   * bounds-safe — drawing off the edges is silently clipped.
   */
  export class Framebuffer {
    readonly width: number;
    readonly height: number;
    readonly pixels: Uint8Array;

    constructor(width = 84, height = 48) {
      this.width = width;
      this.height = height;
      this.pixels = new Uint8Array(width * height);
    }

    getPixel(x: number, y: number): 0 | 1 {
      if (x < 0 || y < 0 || x >= this.width || y >= this.height) return 0;
      return this.pixels[y * this.width + x] === 1 ? 1 : 0;
    }

    setPixel(x: number, y: number, value: 0 | 1): void {
      if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
      this.pixels[y * this.width + x] = value;
    }

    clear(value: 0 | 1 = 0): void {
      this.pixels.fill(value);
    }

    fillRect(x: number, y: number, w: number, h: number, value: 0 | 1 = 1): void {
      for (let yy = y; yy < y + h; yy++) {
        for (let xx = x; xx < x + w; xx++) this.setPixel(xx, yy, value);
      }
    }

    /**
     * Stamp a bitmap's SET pixels at (x, y) — transparent blit. `value`
     * picks the ink (0 erases, for inverted-video text); `scale` expands
     * each source pixel into a scale×scale block.
     */
    blitBitmap(
      bitmap: Bitmap,
      x: number,
      y: number,
      opts: { scale?: number; value?: 0 | 1 } = {},
    ): void {
      const scale = opts.scale ?? 1;
      const value = opts.value ?? 1;
      for (let by = 0; by < bitmap.height; by++) {
        for (let bx = 0; bx < bitmap.width; bx++) {
          if (bitmap.pixels[by * bitmap.width + bx] !== 1) continue;
          if (scale === 1) this.setPixel(x + bx, y + by, value);
          else this.fillRect(x + bx * scale, y + by * scale, scale, scale, value);
        }
      }
    }
  }
  ```

- [ ] **Step 6: Replace `packages/phone-screen/src/index.ts`:**

  ```ts
  export { bitmapFromArt } from "./bitmap";
  export type { Bitmap } from "./bitmap";
  export { Framebuffer } from "./framebuffer";
  ```

- [ ] **Step 7: Run & expect PASS:** `mise exec -- vp run @hellotimber/phone-screen#test`
- [ ] **Step 8: Commit:**

  ```sh
  git add packages/phone-screen
  git commit -m "feat(phone-screen): add framebuffer and string-art bitmap parser"
  ```

---

### Task 3: Pixel font I — uppercase, digits, the compiler

Nokia-style 5×7 glyphs + 1 px advance gap (spec §2 best guess: 14 chars per 84 px line, since 14 × 6 = 84). Glyphs are authored as readable string-art, one glyph per line — 7 row-strings of exactly 5 chars each. `compileFont` parses them into bitmaps once at module load and throws if any glyph has the wrong dimensions, so an art typo fails every test immediately with the glyph's name. This task ships A–Z, 0–9 and space; Task 4 adds the rest.

**Files**

- Create: `packages/phone-screen/src/font/glyphs.ts`
- Create: `packages/phone-screen/src/font/font.ts`
- Modify: `packages/phone-screen/src/index.ts`
- Test: `packages/phone-screen/tests/glyphs.test.ts`

**Steps**

- [ ] **Step 1: Write the failing test** `packages/phone-screen/tests/glyphs.test.ts`:

  ```ts
  import { describe, expect, it } from "vite-plus/test";
  import { Framebuffer } from "../src/framebuffer";
  import { FONT, textWidth } from "../src/font/font";
  import { GLYPHS } from "../src/font/glyphs";
  import { expectPixels } from "./helpers";

  describe("glyph data", () => {
    it("every glyph is 7 rows of exactly 5 chars of '#'/'.'", () => {
      for (const [ch, rows] of Object.entries(GLYPHS)) {
        expect(rows, `glyph '${ch}' row count`).toHaveLength(7);
        for (const row of rows) {
          expect(row, `glyph '${ch}' row '${row}'`).toMatch(/^[#.]{5}$/);
        }
      }
    });

    it("covers uppercase, digits and space", () => {
      for (const ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ") {
        expect(GLYPHS[ch], `missing glyph '${ch}'`).toBeDefined();
      }
    });
  });

  describe("FONT", () => {
    it("is a compiled 5×7 font with a 1px gap", () => {
      expect(FONT.glyphWidth).toBe(5);
      expect(FONT.glyphHeight).toBe(7);
      expect(FONT.gap).toBe(1);
      expect(FONT.glyphs.size).toBe(Object.keys(GLYPHS).length);
    });

    it("compiled 'A' matches its art when blitted", () => {
      const fb = new Framebuffer();
      fb.blitBitmap(FONT.glyphs.get("A")!, 0, 0);
      expectPixels(
        fb,
        0,
        0,
        `
        .###.
        #...#
        #...#
        #####
        #...#
        #...#
        #...#
      `,
      );
    });

    it("textWidth: advance is 6px per char, no trailing gap", () => {
      expect(textWidth(FONT, "")).toBe(0);
      expect(textWidth(FONT, "A")).toBe(5);
      expect(textWidth(FONT, "AB")).toBe(11);
      expect(textWidth(FONT, "MENU", 2)).toBe(46); // (4*6-1)*2
      expect(textWidth(FONT, "NOKIA")).toBe(29);
    });
  });
  ```

- [ ] **Step 2: Run & expect FAIL** (no font modules): `mise exec -- vp run @hellotimber/phone-screen#test`
- [ ] **Step 3: Write `packages/phone-screen/src/font/glyphs.ts`** — actual glyph data, exactly as below (each entry is 7 rows × 5 chars; Task 4 appends more entries before the closing brace):

  ```ts
  /**
   * 5×7 string-art glyphs for the Nokia-style body font ('#' = ink).
   * Spec §2 best guess: 5×7 px + 1 px advance gap → 14 chars per line.
   */
  export const GLYPHS: Record<string, readonly string[]> = {
    " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
    A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
    C: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
    D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
    E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
    F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
    G: [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".###."],
    H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    I: [".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
    J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
    K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
    L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
    M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
    N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
    O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
    Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
    R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
    S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
    T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
    U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    V: ["#...#", "#...#", "#...#", "#...#", ".#.#.", ".#.#.", "..#.."],
    W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
    X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
    Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
    Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
    "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
    "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
    "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
    "3": ["#####", "...#.", "..#..", "...#.", "....#", "#...#", ".###."],
    "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
    "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
    "6": ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
    "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
    "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
    "9": [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
  };
  ```

- [ ] **Step 4: Write `packages/phone-screen/src/font/font.ts`:**

  ```ts
  import { bitmapFromArt } from "../bitmap";
  import type { Bitmap } from "../bitmap";
  import { GLYPHS } from "./glyphs";

  export interface PixelFont {
    readonly glyphWidth: number;
    readonly glyphHeight: number;
    /** Blank columns between glyphs; advance = glyphWidth + gap. */
    readonly gap: number;
    readonly glyphs: ReadonlyMap<string, Bitmap>;
  }

  function compileFont(
    art: Record<string, readonly string[]>,
    glyphWidth: number,
    glyphHeight: number,
    gap: number,
  ): PixelFont {
    const glyphs = new Map<string, Bitmap>();
    for (const [ch, rows] of Object.entries(art)) {
      const bitmap = bitmapFromArt(rows);
      if (bitmap.width !== glyphWidth || bitmap.height !== glyphHeight) {
        throw new Error(
          `glyph '${ch}' is ${bitmap.width}x${bitmap.height}, expected ${glyphWidth}x${glyphHeight}`,
        );
      }
      glyphs.set(ch, bitmap);
    }
    return { glyphWidth, glyphHeight, gap, glyphs };
  }

  /** The body font: 5×7 glyphs, 1px gap → 6px advance, 14 chars per 84px line. */
  export const FONT: PixelFont = compileFont(GLYPHS, 5, 7, 1);

  /** Pixel width of a rendered string (no trailing gap). */
  export function textWidth(font: PixelFont, text: string, scale = 1): number {
    const len = [...text].length;
    if (len === 0) return 0;
    return (len * (font.glyphWidth + font.gap) - font.gap) * scale;
  }
  ```

- [ ] **Step 5: Append the font exports to `packages/phone-screen/src/index.ts`:**

  ```ts
  export { FONT, textWidth } from "./font/font";
  export type { PixelFont } from "./font/font";
  export { GLYPHS } from "./font/glyphs";
  ```

- [ ] **Step 6: Run & expect PASS:** `mise exec -- vp run @hellotimber/phone-screen#test`
- [ ] **Step 7: Commit:**

  ```sh
  git add packages/phone-screen
  git commit -m "feat(phone-screen): add 5x7 pixel font with uppercase and digits"
  ```

---

### Task 4: Pixel font II — lowercase, punctuation, UI glyphs

The rest of the glyph set: a–z, the punctuation set `. , : ; ! ? ' " ( ) + - * / # @ _ < > = %`, the ellipsis `…`, and the UI arrows `►`/`▲`/`▼` (used by lists, readers and scroll affordances). Same 5×7 format; `compileFont` keeps validating.

**Files**

- Modify: `packages/phone-screen/src/font/glyphs.ts`
- Modify: `packages/phone-screen/tests/glyphs.test.ts`

**Steps**

- [ ] **Step 1: Extend the test** — add these two cases inside the existing `describe("glyph data", ...)` block in `packages/phone-screen/tests/glyphs.test.ts`:

  ```ts
  it("covers lowercase and punctuation", () => {
    for (const ch of "abcdefghijklmnopqrstuvwxyz.,:;!?'\"()+-*/#@_<>=%") {
      expect(GLYPHS[ch], `missing glyph '${ch}'`).toBeDefined();
    }
  });

  it("covers the ellipsis and arrow UI glyphs", () => {
    for (const ch of ["…", "►", "▲", "▼"]) {
      expect(GLYPHS[ch], `missing glyph '${ch}'`).toBeDefined();
    }
  });
  ```

- [ ] **Step 2: Run & expect FAIL** (glyphs missing): `mise exec -- vp run @hellotimber/phone-screen#test`
- [ ] **Step 3: Append the new glyph entries** to the `GLYPHS` object in `packages/phone-screen/src/font/glyphs.ts` — insert this block directly before the closing `};`, exactly as written:

  ```ts
    a: [".....", ".....", ".###.", "....#", ".####", "#...#", ".####"],
    b: ["#....", "#....", "####.", "#...#", "#...#", "#...#", "####."],
    c: [".....", ".....", ".###.", "#....", "#....", "#...#", ".###."],
    d: ["....#", "....#", ".####", "#...#", "#...#", "#...#", ".####"],
    e: [".....", ".....", ".###.", "#...#", "#####", "#....", ".###."],
    f: ["..##.", ".#..#", ".#...", "###..", ".#...", ".#...", ".#..."],
    g: [".....", ".####", "#...#", "#...#", ".####", "....#", ".###."],
    h: ["#....", "#....", "####.", "#...#", "#...#", "#...#", "#...#"],
    i: ["..#..", ".....", ".##..", "..#..", "..#..", "..#..", ".###."],
    j: ["...#.", ".....", "..##.", "...#.", "...#.", "#..#.", ".##.."],
    k: ["#....", "#....", "#..#.", "#.#..", "##...", "#.#..", "#..#."],
    l: [".##..", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
    m: [".....", ".....", "##.#.", "#.#.#", "#.#.#", "#.#.#", "#.#.#"],
    n: [".....", ".....", "####.", "#...#", "#...#", "#...#", "#...#"],
    o: [".....", ".....", ".###.", "#...#", "#...#", "#...#", ".###."],
    p: [".....", "####.", "#...#", "#...#", "####.", "#....", "#...."],
    q: [".....", ".####", "#...#", "#...#", ".####", "....#", "....#"],
    r: [".....", ".....", "#.##.", "##..#", "#....", "#....", "#...."],
    s: [".....", ".....", ".####", "#....", ".###.", "....#", "####."],
    t: [".#...", ".#...", "###..", ".#...", ".#...", ".#..#", "..##."],
    u: [".....", ".....", "#...#", "#...#", "#...#", "#..##", ".##.#"],
    v: [".....", ".....", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
    w: [".....", ".....", "#...#", "#...#", "#.#.#", "#.#.#", ".#.#."],
    x: [".....", ".....", "#...#", ".#.#.", "..#..", ".#.#.", "#...#"],
    y: [".....", ".....", "#...#", "#...#", ".####", "....#", ".###."],
    z: [".....", ".....", "#####", "...#.", "..#..", ".#...", "#####"],
    ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
    ",": [".....", ".....", ".....", ".....", "..#..", "..#..", ".#..."],
    ":": [".....", "..#..", "..#..", ".....", "..#..", "..#..", "....."],
    ";": [".....", "..#..", "..#..", ".....", "..#..", "..#..", ".#..."],
    "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
    "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
    "'": ["..#..", "..#..", ".....", ".....", ".....", ".....", "....."],
    '"': [".#.#.", ".#.#.", ".....", ".....", ".....", ".....", "....."],
    "(": ["...#.", "..#..", ".#...", ".#...", ".#...", "..#..", "...#."],
    ")": [".#...", "..#..", "...#.", "...#.", "...#.", "..#..", ".#..."],
    "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
    "-": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
    "*": [".....", "..#..", "#.#.#", ".###.", "#.#.#", "..#..", "....."],
    "/": ["....#", "...#.", "...#.", "..#..", ".#...", ".#...", "#...."],
    "#": [".#.#.", ".#.#.", "#####", ".#.#.", "#####", ".#.#.", ".#.#."],
    "@": [".###.", "#...#", "#.###", "#.#.#", "#.##.", "#....", ".###."],
    _: [".....", ".....", ".....", ".....", ".....", ".....", "#####"],
    "<": ["...#.", "..#..", ".#...", "#....", ".#...", "..#..", "...#."],
    ">": [".#...", "..#..", "...#.", "....#", "...#.", "..#..", ".#..."],
    "=": [".....", ".....", "#####", ".....", "#####", ".....", "....."],
    "%": ["##..#", "##..#", "...#.", "..#..", ".#...", "#..##", "#..##"],
    "…": [".....", ".....", ".....", ".....", ".....", ".....", "#.#.#"],
    "►": ["#....", "##...", "###..", "####.", "###..", "##...", "#...."],
    "▲": [".....", ".....", "..#..", ".###.", "#####", ".....", "....."],
    "▼": [".....", ".....", "#####", ".###.", "..#..", ".....", "....."],
  ```

- [ ] **Step 4: Run & expect PASS:** `mise exec -- vp run @hellotimber/phone-screen#test`
- [ ] **Step 5: Commit:**

  ```sh
  git add packages/phone-screen
  git commit -m "feat(phone-screen): complete glyph set with lowercase, punctuation and UI arrows"
  ```

---

### Task 5: Text drawing

`drawText(font, text, x, y, opts)` and `drawTextCentered(font, text, y, opts)` on `Framebuffer`. Options: `scale` (the standby operator name is these same glyphs at 2×, per spec §2 "larger/bolder variant" — no second font) and `color` (drawing with ink 0 onto a filled rect produces the inverted-video selection bar). Unknown characters render as `?` so missing glyphs are visible, never invisible.

**Files**

- Modify: `packages/phone-screen/src/framebuffer.ts`
- Modify: `packages/phone-screen/src/index.ts` (no change needed — `Framebuffer` is already exported; verify only)
- Test: `packages/phone-screen/tests/text.test.ts`

**Steps**

- [ ] **Step 1: Write the failing test** `packages/phone-screen/tests/text.test.ts`:

  ```ts
  import { describe, expect, it } from "vite-plus/test";
  import { FONT } from "../src/font/font";
  import { Framebuffer } from "../src/framebuffer";
  import { expectPixels, regionToArt } from "./helpers";

  describe("drawText", () => {
    it("draws glyphs with a 1px gap and returns the next x", () => {
      const fb = new Framebuffer();
      const next = fb.drawText(FONT, "HI", 0, 0);
      expect(next).toBe(12);
      expectPixels(
        fb,
        0,
        0,
        `
        #...#..###.
        #...#...#..
        #...#...#..
        #####...#..
        #...#...#..
        #...#...#..
        #...#..###.
      `,
      );
    });

    it("scales glyphs 2x for the bold/large variant", () => {
      const fb = new Framebuffer();
      fb.drawText(FONT, "-", 0, 0, { scale: 2 });
      expectPixels(
        fb,
        0,
        4,
        `
        ..........
        ..........
        ##########
        ##########
        ..........
      `,
      );
    });

    it("draws with color 0 for inverted video", () => {
      const fb = new Framebuffer();
      fb.fillRect(0, 0, 7, 9, 1);
      fb.drawText(FONT, "I", 1, 1, { color: 0 });
      expectPixels(
        fb,
        0,
        0,
        `
        #######
        ##...##
        ###.###
        ###.###
        ###.###
        ###.###
        ###.###
        ##...##
        #######
      `,
      );
    });

    it("renders unknown characters as '?'", () => {
      const a = new Framebuffer();
      const b = new Framebuffer();
      a.drawText(FONT, "~", 0, 0);
      b.drawText(FONT, "?", 0, 0);
      expect(regionToArt(a, 0, 0, 5, 7)).toBe(regionToArt(b, 0, 0, 5, 7));
    });

    it("drawTextCentered centers by pixel width", () => {
      const centered = new Framebuffer();
      const manual = new Framebuffer();
      centered.drawTextCentered(FONT, "MENU", 0); // width 23 → x = (84-23)/2 = 30
      manual.drawText(FONT, "MENU", 30, 0);
      expect(regionToArt(centered, 0, 0, 84, 7)).toBe(regionToArt(manual, 0, 0, 84, 7));
    });

    it("drawTextCentered centers scaled text too", () => {
      const centered = new Framebuffer();
      const manual = new Framebuffer();
      centered.drawTextCentered(FONT, "LACHLAN", 10, { scale: 2 }); // width 82 → x = 1
      manual.drawText(FONT, "LACHLAN", 1, 10, { scale: 2 });
      expect(regionToArt(centered, 0, 10, 84, 14)).toBe(regionToArt(manual, 0, 10, 84, 14));
    });
  });
  ```

  > Note: the third test's expected art derives mechanically: a 7×9 filled rect with the `I` glyph (`.###.`/`..#..`…) punched out in color 0 at offset (1,1). If the assertion fails, print `regionToArt(fb, 0, 0, 7, 9)` and check it against the `I` art — do not silently accept the actual output.

- [ ] **Step 2: Run & expect FAIL** (`drawText` is not a function): `mise exec -- vp run @hellotimber/phone-screen#test`
- [ ] **Step 3: Add the text methods to `packages/phone-screen/src/framebuffer.ts`.** First extend the imports at the top of the file:

  ```ts
  import type { Bitmap } from "./bitmap";
  import { textWidth } from "./font/font";
  import type { PixelFont } from "./font/font";
  ```

  Then add these two methods inside the `Framebuffer` class, after `blitBitmap`:

  ```ts
    /**
     * Draw text with the glyph font; returns the x where the next character
     * would start. Unknown characters render as '?'. `color: 0` draws
     * inverted-video text (e.g. onto a filled selection bar).
     */
    drawText(
      font: PixelFont,
      text: string,
      x: number,
      y: number,
      opts: { scale?: number; color?: 0 | 1 } = {},
    ): number {
      const scale = opts.scale ?? 1;
      const color = opts.color ?? 1;
      let cx = x;
      for (const ch of text) {
        const glyph = font.glyphs.get(ch) ?? font.glyphs.get("?");
        if (glyph !== undefined) this.blitBitmap(glyph, cx, y, { scale, value: color });
        cx += (font.glyphWidth + font.gap) * scale;
      }
      return cx;
    }

    /** Draw text horizontally centered on this framebuffer. */
    drawTextCentered(
      font: PixelFont,
      text: string,
      y: number,
      opts: { scale?: number; color?: 0 | 1 } = {},
    ): void {
      const x = Math.floor((this.width - textWidth(font, text, opts.scale ?? 1)) / 2);
      this.drawText(font, text, x, y, opts);
    }
  ```

- [ ] **Step 4: Run & expect PASS:** `mise exec -- vp run @hellotimber/phone-screen#test`
- [ ] **Step 5: Commit:**

  ```sh
  git add packages/phone-screen
  git commit -m "feat(phone-screen): add text drawing with scale and inverted video"
  ```

---

### Task 6: Status icons & signal/battery bar stacks

Spec §2: signal indicator on the LEFT edge (antenna glyph + vertical stack of rungs, growing upward, "the higher the bar, the stronger"), battery on the RIGHT edge (battery glyph + rung stack). Segment count is UNVERIFIED → best guess **4 segments**, drawn as 3×4 px rungs with 1 px gaps. Envelope and keyguard icons ship as 8×8 bitmaps for future use (deviation note 5).

Fixed geometry (constants in the module): rung `i` (0 = bottom) occupies `y = 27 - i*5 … +4`, i.e. rungs at y 27, 22, 17, 12; signal rungs at x 0–2 under the antenna glyph at (0,0); battery rungs at x 81–83 under the battery glyph at (79,0).

**Files**

- Create: `packages/phone-screen/src/icons/status.ts`
- Modify: `packages/phone-screen/src/index.ts`
- Test: `packages/phone-screen/tests/status-icons.test.ts`

**Steps**

- [ ] **Step 1: Write the failing test** `packages/phone-screen/tests/status-icons.test.ts`:

  ```ts
  import { describe, expect, it } from "vite-plus/test";
  import { Framebuffer } from "../src/framebuffer";
  import {
    drawBatteryLevel,
    drawSignalLevel,
    ENVELOPE_ICON,
    KEYGUARD_ICON,
  } from "../src/icons/status";
  import { expectPixels } from "./helpers";

  describe("status icons", () => {
    it("envelope and keyguard are 8×8 bitmaps", () => {
      for (const icon of [ENVELOPE_ICON, KEYGUARD_ICON]) {
        expect(icon.width).toBe(8);
        expect(icon.height).toBe(8);
        expect(icon.pixels.some((p) => p === 1)).toBe(true);
      }
    });
  });

  describe("drawSignalLevel", () => {
    it("draws the antenna glyph at the top-left", () => {
      const fb = new Framebuffer();
      drawSignalLevel(fb, 0);
      expectPixels(
        fb,
        0,
        0,
        `
        #.#.#
        .###.
        ..#..
        ..#..
        ..#..
      `,
      );
    });

    it("level N fills the bottom N rungs, growing upward", () => {
      const fb = new Framebuffer();
      drawSignalLevel(fb, 2);
      // rungs 0 and 1 (y 27 and 22) set, rungs 2 and 3 (y 17 and 12) clear
      expectPixels(
        fb,
        0,
        12,
        `
        ...
        ...
        ...
        ...
        ...
        ...
        ...
        ...
        ...
        ...
        ###
        ###
        ###
        ###
        ...
        ###
        ###
        ###
        ###
      `,
      );
    });

    it("level 4 fills all rungs; level 0 fills none", () => {
      const full = new Framebuffer();
      const empty = new Framebuffer();
      drawSignalLevel(full, 4);
      drawSignalLevel(empty, 0);
      expect(full.getPixel(0, 12)).toBe(1);
      expect(full.getPixel(2, 30)).toBe(1);
      expect(empty.getPixel(0, 12)).toBe(0);
      expect(empty.getPixel(2, 30)).toBe(0);
    });
  });

  describe("drawBatteryLevel", () => {
    it("draws the battery glyph at the top-right", () => {
      const fb = new Framebuffer();
      drawBatteryLevel(fb, 0);
      expectPixels(
        fb,
        79,
        0,
        `
        ..#..
        #####
        #...#
        #...#
        #####
      `,
      );
    });

    it("rungs stack on the right edge, growing upward", () => {
      const fb = new Framebuffer();
      drawBatteryLevel(fb, 1);
      expectPixels(
        fb,
        81,
        22,
        `
        ...
        ...
        ...
        ...
        ...
        ###
        ###
        ###
        ###
      `,
      );
    });
  });
  ```

- [ ] **Step 2: Run & expect FAIL** (no `src/icons/status.ts`): `mise exec -- vp run @hellotimber/phone-screen#test`
- [ ] **Step 3: Write `packages/phone-screen/src/icons/status.ts`:**

  ```ts
  import { bitmapFromArt } from "../bitmap";
  import type { Bitmap } from "../bitmap";
  import type { Framebuffer } from "../framebuffer";

  /** Antenna glyph topping the signal stack (left edge). */
  export const ANTENNA_ICON: Bitmap = bitmapFromArt(["#.#.#", ".###.", "..#..", "..#..", "..#.."]);

  /** Battery glyph topping the battery stack (right edge). */
  export const BATTERY_ICON: Bitmap = bitmapFromArt(["..#..", "#####", "#...#", "#...#", "#####"]);

  /** Message-received envelope (spec §2 status icon; no ScreenModel field yet). */
  export const ENVELOPE_ICON: Bitmap = bitmapFromArt([
    "########",
    "#......#",
    "##....##",
    "#.#..#.#",
    "#..##..#",
    "#......#",
    "#......#",
    "########",
  ]);

  /** Keyguard padlock (spec §2 status icon; no ScreenModel field yet). */
  export const KEYGUARD_ICON: Bitmap = bitmapFromArt([
    "..####..",
    ".#....#.",
    ".#....#.",
    "########",
    "########",
    "###..###",
    "###..###",
    "########",
  ]);

  const RUNG_W = 3;
  const RUNG_H = 4;
  const RUNG_PITCH = 5; // 4px rung + 1px gap
  const RUNG_BOTTOM_Y = 27; // bottom rung top edge; stack grows upward to y=12
  const SIGNAL_X = 0;
  const BATTERY_X = 81;

  function drawRungs(fb: Framebuffer, x: number, level: number): void {
    for (let i = 0; i < level; i++) {
      fb.fillRect(x, RUNG_BOTTOM_Y - i * RUNG_PITCH, RUNG_W, RUNG_H, 1);
    }
  }

  /** Left-edge signal indicator: antenna glyph + 0–4 rungs growing upward. */
  export function drawSignalLevel(fb: Framebuffer, level: 0 | 1 | 2 | 3 | 4): void {
    fb.blitBitmap(ANTENNA_ICON, 0, 0);
    drawRungs(fb, SIGNAL_X, level);
  }

  /** Right-edge battery indicator: battery glyph + 0–4 rungs growing upward. */
  export function drawBatteryLevel(fb: Framebuffer, level: 0 | 1 | 2 | 3 | 4): void {
    fb.blitBitmap(BATTERY_ICON, 79, 0);
    drawRungs(fb, BATTERY_X, level);
  }
  ```

- [ ] **Step 4: Append the status exports to `packages/phone-screen/src/index.ts`:**

  ```ts
  export {
    ANTENNA_ICON,
    BATTERY_ICON,
    drawBatteryLevel,
    drawSignalLevel,
    ENVELOPE_ICON,
    KEYGUARD_ICON,
  } from "./icons/status";
  ```

- [ ] **Step 5: Run & expect PASS:** `mise exec -- vp run @hellotimber/phone-screen#test`
- [ ] **Step 6: Commit:**

  ```sh
  git add packages/phone-screen
  git commit -m "feat(phone-screen): add status icons and signal/battery bar stacks"
  ```

---

### Task 7: Menu icons

13 stylized 16×16 icons, keyed by the top-level menu ids from plan 01's `nokia3310Menu` (`phone-book`, `messages`, `chat`, `call-register`, `tones`, `settings`, `call-divert`, `games`, `calculator`, `reminders`, `clock`, `profiles`, `sim-services` — the carousel `ScreenModel` falls back to the node id as `iconId`). Unknown ids get a `?`-box fallback so a content typo is visible, not a crash. Static icons for now (spec §5 icon animation is an UNVERIFIED nice-to-have; see deviation note 7).

**Files**

- Create: `packages/phone-screen/src/icons/menu-icons.ts`
- Modify: `packages/phone-screen/src/index.ts`
- Test: `packages/phone-screen/tests/menu-icons.test.ts`

**Steps**

- [ ] **Step 1: Write the failing test** `packages/phone-screen/tests/menu-icons.test.ts`:

  ```ts
  import { describe, expect, it } from "vite-plus/test";
  import { FALLBACK_ICON, MENU_ICONS, menuIcon } from "../src/icons/menu-icons";

  const IDS = [
    "phone-book",
    "messages",
    "chat",
    "call-register",
    "tones",
    "settings",
    "call-divert",
    "games",
    "calculator",
    "reminders",
    "clock",
    "profiles",
    "sim-services",
  ];

  describe("menu icons", () => {
    it("has a 16×16 icon for each of the 13 menus", () => {
      expect(MENU_ICONS.size).toBe(13);
      for (const id of IDS) {
        const icon = MENU_ICONS.get(id);
        expect(icon, `missing icon '${id}'`).toBeDefined();
        expect(icon!.width, id).toBe(16);
        expect(icon!.height, id).toBe(16);
        expect(
          icon!.pixels.some((p) => p === 1),
          `icon '${id}' is blank`,
        ).toBe(true);
      }
    });

    it("icons are pairwise distinct", () => {
      const seen = new Set<string>();
      for (const id of IDS) {
        seen.add(MENU_ICONS.get(id)!.pixels.join(""));
      }
      expect(seen.size).toBe(13);
    });

    it("menuIcon falls back to the ?-box for unknown ids", () => {
      expect(menuIcon("phone-book")).toBe(MENU_ICONS.get("phone-book"));
      expect(menuIcon("does-not-exist")).toBe(FALLBACK_ICON);
      expect(FALLBACK_ICON.width).toBe(16);
      expect(FALLBACK_ICON.height).toBe(16);
    });
  });
  ```

- [ ] **Step 2: Run & expect FAIL** (no `src/icons/menu-icons.ts`): `mise exec -- vp run @hellotimber/phone-screen#test`
- [ ] **Step 3: Write `packages/phone-screen/src/icons/menu-icons.ts`** — first half (the file is completed in Step 4; write Steps 3+4 as ONE file in one go):

  ```ts
  import { bitmapFromArt } from "../bitmap";
  import type { Bitmap } from "../bitmap";

  /** 16×16 string-art icons for the 13 top-level menus, keyed by menu node id. */
  const ART: Record<string, readonly string[]> = {
    "phone-book": [
      "................",
      "................",
      ".......##.......",
      "..#####..#####..",
      ".#.....##.....#.",
      ".#.###.##.###.#.",
      ".#.....##.....#.",
      ".#.###.##.###.#.",
      ".#.....##.....#.",
      ".#.###.##.###.#.",
      ".#.....##.....#.",
      "..#####..#####..",
      "................",
      "................",
      "................",
      "................",
    ],
    messages: [
      "................",
      "................",
      ".##############.",
      ".#............#.",
      ".##..........##.",
      ".#.##......##.#.",
      ".#...##..##...#.",
      ".#.....##.....#.",
      ".#............#.",
      ".#............#.",
      ".##############.",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
    chat: [
      "................",
      ".#########......",
      ".#.......#......",
      ".#.......#......",
      ".#########......",
      "...##...........",
      "................",
      "......#########.",
      "......#.......#.",
      "......#.......#.",
      "......#########.",
      "...........##...",
      "................",
      "................",
      "................",
      "................",
    ],
    "call-register": [
      "................",
      "................",
      "................",
      "..##........##..",
      ".####......####.",
      ".####......####.",
      ".##############.",
      ".##############.",
      "..############..",
      "....########....",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
    tones: [
      "................",
      "................",
      "......########..",
      "......#......#..",
      "......#......#..",
      "......#......#..",
      "......#......#..",
      "......#......#..",
      "....###....###..",
      "...####...####..",
      "...####...####..",
      "....##.....##...",
      "................",
      "................",
      "................",
      "................",
    ],
    settings: [
      "................",
      "................",
      ".......##.......",
      "...##..##..##...",
      "....########....",
      "....##....##....",
      ".####......####.",
      ".####......####.",
      "....##....##....",
      "....########....",
      "...##..##..##...",
      ".......##.......",
      "................",
      "................",
      "................",
      "................",
    ],
    "call-divert": [
      "................",
      "................",
      "................",
      "................",
      "..........##....",
      "..........####..",
      "################",
      "################",
      "..........####..",
      "..........##....",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
  ```

- [ ] **Step 4: Complete `packages/phone-screen/src/icons/menu-icons.ts`** — the remaining entries, the closing brace, and the exports (continue the `ART` object from Step 3 directly):

  ```ts
    games: [
      "................",
      "................",
      "..##########....",
      "..##########....",
      "..##............",
      "..##............",
      "..##########....",
      "..##########....",
      "..........##....",
      "..........##....",
      "..##########....",
      "..##########....",
      "................",
      "................",
      "................",
      "................",
    ],
    calculator: [
      "................",
      "................",
      "..############..",
      "..#..........#..",
      "..#.########.#..",
      "..#..........#..",
      "..#.##.##.##.#..",
      "..#..........#..",
      "..#.##.##.##.#..",
      "..#..........#..",
      "..#.##.##.##.#..",
      "..#..........#..",
      "..############..",
      "................",
      "................",
      "................",
    ],
    reminders: [
      "................",
      "................",
      ".......##.......",
      ".....######.....",
      "....########....",
      "....########....",
      "....########....",
      "...##########...",
      "..############..",
      "................",
      ".......##.......",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
    clock: [
      "................",
      "................",
      ".....######.....",
      "...##......##...",
      "..#....#.....#..",
      ".#.....#......#.",
      ".#.....#......#.",
      ".#.....####...#.",
      ".#............#.",
      "..#..........#..",
      "...##......##...",
      ".....######.....",
      "................",
      "................",
      "................",
      "................",
    ],
    profiles: [
      "................",
      "................",
      "......####......",
      ".....######.....",
      ".....######.....",
      "......####......",
      "................",
      "....########....",
      "...##########...",
      "..############..",
      "..############..",
      "..############..",
      "................",
      "................",
      "................",
      "................",
    ],
    "sim-services": [
      "................",
      "................",
      "..###########...",
      "..#.........##..",
      "..#..........#..",
      "..#..######..#..",
      "..#..#....#..#..",
      "..#..#....#..#..",
      "..#..######..#..",
      "..#..........#..",
      "..#..........#..",
      "..############..",
      "................",
      "................",
      "................",
      "................",
    ],
  };

  const FALLBACK_ART: readonly string[] = [
    "................",
    "................",
    "..############..",
    "..#..........#..",
    "..#...####...#..",
    "..#..#....#..#..",
    "..#......#...#..",
    "..#.....#....#..",
    "..#.....#....#..",
    "..#..........#..",
    "..#.....#....#..",
    "..#..........#..",
    "..############..",
    "................",
    "................",
    "................",
  ];

  export const MENU_ICONS: ReadonlyMap<string, Bitmap> = new Map(
    Object.entries(ART).map(([id, rows]) => [id, bitmapFromArt(rows)]),
  );

  /** Shown when a carousel iconId has no icon — visible, never a crash. */
  export const FALLBACK_ICON: Bitmap = bitmapFromArt(FALLBACK_ART);

  /** Resolve a carousel iconId to its icon bitmap (fallback for unknown ids). */
  export function menuIcon(iconId: string): Bitmap {
    return MENU_ICONS.get(iconId) ?? FALLBACK_ICON;
  }
  ```

- [ ] **Step 5: Append the icon exports to `packages/phone-screen/src/index.ts`:**

  ```ts
  export { FALLBACK_ICON, MENU_ICONS, menuIcon } from "./icons/menu-icons";
  ```

- [ ] **Step 6: Run & expect PASS:** `mise exec -- vp run @hellotimber/phone-screen#test`
- [ ] **Step 7: Commit:**

  ```sh
  git add packages/phone-screen
  git commit -m "feat(phone-screen): add 13 menu icons with fallback"
  ```

---

### Task 8: Screen layout helpers & boot renderer

Two things land here. First, `src/render/layout.ts`: the shared zone constants and helpers every screen renderer uses — spec §2 zones are status/title row (y 0–7), content area (y 8–39), and the **single** softkey label bottom-center (y 41–47; the 3310 has ONE softkey, never two — spec §4 point 4). Second, the boot sequence (spec §3): the "connecting hands" animation — two hand sprites that slide together and interlock over 4 frames, composed into 84×30 bitmaps at module load — with the **small NOKIA wordmark bottom-right** (verified 3310 detail), then a `welcome` phase rendering the host-supplied welcome text (deviation note 1).

**Files**

- Create: `packages/phone-screen/src/render/layout.ts`
- Create: `packages/phone-screen/src/icons/boot.ts`
- Create: `packages/phone-screen/src/render/boot.ts`
- Modify: `packages/phone-screen/src/index.ts`
- Test: `packages/phone-screen/tests/boot.test.ts`

**Steps**

- [ ] **Step 1: Write the failing test** `packages/phone-screen/tests/boot.test.ts`:

  ```ts
  import { describe, expect, it } from "vite-plus/test";
  import { FONT } from "../src/font/font";
  import { Framebuffer } from "../src/framebuffer";
  import { HANDS_FRAMES } from "../src/icons/boot";
  import { renderBoot } from "../src/render/boot";
  import { wrapText, truncate } from "../src/render/layout";
  import { regionToArt } from "./helpers";

  describe("layout helpers", () => {
    it("truncate keeps short text and ellipsizes long text", () => {
      expect(truncate("Menu", 14)).toBe("Menu");
      expect(truncate("Fourteen chars", 14)).toBe("Fourteen chars");
      expect(truncate("Fifteen chars!!", 14)).toBe("Fifteen chars…");
    });

    it("wrapText greedy-wraps at 14 chars and hard-breaks long words", () => {
      expect(wrapText("hello world")).toEqual(["hello world"]);
      expect(wrapText("the quick brown fox jumps")).toEqual(["the quick", "brown fox", "jumps"]);
      expect(wrapText("antidisestablishmentarianism")).toEqual([
        "antidisestabli",
        "shmentarianism",
      ]);
      expect(wrapText("a\nb")).toEqual(["a", "b"]);
    });
  });

  describe("HANDS_FRAMES", () => {
    it("is 4 frames of 84×30, pairwise distinct", () => {
      expect(HANDS_FRAMES).toHaveLength(4);
      const seen = new Set<string>();
      for (const frame of HANDS_FRAMES) {
        expect(frame.width).toBe(84);
        expect(frame.height).toBe(30);
        expect(frame.pixels.length).toBe(84 * 30);
        seen.add(frame.pixels.join(""));
      }
      expect(seen.size).toBe(4);
    });

    it("hands meet in the middle only in the final frame", () => {
      const mid = 14 * 84 + 40; // row 14, col 40 of the 84-wide frame
      expect(HANDS_FRAMES[0]!.pixels[mid]).toBe(0);
      expect(HANDS_FRAMES[3]!.pixels[mid]).toBe(1);
    });
  });

  describe("renderBoot", () => {
    it("hands phase: blits the mapped frame and the NOKIA wordmark bottom-right", () => {
      const fb = new Framebuffer();
      renderBoot(fb, { kind: "boot", phase: "hands", frame: 0 }, "Welcome!");
      const expected = new Framebuffer();
      expected.blitBitmap(HANDS_FRAMES[0]!, 0, 4);
      expected.drawText(FONT, "NOKIA", 53, 40); // 82 - textWidth("NOKIA")=29 → x 53
      expect(regionToArt(fb, 0, 0, 84, 48)).toBe(regionToArt(expected, 0, 0, 84, 48));
    });

    it("advances one art frame every 3 model frames and holds the clasp", () => {
      const art = (frame: number): string => {
        const fb = new Framebuffer();
        renderBoot(fb, { kind: "boot", phase: "hands", frame }, "Welcome!");
        return regionToArt(fb, 0, 0, 84, 48);
      };
      expect(art(0)).toBe(art(2));
      expect(art(0)).not.toBe(art(3));
      expect(art(9)).toBe(art(100)); // clamped at the final clasped frame
    });

    it("welcome phase: renders the host welcome text centered", () => {
      const fb = new Framebuffer();
      renderBoot(fb, { kind: "boot", phase: "welcome", frame: 0 }, "Hello!");
      const expected = new Framebuffer();
      expected.drawTextCentered(FONT, "Hello!", 20); // 1 line → top = (48-8)/2
      expect(regionToArt(fb, 0, 0, 84, 48)).toBe(regionToArt(expected, 0, 0, 84, 48));
    });

    it("welcome phase wraps long text onto centered lines", () => {
      const fb = new Framebuffer();
      renderBoot(fb, { kind: "boot", phase: "welcome", frame: 0 }, "Hello brave new world");
      const expected = new Framebuffer();
      expected.drawTextCentered(FONT, "Hello brave", 16); // 2 lines → top = (48-16)/2
      expected.drawTextCentered(FONT, "new world", 24);
      expect(regionToArt(fb, 0, 0, 84, 48)).toBe(regionToArt(expected, 0, 0, 84, 48));
    });
  });
  ```

- [ ] **Step 2: Run & expect FAIL** (modules missing): `mise exec -- vp run @hellotimber/phone-screen#test`
- [ ] **Step 3: Write `packages/phone-screen/src/render/layout.ts`:**

  ```ts
  import { FONT, textWidth } from "../font/font";
  import type { Framebuffer } from "../framebuffer";

  // Spec §2 display zones on the 84×48 LCD.
  export const TITLE_Y = 0; // status/title row: y 0–7
  export const CONTENT_TOP = 8; // content area: y 8–39
  export const SOFTKEY_Y = 41; // softkey label: y 41–47
  export const LINE_CHARS = 14; // 14 × 6px advance = 84px

  /** Clamp to `max` chars, replacing the tail with '…' when too long. */
  export function truncate(text: string, max: number): string {
    const chars = [...text];
    if (chars.length <= max) return text;
    return `${chars.slice(0, max - 1).join("")}…`;
  }

  /** Greedy word-wrap at `width` chars; hard-breaks longer words; '\n' = paragraph. */
  export function wrapText(text: string, width = LINE_CHARS): string[] {
    const lines: string[] = [];
    for (const para of text.split("\n")) {
      let line = "";
      for (const word of para.split(" ")) {
        let w = word;
        while (w.length > width) {
          if (line !== "") {
            lines.push(line);
            line = "";
          }
          lines.push(w.slice(0, width));
          w = w.slice(width);
        }
        if (line === "") line = w;
        else if (line.length + 1 + w.length <= width) line = `${line} ${w}`;
        else {
          lines.push(line);
          line = w;
        }
      }
      lines.push(line);
    }
    return lines;
  }

  /** Centered title on the top row. */
  export function drawTitle(fb: Framebuffer, title: string): void {
    fb.drawTextCentered(FONT, truncate(title, LINE_CHARS), TITLE_Y);
  }

  /**
   * The ONE NaviKey label, bottom-center. The 3310 has a single softkey —
   * never draw two labels (spec §4).
   */
  export function drawSoftkey(fb: Framebuffer, label: string): void {
    fb.drawTextCentered(FONT, label, SOFTKEY_Y);
  }

  /** Right-aligned text: the string's last pixel column lands on `xEnd`. */
  export function drawTextRight(fb: Framebuffer, text: string, xEnd: number, y: number): void {
    fb.drawText(FONT, text, xEnd - textWidth(FONT, text) + 1, y);
  }

  /**
   * Right-edge scroll/position indicator (spec §5): 1px track at x=83 over
   * the content area, 3px-wide thumb showing index/total.
   */
  export function drawScrollIndicator(fb: Framebuffer, index: number, total: number): void {
    const trackTop = CONTENT_TOP;
    const trackH = 32; // y 8–39
    fb.fillRect(83, trackTop, 1, trackH, 1);
    const thumbH = Math.max(4, Math.floor(trackH / Math.max(1, total)));
    const maxOffset = trackH - thumbH;
    const offset = total <= 1 ? 0 : Math.round((index * maxOffset) / (total - 1));
    fb.fillRect(81, trackTop + offset, 3, thumbH, 1);
  }
  ```

- [ ] **Step 4: Write `packages/phone-screen/src/icons/boot.ts`:**

  ```ts
  import { bitmapFromArt } from "../bitmap";
  import type { Bitmap } from "../bitmap";
  import { Framebuffer } from "../framebuffer";

  /** Left hand reaching right (16×14). */
  const HAND_LEFT = bitmapFromArt([
    "................",
    "........####....",
    ".......######...",
    "......########..",
    "......########..",
    "##############..",
    "################",
    "################",
    "##############..",
    "......########..",
    "......########..",
    ".......######...",
    "........####....",
    "................",
  ]);

  /** Right hand reaching left (16×14). */
  const HAND_RIGHT = bitmapFromArt([
    "................",
    "....####........",
    "...######.......",
    "..########......",
    "..########......",
    "..##############",
    "################",
    "################",
    "..##############",
    "..########......",
    "..########......",
    "...######.......",
    "....####........",
    "................",
  ]);

  /** [leftHandX, rightHandX] per frame — the hands slide together and interlock. */
  const FRAME_POSITIONS: readonly [number, number][] = [
    [6, 62],
    [16, 52],
    [24, 44],
    [30, 38],
  ];

  function composeFrame(leftX: number, rightX: number): Bitmap {
    const fb = new Framebuffer(84, 30);
    fb.blitBitmap(HAND_LEFT, leftX, 8);
    fb.blitBitmap(HAND_RIGHT, rightX, 8);
    return { width: fb.width, height: fb.height, pixels: fb.pixels };
  }

  /** The 4 'connecting hands' boot frames, 84×30 each (frame 3 = clasped). */
  export const HANDS_FRAMES: readonly Bitmap[] = FRAME_POSITIONS.map(([l, r]) =>
    composeFrame(l, r),
  );
  ```

- [ ] **Step 5: Write `packages/phone-screen/src/render/boot.ts`:**

  ```ts
  import type { ScreenModel } from "@hellotimber/phone-core";
  import { FONT, textWidth } from "../font/font";
  import type { Framebuffer } from "../framebuffer";
  import { HANDS_FRAMES } from "../icons/boot";
  import { wrapText } from "./layout";

  type BootScreen = Extract<ScreenModel, { kind: "boot" }>;

  /**
   * boot.frame advances every 200ms (phone-core) with no total in the model;
   * hold each art frame for 3 ticks (≈600ms) and clamp on the clasp
   * (contract deviation note 2).
   */
  const TICKS_PER_ART_FRAME = 3;

  export function renderBoot(fb: Framebuffer, screen: BootScreen, welcomeText: string): void {
    fb.clear(0);
    if (screen.phase === "hands") {
      const idx = Math.min(Math.floor(screen.frame / TICKS_PER_ART_FRAME), HANDS_FRAMES.length - 1);
      fb.blitBitmap(HANDS_FRAMES[idx]!, 0, 4);
      // Small NOKIA wordmark bottom-right — verified 3310 boot detail (spec §3).
      fb.drawText(FONT, "NOKIA", 82 - textWidth(FONT, "NOKIA"), 40);
      return;
    }
    const lines = wrapText(welcomeText).slice(0, 5);
    const top = Math.floor((fb.height - lines.length * 8) / 2);
    lines.forEach((line, i) => {
      fb.drawTextCentered(FONT, line, top + i * 8);
    });
  }
  ```

- [ ] **Step 6: Append the new exports to `packages/phone-screen/src/index.ts`:**

  ```ts
  export { HANDS_FRAMES } from "./icons/boot";
  export { renderBoot } from "./render/boot";
  export {
    CONTENT_TOP,
    drawScrollIndicator,
    drawSoftkey,
    drawTextRight,
    drawTitle,
    LINE_CHARS,
    SOFTKEY_Y,
    TITLE_Y,
    truncate,
    wrapText,
  } from "./render/layout";
  ```

- [ ] **Step 7: Run & expect PASS:** `mise exec -- vp run @hellotimber/phone-screen#test`
- [ ] **Step 8: Commit:**

  ```sh
  git add packages/phone-screen
  git commit -m "feat(phone-screen): add layout helpers and connecting-hands boot renderer"
  ```

---

### Task 9: Standby renderer

Spec §4, exactly four elements: operator name (the 2×-scaled "larger/bolder variant" of the body font — same glyphs, scaling blit), signal bars left edge, battery bars right edge, and the single softkey `Menu` bottom-center. Plus the optional clock (spec best guess: lower-right under the battery stack, only when the model carries it).

**Files**

- Create: `packages/phone-screen/src/render/standby.ts`
- Modify: `packages/phone-screen/src/index.ts`
- Test: `packages/phone-screen/tests/standby.test.ts`

**Steps**

- [ ] **Step 1: Write the failing test** `packages/phone-screen/tests/standby.test.ts`:

  ```ts
  import { describe, expect, it } from "vite-plus/test";
  import type { ScreenModel } from "@hellotimber/phone-core";
  import { FONT, textWidth } from "../src/font/font";
  import { Framebuffer } from "../src/framebuffer";
  import { renderStandby } from "../src/render/standby";
  import { regionToArt } from "./helpers";

  type StandbyScreen = Extract<ScreenModel, { kind: "standby" }>;

  function standby(overrides: Partial<StandbyScreen> = {}): StandbyScreen {
    return { kind: "standby", carrier: "LACHLAN", signal: 4, battery: 4, ...overrides };
  }

  describe("renderStandby", () => {
    it("draws the carrier name centered at 2x scale", () => {
      const fb = new Framebuffer();
      renderStandby(fb, standby());
      const expected = new Framebuffer();
      expected.drawTextCentered(FONT, "LACHLAN", 10, { scale: 2 });
      // carrier rows only (2x glyphs: y 10–23), away from the edge bars (x 5–78)
      expect(regionToArt(fb, 5, 10, 74, 14)).toBe(regionToArt(expected, 5, 10, 74, 14));
    });

    it("truncates over-long carrier names to 7 chars at 2x", () => {
      const fb = new Framebuffer();
      renderStandby(fb, standby({ carrier: "INTERNATIONAL" }));
      const expected = new Framebuffer();
      expected.drawTextCentered(FONT, "INTERN…", 10, { scale: 2 });
      expect(regionToArt(fb, 0, 10, 84, 14)).toBe(regionToArt(expected, 0, 10, 84, 14));
    });

    it("draws signal and battery stacks at the configured levels", () => {
      const fb = new Framebuffer();
      renderStandby(fb, standby({ signal: 2, battery: 3 }));
      expect(fb.getPixel(0, 27)).toBe(1); // signal rung 0
      expect(fb.getPixel(0, 22)).toBe(1); // signal rung 1
      expect(fb.getPixel(0, 17)).toBe(0); // signal rung 2 absent
      expect(fb.getPixel(81, 17)).toBe(1); // battery rung 2
      expect(fb.getPixel(81, 12)).toBe(0); // battery rung 3 absent
    });

    it("shows the single softkey label 'Menu' bottom-center", () => {
      const fb = new Framebuffer();
      renderStandby(fb, standby());
      const expected = new Framebuffer();
      expected.drawTextCentered(FONT, "Menu", 41);
      expect(regionToArt(fb, 0, 41, 84, 7)).toBe(regionToArt(expected, 0, 41, 84, 7));
    });

    it("draws the clock lower-right only when present", () => {
      const withClock = new Framebuffer();
      renderStandby(withClock, standby({ clock: "12:34" }));
      const expected = new Framebuffer();
      expected.drawText(FONT, "12:34", 79 - textWidth(FONT, "12:34") + 1, 32);
      expect(regionToArt(withClock, 40, 32, 44, 7)).toBe(regionToArt(expected, 40, 32, 44, 7));

      const without = new Framebuffer();
      renderStandby(without, standby());
      expect(regionToArt(without, 40, 32, 40, 7)).toBe(
        regionToArt(new Framebuffer(), 40, 32, 40, 7),
      );
    });
  });
  ```

- [ ] **Step 2: Run & expect FAIL** (no `src/render/standby.ts`): `mise exec -- vp run @hellotimber/phone-screen#test`
- [ ] **Step 3: Write `packages/phone-screen/src/render/standby.ts`:**

  ```ts
  import type { ScreenModel } from "@hellotimber/phone-core";
  import { FONT } from "../font/font";
  import type { Framebuffer } from "../framebuffer";
  import { drawBatteryLevel, drawSignalLevel } from "../icons/status";
  import { drawSoftkey, drawTextRight, truncate } from "./layout";

  type StandbyScreen = Extract<ScreenModel, { kind: "standby" }>;

  /** Max carrier chars at 2x scale: 7 × 12px advance − 2 = 82px ≤ 84. */
  const CARRIER_MAX_CHARS = 7;
  const CARRIER_Y = 10;
  const CLOCK_Y = 32; // best guess: lower-right, under the battery stack (spec §4)
  const CLOCK_X_END = 79; // clear of the battery rungs at x 81–83

  export function renderStandby(fb: Framebuffer, screen: StandbyScreen): void {
    fb.clear(0);
    drawSignalLevel(fb, screen.signal);
    drawBatteryLevel(fb, screen.battery);
    fb.drawTextCentered(FONT, truncate(screen.carrier, CARRIER_MAX_CHARS), CARRIER_Y, {
      scale: 2,
    });
    if (screen.clock !== undefined) drawTextRight(fb, screen.clock, CLOCK_X_END, CLOCK_Y);
    drawSoftkey(fb, "Menu");
  }
  ```

- [ ] **Step 4: Append to `packages/phone-screen/src/index.ts`:**

  ```ts
  export { renderStandby } from "./render/standby";
  ```

- [ ] **Step 5: Run & expect PASS:** `mise exec -- vp run @hellotimber/phone-screen#test`
- [ ] **Step 6: Commit:**

  ```sh
  git add packages/phone-screen
  git commit -m "feat(phone-screen): add standby renderer"
  ```

---

### Task 10: Menu carousel renderer

Spec §5 presentation: one top-level menu at a time as a full-screen page — menu label, big icon, the **shortcut number top-right** (verified, manual p.40), a right-edge scroll/position indicator, and the `Select` softkey.

**Files**

- Create: `packages/phone-screen/src/render/carousel.ts`
- Modify: `packages/phone-screen/src/index.ts`
- Test: `packages/phone-screen/tests/carousel.test.ts`

**Steps**

- [ ] **Step 1: Write the failing test** `packages/phone-screen/tests/carousel.test.ts`:

  ```ts
  import { describe, expect, it } from "vite-plus/test";
  import type { ScreenModel } from "@hellotimber/phone-core";
  import { FONT } from "../src/font/font";
  import { Framebuffer } from "../src/framebuffer";
  import { menuIcon } from "../src/icons/menu-icons";
  import { renderCarousel } from "../src/render/carousel";
  import { drawTextRight } from "../src/render/layout";
  import { regionToArt } from "./helpers";

  type CarouselScreen = Extract<ScreenModel, { kind: "menu-carousel" }>;

  function carousel(overrides: Partial<CarouselScreen> = {}): CarouselScreen {
    return {
      kind: "menu-carousel",
      label: "Messages",
      menuNumber: 2,
      total: 13,
      iconId: "messages",
      ...overrides,
    };
  }

  describe("renderCarousel", () => {
    it("draws the label centered below the status row", () => {
      const fb = new Framebuffer();
      renderCarousel(fb, carousel());
      const expected = new Framebuffer();
      expected.drawTextCentered(FONT, "Messages", 9);
      expect(regionToArt(fb, 0, 9, 80, 7)).toBe(regionToArt(expected, 0, 9, 80, 7));
    });

    it("draws the shortcut number top-right", () => {
      const fb = new Framebuffer();
      renderCarousel(fb, carousel({ menuNumber: 13 }));
      const expected = new Framebuffer();
      drawTextRight(expected, "13", 83, 0);
      expect(regionToArt(fb, 60, 0, 24, 7)).toBe(regionToArt(expected, 60, 0, 24, 7));
    });

    it("blits the menu icon centered in the content area", () => {
      const fb = new Framebuffer();
      renderCarousel(fb, carousel());
      const expected = new Framebuffer();
      expected.blitBitmap(menuIcon("messages"), 34, 18);
      expect(regionToArt(fb, 34, 18, 16, 16)).toBe(regionToArt(expected, 34, 18, 16, 16));
    });

    it("falls back to the ?-box icon for unknown iconIds", () => {
      const fb = new Framebuffer();
      renderCarousel(fb, carousel({ iconId: "nope" }));
      const expected = new Framebuffer();
      expected.blitBitmap(menuIcon("nope"), 34, 18);
      expect(regionToArt(fb, 34, 18, 16, 16)).toBe(regionToArt(expected, 34, 18, 16, 16));
    });

    it("positions the right-edge scroll thumb by menu number", () => {
      const first = new Framebuffer();
      const last = new Framebuffer();
      renderCarousel(first, carousel({ menuNumber: 1 }));
      renderCarousel(last, carousel({ menuNumber: 13 }));
      expect(first.getPixel(81, 8)).toBe(1); // thumb at the top for menu 1
      expect(first.getPixel(81, 36)).toBe(0);
      expect(last.getPixel(81, 36)).toBe(1); // thumb at the bottom for menu 13
      expect(last.getPixel(81, 8)).toBe(0);
      expect(first.getPixel(83, 20)).toBe(1); // the track line spans the content area
    });

    it("shows the Select softkey", () => {
      const fb = new Framebuffer();
      renderCarousel(fb, carousel());
      const expected = new Framebuffer();
      expected.drawTextCentered(FONT, "Select", 41);
      expect(regionToArt(fb, 0, 41, 84, 7)).toBe(regionToArt(expected, 0, 41, 84, 7));
    });
  });
  ```

- [ ] **Step 2: Run & expect FAIL** (no `src/render/carousel.ts`): `mise exec -- vp run @hellotimber/phone-screen#test`
- [ ] **Step 3: Write `packages/phone-screen/src/render/carousel.ts`:**

  ```ts
  import type { ScreenModel } from "@hellotimber/phone-core";
  import { FONT } from "../font/font";
  import type { Framebuffer } from "../framebuffer";
  import { menuIcon } from "../icons/menu-icons";
  import { drawScrollIndicator, drawSoftkey, drawTextRight, LINE_CHARS, truncate } from "./layout";

  type CarouselScreen = Extract<ScreenModel, { kind: "menu-carousel" }>;

  const LABEL_Y = 9;
  const ICON_X = 34; // (84 - 16) / 2
  const ICON_Y = 18;

  export function renderCarousel(fb: Framebuffer, screen: CarouselScreen): void {
    fb.clear(0);
    // Menu shortcut number top-right — verified 3310 behavior (spec §5).
    drawTextRight(fb, String(screen.menuNumber), 83, 0);
    fb.drawTextCentered(FONT, truncate(screen.label, LINE_CHARS), LABEL_Y);
    fb.blitBitmap(menuIcon(screen.iconId), ICON_X, ICON_Y);
    drawScrollIndicator(fb, screen.menuNumber - 1, screen.total);
    drawSoftkey(fb, "Select");
  }
  ```

- [ ] **Step 4: Append to `packages/phone-screen/src/index.ts`:**

  ```ts
  export { renderCarousel } from "./render/carousel";
  ```

- [ ] **Step 5: Run & expect PASS:** `mise exec -- vp run @hellotimber/phone-screen#test`
- [ ] **Step 6: Commit:**

  ```sh
  git add packages/phone-screen
  git commit -m "feat(phone-screen): add menu carousel renderer"
  ```

---

### Task 11: List & reader renderers

Lists (submenus, item lists): title row top, up to 3 item rows, the selected item as an **inverted-video bar** (filled rect + text drawn with ink 0), right-edge scroll indicator when there are more than 3 items, softkey from the model. Readers: title, 3 visible wrapped lines from `scrollTop` (matches phone-core's `READER_VISIBLE_LINES = 3`), `▲`/`▼` scroll hints on the right edge, fixed `Back` softkey (deviation note 4).

**Files**

- Create: `packages/phone-screen/src/render/list.ts`
- Modify: `packages/phone-screen/src/index.ts`
- Test: `packages/phone-screen/tests/list.test.ts`

**Steps**

- [ ] **Step 1: Write the failing test** `packages/phone-screen/tests/list.test.ts`:

  ```ts
  import { describe, expect, it } from "vite-plus/test";
  import type { ScreenModel } from "@hellotimber/phone-core";
  import { FONT } from "../src/font/font";
  import { Framebuffer } from "../src/framebuffer";
  import { renderList, renderReader } from "../src/render/list";
  import { regionToArt } from "./helpers";

  type ListScreen = Extract<ScreenModel, { kind: "list" }>;
  type ReaderScreen = Extract<ScreenModel, { kind: "reader" }>;

  function list(overrides: Partial<ListScreen> = {}): ListScreen {
    return {
      kind: "list",
      title: "Phone book",
      items: ["Search", "Memory status"],
      selected: 0,
      softkey: "Select",
      ...overrides,
    };
  }

  describe("renderList", () => {
    it("draws the title centered on the top row and the softkey from the model", () => {
      const fb = new Framebuffer();
      renderList(fb, list());
      const expected = new Framebuffer();
      expected.drawTextCentered(FONT, "Phone book", 0);
      expected.drawTextCentered(FONT, "Select", 41);
      expect(regionToArt(fb, 0, 0, 84, 7)).toBe(regionToArt(expected, 0, 0, 84, 7));
      expect(regionToArt(fb, 0, 41, 84, 7)).toBe(regionToArt(expected, 0, 41, 84, 7));
    });

    it("draws the selected item as an inverted-video bar", () => {
      const fb = new Framebuffer();
      renderList(fb, list()); // selected 0 → row at y 9, bar at y 8–16
      const expected = new Framebuffer();
      expected.fillRect(0, 8, 84, 9, 1);
      expected.drawText(FONT, "Search", 2, 9, { color: 0 });
      expect(regionToArt(fb, 0, 8, 80, 9)).toBe(regionToArt(expected, 0, 8, 80, 9));
    });

    it("draws unselected items as plain text", () => {
      const fb = new Framebuffer();
      renderList(fb, list()); // second row at y 19
      const expected = new Framebuffer();
      expected.drawText(FONT, "Memory status", 2, 19);
      expect(regionToArt(fb, 0, 18, 80, 9)).toBe(regionToArt(expected, 0, 18, 80, 9));
    });

    it("scrolls so the selection stays visible (middle row when possible)", () => {
      const items = ["One", "Two", "Three", "Four", "Five"];
      const fb = new Framebuffer();
      renderList(fb, list({ items, selected: 3 })); // top = 2 → window Three/Four/Five
      const expected = new Framebuffer();
      expected.drawText(FONT, "Three", 2, 9);
      expect(regionToArt(fb, 0, 9, 60, 7)).toBe(regionToArt(expected, 0, 9, 60, 7));
      // selected 'Four' is the middle row → inverted bar at y 18–26
      expect(fb.getPixel(0, 18)).toBe(1);
    });

    it("shows the scroll indicator only when items overflow", () => {
      const short = new Framebuffer();
      renderList(short, list());
      expect(short.getPixel(83, 20)).toBe(0);
      const long = new Framebuffer();
      renderList(long, list({ items: ["a", "b", "c", "d"], selected: 0 }));
      expect(long.getPixel(83, 20)).toBe(1);
    });

    it("truncates long labels with an ellipsis", () => {
      const fb = new Framebuffer();
      renderList(fb, list({ items: ["Extraordinarily long"], selected: 0 }));
      const expected = new Framebuffer();
      expected.fillRect(0, 8, 84, 9, 1);
      expected.drawText(FONT, "Extraordinar…", 2, 9, { color: 0 });
      expect(regionToArt(fb, 0, 8, 80, 9)).toBe(regionToArt(expected, 0, 8, 80, 9));
    });
  });

  describe("renderReader", () => {
    function reader(overrides: Partial<ReaderScreen> = {}): ReaderScreen {
      return {
        kind: "reader",
        title: "Chat",
        lines: ["line one", "line two", "line three", "line four"],
        scrollTop: 0,
        ...overrides,
      };
    }

    it("draws title, three visible lines from scrollTop, and the Back softkey", () => {
      const fb = new Framebuffer();
      renderReader(fb, reader({ scrollTop: 1 }));
      const expected = new Framebuffer();
      expected.drawTextCentered(FONT, "Chat", 0);
      expected.drawText(FONT, "line two", 1, 9);
      expected.drawText(FONT, "line three", 1, 19);
      expected.drawText(FONT, "line four", 1, 29);
      expected.drawTextCentered(FONT, "Back", 41);
      expect(regionToArt(fb, 0, 0, 78, 48)).toBe(regionToArt(expected, 0, 0, 78, 48));
    });

    it("shows ▲ only when scrolled down and ▼ only when more lines remain", () => {
      const atTop = new Framebuffer();
      renderReader(atTop, reader()); // 4 lines, scrollTop 0 → more below
      const up = new Framebuffer();
      up.drawText(FONT, "▲", 79, 9);
      const down = new Framebuffer();
      down.drawText(FONT, "▼", 79, 29);
      expect(regionToArt(atTop, 79, 9, 5, 7)).toBe(regionToArt(new Framebuffer(), 79, 9, 5, 7));
      expect(regionToArt(atTop, 79, 29, 5, 7)).toBe(regionToArt(down, 79, 29, 5, 7));

      const atEnd = new Framebuffer();
      renderReader(atEnd, reader({ scrollTop: 1 })); // lines 2–4 visible → nothing below
      expect(regionToArt(atEnd, 79, 9, 5, 7)).toBe(regionToArt(up, 79, 9, 5, 7));
      expect(regionToArt(atEnd, 79, 29, 5, 7)).toBe(regionToArt(new Framebuffer(), 79, 29, 5, 7));
    });
  });
  ```

- [ ] **Step 2: Run & expect FAIL** (no `src/render/list.ts`): `mise exec -- vp run @hellotimber/phone-screen#test`
- [ ] **Step 3: Write `packages/phone-screen/src/render/list.ts`:**

  ```ts
  import type { ScreenModel } from "@hellotimber/phone-core";
  import { FONT } from "../font/font";
  import type { Framebuffer } from "../framebuffer";
  import { drawScrollIndicator, drawSoftkey, drawTitle, truncate } from "./layout";

  type ListScreen = Extract<ScreenModel, { kind: "list" }>;
  type ReaderScreen = Extract<ScreenModel, { kind: "reader" }>;

  /** Three content rows: text at y 9/19/29, selection bars at y−1 … y+7. */
  const ROW_YS = [9, 19, 29] as const;
  const VISIBLE_ROWS = 3;
  const ROW_CHARS = 13; // leaves x 81–83 free for the scroll indicator

  /** First visible index: keep the selection on the middle row when possible. */
  function windowTop(selected: number, count: number): number {
    return Math.min(Math.max(0, selected - 1), Math.max(0, count - VISIBLE_ROWS));
  }

  export function renderList(fb: Framebuffer, screen: ListScreen): void {
    fb.clear(0);
    drawTitle(fb, screen.title);
    const top = windowTop(screen.selected, screen.items.length);
    for (let row = 0; row < VISIBLE_ROWS; row++) {
      const index = top + row;
      const item = screen.items[index];
      if (item === undefined) break;
      const y = ROW_YS[row]!;
      const label = truncate(item, ROW_CHARS);
      if (index === screen.selected) {
        fb.fillRect(0, y - 1, fb.width, 9, 1); // inverted-video selection bar
        fb.drawText(FONT, label, 2, y, { color: 0 });
      } else {
        fb.drawText(FONT, label, 2, y);
      }
    }
    if (screen.items.length > VISIBLE_ROWS) {
      drawScrollIndicator(fb, screen.selected, screen.items.length);
    }
    drawSoftkey(fb, screen.softkey);
  }

  export function renderReader(fb: Framebuffer, screen: ReaderScreen): void {
    fb.clear(0);
    drawTitle(fb, screen.title);
    const visible = screen.lines.slice(screen.scrollTop, screen.scrollTop + VISIBLE_ROWS);
    visible.forEach((line, i) => {
      fb.drawText(FONT, truncate(line, ROW_CHARS), 1, ROW_YS[i]!);
    });
    if (screen.scrollTop > 0) fb.drawText(FONT, "▲", 79, ROW_YS[0]!);
    if (screen.scrollTop + VISIBLE_ROWS < screen.lines.length) {
      fb.drawText(FONT, "▼", 79, ROW_YS[2]!);
    }
    drawSoftkey(fb, "Back");
  }
  ```

- [ ] **Step 4: Append to `packages/phone-screen/src/index.ts`:**

  ```ts
  export { renderList, renderReader } from "./render/list";
  ```

- [ ] **Step 5: Run & expect PASS:** `mise exec -- vp run @hellotimber/phone-screen#test`
- [ ] **Step 6: Commit:**

  ```sh
  git add packages/phone-screen
  git commit -m "feat(phone-screen): add list and reader renderers with inverted selection"
  ```

---

### Task 12: Editor & confirm renderers + the `renderScreen` dispatcher

Editor (spec §2/§6): title top-left, the input-mode indicator (`abc`/`Abc`/`123`) top-right, text hard-wrapped at 14 chars across up to 4 rows (8 px pitch — glyph + underline row), a 5×1 px **underscore cursor** at the insertion point, auto-scrolled so the cursor row is visible, fixed `Options` softkey. Confirm: wrapped text centered + the model's softkey. Then `renderScreen` — the exhaustive dispatcher over every `ScreenModel` kind, including the two trivial ones: `off` (clear) and `custom` (blit the provided Bitmap verbatim at 0,0).

**Files**

- Create: `packages/phone-screen/src/render/editor.ts`
- Create: `packages/phone-screen/src/render/index.ts`
- Modify: `packages/phone-screen/src/index.ts`
- Test: `packages/phone-screen/tests/editor.test.ts`

**Steps**

- [ ] **Step 1: Write the failing test** `packages/phone-screen/tests/editor.test.ts`:

  ```ts
  import { describe, expect, it } from "vite-plus/test";
  import type { ScreenModel } from "@hellotimber/phone-core";
  import { FONT, textWidth } from "../src/font/font";
  import { Framebuffer } from "../src/framebuffer";
  import { renderConfirm, renderEditor } from "../src/render/editor";
  import { renderScreen } from "../src/render";
  import { regionToArt } from "./helpers";

  type EditorScreen = Extract<ScreenModel, { kind: "editor" }>;

  function editor(overrides: Partial<EditorScreen> = {}): EditorScreen {
    return { kind: "editor", title: "Message:", text: "Hi", cursor: 2, mode: "Abc", ...overrides };
  }

  describe("renderEditor", () => {
    it("draws title top-left, mode top-right, text and Options softkey", () => {
      const fb = new Framebuffer();
      renderEditor(fb, editor());
      const expected = new Framebuffer();
      expected.drawText(FONT, "Message:", 1, 0);
      expected.drawText(FONT, "Abc", 83 - textWidth(FONT, "Abc") + 1, 0);
      expected.drawText(FONT, "Hi", 0, 8);
      expected.fillRect(12, 15, 5, 1, 1); // cursor underscore at col 2 of row 0
      expected.drawTextCentered(FONT, "Options", 41);
      expect(regionToArt(fb, 0, 0, 84, 48)).toBe(regionToArt(expected, 0, 0, 84, 48));
    });

    it("shows the 123 mode indicator", () => {
      const fb = new Framebuffer();
      renderEditor(fb, editor({ mode: "123" }));
      const expected = new Framebuffer();
      expected.drawText(FONT, "123", 83 - textWidth(FONT, "123") + 1, 0);
      expect(regionToArt(fb, 60, 0, 24, 7)).toBe(regionToArt(expected, 60, 0, 24, 7));
    });

    it("wraps text at 14 chars and places the cursor mid-text", () => {
      const fb = new Framebuffer();
      // 16 chars: rows 'fourteen chars' + '!!'; cursor 15 → row 1, col 1
      renderEditor(fb, editor({ text: "fourteen chars!!", cursor: 15 }));
      const expected = new Framebuffer();
      expected.drawText(FONT, "fourteen chars", 0, 8);
      expected.drawText(FONT, "!!", 0, 16);
      expected.fillRect(6, 23, 5, 1, 1); // col 1 of row 1
      expect(regionToArt(fb, 0, 8, 84, 24)).toBe(regionToArt(expected, 0, 8, 84, 24));
    });

    it("scrolls so the cursor row is visible past 4 rows", () => {
      const text = "a".repeat(14 * 5); // 5 full rows (0–4) + cursor lands on row 5
      const fb = new Framebuffer();
      renderEditor(fb, editor({ text, cursor: 70 }));
      const expected = new Framebuffer();
      // rows 2–4 of 'a's visible, cursor row 5 (empty) at the bottom
      expected.drawText(FONT, "a".repeat(14), 0, 8);
      expected.drawText(FONT, "a".repeat(14), 0, 16);
      expected.drawText(FONT, "a".repeat(14), 0, 24);
      expected.fillRect(0, 39, 5, 1, 1); // cursor at col 0 of the 4th visible row
      expect(regionToArt(fb, 0, 8, 84, 32)).toBe(regionToArt(expected, 0, 8, 84, 32));
    });
  });

  describe("renderConfirm", () => {
    it("centers wrapped text and draws the model softkey", () => {
      const fb = new Framebuffer();
      renderConfirm(fb, { kind: "confirm", text: "Message sent", softkey: "OK" });
      const expected = new Framebuffer();
      expected.drawTextCentered(FONT, "Message sent", 16); // 1 line → top = (41-8)/2 = 16
      expected.drawTextCentered(FONT, "OK", 41);
      expect(regionToArt(fb, 0, 0, 84, 48)).toBe(regionToArt(expected, 0, 0, 84, 48));
    });
  });

  describe("renderScreen dispatcher", () => {
    it("off clears the framebuffer", () => {
      const fb = new Framebuffer();
      fb.fillRect(0, 0, 84, 48, 1);
      renderScreen(fb, { kind: "off" }, { welcomeText: "Welcome!" });
      expect(fb.pixels.every((p) => p === 0)).toBe(true);
    });

    it("custom blits the provided bitmap verbatim", () => {
      const pixels = new Uint8Array(84 * 48);
      pixels[0] = 1;
      pixels[84 * 48 - 1] = 1;
      const fb = new Framebuffer();
      renderScreen(
        fb,
        { kind: "custom", appId: "snake", frame: { width: 84, height: 48, pixels } },
        { welcomeText: "Welcome!" },
      );
      expect(fb.getPixel(0, 0)).toBe(1);
      expect(fb.getPixel(83, 47)).toBe(1);
      expect(fb.pixels.filter((p) => p === 1)).toHaveLength(2);
    });

    it("routes every other kind to its renderer", () => {
      const opts = { welcomeText: "Welcome!" };
      const screens: ScreenModel[] = [
        { kind: "boot", phase: "hands", frame: 0 },
        { kind: "standby", carrier: "LACHLAN", signal: 4, battery: 4 },
        { kind: "menu-carousel", label: "Messages", menuNumber: 2, total: 13, iconId: "messages" },
        { kind: "list", title: "Inbox", items: ["Hello"], selected: 0, softkey: "Select" },
        { kind: "reader", title: "Chat", lines: ["> hi"], scrollTop: 0 },
        { kind: "editor", title: "Message:", text: "Hi", cursor: 2, mode: "Abc" },
        { kind: "confirm", text: "Sent", softkey: "OK" },
      ];
      for (const screen of screens) {
        const fb = new Framebuffer();
        renderScreen(fb, screen, opts);
        expect(
          fb.pixels.some((p) => p === 1),
          screen.kind,
        ).toBe(true);
      }
    });
  });
  ```

- [ ] **Step 2: Run & expect FAIL** (modules missing): `mise exec -- vp run @hellotimber/phone-screen#test`
- [ ] **Step 3: Write `packages/phone-screen/src/render/editor.ts`:**

  ```ts
  import type { ScreenModel } from "@hellotimber/phone-core";
  import { FONT } from "../font/font";
  import type { Framebuffer } from "../framebuffer";
  import { drawSoftkey, drawTextRight, LINE_CHARS, truncate, wrapText } from "./layout";

  type EditorScreen = Extract<ScreenModel, { kind: "editor" }>;
  type ConfirmScreen = Extract<ScreenModel, { kind: "confirm" }>;

  /** 4 text rows at 8px pitch: glyph rows y…y+6, underline cursor row y+7. */
  const EDITOR_ROWS = 4;
  const EDITOR_TOP = 8;
  const ADVANCE = 6;

  export function renderEditor(fb: Framebuffer, screen: EditorScreen): void {
    fb.clear(0);
    fb.drawText(FONT, truncate(screen.title, 9), 1, 0);
    drawTextRight(fb, screen.mode, 83, 0); // input-mode indicator top-right (spec §2)

    // Hard character wrap (not word wrap) keeps cursor↔pixel math exact.
    const chars = [...screen.text];
    const rows: string[] = [];
    for (let i = 0; i < chars.length; i += LINE_CHARS) {
      rows.push(chars.slice(i, i + LINE_CHARS).join(""));
    }
    const cursorRow = Math.floor(screen.cursor / LINE_CHARS);
    const cursorCol = screen.cursor % LINE_CHARS;
    while (rows.length <= cursorRow) rows.push("");

    const top = Math.max(0, cursorRow - (EDITOR_ROWS - 1));
    for (let i = 0; i < EDITOR_ROWS; i++) {
      const row = rows[top + i];
      if (row === undefined) break;
      fb.drawText(FONT, row, 0, EDITOR_TOP + i * 8);
    }
    if (cursorRow >= top && cursorRow < top + EDITOR_ROWS) {
      const y = EDITOR_TOP + (cursorRow - top) * 8 + 7;
      fb.fillRect(cursorCol * ADVANCE, y, 5, 1, 1); // underscore cursor
    }
    drawSoftkey(fb, "Options");
  }

  export function renderConfirm(fb: Framebuffer, screen: ConfirmScreen): void {
    fb.clear(0);
    const lines = wrapText(screen.text).slice(0, 3);
    const top = Math.floor((41 - lines.length * 8) / 2);
    lines.forEach((line, i) => {
      fb.drawTextCentered(FONT, line, top + i * 8);
    });
    drawSoftkey(fb, screen.softkey);
  }
  ```

- [ ] **Step 4: Write `packages/phone-screen/src/render/index.ts`** — the dispatcher:

  ```ts
  import type { ScreenModel } from "@hellotimber/phone-core";
  import type { Framebuffer } from "../framebuffer";
  import { renderBoot } from "./boot";
  import { renderCarousel } from "./carousel";
  import { renderConfirm, renderEditor } from "./editor";
  import { renderList, renderReader } from "./list";
  import { renderStandby } from "./standby";

  export interface RenderOptions {
    /** Boot 'welcome' phase text — the ScreenModel carries none (deviation note 1). */
    welcomeText: string;
  }

  /** Rasterize any ScreenModel into the framebuffer. */
  export function renderScreen(fb: Framebuffer, screen: ScreenModel, opts: RenderOptions): void {
    switch (screen.kind) {
      case "off":
        fb.clear(0);
        return;
      case "boot":
        renderBoot(fb, screen, opts.welcomeText);
        return;
      case "standby":
        renderStandby(fb, screen);
        return;
      case "menu-carousel":
        renderCarousel(fb, screen);
        return;
      case "list":
        renderList(fb, screen);
        return;
      case "reader":
        renderReader(fb, screen);
        return;
      case "editor":
        renderEditor(fb, screen);
        return;
      case "confirm":
        renderConfirm(fb, screen);
        return;
      case "custom":
        fb.clear(0);
        fb.blitBitmap(screen.frame, 0, 0); // games draw raw pixels — verbatim
        return;
    }
  }
  ```

- [ ] **Step 5: Append to `packages/phone-screen/src/index.ts`:**

  ```ts
  export { renderConfirm, renderEditor } from "./render/editor";
  export { renderScreen } from "./render";
  export type { RenderOptions } from "./render";
  ```

- [ ] **Step 6: Run & expect PASS:** `mise exec -- vp run @hellotimber/phone-screen#test`
- [ ] **Step 7: Commit:**

  ```sh
  git add packages/phone-screen
  git commit -m "feat(phone-screen): add editor/confirm renderers and renderScreen dispatcher"
  ```

---

### Task 13: `createScreenRenderer` — the canvas wrapper

The VISION.md contract surface, verbatim (`ScreenRenderer` with `canvas`/`render`/`version`; `createScreenRenderer(opts)` with `scale`/`fg`/`bg` — plus the `welcomeText` extension, deviation note 1). This is the ONLY module that touches `document`, and only inside `createScreenRenderer` — importing the package stays node-safe. `render(screen)` rasterizes into the framebuffer, byte-compares against the previously painted frame, and only on change writes the scaled `ImageData` (`putImageData`) and bumps `version`. Palette default: classic green LCD — bg `#c7f0d8`, fg `#43523d`. The `ImageData` is allocated via `ctx.createImageData` (not `new ImageData`) so the jsdom test can supply a plain fake context.

**Files**

- Create: `packages/phone-screen/src/renderer.ts`
- Modify: `packages/phone-screen/src/index.ts`
- Test: `packages/phone-screen/tests/renderer.test.ts` (jsdom via docblock)

**Steps**

- [ ] **Step 1: Write the failing test** `packages/phone-screen/tests/renderer.test.ts` — jsdom provides `document`/`HTMLCanvasElement`, but its 2D context is not implemented without the native `canvas` package, so the test stubs `getContext` with a recording fake:

  ```ts
  // @vitest-environment jsdom
  import { afterEach, describe, expect, it, vi } from "vite-plus/test";
  import type { ScreenModel } from "@hellotimber/phone-core";
  import { createScreenRenderer } from "../src/renderer";

  interface FakeImageData {
    width: number;
    height: number;
    data: Uint8ClampedArray;
  }

  function stubCanvas2d(): { paints: FakeImageData[] } {
    const paints: FakeImageData[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => {
      const ctx = {
        createImageData: (w: number, h: number): FakeImageData => ({
          width: w,
          height: h,
          data: new Uint8ClampedArray(w * h * 4),
        }),
        putImageData: (image: FakeImageData): void => {
          // copy so later mutations don't rewrite recorded paints
          paints.push({ ...image, data: new Uint8ClampedArray(image.data) });
        },
      };
      return ctx as unknown as CanvasRenderingContext2D;
    });
    return { paints };
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const OFF: ScreenModel = { kind: "off" };
  const STANDBY: ScreenModel = { kind: "standby", carrier: "LACHLAN", signal: 4, battery: 4 };

  function customFrame(...setPixels: [number, number][]): ScreenModel {
    const pixels = new Uint8Array(84 * 48);
    for (const [x, y] of setPixels) pixels[y * 84 + x] = 1;
    return { kind: "custom", appId: "test", frame: { width: 84, height: 48, pixels } };
  }

  describe("createScreenRenderer", () => {
    it("owns an 84×48 canvas, scaled by opts.scale", () => {
      stubCanvas2d();
      expect(createScreenRenderer().canvas.width).toBe(84);
      expect(createScreenRenderer().canvas.height).toBe(48);
      const scaled = createScreenRenderer({ scale: 3 });
      expect(scaled.canvas.width).toBe(252);
      expect(scaled.canvas.height).toBe(144);
    });

    it("bumps version and repaints only on visible change", () => {
      const { paints } = stubCanvas2d();
      const r = createScreenRenderer();
      expect(r.version).toBe(0);
      r.render(OFF); // first frame always paints
      expect(r.version).toBe(1);
      expect(paints).toHaveLength(1);
      r.render(OFF); // identical pixels → no paint, no bump
      expect(r.version).toBe(1);
      expect(paints).toHaveLength(1);
      r.render(STANDBY);
      expect(r.version).toBe(2);
      expect(paints).toHaveLength(2);
      r.render(STANDBY);
      expect(r.version).toBe(2);
    });

    it("paints the default green LCD palette", () => {
      const { paints } = stubCanvas2d();
      const r = createScreenRenderer();
      r.render(customFrame([0, 0]));
      const data = paints[0]!.data;
      // pixel (0,0) is set → fg #43523d
      expect([data[0], data[1], data[2], data[3]]).toEqual([0x43, 0x52, 0x3d, 255]);
      // pixel (1,0) is clear → bg #c7f0d8
      expect([data[4], data[5], data[6], data[7]]).toEqual([0xc7, 0xf0, 0xd8, 255]);
    });

    it("honors custom fg/bg colors", () => {
      const { paints } = stubCanvas2d();
      const r = createScreenRenderer({ fg: "#000000", bg: "#ffffff" });
      r.render(customFrame([0, 0]));
      const data = paints[0]!.data;
      expect([data[0], data[1], data[2]]).toEqual([0, 0, 0]);
      expect([data[4], data[5], data[6]]).toEqual([255, 255, 255]);
    });

    it("expands each framebuffer pixel into a scale×scale block", () => {
      const { paints } = stubCanvas2d();
      const r = createScreenRenderer({ scale: 2 });
      r.render(customFrame([0, 0]));
      const { width, data } = paints[0]!;
      expect(width).toBe(168);
      const at = (x: number, y: number): number[] => {
        const i = (y * 168 + x) * 4;
        return [data[i]!, data[i + 1]!, data[i + 2]!];
      };
      const FG = [0x43, 0x52, 0x3d];
      const BG = [0xc7, 0xf0, 0xd8];
      expect(at(0, 0)).toEqual(FG);
      expect(at(1, 0)).toEqual(FG);
      expect(at(0, 1)).toEqual(FG);
      expect(at(1, 1)).toEqual(FG);
      expect(at(2, 0)).toEqual(BG);
      expect(at(0, 2)).toEqual(BG);
    });

    it("renders the boot welcome phase with the configured welcomeText", () => {
      const { paints } = stubCanvas2d();
      const a = createScreenRenderer({ welcomeText: "Hello!" });
      const b = createScreenRenderer({ welcomeText: "Other text" });
      const welcome: ScreenModel = { kind: "boot", phase: "welcome", frame: 0 };
      a.render(welcome);
      b.render(welcome);
      expect(paints[0]!.data).not.toEqual(paints[1]!.data);
    });
  });
  ```

- [ ] **Step 2: Run & expect FAIL** (no `src/renderer.ts`): `mise exec -- vp run @hellotimber/phone-screen#test`
- [ ] **Step 3: Write `packages/phone-screen/src/renderer.ts`:**

  ```ts
  import type { ScreenModel } from "@hellotimber/phone-core";
  import { Framebuffer } from "./framebuffer";
  import { renderScreen } from "./render";

  export interface ScreenRenderer {
    readonly canvas: HTMLCanvasElement; // 84×48 logical px, scaled by opts.scale
    render(screen: ScreenModel): void; // draw + bump version when output changes
    readonly version: number; // increments on visible change
  }

  export interface ScreenRendererOptions {
    scale?: number; // default 1: native 84×48 — three.js NearestFilter and CSS
    // image-rendering:pixelated handle upscaling crisply
    fg?: string;
    bg?: string; // default classic green LCD palette
    /** Boot 'welcome' phase text (the boot ScreenModel carries none). Default "Welcome!". */
    welcomeText?: string;
  }

  const LCD_FG = "#43523d";
  const LCD_BG = "#c7f0d8";

  function parseHexColor(hex: string): [number, number, number] {
    const match = /^#([0-9a-f]{6})$/i.exec(hex);
    if (match === null) throw new Error(`invalid color '${hex}' — expected #rrggbb`);
    const n = Number.parseInt(match[1]!, 16);
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  }

  /**
   * Create the canvas-backed screen renderer. The ONLY DOM-touching code in
   * this package, and only inside this function — module import stays
   * node-safe for tests and SSR.
   */
  export function createScreenRenderer(opts: ScreenRendererOptions = {}): ScreenRenderer {
    const scale = Math.max(1, Math.floor(opts.scale ?? 1));
    const fg = parseHexColor(opts.fg ?? LCD_FG);
    const bg = parseHexColor(opts.bg ?? LCD_BG);
    const welcomeText = opts.welcomeText ?? "Welcome!";

    const fb = new Framebuffer();
    const canvas = document.createElement("canvas");
    canvas.width = fb.width * scale;
    canvas.height = fb.height * scale;
    const ctx = canvas.getContext("2d");
    if (ctx === null) throw new Error("2D canvas context unavailable");
    const image = ctx.createImageData(canvas.width, canvas.height);

    let previous: Uint8Array | null = null;
    let version = 0;

    function paint(): void {
      const data = image.data;
      for (let y = 0; y < fb.height; y++) {
        for (let x = 0; x < fb.width; x++) {
          const color = fb.pixels[y * fb.width + x] === 1 ? fg : bg;
          for (let sy = 0; sy < scale; sy++) {
            for (let sx = 0; sx < scale; sx++) {
              const i = ((y * scale + sy) * canvas.width + x * scale + sx) * 4;
              data[i] = color[0];
              data[i + 1] = color[1];
              data[i + 2] = color[2];
              data[i + 3] = 255;
            }
          }
        }
      }
      ctx.putImageData(image, 0, 0); // ctx is a narrowed const — null was thrown above
    }

    function samePixels(a: Uint8Array, b: Uint8Array): boolean {
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
      }
      return true;
    }

    return {
      canvas,
      get version(): number {
        return version;
      },
      render(screen: ScreenModel): void {
        renderScreen(fb, screen, { welcomeText });
        if (previous !== null && samePixels(previous, fb.pixels)) return;
        previous ??= new Uint8Array(fb.pixels.length);
        previous.set(fb.pixels);
        paint();
        version += 1;
      },
    };
  }
  ```

- [ ] **Step 4: Append to `packages/phone-screen/src/index.ts`:**

  ```ts
  export { createScreenRenderer } from "./renderer";
  export type { ScreenRenderer, ScreenRendererOptions } from "./renderer";
  ```

- [ ] **Step 5: Run & expect PASS:** `mise exec -- vp run @hellotimber/phone-screen#test` (the jsdom file runs in jsdom via its docblock; everything else stays in node)
- [ ] **Step 6: Run `mise exec -- vp check --fix`** — expect pass (fix any reported lint nits without changing behavior).
- [ ] **Step 7: Commit:**

  ```sh
  git add packages/phone-screen
  git commit -m "feat(phone-screen): add createScreenRenderer canvas wrapper"
  ```

---

### Task 14: Full-suite verification, README, plan status

**Files**

- Create: `packages/phone-screen/README.md`
- Modify: `docs/plans/README.md`

**Steps**

- [ ] **Step 1: Run the package suite:** `mise exec -- vp run @hellotimber/phone-screen#test` — expect ALL tests green.
- [ ] **Step 2: Run the workspace suite:** `mise exec -- vp run -r test` — expect green (other packages' suites must be unaffected).
- [ ] **Step 3: Run `mise exec -- vp check --fix`** — expect pass.
- [ ] **Step 4: Write `packages/phone-screen/README.md`** (standalone usage — rule: every package works outside this repo):

  ````md
  # @hellotimber/phone-screen

  Rasterizes a Nokia 3310 `ScreenModel` (from `@hellotimber/phone-core`, **types
  only** — no runtime dependency) into an 84×48 monochrome framebuffer and
  presents it on a 2D canvas with the classic green LCD palette.

  ## Usage

  ```ts
  import { createScreenRenderer } from "@hellotimber/phone-screen";

  const renderer = createScreenRenderer({
    scale: 1, // canvas stays 84×48; upscale with CSS image-rendering: pixelated
    // fg: "#43523d", bg: "#c7f0d8",       // green LCD default
    welcomeText: "Hello!", // boot welcome note
  });
  document.body.append(renderer.canvas);

  let lastVersion = renderer.version;
  function frame(): void {
    renderer.render(phone.screen); // any phone-core ScreenModel
    if (renderer.version !== lastVersion) {
      lastVersion = renderer.version; // e.g. texture.needsUpdate = true in three.js
    }
    requestAnimationFrame(frame);
  }
  frame();
  ```

  `render()` repaints and bumps `version` only when the output actually changes,
  so it is safe to call every animation frame.

  ## Node / headless use

  Everything except `createScreenRenderer` is DOM-free. Draw into a
  `Framebuffer` directly and read `framebuffer.pixels` (one byte per pixel,
  row-major, 0/1):

  ```ts
  import { FONT, Framebuffer, renderScreen } from "@hellotimber/phone-screen";

  const fb = new Framebuffer(); // 84×48
  renderScreen(
    fb,
    { kind: "standby", carrier: "LACHLAN", signal: 4, battery: 4 },
    {
      welcomeText: "Hello!",
    },
  );
  fb.drawTextCentered(FONT, "overlay", 24);
  console.log(fb.pixels.length); // 4032
  ```

  ## Testing

  `vp test run` (or `pnpm test`). Pixel-level tests run in node; the canvas
  wrapper test uses jsdom with a stubbed 2D context.
  ````

- [ ] **Step 5: Update the plan index:** in `docs/plans/README.md`, change the Status cell of the row `| 02  | [phone-screen](./02-phone-screen.md) | ... | not started |` from `not started` to `done`.
- [ ] **Step 6: Commit:**

  ```sh
  git add packages/phone-screen/README.md docs/plans/README.md
  git commit -m "docs(phone-screen): standalone usage README; mark plan 02 done"
  ```
