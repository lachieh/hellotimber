# Plan 09 — `@hellotimber/phone-3d` model v2: procedural Nokia 3310, per-key light & depress

> **For agentic workers:** execute task-by-task; tick checkboxes; commit per task.
> If this plan contradicts VISION.md contracts or the code, STOP and report.

**Prerequisites:** none (independent of plans 07/08 — parallel-safe except Task 9's small
`website/` touch; coordinate that one commit if 07/08 are in flight).
**History:** plan 03 built a procedural v1 from primitives; commit `22c10e2` replaced it
with a Sketchfab glTF; this plan replaces the glTF with a **properly crafted** procedural
v2. Read plan 03's "Post-completion history" section first.

## Why (visual evidence)

See `docs/plans/assets/model-v1-artifacts.png` (headed-browser screenshot, 2026-07-01):

- **Broken shading facets** sprawl across the whole keypad face — hard triangular
  artifacts from the asset's low poly count / damaged vertex normals. This is the
  "geometry around buttons" complaint and cannot be fixed without re-authoring the mesh.
- **Keys are blank ovals** — no digit/letter legends, none of the 3310's distinctive
  curved key shapes; the NaviKey cluster has black seams.
- **Keys cannot light up or depress**: the keypad is ONE fused mesh, so the backlight is
  faked (screen emissive + a point light) and the contract's `pressedKeys` prop is a
  silent no-op — a standing violation of VISION's "keypad with pressable meshes".
- ~440 lines of workaround code (`hotspots.ts`, `calibration.ts`, `CalibrationPanel.tsx`)
  and ~380 KB of assets (glb + Draco decoders, duplicated in `website/public/`) exist
  only to compensate for the fused mesh.

What already works and **must be preserved unchanged**: the 84×48 `CanvasTexture` LCD
pipeline (NearestFilter, version-gated re-upload) — see
`docs/plans/assets/lcd-authentic-carousel.png`; `PhoneStage` (Canvas, lights, idle sway,
reduced-motion gate); the `onKey` callback contract; the package's no-internal-deps rule.

## Goal

A convincing, artifact-free Nokia 3310 built **entirely in code**: beveled extruded body,
seventeen individually meshed keys with authentic shapes and printed legends, per-key
**green backlight** (keys + legends + LCD glow driven by `backlightOn`), real **depress
animation** on pointer AND via `pressedKeys` (keyboard presses visibly push keys), LCD
seated in true bezel geometry with zero runtime calibration. Delete the glTF, Draco,
hotspots, and calibration machinery.

## Architecture

- **1 world unit = 1 cm**; body `4.8 × 11.3 × 2.2` (spec §1), front face at z ≈ +1.1 —
  same frame as plan 03 so `PhoneStage`'s camera/lights carry over.
- **Everything positional is data** in `src/layout.ts` (node-tested, no three import):
  body silhouette control points, bezel rect, per-key `{ key, cx, cy, w, h, rot, shape }`.
  Seed the key positions by converting the **calibrated** fractions in the current
  `src/hotspots.ts` (they were hand-tuned against the real proportions — that effort is
  kept, then the file is deleted).
- **Geometry from 2D outlines**: `THREE.Shape` → `ExtrudeGeometry` with bevel
  (`bevelSegments ≥ 3`) for body front shell, face plate, bezel ring, and every key cap.
  Beveled extrusions give smooth silhouettes with correct normals — no facet artifacts by
  construction. Key `shape` variants: `pill` (digits — rounded lens, slight fan rotation
  like the real keypad), `crescent` (the wide blue NaviKey), `wing-l`/`wing-r` (C key and
  the ▲▼ pair curving around the NaviKey), `dot` (top power button).
- **Legends** (digits, letter triplets, `*`/`#`, NaviKey bar, NOKIA wordmark, earpiece
  slots): ONE shared canvas-drawn texture atlas (`src/legends.ts`, pure function →
  `HTMLCanvasElement`, drawn at 4× and mipmapped) UV-mapped onto thin planes floated just
  proud of each cap / the face. Legends use a second material whose `emissive` carries the
  backlight so the print itself glows green like the real phone.
- **Backlight**: `backlightOn` drives emissive on key-cap material, legend material, and
  the LCD glow plane (existing `BACKLIGHT_COLOR`/`SCREEN_DIM_TINT` constants in
  `materials.ts` stay the single source for colors). No point-light hack.
