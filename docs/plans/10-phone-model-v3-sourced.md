# Plan 10 — `@hellotimber/phone-3d` model v3: the sourced CGTrader mesh

> **For agentic workers:** execute task-by-task; tick checkboxes; commit per task.
> If this plan contradicts VISION.md contracts or the code, STOP and report.

**Prerequisites:** plan 09 done (v2/v2.1 procedural model in production).
**History:** plan 09's addendum lists the sourcing checklist; Lachlan purchased
CGTrader item #5212540 ("Nokia 3310 classic color" by domeyarmyen, Royalty Free
license, order 17445971 — keep the invoice). It **passed** the checklist after
scripted surgery (2026-07-01).

## The asset (already prepared — do not redo)

Local, gitignored working files in `nokia-3310/3dmodel/`:

- `uploads_files_5212540_Nokia_3310_Complete.blend` — the purchased source
  (1.47 GB, Cycles; low-poly ~14.8k verts + scene props + 8K texture zip).
- `/tmp/build_glb.py` era surgery (re-runnable; script content reproduced in
  the appendix below): drops camera/lamps/floor/internals, splits the merged
  `Main_Button` into 14 loose parts, auto-names keys by measured position map,
  bisects the up/down rocker into `key_up`/`key_down` (duplicate + clear-side
  bisect through the wedge gap, normal (1,0,1)), renames the rest, exports GLB
  (`export_image_format="NONE"` — we re-dress all materials in three).
- **`nokia3310-v3.glb` — the integration asset**: 490 KB Draco. 24 named
  nodes; ALL 17 controls separate: `key_0`…`key_9`, `key_star`, `key_hash`,
  `key_c`, `key_up`, `key_down`, `key_navi`, `key_power`; plus `body`
  (front+back shells), `island` (chrome plate), `screen` (the lit display
  plane, 84×60 mm), `screen_glass`, `badge`, `badge_logo`, `side_cap`.
  Verified loading in three.js r184 + DRACOLoader; keys protrude through the
  shell cutouts at correct fan positions (glTF: y=height, keys toward +z).
  ⚠️ Compress with `gltf-transform draco` ONLY — the `optimize` command joins
  meshes by material and destroys the named separation (verified failure).

Model scale is ~2.37× life (body 270 mm tall); orientation y-up after export.
The existing `Nokia3310` normalization (scale to STAGE_HEIGHT) absorbs both.

## Goal

Swap the v2.1 procedural geometry for the sourced mesh **behind the unchanged
`Nokia3310Props` contract**, keeping everything plan 09 built: per-key depress
(pointer + `pressedKeys`), per-key green backlight, the 84×48 CanvasTexture
LCD, `onKey` semantics, no runtime calibration. The v1 glTF era's workarounds
(hotspots/calibration) must NOT return — per-key named nodes make them
unnecessary.

## Architecture

- The GLB ships from `website/public/models/nokia3310-v3.glb` + Draco decoder
  (as in the v1 era — restore the `modelUrl`/`dracoPath` props to
  `Nokia3310Props` and the host-serves-assets README section; VISION update in
  Task 1). Copy the decoder trio from three's `examples/jsm/libs/draco/` (or
  gstatic-pin) into `website/public/draco/` and the package demo `public/`.
- `Nokia3310.tsx` loads via drei `useGLTF`, clones, normalizes scale, then
  **adopts named nodes**: each `key_*` node is re-parented into a `<Key/>`
  wrapper that keeps ALL v2 interaction code (pointer capture, StrictMode-safe
  emit guard, depress lerp along the key's local protrusion axis, emissive
  drive). `layout.ts` shrinks to the key-name↔`Nokia3310Key` map + travel
  constants; the extrude/shape builders and the legend atlas decal planes are
  deleted (legends are modeled/textured into the mesh — verify visually; if
  the stripped-material mesh has no printed legends, keep the atlas decal path
  for digits as a fallback Task).
- **Materials**: re-dressed in code exactly like v2.1 (`materials.ts` palette
  survives): body/face plastic, chrome island + keys, white navi + cyan bar
  (check whether the navi bar is modeled; if not, keep the v2 bar mesh),
  badge, dark screen surround. Per-key emissive = backlight (KEY_GLOW), LCD
  glow on `screen`.
