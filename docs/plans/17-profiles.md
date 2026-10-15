# Plan 17 - Profiles

> **For agentic workers:** execute task-by-task; tick checkboxes; commit per task.
> If this plan contradicts VISION.md, AGENTS.md, or the code, STOP and report.

**Prerequisites:** plans 13, 14, 15 and 23 complete; plan 16 complete (this plan uses only
`StockSounder` as shipped by its Task 9). Task 8
(Rename) also needs plan 18 Tasks 5-7 (the multi-tap engine and `textInput`). Plan 18 Task 4
adds the "standby application" activation and `standbyIndicators`; whichever plan's kernel task
lands first adds them, the other reuses them (Task 4).
**Structural convention:** the per-plan file split lands before this plan is implemented.
Acceptance tests go in `packages/nokia-os/tests/acceptance/17-profiles.test.ts`, behaviour in
`packages/nokia-os/src/firmware/features/profiles.ts`, the capture set in
`packages/nokia-os/scripts/capture-sets/17-profiles.ts`, spec facts in
`docs/specs/stock/profiles.md`. Shared files get one-line registrations only, except the edits
listed under "Shared-file edits", each named with its reason.
**Ground truth:** the v6.39 emulator corpus at
`REF=/Volumes/SSD/Projects/lachieh/hellotimber/nokia-3310` (gitignored, main checkout only). Read
`$REF/captures/README.md` ("Plan 14", "Plan 15" and "Plan 16 supplementary captures"), plans 13,
14, 15, 16 and 18 in full before starting. The planning probes are in
`$REF/captures/scratch-plan17/` (`NOTES.md`, `probe-{a,b,c,d}.cap`, `out-{a,b,c,d}/`): evidence for
this plan only, never imported. Task 0 writes the canonical captures to `$REF/captures/6.39/plan17/`.
**Status:** in progress (Task 0 captured; Task 1 contracts documented).

## Goal

Give `@hellotimber/nokia-os` the stock v6.39 Profiles, pixel- and timing-faithful to the captures:

- **Activate** (12-n-1): the `Selected profile:` note, then standby showing the active profile's
  name under the operator and, for Silent, the standby icon;
- **the active profile** as stored state: Tones (5-1…5-9) read and write the active profile's
  Personalise settings, so keypad tones, warning tones, previews, the vibrator, game shakes and
  later plans' ringing and message alerts follow the profile with no plan 16 change;
- **the power key's short press at standby**: the `Switch off!` / profiles list, choosing a
  profile, and switching the phone off from it;
- **Rename** (12-2…6-2-10): the `New name:` text input (plan 18's widget), `Done`, the new name
  everywhere a profile's name is drawn, and the empty name restoring the default;
- persistence in the settings record, Restore factory settings resetting the active profile and
  the names, and goldens for all of it.

The website does not change (D14).

## Why this plan exists (measured gap)

| Area                  | nokia-os after plans 13-16                                   | v6.39 evidence                                                                                                                                                         |
| --------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Activate (12-n-1)     | placeholder (`pending:17`, 6 LCD + 6 sound goldens)          | `Selected` / `profile:` / name, long tick (≈690/232/1975 ms), a 9 ms edges step, standby; the name appears under the operator ≈1.91 s later (`plan14/open/12-n-1`, P1) |
| Active profile        | none: Tones alias General's settings statically (plan 14 D9) | with Silent active, every Tones page shows Silent's value and Tones › Keypad tones writes Silent's (P2)                                                                |
| Standby               | operator, clock, ladders                                     | a profile line in the small face under the operator for every profile but General; a top-left icon for Silent (P1, P9)                                                 |
| Power key short press | nothing (the kernel only long-presses power)                 | at standby: `Switch off!`, General, Silent, Discreet, Loud, (empty), (empty), rows, soft key `OK`, no indicator (P4)                                                   |
| Rename (12-n-2-10)    | first screen only, entry inert (plan 14 D11)                 | multi-tap `abc` input, 10 characters, `Done`, the name in the Profiles list, the power list, the note, standby and the Rename page (P6)                                |
| Profiles level        | opens on General; labels are the tree's                      | labels are the stored names (`Silenth`); the level opens on the active profile (P3; conflicting after a power cycle, Open question 1)                                  |
| Beeps                 | a key beeps at the active profile's level when it goes down  | the key that activates a profile already beeps at the **new** profile's level (`sound/note/12-n-1`: Discreet 0x9108, Loud 0x9100, Silent silent)                       |

## Planning investigation (2026-10-14)

Probes in `$REF/captures/scratch-plan17/` on plan 15's factory-restored image (`NOTES.md` has the
commands; ≈8 min wall in all), plus the existing virgin captures `plan14/open/12-*`, plan 15's
`accept/c4-*` and plan 16's `boot/power-key` and `notes/12-n-1`.

