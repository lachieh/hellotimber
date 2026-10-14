# Plan 15 - Storage port, security code and Settings

> **For agentic workers:** execute task-by-task; tick checkboxes; commit per task.
> If this plan contradicts VISION.md, AGENTS.md, or the code, STOP and report.

**Prerequisites:** plans 13 and 14 complete (`@hellotimber/nokia-os` with the whole v6.39 tree,
stock widgets and the internal in-memory settings store).
**Ground truth:** the v6.39 emulator corpus at
`REF=/Volumes/SSD/Projects/lachieh/hellotimber/nokia-3310` (gitignored, main checkout only). Read
`$REF/captures/README.md`, `$REF/captures/6.39/boot-clean/NOT-ACHIEVED.md`, plan 13 and plan 14 in
full before starting. Task 0 writes this plan's captures to `$REF/captures/6.39/plan15/` and
`$REF/captures/5.79/plan15/`.
**Status:** not started.

## Goal

Give `@hellotimber/nokia-os` a memory that survives the page, and the Settings behaviour that
depends on it, as strictly as the evidence allows:

- a public host storage port (EEPROM-like key/value persistence: `window.localStorage` in the
  demo, in-memory by default and in tests);
- versioned, serialised EEPROM records, owned one per feature, starting with the settings store
  that plan 14 built in memory and a new security record;
- the virgin and factory states made explicit: what an empty EEPROM boots with, and what Restore
  factory settings writes;
- the security code (default `12345`): a stock code-entry widget with the captured `Code error`
  flow, used by every security-code leaf, and the post-acceptance flows of Phone security,
  Change security code and Restore factory settings;
- boot gates: the power-on security-code prompt when Phone security asks for it, and the welcome
  note, which the firmware shows instead of the connecting hands;
- the internal settings API that plans 16-22 consume.

The website does not change. Portfolio integration stays unsequenced.

## Why this plan exists (measured gap)

| Area                          | nokia-os after plan 14                                 | Evidence                                                                                                                                                                                                                             |
| ----------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Persistence                   | a fresh virgin store per `createStockPhone`            | the firmware keeps settings in its PMM/EEPROM partition: a welcome note saved with `saveflash` survives `reboot` (investigation W below)                                                                                             |
| Security code prompts         | first screen only, every key but C inert (plan 14 D11) | the prompt masks each digit with `*`; a wrong code shows `Code error` (octagon, ≈2.9 s), then the empty prompt again (probes A and B)                                                                                                |
| Boot                          | self-test + hands composition (plan 13 D12), no gate   | power-on with a code request: self-test, 42 ms blank, `Security code:` prompt, `Code accepted` (tick note), hands (`boot/power-on`, `boot/welcome`); with a welcome note the note replaces the hands for 4930.7 ms (investigation W) |
| Restore factory settings      | code prompt, then nothing                              | v5.79 with the firmware-accepted code: tick note ≈1.45 s (688/232/532 ms), then the Restore page (investigation O)                                                                                                                   |
| Settings that change the boot | Welcome note editor is a placeholder (pending:15)      | `Welcome\nnote\nsaved` / `erased` notes exist; the note is drawn at power-on (W)                                                                                                                                                     |
| Language                      | Русский/Български/Українська choices are placeholders  | each switches the whole UI to that language (`tree/06-settings/6-2-1-3.choose` ends on a Cyrillic page); no Cyrillic tree capture exists                                                                                             |

## Scope and non-goals

In scope: the storage port and EEPROM records; the persistent settings store; the security record
and code entry; Settings leaves 6-3-5 Phone security, 6-3-6-1 Change security code and 6-4
Restore factory settings; the code-entry part of 4-5-5 Clear timers; boot gates (security code,
welcome note) and the SIM identity port; factory state; the demo's persistence; documentation.

Deliberately left to later plans (each recorded in "Follow-up plan adjustments"):

- **Welcome note editor** (6-2-3) → plan 18. It is a text editor, and plan 18 builds stock text
  entry. Plan 15 owns the stored note and its boot display, so plan 18 only writes the key.
- **Language** Русский/Български/Українська (6-2-1-3…5) → a new plan 26 (Languages). Each choice
  switches every screen to Cyrillic text that no capture shows. Automatic and English already
  store and need nothing more.
- **Clock effects** (Hide clock on standby, 12-hour standby clock) → plan 21, which owns Clock.
- **Clear timers** after an accepted code, and the call-list erase that changing Phone security
  causes (user guide) → plan 22. **Phone book › Erase all** after its code → plan 19.
- **SIM PIN, PIN2, PUK and barring passwords** (6-3-1, 6-3-6-3, 6-3-6-4, call barring) stay
  first-screen prompts. They need a SIM model that no plan owns yet (Open question 9).
- **Profile switching** changes which profile the Tones keys alias → plan 17. Plan 15 keeps that
  rule in one function (`settingAlias`).

## Security-code investigation (planning, 2026-10-14)

Plan 13 Task 0 found that every in-menu security-code check answers `Code error` to `12345`,
although the power-on prompt accepts it, so Restore factory settings could not be captured. This
plan's investigation (scratch output under `/tmp/p15probe`, nothing written to REF) narrowed it
down:

| #   | Probe                                                                                                                                 | Result                                                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | v6.39 virgin power-on prompt, `00000` OK                                                                                              | `Code error` (octagon), then the empty prompt again: the boot gate really checks the code                                                                                                   |
| B   | v6.39 Menu 6 4, `12345` OK; also `00000`, and `1 C 1 2 3 4 5` (a dummy first key)                                                     | all `Code error`, then the empty `Security code:` prompt again. The crawl's "back to the list" was the crawler pressing C                                                                   |
| E   | EEPROM bytes                                                                                                                          | plaintext BCD `12 34 50` at flattened-PMM offset 0x10136 (logical 0x110 of the `EEPROM` block) in the virgin and in the used v5.79 EEPROM                                                   |
| G   | v6.39 MCU+PPM E with the used v5.79 phone's EEPROM tail                                                                               | boots with no code prompt (that phone had none), but in-menu `12345` is still `Code error`                                                                                                  |
| N   | v5.79 native image (real phone EEPROM), in-menu `12345`                                                                               | `Code error` too                                                                                                                                                                            |
| O   | the emulator's own oracle: `build/dct3_boot_trace` with `SECCODE=1` (its defaults are 3310 v5.79 addresses), on the v5.79 image       | `plaintext=12345 authoritative=62628 [firmware-verified] [DIVERGED]`. Typing `62628` in v5.79's Restore factory settings is **accepted**: tick note (688/232/532 ms), then the Restore page |
| P   | the four oracle routines ported to v6.39 by masked signature match (BL, PC-relative LDR and branch offsets wildcarded)                | unique matches: `get` 0x28819A, `decrypt` 0x2E8C1A, `verify` 0x2E8D50; the code block's RAM address is 0x111B84 (all seven literal-pool references agree)                                   |
| Q   | oracle on the v6.39 virgin image with those addresses (`SECCODE_GET/DECRYPT/BLOCK/VERIFY`, `SECCODE_DEBUG=1`)                         | plaintext = decrypted = `12345`; `verify("12345")` returns 0 at 20 M instructions and 1 at 120 M (power-on prompt time)                                                                     |
| R   | harness-only helper that arms the emulator's own verify-input repair (`dct3_web_seccode_reset`) at 0x2E8D50, then Menu 6 4 `12345` OK | the hook fires once with input `12345`, and the firmware still answers `Code error`                                                                                                         |
| W   | v6.39: welcome note `Hi` (multi-tap, Options › Save), `saveflash`, `reboot` from it, code at the prompt                               | prompt, `Code accepted` (tick, 689/247/491 ms), then `Hi` in the large face for 4930.7 ms with **no hands animation**, then the virgin clock wizard. EEPROM writes survive a reboot         |

Conclusions:

1. The in-menu rejection is an emulator limitation, not a different stored code: the firmware's
   own verify accepts `12345` at power-on time and the input reaching it in-menu is `12345` (R),
   yet it rejects it after setup. The stored code or the key verify uses changes between the two.
   The emulator documents the same class of fault for its 2100 profile and fixes it by
   re-provisioning the stored code with the firmware's own `encrypt` routine under the live key
   (`src/web/main.c`, `dct3_web_seccode_reset`). The 3310 profile has no `seccode_*` addresses,
   and v6.39's `encrypt` routine has not been located. That is Task 0c, time-boxed and optional.