- **LCD**: the `screen` node is the CanvasTexture target. Its UVs are the
  model's — inspect and REMAP in the load path (compute the node's UV bounds
  and rewrite to [0,1] so the 84×48 texture fills the visible display exactly;
  one-time, no calibration constants). `screen_glass` gets a subtle
  transmission/alpha material.
- Keep the v2.1 procedural implementation **in git history only** — this plan
  deletes it from `src/` like plan 09 deleted the v1 glTF path. If the sourced
  mesh disappoints at any gate, STOP and report rather than shipping both.

## Contract changes (Task 1, VISION.md first)

- `Nokia3310Props` regains `modelUrl?: string` and `dracoPath?: string`
  (host-served assets; defaults `/models/nokia3310-v3.glb`, `/draco/`).
- Everything else unchanged — `pressedKeys` stays honored.

## Tasks

### Task 1 — VISION + asset plumbing

- [x] VISION.md: re-add `modelUrl`/`dracoPath` to the phone-3d contract block
      with the new defaults.
- [x] Copy `nokia-3310/3dmodel/nokia3310-v3.glb` →
      `packages/phone-3d/public/models/` and `website/public/models/`; vendor
      the Draco decoder into both `public/draco/` dirs; restore the root
      vite.config comment about vendored decoders if lint flags them.
- [x] Commit: `feat(phone-3d): v3 asset + draco decoders (CGTrader #5212540, RF license)`

### Task 2 — node map + tests (TDD)

- [x] `src/layout.ts` v3: export `KEY_NODES: Record<Nokia3310Key, string>`
      (`"5" → "key_5"`, `"*" → "key_star"`, `"#" → "key_hash"`, etc.),
      `STATIC_NODES` (`body`, `island`, `screen`, `screen_glass`, `badge`,
      `badge_logo`, `side_cap`), KEY_TRAVEL (scale-relative: the model is
      ~2.37× life, travel must be computed against normalized size, not cm).
- [x] Rewrite `tests/layout.test.ts`: bijection between `ALL_KEYS` and
      `KEY_NODES` names; no duplicate node names across KEY_NODES ∪
      STATIC_NODES; names match `^[a-z_0-9]+$`.
- [x] Commit: `feat(phone-3d): v3 node map (named-mesh contract)`

### Task 3 — loader + assembly

- [x] Rewrite `Nokia3310.tsx`: useGLTF(modelUrl, dracoPath) → clone →
      normalize (existing STAGE_HEIGHT convention) → traverse: wrap each
      KEY_NODES mesh in the interaction `<Key/>` (depress axis = the node's
      protrusion direction, +z local), assign materials by node name from
      `materials.ts`, remap `screen` UVs to [0,1] and attach the CanvasTexture
      pipeline (NearestFilter, version-gated upload — reuse `Screen.tsx`
      logic against the mesh instead of a generated plane), glass material on
      `screen_glass`, `useGLTF.preload` at module scope.
- [x] Delete the now-dead procedural modules: shape builders in `Key.tsx`
      (keep the interaction shell), `PhoneBody.tsx`, `Screen.tsx` (logic moves
      into the loader), `legends.ts`/`atlas.ts` + their tests IF the mesh
      carries printed legends — **visual gate decides**; if legends are absent
      keep atlas decals positioned from key node bboxes.
- [x] Demo gate (`vp dev` + WebGL browser): all 17 keys present, click `5` →
      exactly `5 down`/`5 up` + visible depress; keyboard-held digits depress
      via `pressedKeys`; backlight toggle lights keys/LCD; test pattern
      pixel-crisp and correctly bounded on the display; no z-fighting.
- [x] Commit: `feat(phone-3d): v3 assembly — named-node keys, mesh LCD`

> **Task 3 deviations:** (a) pointer events are routed by ONE handler on the model
> root (`e.object` → `userData.keyId`), not per-key JSX handlers — one raycast
> surface, same semantics, StrictMode-safe held-refs; (b) the mesh ships without
> printed legends (they lived in the stripped textures), so the plan-09 atlas
> decals carry the print — parented to each key mesh so they inherit depress; key
> rotations are baked into vertices, so decals stay upright with no counter-
> rotation; (c) `screenBgColor` is accepted-but-unused (the mesh display has no
> surround gap — documented in types.ts); (d) `Keypad.tsx` deleted along with
> PhoneBody/Screen (keys render via the adopted nodes, not a JSX list).