| #   | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Evidence                                                                       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| P1  | Activate (virgin and factory, every slot): `Selected` / `profile:` / name in the large face with the tick (box 683-696, half 218-240, full 1960-1987 ms), a 8-9 ms edges step, standby with the operator only, then ≈1897-1930 ms later the name centred under the operator in the small face (`Silent`, `Loud`, `(empty)`, slot 6's two U+E000 boxes). General shows no name. After a menu round trip (Menu, C) standby again shows the operator only and the name 1929 ms later; after a power cycle 2335 ms later (that run ended in the clock wizard and C held).                                                                                                                     | `plan14/open/12-n-1`, `out-a/a/{activate-*,menu-roundtrip,standby-after-boot}` |
| P2  | Tones are the active profile's: with Silent active Tones shows Nokia tune, Level 1, Off, No tone, Off, Off, Off, On (Silent's factory values); Tones › Keypad tones → Level 3 makes Silent's list open on Level 3 and leaves General's on Level 2.                                                                                                                                                                                                                                                                                                                                                                                                                                        | `out-a/a/1*.png`, `2*.png`                                                     |
| P3  | The Profiles level (Menu 1 2) opened on the active profile in four runs (Silent, Discreet after a power cycle, slot 6, Silent), but on General after another power cycle with Silent active (`out-c/c/51-*`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `out-a/a/03-*`, `42-*`, `out-b/b/in-profiles`, `out-c/c/42-*`, `51-*`          |
| P4  | Power key at standby: on its key-down (list drawn 95 ms in, released at 100 ms) standby's ladders are erased for ≈30 ms, then a rows list `Switch off!`, General, Silent, Discreet, Loud, (empty), (empty) on `Switch off!` (also with Silent active), soft key `OK`, the rail, no indicator, the circular window of plan 14 D3. The key beeps at the keypad level. ▲/▼ move; a further power press moves down; a digit chooses the entry at that position at once (`3` → `Selected profile: Silent`); C returns to standby (a 70 ms frame without the operator first); 40 s idle changes nothing. In the carousel, a submenu or an option list the power key's short press does nothing. | `out-b/b/{list-*,scroll-general,power-twice,digit,c-on-list,idle,in-*}`        |
| P5  | Choosing a profile in the power list plays Activate's note and standby (same timings). `Switch off!` + OK switches off ≈31 ms after the OK, with no note; the power-off tone (900 Hz 0x9105) replaces OK's beep.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `out-b/b/{choose-*,switch-off}`                                                |
| P6  | Rename: `New name:` with the name, cursor at its end, `abc` (lower case), counter `10 - length`; multi-tap; at 0 left further keys are ignored; OK → `Done` (tick, ≈700/219/555 ms) → the Rename page with the new name. Hold C to empty: the mode becomes `Abc`, counter 10; OK on an empty name → `Done` and the default name (`Silent`) again. C deletes, C on an empty entry returns to the page, name unchanged. The new name shows in the Profiles list, the profile's level, the power list, the note, standby, and survives a power cycle. Restore resets names (plan 15: `Silenth` → `Silent`; slot 6 → `(empty)`).                                                              | `out-c/c/*`, `plan15/accept/c4-*`                                              |
| P7  | Activation and persistence: the active profile survives a power cycle (the name on standby after boot); Restore factory settings makes General active (no name; Keypad tones Level 2).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `out-a/a/4*.png`, `5*.png`                                                     |
| P8  | Effects (factory): with Silent active keys and `Invalid shortcut` are silent; after Tones › Keypad tones → Level 3 they beep at 0x9100; with Loud active keys beep at 0x9100 and `Invalid shortcut` sounds 1750 Hz. The Activate key itself beeps at the new profile's level (also in `goldens/sound/note/12-n-1`, pending:17).                                                                                                                                                                                                                                                                                                                                                           | `out-a/a/*.events.csv`                                                         |
| P9  | Standby icon (a top-left glyph at x ≈7..13, y 0..5): shown at once with standby for factory Silent; not for Silent with Incoming call alert Ringing; not for General with No tone, nor with alert Off + No tone, nor for slot 6 with alert Off or Beep once.                                                                                                                                                                                                                                                                                                                                                                                                                              | `out-a/a/02-*`, `out-d/d/0*`, `out-b/b/general-alert-*`                        |
| P10 | With Discreet active, the operator line is overwritten ≈15 ms (after Activate) or ≈2.8 s (after a setting change) after the name appears: only its bottom rows remain; it stays so for 20 s. Silent, Loud, `Silenth` and slot 6 never show it.                                                                                                                                                                                                                                                                                                                                                                                                                                            | `out-a/a/40-*`, `out-b/b/discreet-standby`, `out-d/d/discreet-*`               |
| P11 | v6.39 has six slots (General, Silent, Discreet, Loud, `(empty)`, slot 6). There is no Meeting, Outdoor or Pager profile (later Nokia firmware) and no timed profile. General has no Rename (12-1-2 stops at 9).                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `docs/specs/nokia-3310-menu-tree.md` "12 Profiles"                             |

Conclusions:

1. **A profile is its Personalise settings plus a name.** Every audible difference between
   profiles comes from the settings Tones alias (P2, P8), so "Silent" is Silent's stored values,
   not a mode. Making the alias follow the active profile is the whole effect.
2. **Standby gains two profile-driven elements** (the name line and the icon) and the power key
   gains a standby application. Both need opt-in kernel seams.
3. **Labels become stored text.** A renamed profile's name is drawn in a kernel list (Profiles),
   so phone-core needs an opt-in label reader; slugs and paths do not change.

## Scope and non-goals

In scope: the Goal items; Task 0 captures; five opt-in phone-core seams (Contract changes);
goldens, glyphs, sprites and timings; the demo's profile line; documentation.

Not in scope (owner in brackets): ringing an incoming call with the active profile (22), the
message arrival alert (18), the screen saver itself (unowned; noted in follow-ups), Personalise's
lists (done by plans 14-16: each already stores per profile and previews per D9 of plan 16),
keyguard and backlight (25), Cyrillic names (26), any website change.

## Decisions

Each decision states what changes relative to the brief and to plans 13-16 and 18.

**D1 - The active profile is a stored choice; Tones alias it dynamically (revises plan 14 D9,
plan 15 D3).** The settings record gains the single choice `profiles/active` (six options in slot
order: `general`, `silent`, `discreet`, `loud`, `empty`, `empty-2`; virgin and factory `general`,
P7). `settingAlias`'s fixed target `profiles/general/personalise/` becomes
`profiles/<active slug>/personalise/`: Tones keys read and write the active profile's settings
(P2). Composer (5-4) keeps no alias. Records already store aliased keys under their target, so no
record changes shape: a virgin or plan 15 record decodes unchanged (no version bump; a record
without `profiles/active` is General). `settingsRecordKeys()`'s pinned snapshot gains the key.

**D2 - Names are the Rename pages' texts (new).** A profile's name is the text
`profiles/<slug>/personalise/rename` (already a virgin text: `Silent`, `Discreet`, `Loud`,
`(empty)`, slot 6's two U+E000 boxes). General's is the constant `General` (no Rename, P11).
`profileName(slug)` is the one reader; every place that draws a name uses it (P6). OK on an empty
name writes the slot's default (P6: `Silent`; slot 6's default is `(empty)`, the factory name,
UNVERIFIED until Task 0 R5). Restore resets names (plan 15 D5, unchanged), and the factory text of
slot 6 is `(empty)`, not the virgin boxes (plan 15 Task 0c): a `FACTORY_TEXTS` table beside
`FACTORY_DEFAULTS`.

**D3 - Activate is a long-tick note, then standby (new; replaces the plan 14 placeholder).**
12-n-1 stores `profiles/active`, plays `Selected` / `profile:` / name with its own captured
timeline (P1; the six `tree/12-profiles/12-n-1.leaf` goldens become asserted, so their
timelines generate as for every leaf), and ends with the note's edges step to standby (6-2-4-1's
`standby` end). The choice is stored when the note opens, so its standby and its beep follow it.