2. **v5.79 works today** with the oracle's code `62628` (O). Its post-acceptance flows (Phone
   security, Change security code, Restore factory settings) and its option lists' opening
   positions after Restore are capturable now (Task 0b). They are another firmware version with
   a Romanian UI, so they are flow and default-value evidence, never pixels.
3. The virgin v6.39 EEPROM asks for the code at every power-on although its Phone security page
   shows `Off` (`tree/06-settings/6-3.sub` image 04). NOT-ACHIEVED.md's "Phone security (On)" is
   wrong (Conflicts). The virgin prompt is therefore an EEPROM artefact, not the Phone security
   setting, and stays unreproduced (plan 13 artefact table).
4. The user guide (helpdoc, "Phone security") says On asks for the code "when a new SIM card is
   inserted", meaning any card not among the last five used. "Security code" gives the default
   `12345`. "Restore factory settings" resets "the menu settings to their original values" and
   "has no effect e.g. on" phone book entries, messages, call register numbers and call divert.

## Decisions

Each decision states what changes relative to the brief and to plans 13 and 14.

**D1 - The storage port is the Web Storage subset (new).** `StockStorage` is
`{ getItem(key): string | null; setItem(key, value): void; removeItem(key): void }`, synchronous,
so a host passes `window.localStorage` as it is and tests pass `createMemoryStorage()`. The default
is a fresh in-memory storage per phone (today's behaviour). nokia-os writes only keys that start
with `STOCK_STORAGE_PREFIX` (`"nokia-os/"`). The brief's "key/value persistence" is kept, but the
port is not a bespoke interface: Web Storage is the only host the brief names and it is sync.
EEPROM writes on the phone are immediate, so every change writes at once.

**D2 - EEPROM records, one per owner (new).** A record is `{ name, version, initial(), decode(),
encode(), factory?() }`. Its storage key is the prefix plus `name`, and its value is
`{"version":n,...}` JSON with sorted keys. `src/firmware/records.ts` lists every record
(`STOCK_RECORDS`), so Restore factory settings and the demo's "Erase EEPROM" see all of them.
Plan 15 adds `settings` and `security`; plans 16-24 add their own records (phone book, messages,
call lists, reminders, scores) with their own versions, so no plan migrates another's data.
Format errors (not JSON, not an object, version not a positive integer, a version newer than the
code) throw from `createStockPhone`, naming the storage key. Stale content in a well-formed record
(an unknown setting key, an index out of range, marks of the wrong length) is dropped and
disappears on the next write. Storage failures on write are contained: the phone keeps the value
in memory and goes on.

**D3 - The settings record holds overrides of the virgin snapshot (continues plan 14 D9).** Plan
14's `virginSettings()` stays the computed initial state. The record stores only what the phone
has written since: `choices` (key → index), `marks` (key → booleans) and `texts` (key → string).
Loading applies them on top of the virgin snapshot, with plan 14's rule that a key's first choice
removes its virgin display text. Aliased keys are stored under their target, once. A test pins
the set of keys a record can hold, so a regenerated tree that renames a slug fails until the
version is bumped and a `decode` migration is written.

**D4 - Empty storage is the virgin EEPROM, and the demo boots it (decides the brief's question).**
The virgin state is the only state the goldens assert (unset tone lists, `Top score: 45`, page
values). An empty storage reproduces it, so every plan 13/14 golden keeps passing with the default
storage. The virgin power-on code prompt, the clock wizard and the first-standby `Snooze` prompt
stay unreproduced artefacts (plan 13). Reverse by seeding the factory state on first boot (one
call in `createStockPhone`).

**D5 - The factory state is what Restore factory settings writes (new).** Restore replaces the
settings record with `factory(current)`: choices and marks return to the virgin values, then
`FACTORY_DEFAULTS` applies. Typed texts the user keyed in (welcome note, profile names) and
`settings/security-settings/*` are kept (`RESTORE_KEEPS`). The security record and every record
without a `factory` function are kept, as the user guide lists. `FACTORY_DEFAULTS` holds only
values with evidence: v6.39 opening positions after a captured Restore if Task 0c succeeds,
otherwise the v5.79 opening positions from Task 0b for lists whose options match v6.39 by count
(each entry cites its capture, flagged `evidence: "v5.79"`). A list with no evidence keeps its
virgin value. Task 0b also decides `RESTORE_KEEPS` from what survived Restore on v5.79.

**D6 - Security code: stored, verified exactly, default `12345` (new).** The security record is
`{ code: "12345", recentSims: [] }` (plus a wrong-attempt counter only if Task 0 A3 shows a
lockout). Verification compares the typed digits with the stored code. The code length bounds
(the most digits the prompt takes; whether OK with too few does anything) come from Task 0 A2/A5.
The emulator limitation never becomes behaviour: no golden may record `12345` being rejected
in-menu. Wrong-code goldens are recorded with `00000`.

**D7 - One stock code-entry widget for every security-code leaf (extends plan 14 D11).** The
prompt's first screen is plan 14's; digits append to the entry, drawn as the captured `*` mask;
C deletes the last digit and leaves on an empty entry (per Task 0 A5); OK verifies. A wrong code
shows `Code error` with the captured timeline and returns to the empty prompt (B). An accepted code
runs the leaf's flow (D8). Bound to 6-3-5, 6-3-6-1 and 6-4, to the 4-5-5 Clear timers page result
(accept → plan 22's placeholder), and exported internally for plan 19's Erase all. Other code
prompts (PIN, PIN2, barring password) keep plan 14's first screen.

**D8 - Post-acceptance flows: v6.39 captures if Task 0c succeeds, else compositions with
v5.79 evidence (new; a narrow exception to plan 13 D8 and plan 14 D13).** No v6.39 capture shows
what follows an accepted in-menu code. Without Task 0c, each flow is composed from captured stock
widgets in the shape Task 0b records on v5.79, using v6.39's own strings transcribed by hand from
the firmware string table (`$REF/extracted/6.39/text/english.txt`, cited by string id in
`bindings.ts`; nothing is imported). Every composed screen is listed in `COMPOSED_FLOWS` with its
evidence and is UNVERIFIED in the spec. Indicative shapes, to be replaced by 0b's observations:

- Phone security (6-3-5): code → option list `On`/`Off` on the stored value (OK) → tick note →
  the Phone security page with the new value. Turning it On adds the current SIM to the recent
  list.
- Change security code (6-3-6-1): `Security code:` → `Enter new\nsecurity code:` → `Verify new\nsecurity code:` →
  `Security\ncode\nchanged` (tick) or `Codes\ndo not\nmatch` (error, then the step 0b shows).
- Restore factory settings (6-4): code → `Settings\nrestored` (tick, ≈1.45 s as on v5.79) → the
  Restore page.

If Lachlan rejects composed screens (Open question 3), these three leaves keep the code-entry
widget and open plan 15's placeholder after an accepted code instead.

**D9 - Boot gates: a generic phone-core seam and two stock gates (new; revises plan 13 D12).**
phone-core gains `PhoneConfig.bootGates`: at an offset into the boot, an application may hold the
boot; its `exit()` resumes the boot there, `exit({ to: "standby" })` ends it. nokia-os sets two
gates at the end of the self-test (4073 ms, `boot/power-on` frames 0-3):

1. **Security code**, when Phone security is On and the inserted SIM is not among the last five
   used (user guide). It draws the captured 42 ms blank, the prompt, the mask, `Code error` and
   `Code accepted` (the timelines of `boot/power-on` frames 4-5 and `boot/welcome` frames 0-3),
   then the hands resume. With `boot: "skip"` this gate still runs: skipping an animation must
   not skip a lock.
2. **Welcome note**, when one is stored: the note in the large face for 4930.7 ms (W), then
   standby, so the hands never play. Skipped with `boot: "skip"`.

A boot with no gate is plan 13's composition (UNVERIFIED as one sequence). A boot with the
welcome note and no security gate is a composition too (W had the gate before the note).

**D10 - The inserted SIM is host config (new).** `StockPhoneConfig.sim` (default `"sim-1"`) names
the SIM. At each power-on that passes, the SIM moves to the front of `recentSims` (five at most).
The brief asked for "the boot security prompt when Phone security is On"; the user guide ties the
prompt to a new SIM, so the strict reading needs the SIM's identity (Conflicts, Open question 2).
The demo offers two SIMs to show the gate.

**D11 - The settings API for plans 16-22 is internal (continues plan 14 D9).** Hosts see only
`StockStorage`, `createMemoryStorage`, `STOCK_STORAGE_PREFIX` and the `storage`/`sim` config.
nokia-os modules read and write settings through `StockSettings` and their own records through
`StockEeprom` ("Settings API for later plans"). No subscription API: pages and painters re-read
on every tick already, and a consumer reads a setting when it acts (a key beep reads Keypad tones
when the key is pressed).

**D12 - Re-owned placeholders keep the coverage guard honest (changes plan 14 "Leaf
ownership").** 6-2-3 Welcome note moves to plan 18 and 6-2-1-3…5 to plan 26. Both
`PLACEHOLDER_OWNERS` tables (`scripts/tree-capture-set.ts`, `src/firmware/bindings.ts`) and the
pending goldens' status change together, so no golden stays `pending:15` when this plan is done.

**D13 - The website does not change.** phone-core's seam is opt-in; the website sets no gates.
`git diff --stat <commit before Task 1> -- website/` is empty at the end.

## Ground truth and artefacts

| Source                                               | Contents                                                                                                                                                                                             | Use                                                                   |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `captures/6.39/boot/power-on/` (existing)            | self-test 0-3, blank 42 ms (4), prompt (5)                                                                                                                                                           | security gate golden (Task 2), now imported whole                     |
| `captures/6.39/boot/security-code-entry/` (existing) | the mask as digits are typed                                                                                                                                                                         | security gate golden                                                  |
| `captures/6.39/boot/welcome/` (existing)             | `Code accepted` 0-3, hands 4-10, clock wizard 11-15                                                                                                                                                  | frames 0-10; 11-15 stay omitted (artefact)                            |
| `captures/6.39/plan15/` (Task 0a)                    | boot gate probes, in-menu wrong-code flows, code keys, welcome-note boots, persistence, OCR                                                                                                          | asserted goldens                                                      |
| `captures/5.79/plan15/` (Task 0b)                    | v5.79 accepted-code flows, option lists before and after Restore                                                                                                                                     | flow shapes (D8) and `FACTORY_DEFAULTS` evidence (D5); never imported |
| `captures/6.39/plan15/accept/` (Task 0c, optional)   | v6.39 accepted-code flows, factory scrolls, a boot after Restore                                                                                                                                     | asserted goldens replacing the D8 compositions and 0b evidence        |
| `extracted/6.39/text/english.txt`                    | `Settings\nrestored` (0x2d6), `Security\ncode\nchanged` (0x3d3), `Enter new\nsecurity code:` (0x3d5), `Verify new\nsecurity code:` (0x3d6), `Codes\ndo not\nmatch` (0x1c5), `Code\naccepted` (0x1c3) | strings for composed screens only (D8), transcribed with their ids    |

New artefacts (spec §10 table, Task 1):

| Artefact                                                       | Cause                                                      | Handling                                                              |
| -------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------- |
| In-menu `Code error` for the correct code                      | emulator: stored code or key differs after power-on (R)    | never recorded as behaviour; wrong-code goldens use `00000` (D6)      |
| Security prompt at every virgin power-on, Phone security `Off` | virgin EEPROM state                                        | not reproduced (D4); the gate follows Phone security and the SIM (D9) |
| Clock wizard after the welcome note (W)                        | virgin EEPROM, emulator RTC                                | cut from the welcome-note golden (omitted frames)                     |
| v5.79 code `62628`                                             | emulator identity: the v5.79 code block decrypts to it (O) | used only to drive Task 0b                                            |

## Package boundaries

Unchanged from plans 13 and 14. phone-core gains one generic, opt-in seam (`bootGates`) with no
Nokia labels or timings. nokia-os gains no dependency. Scripts keep plan 13's conventions.

## Contract changes

Task 1 writes these into `VISION.md`.

### `@hellotimber/phone-core` (additive, opt-in)

```ts
export interface BootGate {
  /** Offset into the boot (ms) at which the gate is asked; an integer in 0..bootMs. */
  atMs: number;
  /**
   * Called once per power-on when the boot reaches `atMs`. An application holds the boot until it
   * exits; undefined lets the boot go on.
   */
  open(): PhoneApplication | undefined;
}

export interface PhoneConfig<Metadata = unknown> {
  // ...plan 13/14 fields unchanged...
  /** Plan 15: applications that hold the boot at offsets into it, in ascending `atMs`. */
  bootGates?: readonly BootGate[];
}
```

Rules (Task 3 pins each with a test): gates must be in ascending `atMs` (equal offsets run in
order) and each `atMs` an integer in `0..bootMs`, else `createPhone` throws. With `bootMs: 0` the
gates run in order at power-on, before standby. While a gate application runs, the boot clock is
paused, the screen is the application's, keys go to it, the path stays `standby`, and
`navigate()` only records the target applied when the boot ends; the power long press still
powers off (deactivation reason `power-off`). `exit()` resumes the boot at `atMs` (the next gate at
the same offset first); `exit({ to: "standby" })` ends the boot at once; `levels`, `select` and
`row` throw. `open()` replaces the gate application in place; `menuIndicator()` returns no
segments. An exception from `open()` or `createSession` skips that gate. The website sets no
gates, so its models are unchanged.

### `@hellotimber/nokia-os` (additive)

```ts
/** The phone's EEPROM, as the Web Storage subset (`window.localStorage` fits). */
export interface StockStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** nokia-os writes only keys that start with this. */
export const STOCK_STORAGE_PREFIX = "nokia-os/";

/** A fresh in-memory storage (the default; tests). */
export function createMemoryStorage(): StockStorage;

export interface StockPhoneConfig {
  carrier: string; // unchanged
  clock?: () => string | undefined; // unchanged
  date?: () => string | undefined; // unchanged
  boot?: "animated" | "skip"; // unchanged; "skip" still runs the security gate
  /** Plan 15: where settings persist. Default: a fresh in-memory storage. Empty = virgin EEPROM. */
  storage?: StockStorage;
  /**
   * Plan 15: the inserted SIM card's identity. With Phone security On, power-on asks for the
   * security code when this SIM is not among the last five used. Default "sim-1"; non-empty.
   */
  sim?: string;
}
```

`createStockPhone` throws when a stored record is malformed or newer than the code (D2), naming the
storage key. `stockMenu`, `paintStockScreen` and `missingStockGlyphs` are unchanged.

## Settings API for later plans (internal)

Plans 16-22 consume these from `src/firmware/`. Signatures are fixed by Tasks 4-6; a change is a
Deviation recorded here.

```ts
// src/firmware/eeprom.ts
export interface EepromRecord<T> {
  readonly name: string; // storage key = STOCK_STORAGE_PREFIX + name; kebab-case
  readonly version: number; // positive integer; bump on any shape change
  initial(): T; // the virgin EEPROM value
  /** Decodes a stored value written by `version` (older versions migrate); throws on bad shape. */
  decode(data: unknown, version: number): T;
  encode(value: T): unknown; // JSON-safe; keys sorted by the writer
  /** What Restore factory settings leaves; absent = the record is kept (user guide). */
  factory?(current: T): T;
}
export class StockEeprom {
  constructor(storage: StockStorage, records?: readonly EepromRecord<unknown>[]); // default STOCK_RECORDS
  read<T>(record: EepromRecord<T>): T; // decoded once, then cached
  write<T>(record: EepromRecord<T>, value: T): void; // immediate; storage failures contained
  restoreFactory(): void; // applies every record's `factory`
}

// src/firmware/records.ts: the one list of records (plans 16-24 append theirs)
export const STOCK_RECORDS: readonly EepromRecord<unknown>[]; // [SETTINGS_RECORD, SECURITY_RECORD]

// src/firmware/settings.ts (plan 14's interface, extended)
export interface StockSettings {
  choice(key: string): number | null;
  choose(key: string, index: number): void;
  marks(key: string): readonly boolean[];
  toggle(key: string, index: number): void;
  text(key: string): string | undefined;
  /** Plan 15: write (or, with undefined, clear) a typed text: welcome note, profile name. */
  setText(key: string, text: string | undefined): void;
  /** Plan 15: the chosen option's label of a single-choice setting (`"Level 2"`), if chosen. */
  label(key: string): string | undefined;
}
export function createStockSettings(eeprom: StockEeprom): StockSettings; // persistent
export const SETTINGS_RECORD: EepromRecord<SettingsOverrides>;

// src/firmware/security.ts
export const SECURITY_RECORD: EepromRecord<SecurityState>; // { code: "12345", recentSims: [] }
export class StockSecurity {
  constructor(eeprom: StockEeprom, settings: StockSettings);
  verify(code: string): boolean;
  changeCode(code: string): void; // throws outside the captured length bounds
  phoneSecurity(): boolean; // settings/security-settings/phone-security is On
  asksAtPowerOn(sim: string): boolean; // phoneSecurity() && sim not in recentSims
  insertSim(sim: string): void; // to the front of recentSims, five at most
}

// src/widgets/code-entry.ts
export function codeEntry(options: {
  readonly lines: readonly string[]; // the prompt's label (tree lines)
  readonly security: StockSecurity;
  readonly accepted: (flow: Flow) => void; // what an accepted code opens
}): Widget;
```

Setting keys stay plan 14's slug paths (`tones/keypad-tones`). New keys:
`settings/security-settings/phone-security` (a choice, labels `On`/`Off` per Task 0b, virgin
`Off`) and `settings/phone-settings/welcome-note` (a text; absent = no note).

## Golden pipeline additions

Plan 13's capture set gains rows (`scripts/capture-set.ts`); `NOT_IMPORTED` loses the rows they
replace. Probes join plan 14's `probeCaptureSet` table (`scripts/tree-capture-set.ts`) with
hand-written scenarios. All are `asserted` unless noted:

| Fixture id                       | Source (`$REF/captures/6.39/`)                              | Kind     | Asserts                                                                           |
| -------------------------------- | ----------------------------------------------------------- | -------- | --------------------------------------------------------------------------------- |
| `boot/security-gate`             | `plan15/boot/gate` (cut at the first clock-wizard frame)    | timeline | self-test, blank, prompt, mask, boot `Code error`, prompt, `Code accepted`, hands |
| `boot/security-gate-keys`        | `plan15/boot/gate-keys/*.png`                               | stills   | mask after each digit, C, the most digits, OK with too few                        |
| `boot/security-lockout`          | `plan15/boot/gate-lockout` (only if A3 shows one)           | timeline | the wrong-attempt limit                                                           |
| `boot/welcome-note`              | `plan15/boot/welcome-hi` (cut at the clock wizard)          | timeline | gate, `Code accepted`, `Hi` for 4930.7 ms                                         |
| `boot/welcome-note-long`         | `plan15/boot/welcome-long` (cut likewise)                   | timeline | a note that needs more than one line                                              |
| `probe/code-wrong-<number>` (×4) | `plan15/menu/<number>-wrong` for 6-3-5, 6-3-6-1, 6-4, 4-5-5 | timeline | mask, `Code error`, the empty prompt, C                                           |
| `probe/code-keys-6-4`            | `plan15/menu/6-4-keys/*.png`                                | stills   | in-menu C, OK on empty and with too few digits                                    |
| `probe/persist-reboot`           | `plan15/persist/*.png`                                      | stills   | pages and lists after a reboot show the stored choices                            |
| `probe/accept-<flow>` (Task 0c)  | `plan15/accept/<flow>`                                      | timeline | only if Task 0c succeeds (replaces `COMPOSED_FLOWS` entries)                      |

`boot/power-on` (plan 13's D12 composition) stays the gate-free boot. Text runs for the new images
(`*`, `Code error`, `Code accepted`, `Hi`, the long note) are added to plan 13's manual
`scripts/text-runs.ts` (few images), checked against `plan15/text.json`.

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
- Parallelism (max 3 concurrent agents): Task 0 gates everything, then Task 1. Then lanes A (3),
  B (4 → 5) and C (2). Task 6 needs 2 and 5; Task 7 needs 6; Task 8 needs 3 and 6; Task 9 needs 7
  and 8; then 10.

## Tasks

### Task 0 - REF captures and the security-code follow-through (no repository changes)

**Files (all under `$REF`, gitignored):** `captures/scripts/v639-plan15.cap`,
`captures/scripts/v579-plan15.cap`, `captures/6.39/plan15/**`, `captures/5.79/plan15/**`,
`firmware/work/v639-plan15-*.fls`, `firmware/work/v579-plan15-*.fls`, a "Plan 15 supplementary
captures" section in `captures/README.md`, an addendum to `captures/6.39/boot-clean/NOT-ACHIEVED.md`;
Task 0c only: `tools/harness/build.sh` and `tools/harness/dct3cap.c` (harness-only helpers).

Concurrent sessions use the harness (`captures/scratch-plan23/` was active during planning):
write only the paths above. Scripts use `reboot <absolute image path>` between sections (the
harness runs from the emulator's directory, so relative image paths do not resolve), and `record
<name> start` … `record stop` for recordings that span keys.

**0a - v6.39 virgin image** (`tools/harness/cap firmware/raw/6.39/combined/3310_v639_ppm_E_virgin_eeprom_2MiB.fls captures/scripts/v639-plan15.cap captures/6.39`):

- [x] A1 `plan15/boot/gate`: from power-on, record 30 s: `run 8s`; `0 0 0 0 0`, OK; `run 4s`;
      `1 2 3 4 5`, OK; `run 12s`. Also `audio plan15/boot/gate` (plan 16 wants key beeps).
- [x] A2 `plan15/boot/gate-keys/`: shots after `1`, after `2`, after C, after C on the empty
      entry (plus 2 s: does it do anything?), after typing 11 digits one by one (shot from the
      5th; the most digits the mask takes), after holding C for 1 s with digits typed, and after
      OK with `1 2 3` (record 4 s).
- [x] A3 `plan15/boot/gate-lockout`: six wrong codes in a row (record), then `12345`. Report
      whether any lockout note or refusal appears.
- [x] A4 `plan15/menu/<number>-wrong` for 6-3-5, 6-3-6-1, 6-4 and 4-5-5 (Call register › Show
      call duration, ▼ to Clear timers, Select): navigate, `record ... start` before the Select,
      Select, `run 2s`, `0 0 0 0 0` one key at a time, OK, `run 5s`, C, `run 2s`, `record stop`.
      Use `00000`, never `12345` (D6).
- [x] A5 `plan15/menu/6-4-keys/`: in Restore's prompt: shot after `1 2`, after C, after C on
      empty (where does it go?), OK on empty, OK with `1 2 3`, 11 digits.
- [x] A6 welcome note: Menu 6 2 3, multi-tap `Hi` (`4 4`, wait 1.5 s, `4 4 4`), Options › Save
      (record the note into `plan15/welcome/save-hi`), `saveflash firmware/work/v639-plan15-welcome-hi.fls`,
      `reboot` from it, record 25 s into `plan15/boot/welcome-hi` with the code at 8 s. Repeat
      with a note long enough to need a second line (`plan15/boot/welcome-long`; pick words whose
      letters are easy to type). Record Options › Erase too (`plan15/welcome/erase`).
- [x] A7 `plan15/persist/`: choose Tones › Keypad tones › Level 2 and Settings › Phone settings ›
      Cell info display › On; `saveflash`; `reboot` from it; setup; shots of both pages and both
      lists as they open.
- [x] OCR every image under `plan15/` with `tools/menutree/ocr.py` into `plan15/text.json` (plan
      14's format).

**0b - v5.79 native image, code `62628`** (`firmware/raw/5.79/3310_nr1_v579.fls`; Romanian UI;
the code is the emulator oracle's, probe O). Navigate with ▼ and read numbers from the indicator:
v5.79's tree is not crawled, so do not assume v6.39 numbers.

- [x] B1 `5.79/plan15/before/<v639 number>.png`: the first screen of each option list whose v6.39
      virgin value is an artefact (spec §10: the unset lists in Tones and General's Personalise,
      Screen saver › Timeout, Set delay, Message alert tone, Games › Settings, every Settings
      list), and the Profiles names, after the clock setup.
- [x] B2 Restore: set a welcome note and change two settings first; then Restore factory
      settings with `62628` (record from before OK to the settled page); then `after/` shots of
      the B1 screens, the welcome note page, the profile names and Phone book (data kept?).
- [x] B3 Phone security with `62628`: record what follows the code; choose On; then `saveflash`,
      `reboot` from it: does the same SIM get the power-on prompt? Then Off again.
- [x] B4 Change security code: `62628` → new `11111` → verify `22222` (record the mismatch and
      where it returns) → again with a matching verify (record) → Restore's prompt accepts `11111`?
- [x] Write a table in the README section: per v6.39 list, its v5.79 option count and opening
      index before and after Restore. Lists whose counts differ are marked "no evidence".

**0c - optional, time-boxed to 3 hours: make v6.39 accept the code in-menu.** Known (probes P-R):
`get` 0x28819A, `decrypt` 0x2E8C1A, `verify` 0x2E8D50, code block RAM 0x111B84; input repair at
verify's entry is not enough. The harness already appends helpers to its copy of `main.c`
(`build.sh`); add more there and in `dct3cap.c`, never in the emulator's sources.

- [x] Compare the 8 bytes at 0x111B84 (and verify's other inputs, found by disassembling 0x2E8D50
      with `tools/nokia-dct3-emulator/tools/disfw.c`) at power-on prompt time and at the in-menu
      prompt. If only the block changed, a harness command restoring the power-on bytes before the
      in-menu verify is enough. Otherwise locate v6.39's `encrypt` routine (the one verify calls
      before its compare) and re-provision the block with `encrypt("12345")` in context, as the
      emulator's 2100 hook does.
- [x] If achieved: repeat B2-B4 on v6.39 into `6.39/plan15/accept/<flow>`; scroll every option
      list after Restore into `6.39/plan15/factory/scroll/<number>` (plan 14's C1 style); and
      record a power-on after Restore into `6.39/boot-clean/power-on` if Restore clears the virgin
      prompt. Document the commands in the README section.
- [x] If not achieved within the box: record what was tried in the NOT-ACHIEVED addendum.
      (Not needed: 0c was achieved. The addendum records how.)

- [x] Append "Plan 15 supplementary captures" to `$REF/captures/README.md`, including the
      investigation table above and the oracle invocation:
      `cd tools/nokia-dct3-emulator && SECCODE=1 SECCODE_DEBUG=1 SECCODE_GET=0x28819a SECCODE_DECRYPT=0x2e8c1a SECCODE_BLOCK=0x111b84 SECCODE_VERIFY=0x2e8d50 build/dct3_boot_trace <fls> 120000000`.
- [x] No commit. Record the outcome under this task, as plans 13 and 14 did: A1-A7 facts (code
      length bounds, C behaviour, lockout, welcome-note layout and duration), B1-B4 flow shapes
      and the default-value table, and 0c's result.

**Task 0 outcome (2026-10-14).** Scripts `captures/scripts/v639-plan15.cap` (0a and 0c),
`v579-plan15.cap` (0b) and, for a second SIM, `v639-plan15-sim2.cap` and `v579-plan15-sim2.cap`
(the harness reads the SIM fixture once per process, so each SIM needs its own run; fixture
`captures/5.79/plan15/sim2-gsm.json`). Output: 6.39/plan15 has 2040 images and 40 timelines,
including 159 factory scrolls; 6.39/boot-clean has two new timelines; 5.79/plan15 has 1323 images
and 21 timelines; `plan15/text.json` holds the OCR. The README section
"Plan 15 supplementary captures" has the commands, the investigation and the v5.79 table. Harness
additions in `build.sh`/`dct3cap.c`: `peek`, `poke`, `call` (an in-context firmware call); the
binary is now rebuilt by an atomic rename.

- A1 boot gate (`boot/gate`): self-test 0-3, 42 ms blank, prompt, the mask, boot `Code error`
  2889 ms, empty prompt, `Code accepted` 689/232/582 ms, hands (308 ms, then ≈255 ms steps, last
  4215.6 ms), clock wizard. Audio recorded.
- A2/A5 code entry: the mask is `*` in `bold8` from x 0, top 29. It holds 10 digits; the 11th key
  is ignored. C deletes the last digit and C held 1 s clears all. C on the empty entry does nothing
  at the boot gate (still nothing 2 s later) and returns to the page at once in a menu. OK with
  fewer than 5 digits, or empty, shows `Code error` (≈2.9 s), then the empty prompt.
- A3 lockout: five consecutive wrong codes lock every entry, the correct code included. Each
  attempt gets `Code error`, with no other note. The lockout lasts ≈290 s of emulated time
  (`12345` was rejected 286.7 s after the fifth OK and accepted 291.7 s after it). Any entry
  during the lockout restarts it. It survives a power cycle. Four wrong codes then `12345`: accepted.
  The counter (0x111B88, EEPROM) and the routine are shared by the boot gate and the menus. An
  accepted code resets the counter.
- A4 in-menu wrong code (6-3-5, 6-3-6-1, 6-4, 4-5-5): page; prompt 50-66 ms after Select; mask;
  `Code error` 2902-2905 ms; empty prompt; C returns to the page. 4-5-5's page softkey is `OK`.
- A6 welcome note: the editor counts down from 36 characters. Options are `Save` and `Erase`.
  `Welcome\nnote\nsaved` and `...erased` are tick notes (686/232/525 ms), then the page. At
  power-on, the note replaces the hands. It is drawn in `large13` from x 1 at tops 7 and 22 and
  wraps at the space (`Welcome to` / `my phone`). After the gate, both notes end 6357.9 ms after
  `Code accepted` appears (`Hi` 4930.7 ms; the long note starts 16 ms later and lasts 4914.7 ms).
  With no gate (`factory/boot`, after a Restore), `Hi` follows the self-test after a 7 ms partial
  draw and lasts 5079.5 ms, then the clock wizard. After Erase, the hands play again
  (`boot/welcome-erased`).
- A7 persistence: Keypad tones `Level 2` and Cell info display `On` survive `saveflash` +
  `reboot`. Both pages show the value and both lists open on it.
- B1/B2 v5.79 Restore: page, prompt, `62628`, then `Revenit la setările originale` (tick
  689/232/518 ms), then the page. These were unchanged by Restore: the welcome note (shown at the
  next power-on), the Top scores (1297, 7745) and the language. Reset: the tone and setting lists
  (README table) and the profile names (slot 3 `MyX` became `Discret` with Discreet's values).
  Phone book: no evidence, because the SIM holds no names. The table is superseded by the v6.39
  factory scrolls below. Games › Settings is where they differ: v5.79's factory is `Off`, v6.39's
  is `On`.
- B3 Phone security: prompt, code, then the list at once. It has no `Code accepted` note, opens on
  the stored value and lists `Off` first. OK shows a `Done` tick, then the page. The new-SIM rule
  holds on both versions. With Phone security On, the same SIM powers on with no prompt. A SIM
  never used gets the prompt, then `Code accepted`. That SIM gets no prompt the next time. With
  Phone security Off, a new SIM gets no prompt.
- B4 Change security code: `Security code:` → `Enter new\nsecurity code:` → `Verify new\nsecurity
  code:`. A mismatch shows `Code error` (2907-2911 ms) and returns to `Enter new security code:`.
  A new code must have exactly 5 digits: 0, 4, 6 and 10 digits all show `Code error` and return
  to `Enter new`. A match shows `Security\ncode\nchanged` (tick 680/232/537 ms), then the page.
  Afterwards the old code fails and the new one passes (in menus).
- 0c **achieved** (the fix took about 30 minutes of the 3-hour box). The virgin PMM stores the code record enciphered under
  another key. The firmware reloads it into 0x111B84 when the clock wizard is left, and from then
  on no 5-digit code verifies. The firmware's own set-code routine, called in context at standby
  (`call 0x2e8d96` with `"12345"`, then `saveflash`), re-provisions the record. On the saved image
  (`firmware/work/v639-plan15-seccode.fls`) every in-menu prompt accepts `12345`. The v6.39 flows
  are in `6.39/plan15/accept/`:
  - Phone security, as on v5.79: `Done` tick, then the page.
  - Change security code, as B4 with v6.39's strings.
  - Clear timers: `Timers\ncleared` tick, then the page.
  - Restore: `Settings\nrestored` tick (679-697/217-233/515-546 ms), then the page.
  - The factory scroll of every submenu, option list and info-pages list is in `factory/scroll/`.
  - Restore removes the virgin power-on prompt. `6.39/boot-clean/power-on` records the gate-free
    boot: self-test, then the hands at irregular steps (132, 360, 302, 292, 366, 287, 320 ms, last
    3951 ms), then the clock wizard.
  - v6.39's Restore keeps the welcome note and the security code. It resets Phone security to
    `Off`, the profile names (`Silenth` returned to `Silent`; slot 6's boxes became `(empty)`),
    the Info service topics (only `Add topic` remains) and the Info service language marks.
  - Factory values that differ from the virgin EEPROM: Ringing tone `Nokia tune`, Ringing volume
    `Level 4`, Incoming call alert `Ringing`, Message alert tone `Standard`, Keypad tones
    `Level 2`, Warning tones `On`, Vibrating alert `On`, Screen saver Timeout `5 seconds`, Own
    number sending `Set by network` and Set delay `30 seconds`. Each profile has its own values
    (the README table), and v5.79's agree slot by slot. Every other list keeps its virgin
    opening.

Deviation (D6, D7; Tasks 6, 8): a lockout exists (A3). The security record needs the
wrong-attempt counter and the lockout's start. Any entry during the lockout gets `Code error` and
restarts it, and the lockout survives power-off. The boot gate's C on an empty entry is inert,
unlike the menus (A2/A5). `changeCode` takes exactly 5 digits (B4).

Deviation (D8; Tasks 2, 7; Open question 3 is moot): Task 0c succeeded. Phone security, Change
security code, Restore and Clear timers are v6.39 captures (`plan15/accept/`), not compositions.
`COMPOSED_FLOWS` is empty for them, and Task 2 imports `probe/accept-*`. Change security code's
mismatch shows `Code error`, not `Codes do not match`, and returns to `Enter new security code:`.
No in-menu flow shows `Code accepted`. The Phone security list is `Off`, `On`, in that order
(Task 5's `CODE_SETTINGS` labels). Clear timers' accepted flow shows `Timers cleared`; erasing
the timers stays with plan 22.

Deviation (D5; Tasks 5, 7): `FACTORY_DEFAULTS` comes from the v6.39 factory scrolls with
`evidence: "v6.39"`, not from v5.79. `RESTORE_KEEPS` is the welcome note only, plus the security
record. Restore resets profile names (typed texts), `settings/security-settings/phone-security`
and the Info service topics and language marks. The follow-ups for plans 17 (profile names are
reset) and 18 (Restore clears the topics) change accordingly.

Deviation (D9; Tasks 2, 8; plan 13 D12): the gate-free power-on is now a capture
(`boot-clean/power-on`) and replaces plan 13's composition as the asserted boot. Its hands steps
differ from `boot/welcome`'s. The welcome-note boot without a gate is captured too
(`factory/boot`), so it is no longer a composition. Under the gate, the note's end is anchored
6357.9 ms after `Code accepted`, not at a fixed 4930.7 ms. Task 8 times the gated note from
`Code accepted` and the gate-free note from the self-test.

Deviation (Conflicts; Task 1): the virgin power-on prompt comes from the stale code record. Its
handling as an artefact (D4) is unchanged. NOT-ACHIEVED.md has an addendum. Open question 2 is
settled by evidence: the prompt follows Phone security plus an unknown SIM on v5.79 and on v6.39.

### Task 1 - Contracts and documentation

**Files:** `VISION.md`, `docs/specs/nokia-3310.md`, `docs/specs/nokia-3310-menu-tree.md`,
`docs/plans/README.md`, this plan.

- [ ] Apply Task 0's outcome to D5-D9 (Deviation lines where it changes them), including the
      composed flows' final shapes and `FACTORY_DEFAULTS`' evidence.
- [ ] VISION: `BootGate`/`bootGates` and their rules; nokia-os `StockStorage`,
      `STOCK_STORAGE_PREFIX`, `createMemoryStorage`, `StockPhoneConfig.storage`/`sim`; a sentence
      that empty storage is the virgin EEPROM.
- [ ] Spec §3: the welcome note replaces the hands (W). Spec §10: a "Security code, boot gates
      and storage (plan 15)" subsection (gate timeline, mask, `Code error` flow, the investigation
      outcome, Restore's shape, the virgin-vs-factory rule) and the new artefacts. Mark everything
      not yet asserted "(plan 15, in progress)".
- [ ] Menu-tree spec "Behind codes the emulator could not pass": replace the paragraph with the
      oracle finding and the corrected `Code error` return (to the prompt, not the list).
- [ ] Plans README: row 15 `in progress`; add row 26 (Languages: Русский, Български, Українська UI;
      depends on 14, 15; not started).
- [ ] No runtime code. `mise exec -- vp check --fix`.
- [ ] Commit: `docs: define storage port, security code and boot gate contracts (plan 15)`.

### Task 2 - Goldens, glyphs and re-owned placeholders (TDD)

**Files:** `scripts/capture-set.ts`, `scripts/tree-capture-set.ts`, `scripts/text-runs.ts`,
`scripts/glyph-overrides.ts`, `src/firmware/bindings.ts` (`PLACEHOLDER_OWNERS` only),
`tests/goldens-integrity.test.ts`, `tests/tree-capture-set.test.ts`, `tests/acceptance.test.ts`
(todo shim only), `goldens/**`, `src/resources/generated/**`.

- [ ] Add the "Golden pipeline additions" rows (cut points as `FrameRange`s; the omitted clock
      wizard frames listed under `omitted` with the reason). Remove the replaced
      `NOT_IMPORTED` reasons (`boot/security-code*`, `boot/welcome` 11-15 keeps its reason).
- [ ] Re-own placeholders (D12) in both `PLACEHOLDER_OWNERS` tables: `6-2-3` → `18`,
      `6-2-1-3`, `6-2-1-4`, `6-2-1-5` → `26`. Their goldens become `pending:18`/`pending:26`.
- [ ] Transcribe the new images' text runs in `text-runs.ts` (the mask face as measured; `Code
error`, `Code accepted` and the welcome notes in `large`), checked against
      `plan15/text.json`. Resolve harvester reports with overrides naming their golden.
- [ ] Integrity tests: the new ids exist and parse; no golden is `pending:15`; the two owner tables
      are equal (plan 14 Task 13's test covers the rest).
- [ ] `tests/acceptance.test.ts`: list the new asserted goldens without a scenario as todos
      (`awaitsPlan15Scenario`; Task 10 deletes it).
- [ ] Run `import-captures` and `extract-resources` twice each; the second runs change nothing.
      Record fixture counts and new glyphs in a completion note.
- [ ] `mise exec -- vp run @hellotimber/nokia-os#test`, `mise exec -- vp check --fix`.
- [ ] Commit: `feat(nokia-os): import security-code and boot-gate goldens (plan 15)`.

### Task 3 - phone-core: boot gates (TDD)

**Files:** `packages/phone-core/src/{types.ts,machine.ts,application.ts,index.ts}`, README;
tests `boot-gates.test.ts` (new).

- [ ] TDD validation: unsorted gates, a non-integer or out-of-range `atMs` throw; gates without
      `bootTimeline` and with the legacy boot both work.
- [ ] TDD the hold: at `atMs` the boot frame stops advancing, the gate's render is the screen,
      keys reach it, `phone.path` is `standby`, snapshots fire on its renders only.
- [ ] TDD the exits: `exit()` resumes the timeline at `atMs` (the remaining duration is exact);
      two gates at the same offset run in order; `exit({ to: "standby" })` ends the boot; `levels`,
      `select` and `row` throw; `open()` replaces in place.
- [ ] TDD `navigate()` during a gate records the target, applied at the boot's end; power long
      press deactivates the gate once with `power-off`; a new power-on calls `open()` again.
- [ ] TDD `bootMs: 0`: gates run in order at power-on, then standby (and a pending deep link).
- [ ] TDD containment: `open()` or `createSession` throwing skips the gate.
- [ ] Existing tests pass unchanged; configs without gates produce identical models.
- [ ] `mise exec -- vp run @hellotimber/phone-core#test`, `vp run -r test`, `vp run website#build`, `vp check --fix`.
- [ ] Commit: `feat(phone-core): boot gates`.

### Task 4 - The storage port and EEPROM records (TDD)

**Files:** `src/firmware/eeprom.ts` (new), `src/firmware/records.ts` (new), `src/index.ts`,
`tests/eeprom.test.ts` (new).

- [ ] TDD `createMemoryStorage`: the Web Storage subset; separate instances share nothing.
- [ ] TDD `StockEeprom` with a toy record: missing key → `initial()`; round trip; the stored JSON
      is `{"version":n,...}` with sorted keys (exact string asserted); `decode` receives older
      versions; malformed JSON, a non-object, a bad or newer version throw naming the key; reads
      are cached; a throwing `setItem` keeps the value in memory and does not throw;
      `restoreFactory()` applies `factory` and leaves records without one untouched; only keys
      with `STOCK_STORAGE_PREFIX` are touched.
- [ ] Export `StockStorage`, `createMemoryStorage`, `STOCK_STORAGE_PREFIX` from `src/index.ts`.
- [ ] `mise exec -- vp run @hellotimber/nokia-os#test`, `vp check --fix`.
- [ ] Commit: `feat(nokia-os): host storage port and versioned EEPROM records`.

### Task 5 - Persistent settings, virgin and factory states (TDD)

**Files:** `src/firmware/settings.ts`, `src/firmware/records.ts`, `src/firmware/bindings.ts`
(`CODE_SETTINGS`, `RESTORE_KEEPS`, `FACTORY_DEFAULTS`, `WELCOME_NOTE_KEY`), `src/firmware/menu.ts`,
`src/firmware/phone.ts`, `tests/settings.test.ts`, `tests/persistence.test.ts` (new),
`tests/firmware-phone.test.ts`.

- [ ] TDD `SETTINGS_RECORD`: overrides only; aliased keys under their target; a choice removes
      the virgin text on load as in memory; unknown keys, out-of-range indexes and wrong-length
      marks are dropped; the set of writable keys is pinned by a snapshot test (D3).
- [ ] TDD `createStockSettings(eeprom)`: every write persists at once; `setText`, `label`; a
      second store over the same storage reads the same values.
- [ ] Phone security becomes a single choice (`CODE_SETTINGS`: 6-3-5, labels per Task 0b, virgin
      `Off`, the page reads it like a setter level).
- [ ] TDD factory (D5): `factory(current)` restores virgin choices and marks, applies
      `FACTORY_DEFAULTS` (each entry carries `evidence` and its capture), keeps `RESTORE_KEEPS`
      and typed texts.
- [ ] `createStockMenu(ports, settings)` keeps its signature; `createStockPhone` builds one
      `StockEeprom` over `config.storage ?? createMemoryStorage()` and passes the persistent store.
      Subtract: `createMemorySettings` remains only as the in-memory test helper if tests still
      need it, else delete it.
- [ ] TDD `persistence.test.ts` through keys: choose Keypad tones › Level 2, drop the phone,
      create another over the same storage: the page shows `Level 2` and the list opens on it (as
      `probe/persist-reboot`); a malformed record throws from `createStockPhone`.
- [ ] Every plan 13/14 golden still passes with the default storage (virgin).
- [ ] `mise exec -- vp run @hellotimber/nokia-os#test`, `vp check --fix`.
- [ ] Commit: `feat(nokia-os): persistent settings over the storage port`.

### Task 6 - Security record and code entry (TDD against goldens)

**Files:** `src/firmware/security.ts` (new), `src/widgets/code-entry.ts` (new),
`src/display/widgets/prompt.ts` (mask entry), `src/display/widgets/index.ts`,
`src/firmware/leaves.ts`, `src/firmware/bindings.ts` (`CODE_LEAVES`), `src/firmware/records.ts`,
`tests/security.test.ts` (new), `tests/widgets-code.test.ts` (new).

- [ ] TDD `SECURITY_RECORD` and `StockSecurity`: default `12345`; `verify` exact; `changeCode`
      bounds from Task 0; `insertSim` keeps five, most recent first; `asksAtPowerOn` per D9/D10;
      the record survives `restoreFactory()`. Add a wrong-attempt counter only if A3 shows a
      lockout, with its captured behaviour.
- [ ] TDD the prompt painter's mask entry: `probe/code-keys-6-4` and `boot/security-gate-keys`
      images pixel-exact from literal models.
- [ ] TDD `codeEntry` in a flow (`tests/support/flow-rig.ts`): digits, C, C on empty, OK on empty
      and with too few digits, the most digits, per A2/A5; a wrong code plays `Code error` with
      its golden timeline and returns to the empty prompt; an accepted code calls `accepted`.
- [ ] Bind `CODE_LEAVES` in `leaves.ts`: 6-3-5, 6-3-6-1, 6-4 and the 4-5-5 page result use
      `codeEntry`; until Task 7, an accepted code opens a placeholder owned by `15` (4-5-5's by
      `22`). PIN, PIN2 and barring prompts are unchanged.
- [ ] Acceptance scenarios for `probe/code-wrong-*` and `probe/code-keys-6-4` (hand-written, in
      `tests/support/probes.ts`); plan 14's `6-3-5.leaf` and `4-5-5` goldens still pass.
- [ ] `mise exec -- vp run @hellotimber/nokia-os#test`, `vp check --fix`.
- [ ] Commit: `feat(nokia-os): security code verification and stock code entry`.

### Task 7 - Phone security, Change security code, Restore factory settings (TDD)

**Files:** `src/firmware/leaves.ts`, `src/firmware/bindings.ts` (`COMPOSED_FLOWS`,
`ACCEPT_FLOWS`), `src/firmware/settings.ts` (restore entry point), `tests/settings-flows.test.ts`
(new), `scripts/widget-sprites.ts` only if Task 0c adds timelines.

- [ ] If Task 0c succeeded: drive each flow against `probe/accept-*` goldens, and
      `FACTORY_DEFAULTS` from the v6.39 factory scrolls (every list's opening after Restore).
      Otherwise: compose per D8 with Task 0b's shapes; every composed screen is in
      `COMPOSED_FLOWS` with its evidence and string ids; reuse captured timelines by note class
      (tick `Done`, error `Not allowed`).
- [ ] TDD Phone security: the list opens on the stored value; OK stores and shows the note, then
      the page value; On inserts the current SIM.
- [ ] TDD Change security code: both new-code prompts use `codeEntry`'s entry; a match stores the
      code (the next `verify` takes it, the old one fails); a mismatch follows 0b.
- [ ] TDD Restore factory settings: after the note every page shows its factory value; the
      security code, Phone security, the welcome note and profile names are kept (per 0b); the
      settings record in storage equals `factory(previous)`.
- [ ] Remove the Task 6 placeholders owned by `15` (subtract); no placeholder names plan 15.
- [ ] `mise exec -- vp run @hellotimber/nokia-os#test`, `vp check --fix`.
- [ ] Commit: `feat(nokia-os): Phone security, Change security code and Restore factory settings`.

### Task 8 - Boot gates in the stock phone (TDD against goldens)

**Files:** `src/firmware/boot.ts` (new), `src/firmware/phone.ts`, `src/display/widgets/note.ts`
(welcome-note layout, if it differs from notes), `tests/boot.test.ts` (new),
`tests/support/rig.ts` (`storage`/`sim` options), `tests/support/probes.ts`.

- [ ] `SELF_TEST_MS` from `BOOT_TIMELINE` (end of step 3, 4073 ms); a test pins it against
      `boot/power-on`.
- [ ] Security gate application: the 42 ms blank, the prompt, `codeEntry` with the boot's own
      `Code error` and `Code accepted` timelines (from `boot/security-gate`), then `exit()`.
      `insertSim(sim)` on every power-on that passes (gate or not).
- [ ] Welcome-note gate application: the stored note laid out as measured on
      `boot/welcome-note` and `boot/welcome-note-long`, held 4930.7 ms, then
      `exit({ to: "standby" })`. A note with glyphs the large face lacks is drawn with what exists
      and missing characters are reported by a test helper, not thrown at boot (D10 of plan 13
      applies to firmware labels, not user text).
- [ ] `createStockPhone`: validates `sim`; `bootGates` as D9 (`boot: "skip"` keeps the security
      gate only).
- [ ] Acceptance: `boot/security-gate` (storage seeded with Phone security On, empty recent SIMs;
      keys at the golden's times; then `standby/standby`), `boot/welcome-note` and
      `-long` (seeded note and gate), `boot/security-lockout` if imported; `boot/power-on` still
      passes with empty storage.
- [ ] TDD: the same SIM after a passed gate boots without it; a sixth SIM evicts the oldest;
      navigate during the gate waits; power off during the gate.
- [ ] `mise exec -- vp run @hellotimber/nokia-os#test`, `vp check --fix`.
- [ ] Commit: `feat(nokia-os): security-code and welcome-note boot gates`.

### Task 9 - Demo and README

**Files:** `packages/nokia-os/demo/{index.html,main.ts,style.css}`, `packages/nokia-os/README.md`.

- [ ] Demo: `storage: window.localStorage`; an "Erase EEPROM" button removing every
      `STOCK_STORAGE_PREFIX` key and restarting the phone; a SIM select (`SIM 1`, `SIM 2`) that
      restarts the phone with that `sim`; the status line adds the stored record names. A
      malformed record shows the error with the Erase button.
- [ ] Verify with `mise exec -- vp run @hellotimber/nokia-os#demo` and `agent-browser`: choose
      Keypad tones › Level 2, reload, the page still shows it; Phone security On, switch SIM,
      power on: the prompt, a wrong code's `Code error`, `12345`, the hands; Restore factory
      settings resets Keypad tones.
- [ ] README: the storage port (with the localStorage example), records and versions, virgin vs
      factory, the security code and boot gates, and what is left to later plans.
- [ ] Commit: `feat(nokia-os): persistent demo with EEPROM and SIM controls`.

### Task 10 - Acceptance, verification gate and closeout

**Files:** `tests/acceptance.test.ts`, this plan, `docs/plans/README.md`,
`docs/specs/nokia-3310.md`.

- [ ] Delete `awaitsPlan15Scenario`; every asserted golden has a scenario and passes (timelines
      within ±2 ms after alignment; probes per plan 14's closeout decision 2).
- [ ] The coverage guard still accounts for every tree node; no golden or placeholder names plan 15.
- [ ] `mise exec -- vp check --fix`, `mise exec -- vp run -r test`, `mise exec -- vp run website#build`;
      `git diff --stat <commit before Task 1> -- website/` is empty.
- [ ] Spec §10: replace "(plan 15, in progress)" with verified facts; list what stays UNVERIFIED
      (composed flows, factory values from v5.79, the gate-free boot with a welcome note).
- [ ] Plans README row 15 `done`. Completion notes; status `done`.
- [ ] Commit: `docs: complete storage port, security code and Settings (plan 15)`.

## Follow-up plan adjustments

- **16 - Tones:** reads Keypad tones, Warning tones, Ringing tone/volume, Incoming call alert and
  Vibrating alert through `StockSettings.choice`/`label` when it plays; adds no settings record.
- **17 - Profiles:** the active profile is a new choice in the settings record; `settingAlias`
  reads it (one function). Profile names are typed texts (kept by Restore per 0b).
- **18 - Messages and Chat:** owns the Welcome note editor (6-2-3); Save writes
  `settings/phone-settings/welcome-note` with `setText`, Erase clears it. Its record holds
  messages (kept by Restore).
- **19 - Phone book:** its record holds entries (kept by Restore); Erase all uses `codeEntry`.
- **21 - Clock and Reminders:** Hide clock and Time format take effect on standby; reminders and
  the alarm are its record.
- **22 - Call register and Call divert:** Clear timers' accepted code; changing Phone security
  erases the recent call lists (user guide); call lists and divert state are its record (kept).
- **23/24 - Games:** scores are a record with `factory` per Task 0b (does Restore clear Top score?).
- **26 - Languages (new row):** the Cyrillic UIs and their notes (`pending:26`).

## Open questions for Lachlan

Resolved provisionally so execution is not blocked; each is cheap to reverse.

1. **Which state the demo boots (D4):** virgin on empty storage, as the goldens assert. Reverse:
   seed the factory state on first boot.
2. **Phone security trigger (D9/D10):** the user guide's rule (a SIM not among the last five),
   with a `sim` port and a demo SIM switch. Reverse: `asksAtPowerOn` returns `phoneSecurity()`
   (ask at every power-on, as the brief assumed).
3. **Composed post-acceptance screens (D8):** built from captured widgets, v5.79 flow shapes and
   v6.39 firmware strings, flagged UNVERIFIED, unless Task 0c captures them. Reverse: accepted
   codes open a placeholder until a capture exists.
4. **Factory values from v5.79 (D5):** used where the option counts match, flagged. Reverse: an
   empty `FACTORY_DEFAULTS` (factory = virgin).
5. **Restore keeps (D5):** typed texts, security settings and every non-settings record, per the
   user guide and Task 0b.
6. **Malformed storage (D2):** `createStockPhone` throws; the demo offers Erase. Reverse: treat
   it as virgin and overwrite on the next write.
7. **Language (scope):** a new plan 26 rather than plan 15 or dropping the three choices. Lachlan
   may prefer to drop them from the portfolio's scope entirely.
8. **Welcome note editor (scope):** plan 18, because it is stock text entry.
9. **SIM PIN/PIN2/PUK and barring passwords:** not sequenced; they need a SIM model. Assign to a
   plan when one is wanted.
10. **Task 0c (time box):** 3 hours. If it fails, no further emulator work is planned; a later RE
    pass can still replace the compositions without changing this plan's contracts.

## Conflicts found while planning

- `boot-clean/NOT-ACHIEVED.md` says Phone security and PIN code request are On in the virgin
  EEPROM; the golden `tree/06-settings/6-3.sub` shows both `Off`. The virgin power-on prompt is not
  the Phone security setting.
- The menu-tree spec says `Code error` returns "to the list"; probe B shows the empty prompt again.
- The brief's "boot security prompt when Phone security is On" against the user guide's "when a
  new SIM card is inserted" (Open question 2).
- Plan 14 assigns 6-2-3 and 6-2-1-3…5 to plan 15; this plan re-owns them (D12), and row 26 is new.
- Spec §3 says the welcome note is "shown briefly" after power-on; the capture shows it replaces
  the hands for 4930.7 ms.
- The user guide numbers Restore factory settings `6-5`; v6.39 shows `6-4` (the guide is for
  another firmware; the crawl wins, as the menu-tree spec already says for labels).
- Plan 13 D12 and the spec treat the power-on code prompt as an unreproduced artefact; plan 15
  reproduces its pixels and timings as the Phone security gate, with a different trigger.

## Done means

- Hosts can pass `window.localStorage` (or any Web Storage subset) and settings survive a reload;
  empty storage boots the virgin EEPROM and every plan 13/14 golden still passes.
- Settings, security and later plans' data are versioned records with tested decode rules.
- Every security-code leaf verifies the code (default `12345`) with the captured mask and
  `Code error` flow; Phone security, Change security code and Restore factory settings work, and
  each screen without a v6.39 capture is listed in `COMPOSED_FLOWS` and the spec.
- Power-on shows the security gate for an unknown SIM with Phone security On and the stored
  welcome note instead of the hands, matching their goldens.
- No golden or placeholder names plan 15; the coverage guard accounts for every node.
- phone-core stays Nokia-agnostic; the website is unchanged; `vp check`, `vp run -r test` and
  `vp run website#build` pass; VISION, the specs and the plans README match what shipped.