### Task 4 — website integration + budget

- [x] Website needs no code change (`PhoneStageHost` passes no model props) —
      verify `mise exec -- vp run website#build` and record the lazy 3D chunk + GLB + decoder transfer sizes in the commit message (budget: chunk gz
      < 700 KB, GLB ≤ 500 KB).
- [x] Headed-browser walk on the site: boot, navigate by 3D clicks + keyboard,
      Lights setting toggles the backlight, side-by-side against
      `nokia-3310/nokia-3310-1.png`.
- [x] Screenshot evidence → `docs/plans/assets/model-v3.png` (+ backlight-off).
- [x] Update `docs/plans/README.md` (plan 10 row → done) and plan 09's
      "Future" section (mark: superseded by plan 10, executed).
- [x] Commit: `feat(website): phone model v3 live; mark plan 10 done`

> **Task 4 results (2026-07-01, headed browser):** lazy 3D chunk 258.45 kB gz
> (<700 budget), GLB 490 kB, decoders ~250 kB wasm+wrapper. 3D NaviKey clicks
> navigate the router (standby → /menu → /menu/phone-book with the LCD
> following); keyboard depress works; backlight off reads correctly. One
> post-gate fix (5786b3e): the display plane extends under the island frame and
> its authored UVs cropped the status bars — UVs are now planar-projected onto
> the visible aperture (SCREEN_APERTURE constants, measured once against the
> standby screen). Evidence: assets/model-v3.png, assets/model-v3-backlight-off.png.

### Post-gate refinement (2026-07-02, `3dc5560`)

Lachlan judged the full-aperture LCD too large. The display is now **two
layers** like the real phone: the model's oversized display plane wears the
dark bezel material (the surround band), and a generated child plane
(`lcd_pixels`) carries the CanvasTexture at `SCREEN_SCALE` (0.8) of the
visible aperture. The aperture UV remapping is gone (plane UVs untouched;
flipY back to standard). `SCREEN_SCALE` in layout.ts is the single sizing
knob; `SCREEN_APERTURE` still positions the aperture rect.

### Shell intersection repair (2026-08-20)

The sourced `Outer_Body` contains disconnected front and rear cover shells.
After subdivision, the rear shell crossed 4.9 mm into the front shell and
produced moving dark wedges along the upper side seams. The integration GLB
now compresses the rear shell's depth range so it ends 0.05 mm behind the
front seam while preserving its back extent. Reapply this separation before
the final `gltf-transform draco` step if the asset is regenerated.

## Done means

`vp run -r test`, `vp run website#build`, `vp check --fix` green; the public
contract equals VISION (with modelUrl/dracoPath restored); all Task 3/4 gates
pass; no hotspot/calibration code reappeared; the procedural v2.1 modules are
fully removed (git history keeps them); license invoice retained by Lachlan.

## Appendix — the surgery script (re-runnable)

Stored during the 2026-07-01 session; if `nokia3310-v3.glb` is ever lost,
re-run against the .blend: drop `Camera/Lamp*/Plane.005/Connector_Board*/
Cylinder/Electric_Surface/Speaker_Plate`; `separate(type='LOOSE')` on
`Main_Button`; name the 14 parts by nearest match to the measured centers
(x, z): C(-0.029, 0.110), rocker(0.023, 0.105), 1(-0.033, 0.083), 2(0, 0.080),
3(0.033, 0.083), 4(-0.030, 0.065), 5(0, 0.062), 6(0.030, 0.065),
7(-0.029, 0.047), 8(0, 0.043), 9(0.029, 0.047), \*(-0.028, 0.029), 0(0, 0.025),
#(0.028, 0.029); duplicate the rocker and bisect both copies at its center
with plane normal (1, 0, 1), `clear_outer` on one / `clear_inner` on the
other → `key_down` (lower-left), `key_up` (upper-right); rename
`OK_Button→key_navi`, `Power_Button→key_power`, `LED_Light→screen`,
`LED_Glass→screen_glass`, `Curve_Frame→island`, `Outer_Body→body`,
`Logo_plate→badge`, `Nokia_logo→badge_logo`, `Side_Cap→side_cap`; export GLB
y-up, no images; compress with `gltf-transform draco` (NEVER `optimize`).