- **Depress**: each `<Key/>` lerps `z` by −0.04 (plan 03's Δz) toward pressed when
  `pointerDown ∪ pressedKeys.has(key)`; pointer events fire `onKey(key, "down"|"up")`
  with pointer-capture + `pointerleave` → synthetic `"up"` (no stuck keys).
- **Screen**: LCD plane position/size are layout constants matching the bezel opening —
  delete `SCREEN_ADJUST`, `?calibrate=1`, and all live-calibration state. Keep the
  `screenBgColor` fill behind the LCD (prop survives).

## Contract changes (update VISION.md in Task 1, before any code)

- `Nokia3310Props`: **remove `modelUrl` and `dracoPath`** (glTF-era additions; no asset
  to point at anymore). Keep `screenCanvas`, `screenVersion`, `onKey`, `backlightOn`,
  `pressedKeys`, `screenBgColor`. **`pressedKeys` is now honored** (it was contractually
  present but dead).
- Nothing else changes; the package still defines its own `Nokia3310Key` and has no
  internal deps (AGENTS.md boundary rules).

## Files at completion

```
packages/phone-3d/src/
├── index.ts            unchanged surface (minus removed props)
├── types.ts            Nokia3310Props without modelUrl/dracoPath
├── layout.ts           silhouette + bezel + KEY_LAYOUT (pure data)   ← new
├── legends.ts          canvas legend/atlas painter (pure, jsdom-testable) ← new
├── materials.ts        + emissive/backlight material specs (extended)
├── PhoneBody.tsx       extruded shell, face, bezel, NOKIA decal, earpiece ← new
├── Key.tsx             one extruded key: shape, legend UV, depress, events ← new
├── Keypad.tsx          KEY_LAYOUT → <Key/>                            ← new
├── Screen.tsx          LCD plane at layout position (CanvasTexture pipeline) ← new
├── Nokia3310.tsx       assembly (rewritten, ~⅓ current size)
├── PhoneStage.tsx      unchanged (verify only)
└── demo/               main.tsx gains pressedKeys + backlight toggles
DELETED: hotspots.ts, calibration.ts, CalibrationPanel.tsx,
         public/models/**, public/draco/**  (also website/public/{models,draco}/**)
```

## Conventions for every task

- Repo root; `mise exec --` prefix. After each task: `mise exec -- vp check --fix` +
  `mise exec -- vp run @hellotimber/phone-3d#test` green.
- Visual gates run the package demo: `cd packages/phone-3d && mise exec -- vp dev`
  (needs a WebGL browser — **headless Chromium on this machine has no WebGL**; use a
  headed browser). Stop the server after verifying.
- 3D can't be jsdom-tested (integration-notes §6): pure data/canvas modules get unit
  tests; meshes get demo checklist gates. Commit per task: `feat(phone-3d): <what>`.

## Tasks

### Task 1 — VISION.md + layout data (TDD)

- [x] Update VISION.md per "Contract changes".
- [x] Write failing `packages/phone-3d/tests/layout.test.ts`: KEY_LAYOUT has exactly the
      17 `ALL_KEYS` entries, unique; XY bounding boxes (rotation-aware) don't overlap;
      digit rows fan symmetrically (rot(1) = −rot(3) etc.); every key inside the face
      bounds; bezel rect inside the face; LCD rect inside the bezel with even margins.
- [x] Write `src/layout.ts` — convert `hotspots.ts` calibrated fractions into cm-space
      entries + silhouette/bezel/LCD constants (document the conversion in a comment).
- [x] Test green. Commit: `feat(phone-3d): v2 layout data from calibrated hotspots`

### Task 2 — legends atlas (TDD)

- [x] Failing `tests/legends.test.ts` (jsdom env for this file via vite config
      `test.environmentMatchGlobs` — canvas 2D only, no WebGL): atlas canvas is created
      at the declared size; every key id has a UV entry within [0,1]²; digit cells are
      non-blank (sample pixels); `2`/`abc`-style letter triplets present for 2–9;
      `0` carries the space glyph hint, `#`/`*` and NaviKey bar present.
- [x] Write `src/legends.ts` (pure painter, tall-narrow Nokia-ish print, white-on-
      transparent so material color/emissive tint it).
- [x] Test green. Commit: `feat(phone-3d): key legend + face decal atlas`

> **Executed with a deviation:** jsdom in this repo has no real 2D context
> (phone-screen mocks `getContext`), so pixel sampling was replaced by a
> node-env recording-stub `Ctx2D`; the painter draws through that interface
> and `createLegendAtlas()` binds it to a real canvas in the browser.

### Task 3 — body

- [x] Write `src/PhoneBody.tsx`: front shell from the silhouette `Shape` (extrude +
      bevel), flat back shell, face plate, bezel ring with recessed opening, earpiece
      slot decals + NOKIA wordmark from the atlas. Materials from `materials.ts`
      (extend with `keyTop`, `legend`, emissive fields — keep the existing dark-blue
      Xpress-on palette).
- [x] Demo gate: body renders with **smooth, artifact-free shading** (orbit in the demo;
      compare against `assets/model-v1-artifacts.png` — no facets), correct proportions
      vs spec §1.
- [x] Commit: `feat(phone-3d): extruded beveled body, bezel, face decals`

> **Note:** the visual gate for Tasks 3–6 ran as one consolidated headed-browser
> session after Task 6's assembly (the demo can only show the v2 model once it
> exists); code + tests still committed per task. Shared three-side atlas helpers
> live in `src/atlas.ts` (one texture, per-cell UV geometries) — small addition to
> the file list.

### Task 4 — keys: shapes, legends, depress, events