**D4 - The activating key beeps at the new profile's level (new; plan 16 D8 applied).** The
firmware switches the profile before the key's beep (P8). nokia-os opens a leaf on the key's
release, after its beep, so `features/profiles.ts` exports `activationBeep(phone, settings)`: for
Navi on an Activate row (path `menu/profiles/<slug>`, selection 0), on a power-list entry, or a
digit in the power list, it returns that profile's Keypad tones option, and the wrapper passes it
to the existing `StockSounder.keyBeepLevel` before `keyDown` (the Keypad tones list's mechanism).
A shortcut digit that ends on Activate (`Menu 1 2 2 1`) beeps as Task 0 records (A6).

**D5 - Standby shows the active profile's name after a delay (new; kernel seam 1).** The kernel
re-reads `PhoneConfig.standbyLine(shownMs)` on every tick, `shownMs` being the time since standby
was last entered; nokia-os returns the name once `shownMs ≥ PROFILE_LINE_DELAY_MS`, else
undefined, and nothing for General. The stock painter draws it centred in the small face under
the operator (Task 3 measures the top). `PROFILE_LINE_DELAY_MS` is measured by Task 0 for every
way into standby (the note's end, C from a menu, C held, the power list's C, boot); one constant if
they agree within ±25 ms, else one per entry, each generated from its goldens (Deviation).

**D6 - The standby icon follows a rule Task 0 decides (new; kernel seam 2).** P9 rules out "Incoming
call alert Off". Provisional rule (fits P9): the icon shows while the active profile's Incoming
call alert is Off, its Message alert tone is No tone and its Keypad tones are Off. Task 0 (A3) runs a
matrix and fixes the rule; the sprite is cropped from a golden. It reaches the painter as
`StandbyIndicators.silent` (plan 18's reader, extended).

**D7 - The power-key list is a standby application (new; kernel seams 3 and 4).** `PhoneConfig
.standbyPower` names an application the kernel opens on the power key's **key-down** at standby,
as a standby application (empty stack, path stays `standby`, `exit()` returns to standby; plan 18
D11's activation). The power key's long press still powers off from it (kernel rule). The list
reuses `OptionListWidget` with numbering `none` (no indicator, P4), opens on `Switch off!`, moves
with ▲/▼ and the power key's key-down, chooses with OK or a digit (position), and C exits. A profile
runs D3's flow. `Switch off!` calls `ApplicationContext.powerOff()` ≈31 ms after the key (P5;
nokia-os powers off at the key, the latency is not reproduced, plan 14 D8). Its leading 30 ms
"ladders erased" frame and C's 70 ms operator-less frame are reproduced as captured frames, as
Menu's 39 ms frame is (Task 3 decides whether a `standby leaving` model or a widget `image` step).
Elsewhere the short press does nothing (P4); during a note or a notice at standby Task 0 records it
(B6).

**D8 - Labels from a reader (new; kernel seam 5).** `SubmenuOptions.label?(child)` returns the text
a child shows in its level's list and as its own level's title; re-read on every tick. The Profiles
level uses `profileName`. The Profiles level opens on the active profile (P3, provisional: Open
question 1).

**D9 - Rename is plan 18's `textInput` (new; needs plan 18 Task 7).** The prompt keeps plan 14's
measured layout; `textInput` adds the entry: limit 10, lower case `abc` with text and `Abc` when
empty (P6), extra keys at the limit ignored, C/held C/C on empty as plan 18 measures. OK writes the
name (D2) and plays `Done` with the captured timeline, then the page. The first screens of
12-3…6-2-10 (`plan14/open/12-n-2-10`, captured but never imported because they lie under
`SAME_AS`) become asserted goldens, replacing plan 14's `layoutOf` guess (subtract). If plan 18
Task 7 has not landed, Task 8 waits; everything else ships.

**D10 - Discreet's operator line (P10) is a Task 0 question.** Task 0 (A4) decides what triggers
it (the name, its width, Discreet's settings, time). If it is a deterministic function of state, it
is reproduced as captured (a painter rule, golden-backed); if Task 0 cannot pin it, its goldens are
known gaps with the reason, and the spec lists it.

**D11 - Effects need no plan 16 change (confirms plan 16 "Follow-up plan adjustments").** Keypad
tones, warning tones, previews' vibrator, game shakes, and later `ring(prefix)` /
`messageAlert(prefix)` read `tones/*`, which D1 points at the active profile. Task 6 pins P8 with
sound goldens (`sound/note/12-n-1`, Task 0's `effects/*`).

**D12 - Storage (continues plan 15 D2).** No new record: `profiles/active` and the names live in the
settings record. Restore resets both (P7, plan 15). Persistence across a reboot is asserted as
plan 15's `probe/persist-reboot` was (two phones over one storage).

**D13 - Meeting, Outdoor and Pager do not exist on v6.39 (the brief's list).** The brief asks for
"Silent/Meeting/Outdoor/Pager effects"; v6.39 has General, Silent, Discreet, Loud and two
`(empty)` slots (P11). Their effects are D11's.

**D14 - The website does not change.** phone-core's seams are opt-in; the website sets none (its
"Profiles visitor modes" stretch idea in VISION is untouched). `git diff --stat <commit before
Task 1> -- website/` is empty at the end.

## Ground truth and artefacts

| Source (`$REF/captures/`)                         | Contents                                                | Use                                                   |
| ------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------- |
| `6.39/plan14/open/12-n-1`, `12-n-2-10` (existing) | virgin Activate notes and standby; Rename first screens | `tree/*` goldens (asserted), `profiles/rename-open-*` |
| `6.39/plan16/notes/12-n-1`, `boot/power-key`      | Activate and power-key beeps (factory)                  | `sound/*` goldens, pending:17 → asserted              |
| `6.39/plan15/accept/c4-12-2-2-10-*`               | Rename `Silenth`, Restore resetting it                  | cross-check of P6                                     |
| `scratch-plan17/` (planning)                      | P1-P11                                                  | evidence only; never imported                         |
| `6.39/plan17/` (Task 0)                           | canonical recordings below                              | goldens                                               |

Artefacts (spec, Task 1):

| Artefact                                                       | Cause                              | Handling                                  |
| -------------------------------------------------------------- | ---------------------------------- | ----------------------------------------- |
| Slot 6 named with two U+E000 boxes                             | uninitialised EEPROM name (virgin) | virgin state; factory `(empty)` (D2)      |
| `Hi` welcome note and clock wizard at power-on in factory runs | plan 15's restored image           | cut from boot recordings (omitted frames) |
| Key-to-redraw and Switch off! latency                          | firmware key scan                  | not reproduced (plan 14 D8)               |
| Discreet's overwritten operator line (P10)                     | unknown until Task 0               | D10                                       |

## Package boundaries

Unchanged from plans 13-16. phone-core gains five generic, opt-in seams with no Nokia labels or
timings. nokia-os gains no dependency. The profiles feature imports the settings store, the sounder
and plan 18's `textInput`; nothing imports it except the registrations below.

## Contract changes

Task 1 writes these into `VISION.md`.

### `@hellotimber/phone-core` (additive, opt-in)

```ts
export interface StandbyIndicators {
  voicemail?: boolean;
  message?: boolean;
  /** Plan 17: the host's "silent" icon (stock: drawn top-left while the active profile is silent). */
  silent?: boolean;
}

// ScreenModel `standby` addition: line?: string  // present only when standbyLine returns a string

export interface SubmenuOptions<Metadata = unknown> {
  // ...unchanged...
  /**
   * Plan 17: the text `child` shows in this level's list and as its own level's title; re-read on
   * every tick (a change emits one snapshot). Undefined = the child's label. Must be non-empty:
   * `SubmenuEntry.labelOf(child)` throws for a blank one, and the kernel then shows the child's own.
   */
  label?(child: MenuEntry<Metadata>): string | undefined; // method syntax: keeps SubmenuEntry covariant
}

export interface PhoneConfig<Metadata = unknown> {
  // ...unchanged...
  /**
   * Plan 17: a second standby line under the operator, re-read on every tick with the time since
   * standby was last entered (boot end, a return from the menus or an application, a notice
   * cleared); a change emits one snapshot. Default: none.
   */
  standbyLine?: (shownMs: number) => string | undefined;
  /**
   * Plan 17: opened on the power key's key-down at standby as a standby application (plan 18
   * D11: empty stack, path `standby`, `exit()` returns to standby, `levels`/`select`/`row`
   * throw), also over a notice and when the running application's handling of that key-down
   * leaves for standby (B6). The power long press still powers off. Elsewhere the short press
   * does nothing.
   */
  standbyPower?: PhoneApplication;
}

export interface ApplicationContext {
  // ...unchanged...
  /** Plan 17: powers the phone off (deactivation reason `power-off`). Always provided by the kernel. */
  powerOff?(): void;
}
```

`standbyIndicators` (the reader) is plan 18 D11's; if plan 18 Task 4 has not landed, Task 4 here
adds it exactly as plan 18 specifies. Rules (Task 4 pins each): configs without the seams produce
identical models; `standbyLine` and `label` throw nothing into the kernel (an exception is contained
like `detail`'s, and the line or label is omitted); `standbyPower` is ignored during boot gates.

Deviation: **Contract (Task 0 B6):** `standbyPower` opens over a standby notice (the notice stays)
and when the running application leaves for standby on the power key's down (the Activate note).
Plan 18 already shipped `standbyIndicators` and the standby application activation (`setNotice({
open })`); Task 4 reuses both (the power application is a second standby application, with the
notice's exit rules).

### `@hellotimber/nokia-os`

Public API unchanged. Internal: `src/firmware/features/profiles.ts` (below).

## Profiles API (internal)

Plans 18, 21, 22 and 25 consume these. Signatures are fixed by Tasks 5-7; a change is a Deviation.

```ts
// src/firmware/features/profiles.ts
export const PROFILE_SLUGS = ["general", "silent", "discreet", "loud", "empty", "empty-2"] as const;
export type ProfileSlug = (typeof PROFILE_SLUGS)[number];
export const ACTIVE_PROFILE_KEY = "profiles/active";
export function activeProfile(settings: StockSettings): ProfileSlug;
export function activateProfile(settings: StockSettings, slug: ProfileSlug): void;
export function profileName(settings: StockSettings, slug: ProfileSlug): string; // D2
export function renameProfile(settings: StockSettings, slug: ProfileSlug, name: string): void; // "" = default
/** Tones' alias target for the active profile (D1); used by settings.ts's resolver. */
export function profileAlias(key: string, active: ProfileSlug): string;
export function standbyProfileLine(
  settings: StockSettings,
): (shownMs: number) => string | undefined; // D5
export function standbySilent(settings: StockSettings): boolean; // D6
export function powerList(deps: ProfileDeps): PhoneApplication; // D7
export function activateLeaf(deps: ProfileDeps, slug: ProfileSlug): PhoneApplication; // D3
export function renameLeaf(deps: ProfileDeps, slug: ProfileSlug): () => Widget; // D9
export function activationBeep(phone: Phone, settings: StockSettings): number | null | undefined; // D4
```

## Shared-file edits

One-line registrations unless stated. If the refactor provides a feature registry for any of these
(leaf bindings, level options, phone config, virgin/factory settings), register there instead.

| File                                                                | Edit                                                                                                                                                                                    |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/firmware/bindings.ts`, `scripts/tree-capture-set.ts`           | drop `"12-*-1": "17"` from both `PLACEHOLDER_OWNERS` (one line each); drop `PROMPT_LAYOUTS["12-2-2-10"]` (moves to profiles.ts)                                                         |
| `src/firmware/bindings.ts`                                          | `SETTING_ALIASES`/`settingAlias`: the fixed General target is resolved by `profileAlias` (≈3 lines: the alias becomes a function of the active profile, D1)                             |
| `src/firmware/settings.ts`                                          | `resolve` routes through `profileAlias` with the stored active choice (≈3 lines); the virgin snapshot registers `profiles/active`; `factorySettings` applies `FACTORY_TEXTS` (≈2 lines) |
| `src/firmware/leaves.ts`                                            | one registration: 12-n-1 → `activateLeaf`, 12-n-2-10 → `renameLeaf`; subtract `layoutOf`'s Rename branch (D9)                                                                           |
| `src/firmware/menu.ts`                                              | one spread: the Profiles level's `label` and `opening` from profiles.ts                                                                                                                 |
| `src/firmware/phone.ts`                                             | one spread into `createPhone` (`standbyLine`, `standbyPower`, `standbyIndicators.silent`); one line in `send` calling `activationBeep` before `sounder.keyDown`                         |
| `src/display/standby.ts`                                            | one call: `paintProfileLine(fb, screen)` and the icon (painters live in profiles' display module)                                                                                       |
| `tests/__snapshots__/settings.test.ts.snap`                         | regenerated: `profiles/active` (plan 15 D3's pinned keys)                                                                                                                               |
| `packages/phone-core/src/{types,machine,menu,application,index}.ts` | the five seams (Task 4)                                                                                                                                                                 |

## Golden pipeline additions

`scripts/capture-sets/17-profiles.ts` (explicit table, like `game-capture-set.ts`), appended by the
importer. Ids `profiles/<name>` (LCD) and `sound/profiles/<name>`; asserted unless noted; every
scenario hand-written in the acceptance file except the generic `tree/*` ones.

| Fixture id(s)                                               | Source (`$REF/captures/6.39/`) | Kind             | Asserts                                                              |
| ----------------------------------------------------------- | ------------------------------ | ---------------- | -------------------------------------------------------------------- |
| `tree/12-profiles/12-n-1.leaf` (×6, existing)               | `plan14/open/12-n-1`           | timeline         | pending:17 → asserted (generic `leaf` scenario, virgin)              |
| `profiles/rename-open-12-{3,4,5,6}`                         | `plan14/open/12-n-2-10`        | timeline         | each slot's Rename first screen and blink (D9)                       |
| `profiles/activate-<slug>` (×6, factory)                    | `plan17/activate/<slug>`       | timeline         | note, edges, standby, the name after the delay, the icon             |
| `profiles/standby-<entry>`                                  | `plan17/standby/<entry>`       | timeline         | the name's delay per way into standby (D5)                           |
| `profiles/icon-*`                                           | `plan17/icon/*`                | stills           | the icon rule (D6)                                                   |
| `profiles/tones-<slug>`                                     | `plan17/tones/<slug>`          | stills           | Tones pages and lists follow the active profile (D1)                 |
| `profiles/power-*`                                          | `plan17/power/*`               | timelines/stills | open, scroll, power-as-▼, digits, C, choose, Switch off!, long press |
| `profiles/rename-*`                                         | `plan17/rename/*`              | timelines/stills | typing, limit, `Done`, empty → default, C keys, names everywhere     |
| `profiles/persist-*`, `profiles/restore`                    | `plan17/persist/*`, `restore`  | stills           | active profile and names after a power cycle and after Restore       |
| `profiles/discreet-*`                                       | `plan17/discreet/*`            | timeline         | D10 (asserted, or known gaps)                                        |
| `profiles/glyphs-thin-<n>`                                  | `plan17/glyphs/thin/*`         | stills           | Rename page values for thin-face harvest (resources, not scenarios)  |
| `sound/note/12-n-1` (×6), `sound/boot/power-key` (existing) | `plan16/…`                     | sound            | pending:17 → asserted (D4)                                           |
| `sound/profiles/{activate-*,power-*,effects-*}`             | `plan17/…` (`audio`)           | sound            | activation beeps, Switch off!'s tone, P8's effects per profile       |

## Conventions for every task

- Run commands from the repo root with `mise exec --`.
- TDD: write the failing test first wherever the task names tests.
- After each task: `mise exec -- vp check --fix` and the named test commands. A task that touches
  `phone-core` also runs `mise exec -- vp run -r test` and `mise exec -- vp run website#build`.
- Commit rule: run `mise exec -- vp check --fix` yourself, stage files by explicit path, then
  `git commit --no-verify -m "<message>"`. Never `git add -A`/`git add .`. Never stage
  `TODOS.md` (Lachlan's untracked notes).
- Never hand-edit `goldens/**`, `src/resources/generated/**`, `src/firmware/generated/**` or
  `scripts/generated/**`; change the generator or its tables and regenerate. Each generator runs
  twice with no diff before its commit.
- Tests never read `$REF`. Generators that read `$REF` fail clearly when it is missing.
- No new dependencies.
- When reality differs from this plan, follow the captures and append a `Deviation:` paragraph
  under the task. If a deviation breaks a contract in VISION.md, stop and report.
- Parallelism (max 3 concurrent agents): Task 0 gates everything, then Task 1. Then lanes A
  (2 → 3), B (4) and C (5). Task 6 needs 3, 4 and 5; Task 7 needs 6; Task 8 needs 6 and plan 18
  Task 7; Task 9 needs 7 (and 8 when it has landed); then 10.

## Tasks

### Task 0 - Canonical REF captures (no repository changes)

**Files (all under `$REF`, gitignored):** `captures/scripts/gen_v639_plan17.py`,
`captures/scripts/v639-plan17-<section>.cap`, `captures/6.39/plan17/**`, a "Plan 17 supplementary
captures" section in `captures/README.md`, scratch images under `captures/6.39/plan17/work/`.

Concurrent sessions use the harness: write only these paths. Factory sections start with
`scripts/v639-factory-setup.inc` and cut the welcome note and clock wizard from boot recordings;
virgin sections with `v639-setup.inc`. Every recording is `audio` + `record` of the same name with
`keys.csv` (plan 16's convention), raw key edges inside recordings.

- [x] **A activation and standby:** Activate each of the six slots from General (factory) and General
      from each; standby recorded 8 s after each (`activate/<slug>`). **A1** the name's delay for
      each way into standby: the note's end, C from the carousel, C from a level, C held from an
      option list, the power list's C, power-on (`reboot` from a saved image, then the wizard cut),
      a notice dismissed if plan 18's `sms` command exists (`standby/<entry>`). **A2** Tones pages
      and Keypad tones / Ringing volume lists with each profile active; a Tones write with Silent
      active, then Silent's and General's lists (`tones/<slug>`). **A3** the icon matrix: from
      General, set Incoming call alert Off, Message alert tone No tone, Keypad tones Off, Warning
      tones Off and Vibrating alert Off one at a time and in the combinations that isolate the rule;
      Silent with each of them restored; shots of standby (`icon/*`). **A4** Discreet's operator line:
      Discreet with each of its settings set to General's, Discreet renamed (`Disc`, `Discreetad`),
      Silent renamed `Discreet`, recorded 20 s each (`discreet/*`). **A5** the Profiles level's
      opening: Menu 1 2 with each profile active, before and after a power cycle, and after visiting
      another profile's level (P3). **A6** `Menu 1 2 n 1` with audio (the digit's beep level).
- [x] **B power key:** at standby with General and with Silent active: the key-down list (record),
      scroll ▼ and ▲ through the wrap (shots), the power key as ▼ (three presses), each digit 1-9 and
      0, `*`, `#` (records; does `1` switch off?), C, OK on each profile, OK on `Switch off!` (audio;
      the run ends there), power held 1.5 s at standby (does the list flash before power-off?),
      60 s idle. **B6** the short press during the `Selected profile:` note, during a notice, in the
      carousel, a rows level, a pages level, an option list, a prompt and Snake II (records).
- [x] **R rename:** each of slots 2-6: the prompt, one letter, OK (record from OK to the page), the
      Profiles list, the power list, the note and standby with the new name; the limit (fill to 10,
      an 11th key); C, held C, C on empty; an empty name OK (record; **R5** slot 6 and `(empty)`
      slot 5 too, virgin and factory: which default?); a name with `*`-table symbols; a name the
      small face lacks (e.g. `Zz/@`) in the list, standby and the note.
- [x] **G thin glyphs:** Rename pages whose values spell every character of plan 18's typeable set
      (10 per name, ≈12 names; `manifest.json` `{ file, face: "thin", chars }`), for the harvester.
- [x] **P persistence:** rename two slots, activate one, `saveflash`, `reboot`: standby, the Profiles
      list and the power list; then Restore factory settings: the same three and Tones' pages.
- [x] **E effects (audio):** for each profile active: keys in the carousel, `Invalid shortcut`, a
      Ringing tone preview in Tones, a Snake II meal with Shakes On (`effects/<slug>`).
- [x] OCR every new image into `plan17/text.json` (plan 14's format and command).
- [x] `check`: every recording starts on its parent; every manifest char is read back.
- [x] Append "Plan 17 supplementary captures" to `$REF/captures/README.md`.
- [x] No commit. Record the outcome under this task: delays per entry (D5), the icon rule (D6),
      Discreet's line (D10), the opening rule (Open question 1), the power list's keys and long
      press, Rename's empty default, the beep of a digit shortcut onto Activate.

#### Task 0 outcome (2026-10-14)

`$REF/captures/6.39/plan17/`: 999 images (296 distinct), 118 recordings with `keys.csv`, audio
and events, every image OCRed (`text.json`); `gen_v639_plan17.py check` passes. Sections and
paths are in `$REF/captures/README.md` "Plan 17 supplementary captures".

| Question                           | Outcome                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Evidence (`plan17/`)                            |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Activate (P1)                      | Every slot: `Selected` / `profile:` / name, tick 678-700 / 218-240 / 1958-1989 ms, an 8-10 ms edges step, standby with the operator only; the name 1909-1913 ms after that standby frame (11 recordings). General shows no name. The virgin `plan14/open/12-n-1` agree (1911 ms).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `activate/*`, `rename/*/activate`, `discreet/*` |
| Name delay per entry (D5)          | Relative to the standby frame that draws the operator: a note's end 1909-1913 ms; the power list's choice 1921 ms; `Date is set` (power-on) 1916 ms; a key's return (C from the carousel, Menu then C, C twice or C held on a level, C held on a list, the power list's C, a notice's C) 1926-1930 ms after the operator's redraw, which follows 84-95 ms of the ladders without the operator (and without the name). Spread 1909-1930: one constant.                                                                                                                                                                                                                                                                                                                                                                         | `standby/*`, `power/*/ok-*`                     |
| Power-on                           | After a power cycle the name returns with standby (`standby/boot`, Silent: 1916 ms after `Date is set` ends). `persist/boot` came up with no network (no operator, no signal ladder) and drew the name at once in its line: an in-process reboot artefact, evidence only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `standby/boot`, `persist/boot`                  |
| Standby icon (D6)                  | Shown exactly while the active profile's Incoming call alert is Off (General, Silent, Loud, Discreet with alert Off; never with Ringing or Beep once), whatever the other settings. P9's contrary probes chose the list's opening value (a probe error).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `icon/*`                                        |
| General's `Silent` text (new)      | With General active and Incoming call alert Off, Message alert tone No tone, Keypad tones Off and Warning tones Off, standby shows the text `Silent` in the name line, not Silent's stored name (`Quiet` after a rename); any of the four on removes it; volume and vibrator do not matter. Another active profile shows its own name with the same values.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `match/*`                                       |
| Discreet's line (D10)              | Discreet's operator line is overwritten 12-15 ms after its name appears (or ≈2.3 s into a later standby) and stays: with Discreet's own Screen saver On, whatever its name and tones; Screen saver Off removes it; Silent renamed `Discreet` never shows it. Its pixels are garbage: an uninitialised screen-saver picture of the restored image. Not reproduced (an artefact).                                                                                                                                                                                                                                                                                                                                                                                                                                               | `discreet/*`                                    |
| Profiles opening (Open question 1) | The level opens on the active profile: each profile, after a visit, after a power cycle (Silent, Discreet). P3's General after a power cycle is not reproduced.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `opening/*`                                     |
| Tones (P2)                         | Pages 1-9 and the Keypad tones / Ringing volume lists show the active profile's values; Tones › Keypad tones Level 3 with Silent active writes Silent's (General's stays Level 2).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `tones/*`                                       |
| Power key (P4, P5)                 | Key-down at standby: 29-30 ms of standby with the ladders and the signal/battery icons erased (operator, name, clock and silent icon kept), then the list on `Switch off!` (General and Silent active), soft key `OK`, no indicator. ▼/▲ and the power key's presses move (circular window); digits choose by position: `1` switches off (24-40 ms), `2`-`7` choose that profile, `8`, `9` show `Invalid shortcut` at once and `0` after 2.98 s (2886 ms note, an 8 ms then a 15 ms partial draw, standby); `*` and `#` do nothing. C: 84-88 ms of the ladders without the operator, then standby. 60 s idle changes nothing. Held at standby: the list, then off ≈1033 ms after the down (with the power-off tone). Keys beep at the keypad level; Switch off! plays the power-off tone (900 Hz 0x9105) instead of the beep. | `power/*`                                       |
| Power key elsewhere (B6)           | During the `Selected profile:` note (activation stored) and on a standby notice the press opens the list (the same erased frame first); in the carousel, a rows or pages level, an option list, a prompt and the Snake II menu it does nothing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `power/elsewhere/*`                             |
| Activation beep (D4, A6)           | The activating key beeps at the new profile's Keypad tones level: Navi on Activate, OK and digits in the power list, and the last digit of `Menu 1 2 n 1` (Silent: none; Discreet 0x9108; Loud 0x9100).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `activate/*`, `power/*`, `shortcut/*`           |
| Rename (P6)                        | `New name:` with the name and the cursor at its end (480 ms blink), `abc`; the counter is 10 − length; at 0 an 11th key is ignored. OK → `Done` (tick 687-700 / 218-240 / 534-545 ms) → the Rename page. C deletes, C held clears (mode `Abc`), C on empty returns to the page with the name kept. OK on an empty name restores the factory name: Silent, `(empty)` for slot 5 and for slot 6, factory and virgin (R5). The name shows in the Profiles list, the level, the power list, the note, standby and the Rename page (thin face), and survives a power cycle; Restore resets names and the active profile (slot 6 → `(empty)`).                                                                                                                                                                                      | `rename/*`, `rename-virgin/*`, `persist/*`      |
| Effects (P8)                       | Per active profile: keys beep at its level (Silent none, Discreet 0x9108, Loud 0x9100), `Invalid shortcut` plays 1750 Hz only with Warning tones On, the Ringing tone preview follows its alert (Discreet's Beep once: none).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `effects/*`                                     |

Deviation: **Task 0 E:** no Snake II meal per profile: game sounds and shakes read Warning tones,
Vibrating alert and Games' settings through the aliased `tones/*` keys, which plan 16's
`game/snake-{warning-off,shakes-on-vibra-off}` goldens already pin; nothing profile-specific is
left to capture.

Deviation: **Task 0 R:** no "name the small face lacks": plan 18 gave small and large every
typeable character. The thin face (the Rename page) lacked 63; `glyphs/thin` spells them.

Deviation: **D5 (one constant, from the standby frame):** the name appears 1909-1930 ms after
standby's own frame, so `PROFILE_LINE_DELAY_MS` is one constant (1911, the note-end median) on
the kernel's standby entry. A key's return to standby first shows the ladders without the
operator for 84-95 ms, a kernel-wide partial draw nokia-os does not reproduce (as plan 20's
`HELD_AFTER_NOTE`); only the power list, which owns its C, draws it.

Deviation: **D6:** the icon rule is Incoming call alert Off alone (P9 corrected).

Deviation: **D2/D5 (General's `Silent` text, new):** with General active and its alert, message
tone, keypad tones and warning tones all off, the standby line is the firmware's text `Silent`.

Deviation: **D7 (power key):** the list opens over a standby notice and during the Activate note
(B6); the kernel opens `standbyPower` there too (see Task 4). Digits follow the menu-number rule
above (`1` is Switch off!). The power key's long press switches off ≈1033 ms after the down; the
kernel's long press stays 800 ms (kernel-wide, plan 16's `boot/power-off` agrees with 1046 ms), so
`profiles/power-held` is a known gap.

Deviation: **D10:** Discreet's operator line is an artefact (Discreet's uninitialised screen
saver picture); `discreet/*` is not imported except `profiles/activate-discreet` cut before it.

### Task 1 - Contracts and documentation

**Files:** `VISION.md`, `docs/specs/stock/profiles.md` (new), `docs/specs/nokia-3310.md` (§8, §10:
a pointer only), `docs/specs/nokia-3310-menu-tree.md`, `docs/plans/README.md`, this plan.

- [x] Apply Task 0's outcome to D2-D10 and Open questions (Deviation lines where it changes them).
- [x] VISION: the five phone-core seams exactly as in "Contract changes", a plan 17 kernel-policy
      paragraph (standby line timing, label reader, power key standby application, `powerOff`),
      and that nokia-os's Tones follow the active profile.
- [x] `docs/specs/stock/profiles.md`: P1-P11 as verified by Task 0, the artefacts, everything
      "(plan 17, in progress)". Spec §8: mark the manual's "profile mutes all tones" as history
      (profiles are their settings). Menu-tree spec: General has no Rename; slot 6's factory name.
- [x] Plans README row 17 `in progress`.
- [x] No runtime code. `mise exec -- vp check --fix`.
- [x] Commit: `docs: define profile, standby line and power-key contracts (plan 17)`.

### Task 2 - Goldens and re-owned placeholders (TDD)

**Files:** `scripts/capture-sets/17-profiles.ts` (new), its registration in
`scripts/import-captures.ts` (one line), `scripts/tree-capture-set.ts` and
`src/firmware/bindings.ts` (`PLACEHOLDER_OWNERS`, one line each),
`tests/capture-sets/17-profiles.test.ts` (new), `tests/goldens-integrity.test.ts`, the acceptance
todo shim, `goldens/**`.

- [x] TDD the capture set on synthetic recordings (injected loader): ids, kinds, cut points
      (welcome note and wizard omitted with reasons), `trigger-frame` on the first changed frame,
      sound rows, glyph sheets with their manifest note.
- [ ] Drop `12-*-1` from both owner tables: the six `tree/12-profiles/12-n-1.leaf` and
      `sound/note/12-n-1` goldens and `sound/boot/power-key` become asserted.
- [x] Integrity: no golden is `pending:17`; the owner tables are equal; glyph sheets match their
      manifests.
- [x] Acceptance: asserted goldens without a scenario are todos (`awaitsPlan17Scenario`; Task 9
      deletes it).
- [x] Run `import-captures` twice; the second changes nothing. Record counts and bytes.
- [x] `mise exec -- vp run @hellotimber/nokia-os#test`, `mise exec -- vp check --fix`.
- [x] Commit: `feat(nokia-os): import profile goldens (plan 17)`.

Deviation: **Task 2 (paths, plan 29 conventions):** the table is `scripts/capture-sets/17-profiles.ts`
(registered by one line in `scripts/capture-sets/index.ts`), tested by
`tests/capture-sets/17-profiles.test.ts` with an injected recording loader; its goldens are indexed
in `goldens/index/17.json` and run by `tests/acceptance/17-profiles.test.ts`. `scripts/import-
captures.ts` needs no line (the registry discovers the set).

Deviation: **Task 2 (status, plan 29 pending workflow):** every new golden is `pending:17` and no
`awaitsPlan17Scenario` shim exists; each row names the task (6, 7, 8) whose scenarios promote it
(`ASSERTED_TASKS`). `12-*-1` stays in both owner tables until Task 6 binds Activate (the six
`tree/12-profiles/12-n-1.leaf` and `sound/note/12-n-1` goldens would otherwise be asserted with a
placeholder behind them), and `sound/boot/power-key` stays `pending:17` until Task 7. The
integrity check "no golden is `pending:17`" moves to Task 9; Task 2 checks that plan 17 is
pending elsewhere only on those goldens.

Deviation: **Task 2 (selection):** stills are grouped per screen family (`profiles/icon`,
`profiles/tones-<slug>`, `profiles/opening`, the power ▼/▲ shots, `persist-after-*`), one image per
shot; the standby entries that repeat `standby-carousel-c`'s operator-less redraw, the notice
(plan 18's painter), the shortcut's LCD (plan 14's timing), the B6 "nothing happens" recordings
and Discreet's artefact are listed in `notImported` with reasons. The thin glyph sheet's note ends
`; manifest [...]` (plan 18's form), one page per image.

**Task 2 completion note:** 146 plan 17 fixtures: 102 LCD (25 stills, 77 timelines; 651 images)
and 44 sound goldens, 2.76 MB of text grids, all `pending:17`. A second `import-captures` run
changes nothing (identical tree hash); no other plan's golden changed.

### Task 3 - Glyphs, sprites and timings (TDD)

**Files:** `scripts/extract-resources.ts`, `scripts/widget-sprites.ts`, `scripts/glyph-overrides.ts`,
`src/resources/generated/**` (generated), `src/resources/index.ts`, `tests/resources.test.ts`.

- [x] Harvest the thin sheet and the new goldens' runs (the large U+E000 box of slot 6's prompt, the
      standby line). Resolve reports with overrides naming their golden.
- [x] Crops: the standby icon; the power list's leading frame and C's frame if they are not plain
      models (D7). Timelines: each `Selected profile:` note (its own recordings), Rename's `Done`,
      `PROFILE_LINE_DELAY_MS` per D5 (medians with the spread in a comment).
- [x] Measure the standby line's top and centring and the icon's place from the goldens.
- [x] TDD: freshness; every default name renders in small, large and thin; every typeable character
      renders in thin or is reported (plan 15's welcome-note rule).
- [x] Run `extract-resources` twice; no diff.
- [x] Commit: `feat(nokia-os): harvest profile glyphs, icon and timings`.

Deviation: **Task 3 (paths, plan 29):** plan 17's evidence is `PlanCaptureSet.resources` in
`scripts/resource-inputs/17-profiles.ts` (text runs, glyph overrides, sprite batch 170, timeline
batch 170); `scripts/widget-sprites.ts` and `scripts/glyph-overrides.ts` no longer exist and
`extract-resources.ts` needs no change. The thin face gains the 63 typeable characters it lacked
from `profiles/glyphs-thin` (seven pages, runs at top 29 right-aligned to x 79): eight pairs touch
(`ÎÏ`, `ÏÌ`, `ÌÍ`, their lower case, `ÃÇ`, `ñq`: `touch` overrides with widths from the OCR cells
of `plan17/text.json`) and seven page-final characters take the stock `spacing`; the eight
accented glyphs that fill their cell join the resources test's spacing exceptions. The large face
gains U+E000 (slot 6's virgin note, `tree/12-profiles/12-6-1.leaf` image d). Sprite:
`profiles/silent` (x 7..13, y 0..5). Timelines: the six Activate notes by node (`12-n-1`, from
the tree goldens, still `pending:17`: explicit probes), `rename-done` and `power-invalid-shortcut`.
The power list's leading frame (standby with the ladders erased) and its C frame (the ladders
without the operator) are plain standby models the power list paints, not crops (D7). The
measured constant `PROFILE_LINE_DELAY_MS` (1912, the median of eleven Activate goldens, spread
1898-1913) lives in `features/profiles.ts`, pinned by `tests/profiles-resources.test.ts` against
the goldens (no generator); the standby line's place (small face, top 18, centred) is Task 6's
painter, tested against the goldens.

Deviation: **Task 3 (`power-invalid-shortcut`):** its extracted frames decompose the two partial
draws against their neighbours (`edges` 5..30, then a 31-byte `cut`), which the note painter
cannot replay toward standby; Task 7 keeps the step durations (2886/8/15 ms) and draws the
partials toward standby (`edges` 5..78, then the first 31 bytes of standby).

### Task 4 - phone-core: standby line, label reader, power key, powerOff (TDD)

**Files:** `packages/phone-core/src/{types.ts,machine.ts,menu.ts,application.ts,index.ts}`, README;
tests `standby-line.test.ts`, `submenu-label.test.ts`, `standby-power.test.ts` (new).

- [x] TDD `standbyLine`: absent → models unchanged; `shownMs` restarts at boot end, at every return to
      standby (C, C held, application `exit({ to: "standby" })`, a standby application's exit); a
      change emits one snapshot; an exception omits the line.
- [x] TDD `label`: list items and the child level's title follow the reader; re-read per tick; one
      snapshot per change; empty string throws (as labels do); paths and slugs unchanged.
- [x] TDD `standbyPower`: opens on the key-down at standby as a standby application (add plan 18
      D11's activation if absent: empty stack, path `standby`, `exit()` → standby,
      `levels`/`select`/`row` throw); key events reach it, the power key's too; its long press
      powers off (deactivated once with `power-off`); not opened in nav, app, boot or while a notice
      shows; navigate() deactivates it.
- [x] TDD `ApplicationContext.powerOff()`: deactivates with `power-off`, the phone is off; stale
      activations are no-ops.
- [x] `StandbyIndicators.silent` (and the reader if plan 18 Task 4 has not landed).
- [x] `mise exec -- vp run @hellotimber/phone-core#test`, `vp run -r test`, `vp run website#build`,
      `vp check --fix`.
- [x] Commit: `feat(phone-core): standby line, submenu labels, power key application and powerOff`.

Deviation: **Task 4 (reuse):** plan 18 Task 4 had already added `PhoneConfig.standbyIndicators`
and the standby application activation (`setNotice({ open })`); the power key's application is a
second standby application with the notice's exit rules (`exit()` → standby, `levels`/`select`/
`row` throw, C on its `App error` reader → standby, `navigate()` leaves it), and
`StandbyIndicators.silent` extends plan 18's reader. `src/index.ts` needs no change. The standby
line's `shownMs` restarts with every new standby state (boot end, C, C held, an application's or
standby application's exit, a cleared notice, `setNotice(null)` included) and rides on Menu's
`leaving` model. `standbyPower` opens over a notice and after an application leaves for standby
on the power key's down (Task 0 B6). A blank label from the reader throws from
`SubmenuEntry.labelOf`; the kernel shows the child's own label then, as when the reader throws.

### Task 5 - Active profile, aliases and names (TDD)

**Files:** `src/firmware/features/profiles.ts` (new: state part), the settings and bindings edits of
"Shared-file edits", `tests/profiles-state.test.ts` (new), `tests/settings.test.ts` (snapshot),
`tests/persistence.test.ts`.

- [x] TDD `activeProfile`/`activateProfile`: virgin General; a record without the key decodes to
      General; persists at once.
- [x] TDD D1: with each profile active, every `tones/*` key (but Composer) reads and writes that
      profile's Personalise key; Personalise keys stay their own; switching back restores reads.
- [x] TDD names (D2): virgin names (slot 6's boxes), `renameProfile` (10 characters max, throws
      beyond), empty → default; Restore: General active, names reset, slot 6 `(empty)`.
- [x] Pinned record keys gain `profiles/active`; every existing settings, sound and acceptance test
      still passes (General active = plan 14's alias).
- [x] `mise exec -- vp run @hellotimber/nokia-os#test`, `mise exec -- vp check --fix`.
- [x] Commit: `feat(nokia-os): the active profile and profile names`.

Deviation: **Task 5 (files, the per-plan split):** `src/firmware/bindings.ts` no longer exists;
its tables live in the features and `stock.ts`. The profiles feature's alias is
`{ prefix: "tones/", target: (choice) => profileAlias(...) }`: `StockSettingsTables.aliases` takes
an `AliasTarget` (a prefix, or a function of the stored choices), `settingAlias(key, choice?)`
resolves it (default: every choice unset, the virgin General), and the store re-resolves a stock
alias against its own choices on every read and write (a test snapshot's fixed alias stays
fixed). Two generic tables join the settings tables: `choices` (single choices no menu list
stores: `profiles/active`, six options, virgin unset) and `factoryTexts` (Restore's slot 6 name,
`(empty)`, with its capture). The record's pinned keys gain `profiles/active`; no version bump.
`renameProfile(…, "")` writes the slot's factory name (Task 0 R5: `(empty)` for slots 5 and 6).

### Task 6 - Activate, standby name, icon and effects (TDD against goldens)

**Files:** `src/firmware/features/profiles.ts` (leaf, standby, beep), its display module
`src/display/profiles.ts` (new), the leaves/menu/phone/standby registrations,
`tests/profiles-activate.test.ts` (new).

- [x] `activateLeaf` (D3) bound to 12-n-1; the Profiles level's `label` and `opening` (D8).
- [x] `standbyProfileLine` and `standbySilent` wired into `createPhone`; the painter draws the line
      and the icon as measured (D5, D6); Discreet's line per D10.
- [x] `activationBeep` (D4) wired in the wrapper.
- [x] TDD through keys against `tree/12-profiles/12-n-1.leaf`, `profiles/activate-*`,
      `profiles/standby-*`, `profiles/icon-*`, `profiles/tones-*`, `profiles/persist-*`,
      `profiles/restore`, `sound/note/12-n-1`, `sound/profiles/{activate,effects}-*` (pixels exact,
      timelines ±2 ms after alignment; standby-entry delays within the spread Task 3 records).
- [x] Plan 13's standby goldens unchanged (General: no line, no icon).
- [x] Commit: `feat(nokia-os): Activate, the standby profile line and icon`.

Deviation: **Task 6 (API):** `activateLeaf(services, slug)` is the 12-n-1 `ScreenBinding`'s widget
factory (`() => Widget`), bound through the feature's `screens`; `activationBeep(phone, key,
settings)` takes the key going down. The Profiles level's label and opening come through a new
generic feature table, `levels` (`LevelOptions { label?(slug), opening?() }`, by level node:
`features/feature.ts`, `LEVELS` in `stock.ts`, one spread in `menu.ts`), not an import of the
profiles feature. Notes gain `powerLeaves` (`widgets/note.ts`): Activate's note leaves for standby
on the power key's down, where the kernel opens `standbyPower` (B6). The standby painter calls
`paintProfileStandby` (`display/profiles.ts`): the line centred in the small face at top 18 and the
`profiles/silent` sprite, both kept on Menu's `leaving` frame. `phone.ts` sets `standbyLine`,
`standbyIndicators` (`silent`) and calls `activationBeep` before `sounder.keyDown`.

Deviation: **Task 6 (shared tests, one assertion each):** `12-*-1` left both owner tables, so the
six `tree/12-profiles/12-n-1.leaf` and `sound/note/12-n-1` goldens are asserted (plan 16's importer
folds equal note recordings: 12-1-1, 12-2-1 and 12-6-1's sound now share other notes' goldens).
`tests/firmware-menu.test.ts` lists 12-5-1 as stock; `tests/widgets-notes.test.ts` skips leaves a
feature binds (Activate's note ends in the kernel's standby with its line);
`tests/acceptance/14-menu-depth.test.ts` gives `tree/12-profiles/12-5-1.leaf` a hand-written
scenario within PROBE_TOLERANCE_MS (its name comes at 1898 ms; the coverage guard admits no tree
golden as a known gap). `profiles/persist-after-{boot,restore}` move to Task 7 (they show the
power list).

Deviation: **Task 6 (scenarios):** the factory Activate goldens play the virgin per-slot note
timelines (another recording) within PROBE_TOLERANCE_MS; `profiles/activate-empty` is a known gap
(its tick is 27 ms shorter than 12-5-1's), `profiles/standby-carousel-c` too (the key return's
operator-less redraw, Task 0). Cut goldens (`activate-discreet`, `standby-menu`) hold their last
frame as a lower bound (`cutRecordingScenario`). Stills seed the active profile, names and Tones
values into the factory storage (`tests/support/profiles.ts`) instead of replaying the settings'
keys; the scenarios' `toStandby` taps C before holding it on an option list (nokia-os closes a list
on C's release; the firmware leaves for standby on C held, an existing kernel difference).

### Task 7 - The power key's profile list (TDD against goldens)

**Files:** `src/firmware/features/profiles.ts` (`powerList`), `src/widgets/option-list.ts`
(`numbering: "none"`, one line), the phone registration, `tests/profiles-power.test.ts` (new).

- [x] `powerList` (D7): `Switch off!` + six names (D2), opening `Switch off!`, ▲/▼ and the power
      key-down move, digits choose by position (Task 0 B), OK runs Activate's flow or `powerOff()`,
      C exits; the leading and C frames as Task 3 decided.
- [x] TDD against `profiles/power-*` and `sound/boot/power-key`, `sound/profiles/power-*`; power long
      press from the list powers off; the short press elsewhere changes nothing (B6).
- [x] Commit: `feat(nokia-os): the power key's profile list`.

Deviation: **Task 7 (API and files):** `powerList(services, state)` takes a `PowerListState` the
wrapper shares (the standby model the power key went down on, for the leading frame; the
highlighted entry, for `activationBeep(phone, key, settings, state)` and the key's beep). The list
reuses `OptionListWidget` (`numbering: "none"`, `widgets/rows.ts`) inside a widget that keeps the
captured key timing: OK and the digits choose on their down (the choice swallows that key's
release), C leaves on its down, ▲/▼ and the power key move on their release (not the press that
opened it). The leading and C frames are a `standby-frame` widget model (`display/profiles.ts`, one
case in `display/widgets/index.ts`): standby with the ladders erased for 29 ms, standby without
the operator and the line for 86 ms (84-88 captured). `Flow.powerOff?()` (`widgets/flow.ts`)
reaches `ApplicationContext.powerOff()`. `8`/`9` play `Invalid shortcut` with the power list's
own steps (2886/8/15 ms, the note painter's `cut` with no step after it now draws toward standby,
`display/widgets/note.ts`); `0` plays the menus' `invalid-shortcut` 2955 ms after its down
(its tone sounds at 2931 ms and its redraw at 2979 ms; one moment between them).

Deviation: **Task 7 (sound, shared files):** the power-off tone is a key beep's length at the boot
tone's level (≈145 ms with the DSP awake, ≈124 ms waking it) and silent with Warning tones Off
(Silent's Switch off!; UNVERIFIED against Keypad tones, also Off there): `sound/sounder.ts`
`powerOff`. A key that switched the phone off does not beep (`phone.ts`), and the power key beeps
in the list as at standby. `sound/boot/power-key` is asserted (`scripts/sound-capture-set.ts`) with
a scenario in `tests/support/sound-scenarios.ts`; `tests/sounder.test.ts` lets the list close before
its Menu and `tests/firmware-phone.test.ts` expects the awake power-off tone.

Deviation: **Task 7 (goldens):** the Discreet choices cut before the artefact (`power-general-ok-
discreet` at its name, `power-general-digit-4` at standby: there the name and the overwritten line
come together); `persist-after-{boot,restore}` drop their standby image (the in-process reboot came
up without the network). Known gaps: `power-general-held` (the firmware switches off 1033 ms after
the down, the kernel's long press is 800 ms) and `sound/profiles/power-general-power-keys` (in the
list the power key beeps 121-123 ms after its down). Every factory Activate golden (the menus', the
power list's OK and digits) compares within `ACTIVATE_TOLERANCE_MS` (35, a stated tolerance: the
firmware's box 678-700 ms, tick 1958-1989 ms and name delay 1898-1930 ms vary between recordings),
which also retires Task 6's `activate-empty` gap.

### Task 8 - Rename (TDD against goldens; needs plan 18 Task 7)

**Files:** `src/firmware/features/profiles.ts` (`renameLeaf`), the leaves registration and
subtraction, `tests/profiles-rename.test.ts` (new).

- [x] `renameLeaf` (D9): plan 18's `textInput` on the measured layout with the profile's name, limit
      10; OK → `renameProfile` → `Done` → the page.
- [x] TDD against `tree/12-profiles/12-2-2-10.leaf`, `profiles/rename-open-*`, `profiles/rename-*`:
      typing, the limit, empty → default, C keys, the name in the list, power list, note, standby.
- [x] Subtract `layoutOf`'s Rename branch and the `PROMPT_LAYOUTS` entry it replaced.
- [x] Commit: `feat(nokia-os): Rename profiles`.

Deviation: **Task 8 (API and files):** `renameLeaf(services, slug)` is the 12-n-2-10 binding's
widget factory (the feature's `screens`): plan 18's `textInput` (label `New name:`, limit 10,
counter, the stored name, OK → `renameProfile` → `Done` on the `rename-done` timeline → the page).
The Rename prompt restarts its cursor blink at a commit (`profiles/rename-*-type`: the cursor shows
at the commit and toggles 477-480 ms later), an opt-in `restartBlinkOnCommit` of plan 18's
`TextEntry`/`textInput` (`widgets/text-entry.ts`, `widgets/text-input.ts`; default off, the editor
unchanged). `layoutOf`'s Rename branch, its `value` plumbing and `PROMPT_LAYOUTS["12-2-2-10"]` are
gone. Shared tests: `tests/widgets-info.test.ts` skips feature-bound prompts with no plan 14
layout; `tests/acceptance/14-menu-depth.test.ts` gives `tree/12-profiles/12-2-2-10.leaf` the
tolerant tree scenario (plan 18's free-running 480 ms blink against this recording's 479-493 ms).

Deviation: **Task 8 (goldens):** the prompt recordings compare within PROBE_TOLERANCE_MS (their
blink); later keys go down on the row their effect starts. Known gaps: `rename-open-12-3` (a 15 ms
stray cursor column in the virgin recording restarts its blink) and `rename-limit`,
`rename-limit-extra`, `rename-limit-ok`, `rename-symbols` (after a run of commits at the captures'
pace the firmware's cursor is in the other blink phase: one column differs). `rename-limit-extra`
aligns on the key (trigger-frame 0: at the limit the key changes nothing).

### Task 9 - Acceptance and the coverage guard

**Files:** `tests/acceptance/17-profiles.test.ts` (new), `tests/support/profiles.ts` (new),
`tests/support/rig.ts` (a seeded active profile and names, if needed).

- [ ] A scenario for every asserted `profiles/*` and `sound/profiles/*` golden; delete
      `awaitsPlan17Scenario`; the guard fails for an asserted golden without one; no node is covered
      only by a `pending:17` golden.
- [ ] Every asserted golden passes (pixels exact; timelines ±2 ms, or a stated tolerance where a
      scenario replays another recording's timing). New `KNOWN_GAPS` need a reason.
- [ ] `mise exec -- vp run @hellotimber/nokia-os#test`, `mise exec -- vp run -r test`,
      `mise exec -- vp check --fix`. Report the suite's run time.
- [ ] Commit: `test(nokia-os): drive profiles against their goldens`.

### Task 10 - Demo, README, verification gate and closeout

**Files:** `packages/nokia-os/{README.md,demo/main.ts}`, `docs/specs/stock/profiles.md`,
`docs/plans/README.md`, this plan.

- [ ] Demo: the status line shows the active profile. Verify with
      `mise exec -- vp run @hellotimber/nokia-os#demo` and `agent-browser` (headless, Skip boot,
      through `[role=status]`): Activate Silent (note, standby line), Tones › Keypad tones shows
      Silent's, the power key's list, choose General, Rename Loud, power cycle.
- [ ] README: profiles as settings plus names, the active profile's alias, what later plans read.
- [ ] `mise exec -- vp check --fix`, `mise exec -- vp run -r test`,
      `mise exec -- vp run website#build`; `git diff --stat <commit before Task 1> -- website/` is
      empty.
- [ ] Spec: replace "(plan 17, in progress)" with verified facts; list what stays UNVERIFIED.
- [ ] Plans README row 17 `done`. Completion notes; status `done`.
- [ ] Commit: `docs: complete profiles (plan 17)`.

## Follow-up plan adjustments

- **18 - Messages:** `messageAlert("tones")` is the active profile's; Rename binds 18's `textInput`
  (Task 8 waits for 18 Task 7). If 18 Task 4 lands first, plan 17 Task 4 reuses its standby
  application and indicator reader.
- **22 - Calls:** `ring("tones")` rings the active profile; the silent icon may also mean "ringing
  off" in call screens (Task 0 A3's rule decides).
- **25 - Keyguard:** the power key's short press while the keyguard is on (unknown; capture there).
- **Screen saver (unowned):** each profile's Screen saver settings already store per profile and
  alias through D1; the screen saver at standby needs a plan.
- **Portfolio integration (not sequenced):** VISION's "visitor modes" idea could reuse
  `profileName`/`activateProfile`; nothing here commits to it.

## Open questions for Lachlan

Resolved provisionally so execution is not blocked; each is cheap to reverse.

1. **Profiles level opening (P3, D8):** the active profile, which four of five runs show; Task 0 A5
   decides (one run after a power cycle opened on General). Reverse: open on General.
2. **Standby icon (D6):** shown while the active profile's alert is Off, Message tone No tone and
   Keypad tones Off, until Task 0 A3 fixes the rule. Reverse: Silent only.
3. **Discreet's operator line (D10):** reproduced if Task 0 shows a deterministic rule, else known
   gaps. Reverse: never reproduce it (an artefact).
4. **Activation beep (D4):** reproduced through a wrapper hook rather than activating on key-down.
   Reverse: the key beeps at the old profile's level (6 sound goldens become known gaps).
5. **Empty rename (D2):** restores the slot's factory name; slot 6's default is `(empty)` pending
   Task 0 R5.
6. **Meeting/Outdoor/Pager (D13):** absent on v6.39; nothing to build.
7. **Rename timing (D9):** waits for plan 18 Task 7; the rest of plan 17 ships first.

Resolved by Task 0: (1) the active profile, always (`opening/*`); (2) Incoming call alert Off
alone (`icon/*`); (3) not reproduced: Discreet's uninitialised screen saver picture
(`discreet/*`); (4) reproduced through the wrapper hook, the shortcut digit included
(`shortcut/*`); (5) `(empty)` for slots 5 and 6, virgin and factory (`rename-virgin/*`); (7) plan
18 Task 7 has landed on this branch.

## Conflicts found while planning

- Spec §8 (manual): Silent "mutes all tones"; on v6.39 Silent is its settings (P2, P8): changing
  Silent's Keypad tones to Level 3 makes it beep.
- Spec §5 lists "a fifth (empty) slot"; v6.39 has two (slot 6 named with boxes in the virgin
  EEPROM, `(empty)` after Restore).
- Plan 14 D9 fixes the Tones alias to General; D1 makes it follow the active profile.
- Plan 14's UNVERIFIED "Rename in Discreet, Loud and the empty slots" and its entry starting empty for
  slot 6: `plan14/open/12-n-2-10` shows each name and slot 6's two large boxes (counter 8).
- The brief names Meeting/Outdoor/Pager; v6.39 has none (D13).
- The kernel opens leaves on key release; the firmware activates on the key-down (D4).

## Done means

- Activate, the standby name and icon, the power key's list, Switch off! and Rename reproduce their
  goldens (pixels exact; timelines within ±2 ms after alignment, or a stated tolerance); the six
  Activate and the power-key goldens are asserted.
- Tones follow the active profile; every effect of a profile comes from its settings; the active
  profile and names persist and Restore resets them.
- No golden or placeholder names plan 17; the coverage guard accounts for every tree node.
- phone-core stays Nokia-agnostic; the website is unchanged; `vp check`, `vp run -r test` and
  `vp run website#build` pass; VISION, the specs and the plans README match what shipped.