- [x] Write `src/Key.tsx` + `src/Keypad.tsx` per Architecture (extruded shape variants,
      legend plane from atlas UV, depress lerp, pointer events with capture/leave, cursor
      pointer on hover).
- [x] Demo gate: click `5` → key visibly depresses, log shows `5 down`/`5 up`; drag off a
      pressed key → still releases; all 17 keys present with crisp legends; digit fan
      matches the real keypad's curve; NaviKey is the wide blue crescent.
- [x] Commit: `feat(phone-3d): per-key meshes with legends, depress, pointer events`

### Task 5 — backlight

- [x] Drive key-cap emissive, legend emissive, and LCD glow from `backlightOn` (colors
      from `materials.ts`; extend `tests/materials.test.ts` for the new spec fields).
      Screen-off tint keeps using `SCREEN_DIM_TINT`.
- [x] Demo gate: toggling backlight visibly lights **every key and legend** green and the
      LCD glow; off-state still readable (dim), exactly like a real 3310 losing its light.
- [x] Commit: `feat(phone-3d): per-key green backlight`

### Task 6 — screen + assembly

- [x] Write `src/Screen.tsx` (CanvasTexture pipeline copied from the current
      `Nokia3310.tsx` — NearestFilter, no mipmaps, version-gated `needsUpdate`,
      `screenBgColor` fill) positioned purely from `layout.ts`; rewrite
      `src/Nokia3310.tsx` as the thin assembly (body + keypad + screen + `pressedKeys`
      plumbing). Delete `SCREEN_ADJUST` and every calibration reference.
- [x] Demo gate: test-pattern renders pixel-crisp inside the bezel with even margins at
      several window sizes; frame counter proves re-upload; no z-fighting.
- [x] Commit: `feat(phone-3d): LCD seated in bezel geometry; v2 assembly`

> **Gate passed 2026-07-01** (consolidated for Tasks 3–6, headed browser):
> `assets/model-v2.png` (backlight on) and `assets/model-v2-backlight-off.png`.
> Click on '5' logged exactly `5 down`/`5 up`; keyboard-held keys depress via
> `pressedKeys`; LCD test pattern pixel-crisp with a live frame counter; no
> shading artifacts. Gate-driven fixes: legends laid out horizontally +
> aspect-correct band UV mapping, upright (counter-rotated) print, print stays
> dark vs glowing caps, power target doubles as the earpiece grille, StrictMode
> emit-guard moved to a ref (was double-firing 'up').

### Task 7 — delete the glTF era

- [ ] Delete `src/hotspots.ts`, `src/calibration.ts`, `src/CalibrationPanel.tsx`,
      `tests/hotspots.test.ts`, `packages/phone-3d/public/models/`,
      `packages/phone-3d/public/draco/`, `website/public/models/`,
      `website/public/draco/`; remove `useGLTF`/draco imports, the `?calibrate` handling,
      the model credit in `README.md` (replace with a "fully procedural" note + props
      table), and the root `vite.config.ts` fmt/lint exclusion for `public/**` if nothing
      else needs it.
- [ ] `grep -rn "draco\|useGLTF\|modelUrl\|hotspot\|calibrat" packages website/src` → no
      hits (except this plan + plan 03 history).
- [ ] Full run: `mise exec -- vp run -r test` green.
- [ ] Commit: `feat(phone-3d): remove glTF model, draco decoders, calibration machinery`

### Task 8 — demo polish + README

- [ ] Demo (`src/demo/main.tsx`): add a `pressedKeys` playground (hold a docs-listed
      keyboard key → the 3D key depresses without pointer), backlight toggle stays.
- [ ] README: usage outside the repo, props table (no asset serving section anymore).
- [ ] Commit: `feat(phone-3d): v2 demo + README`

### Task 9 — website integration

- [ ] `website/src/phone/PhoneStageHost.tsx`: maintain a `pressedKeys` set from the
      keyboard funnel (key down adds, up removes — map via the existing
      `attachKeyboard` mapping) and pass it to `<PhoneStage/>`; no other website change
      (the removed props were never passed by the host).
- [ ] Verify the lazy 3D chunk budget from plan 06 still holds (it will shrink —
      record the new gz size in the commit message): `mise exec -- vp run website#build`.
- [ ] Headed-browser walk on `vp run website#dev`: keys light with Settings → Phone
      settings → Lights off/on; keyboard digits visibly depress keys; clicking keys
      navigates; LCD crisp; **no keypad shading artifacts** (side-by-side with
      `assets/model-v1-artifacts.png`).
- [ ] Update `docs/plans/README.md` status for plan 09 → done.
- [ ] Commit: `feat(website): keyboard-driven key depress; mark plan 09 done`

## Done means

All 9 tasks committed; `vp run -r test`, `vp run website#build`, `vp check --fix` green;
the package still proves itself standalone via its demo (AGENTS.md rule 3); the public
surface equals the updated VISION contract; **zero** glTF/Draco/calibration bytes remain
in the repo; and the Task 9 visual checklist passes — beveled artifact-free keypad,
legends, green per-key backlight, and keys that move when pressed by mouse or keyboard.
