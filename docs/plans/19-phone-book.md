# Plan 19 - Phone book

> **Fidelity standard (2026-10-15):** `AGENTS.md` "Fidelity standard" supersedes this plan's tolerance text.

> **For agentic workers:** execute task-by-task; tick checkboxes; commit per task.
> If this plan contradicts VISION.md, AGENTS.md, the spec or the code, STOP and report.

**Prerequisites:** plans 13, 14, 15 and 16 done. Plan 18 done through its Task 9: this plan binds
its `textInput` and `numberEntry` widgets (names and numbers), its standby-application mechanism
(plan 18 D11, `setNotice({ open })`) and its `StockNetworkPort` (Send b'card). The per-plan file
split (see "Conventions") must have landed before Task 2.
**Ground truth:** the v6.39 emulator corpus at
`REF=/Volumes/SSD/Projects/lachieh/hellotimber/nokia-3310` (gitignored, main checkout only): the
plan 14 goldens already committed for Phone book (virgin EEPROM, empty SIM), the crawl's
`captures/6.39/tree/_with-content/01-phone-book/` (two contacts), the planning probes in
`$REF/captures/scratch-plan19/` (evidence only, never imported; `NOTES.md` lists them), and the
canonical recaptures Task 0 writes to `$REF/captures/6.39/plan19/`. Read `$REF/captures/README.md`
and plans 13, 14, 15, 16 and 18 in full before starting.
**Status:** not started.

## Goal

Give `@hellotimber/nokia-os` the stock v6.39 Phone book, pixel- and timing-faithful to the
captures:

- the **SIM card** as host config: its phone book (locations, name length, entries) and service
  numbers, with the emulator SIM as the default; this is the seam a later portfolio integration
  uses to provide contacts (D2);
- the **name list** in its three views (Type of view: Large font, Name list, Name, number), sorted,
  with ▲/▼, letter keys and the soft key of the flow that opened it;
- **standby ▼** opening the name list (the captures correct the spec's arrows, D5);
- **Search**, **Service Nos.**, **Add name** (name and number entry, `Saved`, `Nothing to save`,
  `Memory full` and `Replace?`), **Erase** (one by one, Erase all behind the security code),
  **Edit** (Replace or Add), **Assign tone** (with ringing tone previews), **Send b'card**,
  **Options** (Type of view, Memory status from the SIM), **Speed dials** (Assign, View number,
  Change, Erase, the location fallback) and **Voice tags** as far as a phone without a working
  voice system goes;
- a **phone book EEPROM record** (the SIM's contents by SIM identity, speed dials, assigned tones);
- the internal API later plans use (calls, messages, Chat) and goldens for all of it.

The website does not change (D15). Portfolio content is not implemented.

## Why this plan exists (measured gap)

| Area                   | nokia-os after plans 13-16                                       | v6.39 evidence                                                                                                                                                                                 |
| ---------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contacts               | none; every leaf shows the empty-SIM screen (`No phone numbers`) | names live on the SIM (`EF_ADN`: 50 locations of 30 bytes on the emulator SIM, so 16-character names and 20 digits); Memory status counts the SIM only (`SIM card:` / `37 free` / `13 in use`) |
| Name list              | none                                                             | three views by Type of view; sorted case-insensitively; soft key per flow (`Call`, `Erase`, `Edit`, `Send`, `Select`, `Add voice tag`)                                                         |
| Standby ▲/▼            | ▲ → Search prompt, ▼ → Dialled numbers (spec §6)                 | **▼ opens the name list, ▲ shows `No last dialled numbers`** (S1)                                                                                                                              |
| Search, Add name, Edit | first screens only (plan 14 D11)                                 | multi-tap `Name:` (counter from the SIM's name length), `Phone number:` (20), `Saved`, `Nothing to save`, `Memory full` → `Replace?`, `Replace`/`Add` after a name change                      |
| Erase                  | `No phone numbers`                                               | `Erase?` query, an animated `Erased` note; Erase all: `Are you sure?`, the security code, `Erasing memory`, `Memory erased`                                                                    |
| Speed dials            | `Key 2:` / `(empty)`, every key inert                            | keys 2-9 cycle; an unassigned key shows SIM location n; Assign → name list → `Speed dial key n saved`; Options: View number, Change, Erase                                                     |
| Assign tone, b'card    | `No phone numbers`                                               | a page per name with its tone, the ringing tone list with previews (`Default` first), `Done`; `Phone number:`, `Sending b'card`, `Business card sent`                                          |
| Voice tags             | `No phone numbers` / `No voice tags saved`                       | Add voice tag → name list → `Press Start, then speak after tone` → `Please speak now` → `Voice system error` (the emulator has no voice DSP)                                                   |

## Planning investigation (2026-10-14)

Scratch probes in `$REF/captures/scratch-plan19/` (scripts `tools/p1.py`…`p7.py`, outputs
`out-p1/`…`out-p7/`; SIM fixtures `sims/*.json` written by `tools/sim.py` from the emulator's
`third_party/swsim/gsm.json` and passed as `SWSIM_FS`). Virgin image + `v639-setup.inc` unless
noted; "factory" is plan 15's `firmware/work/v639-plan15-restored.fls` + `v639-factory-setup.inc`.
Times are emulated. Task 0 recaptures everything canonically.

| #   | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Evidence                                                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| S1  | **Standby ▼ opens the name list; ▲ shows `No last dialled numbers`** (large, the information icon, ≈2.87 s). Both start with a 21-24 ms frame of standby with the ladders erased. The helpdoc's "Scroll keys" page names the two actions without the arrow glyphs (they are stripped images), so spec §6 guessed the order. C in the list returns to standby; C held redraws standby twice on the way.                                                                                                                                 | `out-p1/a-up`, `out-p4/f01-down`, `out-p5/b01-standby-down`, `out-p6/e02-hold-c` |
| S2  | **Sorted case-insensitively** (`Abcdefghijklmnop`, `anna`, `Ben`, `Bob`, `Carl`, …) whatever the SIM order. ▲/▼ wrap. The list opens on the first name (standby, pickers).                                                                                                                                                                                                                                                                                                                                                             | `out-p1/f-*`                                                                     |
| S3  | **Large font view** (virgin default): the phone-book icon top left, the name in the large face from x 1 at top 7, broken by character onto a second line (`Abcdefghijklm` / `nop`), the soft key. **Name list:** full-width rows (band x 0..83, no rail, no indicator) under the icon, small face, a long name cut with a dotted ellipsis at x 74. **Name, number:** the name in small from x 0 (broken after 15 characters), the number in small at top 29, right-aligned, **only its last 14 digits**.                               | `out-p1/f-large-*`, `f-namelist-*`, `f-namenumber-*`                             |
| S4  | **Search:** pen + `Abc`, `Name:`, a box with the typed letters in large, no cursor, `OK`. OK lands on the first name ≥ the typed text, case-insensitively (`Bz` → Carl, `C` → Carl, `Gi` → Gina); past the last name it wraps to the first (`W`, `M`). Empty OK → the first name. In Name list view the found name is on the top row. Empty SIM: `No phone numbers`, then the Phone book level.                                                                                                                                        | `out-p1/c*`, `out-p4/c*`, `out-p5/b02`, `out-p6/a01`                             |
| S5  | **Letter keys in the list:** a digit types a multi-tap letter (with the commit timeout) and jumps as Search does: `5` → Jack, `5 5` (K) → wraps to the first, `2 2` (B) → Ben; `0`, `1`, `*`, `#` do nothing.                                                                                                                                                                                                                                                                                                                          | `out-p3/c*`, `out-p6/a03`                                                        |
| S6  | **Service Nos.:** the SIM's service numbers (`EF_SDN`) in rows from the top (no icon), a slider rail at x 78..83, `Call`; none: `No phone numbers` (plan 14's golden).                                                                                                                                                                                                                                                                                                                                                                 | `out-p1/d*`                                                                      |
| S7  | **Add name:** `Name:` (counter = the SIM's name length, 16), multi-tap; a name too wide for the large face drops to two small-face lines; the 17th key is ignored. OK → `Phone number:` (counter 20, soft key `OK` even when empty); 20 digits wrap right-aligned in small; the 21st is ignored. OK → `Saved` (tick, ≈685/232/1914 ms) → the new name in the list with `Call`. Empty name and number: `Nothing to save` (≈2.92 s) → the Phone book level; an empty name with a number is accepted.                                     | `out-p2/a*`                                                                      |
| S8  | **Memory full** (50/50): Add name takes the name and number, then `Memory full` (≈2.85 s), then the query `Replace?` / `N00` (location 1); OK → `Saved`, the new name; C → `Name:` with the typed name.                                                                                                                                                                                                                                                                                                                                | `out-p7/*`, `out-p5/a01`                                                         |
| S9  | **Erase › One by one:** the name list with `Erase`; `Erase?` / the name (small, tops 4/15), `OK`; `Erased` (an animated bin, 8 steps of ≈232 ms, ≈2.9 s) → the list on the next name. **Erase all:** `Are you sure?` → `Security code:` → (12345) `Erasing memory` (the hatched bar, ≈2.5 s, irregular steps) → `Memory erased` (tick, ≈2.0 s full step) → the Erase level.                                                                                                                                                            | `out-p2/b*`, `out-p4/a*`, `out-p6/b*`                                            |
| S10 | **Edit:** the name list with `Edit` → `Name:` with the name (counter 16 - length) → `Phone number:` with the number. A changed name asks `Replace` / `Add` (rows, `Select`): Replace → `Saved`, Add → `Saved` and both names exist. An unchanged name (number changed or not) → `Saved` at once. Add with a full SIM → `Memory full` → `Replace?`.                                                                                                                                                                                     | `out-p2/c*`, `out-p3/a*`, `out-p4/b*`, `out-p5/a03`                              |
| S11 | **Assign tone:** one page per name (the name in small from x 0, its tone in thin at the lower right, `Assign`), ▲/▼ through the sorted names → the ringing tone list (`Default`, `Ring ring`, `Low`, …; indicator `1-6-2` on `Default`), `OK`; ▼ **previews** the tone ≈960 ms later with the vibrator (factory); OK → `Done` (short tick) → the page with the tone.                                                                                                                                                                   | `out-p2/d*`, `out-p4/e01`, `out-p6/c*`                                           |
| S12 | **Send b'card:** the name list with `Send` → a 33 ms frame with only `OK` → `Phone number:` (counter 30, `Search`) → OK → `Sending b'card` (bar ≈271 ms, ≈3.4 s) → `Business card sent` (an envelope animation, ≈1.4 s) → the list.                                                                                                                                                                                                                                                                                                    | `out-p2/e*`                                                                      |
| S13 | **Speed dials:** `Key 2:` … `Key 9:` (▼ wraps); an unassigned key shows **SIM location n** (`Key 2:` anna, the second SIM record; `(empty)` with no entry there), soft key `Assign`, in the virgin and the factory state; Assign → the name list with `Select` → `Speed dial key 3 saved` (tick) → the key with `Options` (View number: the number in large, `Back`; Change: the name list again; Erase: `Erase?` → an animated `Speed dial key 3 erased` → location n again with `Assign`). Assign with no names: `No phone numbers`. | `out-p2/f*`, `out-p3/b*`, `out-p4/d*`, `out-p5/b04`, `b05`                       |
| S14 | **Holding 2-9 at standby** with Settings › Call settings › Speed dialling Off (virgin): number entry (`2`, `Call`). On: the number, `Calling.`/`..`/`...` with the name, `End` (plan 22). Holding 1 dials the voice mailbox.                                                                                                                                                                                                                                                                                                           | `out-p2/h*`, `out-p3/d*`                                                         |
| S15 | **Voice tags › Add voice tag:** the name list with `Add voice tag` → `Press Start, then` / `speak after tone`, `Start` → `Please` / `speak now` with an animated icon and `Quit` (≈2.3 s) → `Voice system error` (≈2.84 s) → the list. Playback, Change, Erase: `No voice tags saved`.                                                                                                                                                                                                                                                 | `out-p2/g*`                                                                      |
| S16 | **No phone memory in v6.39.** Options has Type of view and Memory status only; Memory status shows `SIM card:` and nothing else (`0 free` / `50 in use` full, `49 free` / `1 in use`). The firmware strings `Saved to phone memory` and `Save to another memory?` exist but no screen reached them.                                                                                                                                                                                                                                    | `out-p1/e01`, `out-p5/a02`, `b06`                                                |
| S17 | **The SIM keeps its names across a reboot** in one emulator process (`saveflash` + `reboot`); the harness reads the SIM fixture once per process and never writes it back.                                                                                                                                                                                                                                                                                                                                                             | `out-p2/k*`                                                                      |

## Scope and non-goals

In scope: the Goal items; one opt-in phone-core seam (D5); public nokia-os contract additions (D2,
D10); captures, goldens, glyphs, sprites, sound goldens; documentation.

Out of scope (owner in brackets): calling a name, a service number or a speed dial (`Call`, held
2-9, held 1) and the call screens (22); receiving a business card and `Save business card?` (18c,
which adds incoming binary SMS); voice recognition and voice dialling (not sequenced, D9); copying
between SIM and phone memory (does not exist, D1); caller names on incoming calls and the ringing
tone they use (22, through D11's API); Cyrillic names (26); any website change.

## Decisions

Each decision states what changes relative to the brief and to plans 13-18.

**D1 - Names live on the SIM only; there is no phone memory (the brief's "Memory in use: SIM/phone"
does not exist, S16).** v6.39's Options lists Type of view and Memory status, and Memory status
reports `SIM card:` only. The DCT3 strings for a phone memory are unused on the 3310. The capacity,
the name length and the number length are the SIM's.

**D2 - The SIM card is host config, and it is the contacts seam (new; contract change).**
`StockPhoneConfig.sim` (plan 15: a SIM identity string) also accepts a `StockSimCard`: its identity,
its phone book (locations, name length, initial entries by location) and its service numbers. A
string means the emulator SIM: 50 locations, 16-character names, no entries, no service numbers (the
captured virgin state, so every plan 13-18 golden still passes). Numbers have at most 20 digits on
every SIM (the `Phone number:` counter; `EF_ADN` holds 10 BCD bytes). A later portfolio integration
passes a SIM with Lachlan's contacts and implements nothing else. Entries are validated when the
phone is created (names within the name length and drawable in the small and large faces, numbers
of `0-9 * # p w` with an optional leading `+`); a bad entry throws, naming its location.

**D3 - The SIM's contents persist in the phone's storage under the SIM's identity (new; plan 15 D2
record).** nokia-os has one persistence port, so the `phone-book` record (v1) holds, per SIM
identity, the locations as they stand after the phone first wrote them; until then the host's
initial entries are the SIM's contents. Another `sim` shows that SIM's names. The record has no
`factory`: Restore factory settings keeps the phone book (user guide), unless Task 0 K shows it
touching speed dials or tones (then those parts reset, a Deviation).

**D4 - Speed dials and assigned tones are phone memory (new).** Speed dials map keys 2-9 to SIM
locations; an unassigned key reads location n (S13: virgin and factory alike, and after Erase), so
the record stores explicit assignments only. Assigned tones are stored per SIM identity and
location (they follow an entry that Edit replaces and are dropped when it is erased, unless Task 0 D
and T show otherwise). Both live in the `phone-book` record. Whether speed dials follow the SIM is
UNVERIFIED (Task 0 P checks with a second SIM; phone-wide until then).

**D5 - Standby ▼ opens the name list; ▲ stays Dialled numbers' (corrects spec §6, VISION's website
note and `STOCK_STANDBY_KEYS`; S1).** phone-core's `standbyKeys` takes a path. The list is no menu
node, so the seam grows (opt-in, generic): a standby key may name a `PhoneApplication`, run as a
**standby application** (plan 18 D11's rules: empty stack, path `standby`, no indicator segments,
`exit()` to standby), and `PhoneConfig.standbyKeyDelayMs` (default 0) keeps standby on screen with
`leaving: true` that long first, as `menuOpenDelayMs` does for Menu. nokia-os sets ▼ to the name
list, keeps ▲ on `menu/call-register/dialled-numbers` (plan 22 replaces it with the captured `No last
dialled numbers` note, a `pending:22` golden here) and sets the delay Task 0 measures (21-24 ms).
The website sets neither.

**D6 - One name-list widget, three views, many soft keys (new).** `nameList` draws the sorted SIM
entries in the view `phone-book/options/type-of-view` selects (S3), opens on the first name or a
given one, moves with ▲/▼ (wrapping; the stock rows window in Name list view), jumps on letter keys
(S5) and hands the highlighted entry to its flow's soft key: `Call` (standby, Search, after Saved),
`Erase`, `Edit`, `Send`, `Select` (Speed dials, pickers), `Add voice tag`. Assign tone uses the same
widget with its page variant (the name and its tone, S11). Sorting is the firmware's
case-insensitive order; how it orders accents, digits, spaces and equal names comes from Task 0 (the
compare table cites its golden). Search and letter keys share one rule: the first name ≥ the query,
else the first name (S4, S5).

**D7 - Names and numbers use plan 18's entry widgets (dependency).** `Name:` is plan 18's
`textInput` in multi-tap (pen + `Abc`, S7; T9 never applies to names) with the SIM's name length as
its limit and counter; a name wider than the large-face box drops to two small-face lines (S7, also
on Speed dials' key page). Numbers use plan 18's `numberEntry` with limit 20 (soft key `OK` in Add
name and Edit, `Search` while empty in Send b'card, S12). Characters the SIM cannot store (the
firmware has `Invalid char. for SIM card`) follow Task 0 A.

**D8 - Notes, queries and timings come from the goldens (plan 14 D8).** New note classes: `Saved`
(a tick with a long full step), `Erased` and `Speed dial key n erased` (an animated bin),
`Memory erased` after `Erasing memory`'s irregular bar, `Speed dial key n saved` and `Done` (short
ticks), `Nothing to save`, `Memory full`, `Voice system error` (≈2.9 s), `Business card sent` (an
envelope animation), `Please speak now` (an animated icon). Each gets its generated timeline. Task
0 K captures `Speed dial key n saved` for every key 2-9, so no `%N` note is composed. Warning tones
on them come from Task 0 W's sound goldens through plan 16's `NOTE_SOUNDS`.

**D9 - Voice tags: the captured path, ending in `Voice system error` (decision; Open question 4).**
The emulator has no voice DSP and nokia-os has no microphone port, so no tag can be recorded. Add
voice tag reproduces the captured screens through `Please speak now` and `Voice system error`;
Playback, Change and Erase keep `No voice tags saved`. A host microphone and voice dialling are not
sequenced.

**D10 - Send b'card goes through plan 18's network port (contract change, additive).**
`StockNetworkPort` gains an optional `sendBusinessCard(card)`; the phone shows `Sending b'card` for
`max(BCARD_LINK_MS, the host's settle time)` (plan 18 D10's rule, Task 0's median) and then
`Business card sent`, or plan 18's failure note when it settles `"failed"`. A port without the
method settles `"sent"` (the emulator's network accepts everything). `createSyntheticNetwork()`
implements it and records `cards`. Receiving a business card is 18c's.

**D11 - Calls stay plan 22's; plan 19 exposes what they need (dependency).** Every `Call` soft key
(name list, Service Nos.) opens a placeholder owned by `22` inside its flow; held 2-9 and held 1 at
standby stay number entry. `StockPhoneBook` exposes `speedDial(key)`, `byNumber(number)` (caller
names) and `tone(location)` for plan 22.

**D12 - Assign tone's list previews like Tones › Ringing tone (plan 16 D9).** The list is the
ringing tone list with `Default` first; ▲/▼ previews the highlighted tone through
`StockSounder.preview("ringing-tone", …)` with the active profile's settings; what `Default`
previews and whether the first move previews come from Task 0 T; OK stores the choice and shows
`Done`. The `1-6-<k+1>` indicator (S11) is reproduced as captured.

**D13 - The virgin state is an empty SIM (plan 14 D10).** The default SIM has no names and no
service numbers, Type of view opens on Large font, and the plan 14 phone book goldens (the empty-SIM
notes and first screens) stay asserted. Goldens with names name their SIM fixture; tests pass the
same contacts as a `StockSimCard`.

**D14 - Memory status reads the SIM (subtracts plan 14's static text).** `SIM card:` / `<n> free` /
`<n> in use` (the firmware's `1 free`/`%N free` and `1 in use`/`%N in use` strings) is computed; the
two `VIRGIN_TEXTS` entries for it are deleted.

**D15 - The website does not change.** `git diff --stat <commit before Task 1> -- website/` is empty
at the end. Its phone book is portfolio content (contact cards with email, GitHub, CV) and keeps its
standby ▲ mapping; VISION records the contrast.

## Ground truth and artefacts

| Source (`$REF/captures/`)                          | Contents                                                        | Use                                                                     |
| -------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- |
| plan 14 goldens `tree/01-phone-book/*` (committed) | empty-SIM notes, first screens of Search, Add name, Speed dials | stay asserted (D13)                                                     |
| `6.39/tree/_with-content/01-phone-book/`           | two contacts: every leaf's first screen and one key further     | reference for Task 0                                                    |
| `scratch-plan19/` (planning)                       | S1-S17                                                          | evidence for the decisions; never imported                              |
| `6.39/plan19/sims/*.json` (Task 0)                 | SIM fixtures (gsm.json with `EF_ADN`/`EF_SDN` filled)           | capture inputs; their invented contents are restated in the capture set |
| `6.39/plan19/<section>/` (Task 0)                  | canonical recaptures, LCD and audio                             | goldens                                                                 |
| `6.39/plan19/text.json` (Task 0)                   | OCR runs (plan 14 format)                                       | generated text runs, label checks                                       |

New artefacts (spec, Task 1):

| Artefact                                             | Cause                                         | Handling                                                     |
| ---------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------ |
| 50 locations, 16-character names, no service numbers | the emulator SIM (`gsm.json`)                 | the default `StockSimCard` (D2); hosts pass their own        |
| Every name in a fixture                              | invented test contacts                        | test inputs only                                             |
| `Voice system error` after `Please speak now`        | the emulator has no voice DSP                 | reproduced (D9; nokia-os has no microphone either)           |
| `Sending b'card` link time                           | synthetic cell timing                         | phone link time (D10, plan 18 D10's policy); UNVERIFIED live |
| SIM writes lost between emulator processes           | the harness never writes the SIM fixture back | nokia-os persists the SIM under its identity (D3)            |

## Package boundaries

Unchanged from plans 13-18. phone-core gains one generic opt-in seam (D5: a standby key may open an
application; `standbyKeyDelayMs`), with no Nokia labels or timings. nokia-os gains no dependency and
still touches no network or audio API.

## Contract changes

Task 1 writes these into `VISION.md`.

### `@hellotimber/phone-core` (additive, opt-in)

```ts
export interface PhoneConfig<Metadata = unknown> {
  // ...plans 13-18 unchanged, except:
  /**
   * Paths (or, plan 19, applications) opened by ▲/▼ in standby; unknown/absent = no-op. An
   * application runs as a standby application (plan 18 D11 rules: empty stack, path stays
   * `standby`, `menuIndicator()` has no segments, `exit()` returns to standby, `levels`/`select`/
   * `row` throw).
   */
  standbyKeys?: { up?: string | PhoneApplication; down?: string | PhoneApplication };
  /**
   * Plan 19: after a standby key, standby stays on screen with `leaving: true` this long before
   * its target opens (as `menuOpenDelayMs` for Menu). Default 0; non-negative integer.
   */
  standbyKeyDelayMs?: number;
}
```

### `@hellotimber/nokia-os` (additive)

```ts
/** Plan 19: one SIM phone book entry or service number. */
export interface StockContact {
  readonly name: string; // within the SIM's name length; every glyph in the small and large faces
  readonly number: string; // 1-20 of 0-9 * # p w, after an optional leading `+`
}

/** Plan 19: the inserted SIM card. Plan 15's string `sim` is `{ id }` with these defaults. */
export interface StockSimCard {
  /** Identity (plan 15: Phone security's recent SIMs; plan 18: messages). Non-empty. */
  readonly id: string;
  readonly phoneBook?: {
    readonly locations?: number; // default 50 (the emulator SIM)
    readonly nameLength?: number; // default 16
    /** Initial entries by location (index 0 = location 1); null = a free location. */
    readonly entries?: readonly (StockContact | null)[];
  };
  /** The SIM's service numbers (Service Nos.), in SIM order. Default none. */
  readonly serviceNumbers?: readonly StockContact[];
}

export interface StockPhoneConfig {
  // ...plans 13-18 unchanged, except:
  /** Plan 15 identity, or (plan 19) the whole SIM card. Default "sim-1": the emulator SIM. */
  sim?: string | StockSimCard;
}

/** Plan 19: a business card as Send b'card sends it. */
export interface StockBusinessCard {
  readonly to: string; // the number typed at `Phone number:`
  readonly card: StockContact;
}

export interface StockNetworkPort {
  // ...plan 18 unchanged...
  /** Plan 19: Send b'card. Absent = settled "sent" after the phone's link time. */
  sendBusinessCard?(card: StockBusinessCard): StockSendOutcome | Promise<StockSendOutcome>;
}
// createSyntheticNetwork() gains `readonly cards: readonly StockBusinessCard[]`.
```

Rules (Tasks 5 and 10 pin each with a test): `createStockPhone` throws for an invalid SIM (empty id,
`locations` < 1, `nameLength` < 1, more entries than locations, an invalid entry), naming the field
and the location; a host's initial entries are read only while the `phone-book` record has no copy
of that SIM; `sendBusinessCard` follows plan 18's `send` rules (a rejected promise is `"failed"`,
outcomes after power-off are ignored).

## Internal API for later plans

Plans 18c, 22 and the portfolio integration consume these. Signatures are fixed by Tasks 5-9; a
change is a Deviation recorded here.

```ts
// src/phone-book/entries.ts (pure)
export interface PhoneBookEntry extends StockContact {
  readonly location: number; // 1-based SIM location
}
export function compareNames(a: string, b: string): number; // the firmware's order (D6)
export function sortEntries(entries: readonly PhoneBookEntry[]): readonly PhoneBookEntry[];
export function searchIndex(sorted: readonly PhoneBookEntry[], query: string): number; // D6

// src/phone-book/store.ts
export const PHONE_BOOK_RECORD: EepromRecord<PhoneBookState>;
export class StockPhoneBook {
  constructor(eeprom: StockEeprom, sim: NormalisedSimCard);
  entries(): readonly PhoneBookEntry[]; // sorted
  free(): number;
  used(): number;
  add(contact: StockContact): PhoneBookEntry | "full";
  replace(location: number, contact: StockContact): PhoneBookEntry;
  erase(location: number): void;
  eraseAll(): void;
  serviceNumbers(): readonly StockContact[];
  speedDial(key: number): PhoneBookEntry | undefined; // the assignment, else location `key`
  isAssigned(key: number): boolean;
  assign(key: number, location: number): void;
  unassign(key: number): void;
  tone(location: number): number | null; // ringing tone index; null = Default
  setTone(location: number, tone: number | null): void;
  byNumber(number: string): PhoneBookEntry | undefined; // plan 22: caller names
}

// src/widgets/name-list.ts
export function nameList(options: NameListOptions): Widget; // D6
```

Setting keys read: `phone-book/options/type-of-view` (existing) and
`settings/call-settings/speed-dialling` (plan 22 reads it). No new settings key.

## Golden pipeline additions

The capture set is `scripts/capture-sets/19-phone-book.ts`, an explicit table like plan 18's. It
also exports `PHONE_BOOK_SIMS`: every SIM fixture's contents as `StockSimCard` values, the same
invented contacts Task 0's generator writes into `plan19/sims/*.json` (`gen_v639_plan19.py check`
compares the two by reading the table's JSON block). Ids, `status: asserted` unless noted; every
scenario is hand-written in the acceptance file:

| Fixture id(s)                                  | Source (`$REF/captures/6.39/plan19/`) | Kind               | Asserts                                                                               |
| ---------------------------------------------- | ------------------------------------- | ------------------ | ------------------------------------------------------------------------------------- |
| `phone-book/standby-down-*`, `standby-up`      | `standby/*`                           | timelines / stills | ▼ in each view and with an empty SIM; ▲ (`pending:22`); C, C held, ▲/▼                |
| `phone-book/view-{large,list,number}-*`        | `views/*`                             | stills             | every fixture name in each view; long names, long numbers, `+`                        |
| `phone-book/letters-*`                         | `letters/*`                           | stills             | letter keys and their multi-tap cycle, no match, `0`/`1`/`*`/`#`                      |
| `phone-book/search-*`                          | `search/*`                            | timelines / stills | prefixes, no match, case, accents, empty, empty SIM                                   |
| `phone-book/service-*`                         | `service/*`                           | stills             | the service numbers list, ▲/▼, `Call` (`pending:22`)                                  |
| `phone-book/add-*`                             | `add/*`                               | timelines / stills | entry, limits, Saved, Nothing to save, Memory full, Replace?, sorting                 |
| `phone-book/erase-*`                           | `erase/*`                             | timelines          | one by one per view, C on `Erase?`, the last name; Erase all                          |
| `phone-book/edit-*`                            | `edit/*`                              | timelines          | Replace, Add, unchanged, number only, full, empty name                                |
| `phone-book/tone-*`, `sound/phone-book/tone-*` | `tone/*`                              | timelines / sound  | the pages, the list, previews, Done, the page after                                   |
| `phone-book/bcard-*`, `sound/phone-book/bcard` | `bcard/*`                             | timelines / sound  | the prompt, Search, Sending, Business card sent                                       |
| `phone-book/memory-*`, `view-choose-*`         | `options/*`                           | stills             | Memory status per fixture; each Type of view choice                                   |
| `phone-book/speed-*`                           | `speed/*`                             | timelines / stills | keys 2-9, the fallback, Assign, Options, Erase, no names                              |
| `phone-book/hold-*`                            | `hold/*`                              | timelines          | held 2-9 and 1 at standby (`pending:22`)                                              |
| `phone-book/voice-*`                           | `voice/*`                             | timelines          | Add voice tag through `Voice system error`; Quit                                      |
| `phone-book/persist-*`, `sim-*`                | `persist/*`, `sim/*`                  | stills             | the SIM after a reboot; a second SIM's names                                          |
| `sound/note/<name>`                            | `notes/*`                             | sound              | the warning tones of the new notes (plan 16's format, so `NOTE_SOUNDS` picks them up) |
| `phone-book/pick-*`                            | `pick/*`                              | timelines          | Search from plan 18's number prompts; Send to many with names                         |

## Conventions for every task

- Run commands from the repo root with `mise exec --`.
- TDD: write the failing test first wherever the task names tests.
- After each task: `mise exec -- vp check --fix` and the named test commands. A task that touches
  `phone-core` also runs `mise exec -- vp run -r test` and `mise exec -- vp run website#build`.
- Commit rule: run `mise exec -- vp check --fix` yourself, stage files by explicit path, then
  `git commit --no-verify -m "<message>"`. Never `git add -A`/`git add .`. Never stage `TODOS.md`
  (Lachlan's untracked notes).
- **Per-plan files (the split refactor).** This plan owns: the acceptance tests
  `packages/nokia-os/tests/acceptance/19-phone-book.test.ts`; the behaviour
  `packages/nokia-os/src/firmware/features/phone-book.ts` (leaf bindings, flows, registration) plus
  new modules under `src/phone-book/`, `src/widgets/name-list.ts` and
  `src/display/widgets/name-list.ts`; the capture set
  `packages/nokia-os/scripts/capture-sets/19-phone-book.ts`; the spec facts
  `docs/specs/stock/phone-book.md`. Shared files change only by one-line registrations, each named in
  its task: the features index (registering `phoneBookFeature`), `src/firmware/records.ts`
  (`PHONE_BOOK_RECORD`), the capture-set index, the widget-model union and the `paintWidget` switch,
  `src/index.ts` (exports). Larger edits to shared files are unavoidable in four places, each listed
  in its task: phone-core (Task 4), `src/firmware/phone.ts` (SIM config, standby keys; Task 7), the
  two Memory status `VIRGIN_TEXTS` lines and their settings test (Task 7), and
  `tests/firmware-phone.test.ts`'s standby-key test (Task 7).
- Never hand-edit `goldens/**`, `src/resources/generated/**`, `src/firmware/generated/**` or
  `scripts/generated/**`; change the generator or its tables and regenerate. Each generator runs
  twice with no diff before its commit.
- Tests never read `$REF`. Generators that read `$REF` fail clearly when it is missing.
- No new dependencies.
- When reality differs from this plan, follow the captures and append a `Deviation:` paragraph
  under the task. If a deviation breaks a contract in VISION.md, stop and report.
- Parallelism (max 3 concurrent agents): Task 0 gates everything, then Task 1. Then lanes A
  (2 → 3), B (4) and C (5). Task 6 needs 3 and 5; Task 7 needs 4 and 6; Tasks 8, 9 and 10 need 7
  and may run together (each owns its own section of `features/phone-book.ts`; commit in that
  order); Task 11 needs 8-10; then 12.

## Tasks

### Task 0 - Canonical REF captures (no repository changes)

**Files (all under `$REF`, gitignored):** `captures/scripts/gen_v639_plan19.py`,
`captures/scripts/v639-plan19-<section>.cap` (command logs), `captures/6.39/plan19/**` (SIM
fixtures in `plan19/sims/`), a "Plan 19 supplementary captures" section in `captures/README.md`,
`firmware/work/v639-plan19-*.fls`.

- [ ] Read `$REF/captures/README.md`, `captures/scratch-plan19/NOTES.md` and its `tools/*.py`
      (`sim.py` writes SIM fixtures; `drv.py` passes `SWSIM_FS`). Do not modify existing captures
      or scripts. Each SIM needs its own emulator process (the harness reads it once).
- [ ] Write `gen_v639_plan19.py` (`sims`, `run -j 3`, `--only`, `ocr`, `check`), driving
      `tools/menutree/emu.py` like plans 16 and 23. Fixtures (invented names, restated in the repo's
      capture set): `content` (the scratch names plus `Ånna`, `1st`, `zed`, `Zed`, a 15- and a
      16-character name, numbers of 10, 14, 15, 19 and 20 digits, `+`, `*`, `#`, `p`, `w`; two
      service numbers), `two` (the crawl's A and B), `full` (50), `small` (3 locations), `empty`
      (the emulator SIM), `second` (another identity, three names). Virgin sections start from
      `v639-setup.inc`; sections with the security code or sound from `v639-factory-setup.inc`.
      Every recording is `record` + `audio` of the same name with `keys.csv` (plan 16's format).
- [ ] **S standby:** ▼ in each view (Large font, Name list, Name, number) and with `empty`; ▲ with
      and without dialled numbers; ▲/▼ through the list past both ends; C; C held; Navi (`Call`,
      record 3 s, then End); a key during the leading frame. Measure `standbyKeyDelayMs` (the
      ladders-erased frame) over ten presses.
- [ ] **V views and L letters:** every `content` name in each view (shots), with the window in Name
      list view after each ▼ and ▲; every digit key in the list, pressed 1-5 times quickly and with
      the commit gap (the multi-tap letter cycle and the jump), `0`, `1`, `*`, `#`.
- [ ] **Q search:** `Name:` with every query in the fixture's interesting set (each first letter,
      two-letter prefixes inside and between names, a prefix past the last name, upper and lower
      case, `Å`, a digit, a space), empty OK, C on the prompt, C held, and the prompt's other keys
      (`#`, held `#`, `*`). Record where C returns from the list.
- [ ] **N service numbers:** `content` (list, ▲/▼, Navi `Call` 3 s then End, C) and `empty`.
- [ ] **A add name:** names typed with every character class (letters, accents, digits, punctuation
      from key 1, a symbol-table character the SIM alphabet lacks, e.g. `€`: record what OK does),
      16 characters and a 17th, the small-face drop, `Phone number:` with 20 digits and a 21st,
      `*`/`#`/`p`/`w`/`+` entry, OK and C at each step (where C returns), C held; `Saved` (record to
      the settled list; C and Navi there), `Nothing to save`, an empty name with a number, a name
      with no number; `full`: `Memory full`, `Replace?` OK and C; a name equal to an existing one;
      which free location an Add fills (with `small` after an Erase).
- [ ] **E erase:** One by one in each view (first, middle, last name; C on `Erase?`; the last
      remaining name, then the empty SIM); Erase all: `Are you sure?` C and OK, a wrong code
      (`00000`), `12345` (record through `Memory erased` and the level), Erase all on `empty`.
- [ ] **D edit:** per S10: name only, number only, both, neither, empty name, empty number, Replace,
      Add, Add with `full`, C on `Replace`/`Add`; the list position afterwards; an assigned tone and a
      speed dial on the edited entry afterwards (do they follow it?).
- [ ] **T assign tone:** the pages per view and for a long name, the list (indicators of the first
      and last entries), ▲/▼ with audio over ≥ 3 tones (factory), `Default` highlighted after a move
      (does it preview?), whether the first ▼ previews (plan 16 S9), OK on a tone and on
      `Default`, C during a preview, the page after; the tone after Edit Replace and after Erase.
- [ ] **B send b'card:** the leading frame, `Phone number:` (`Search` while empty: the name list
      with `Select`, then the number filled), OK with audio through the list, C at each step, three
      more sends for the link-time median (`BCARD_LINK_MS`).
- [ ] **O options:** each Type of view choice (`Done`, the page value), Memory status on `content`,
      `full`, `small`, `empty` and after an Add and an Erase.
- [ ] **K speed dials:** keys 2-9 (▼ and ▲ wrap) on `content`, `two`, `small` (keys past the SIM's
      locations: what shows?) and `empty`; Assign on each of keys 2-9 once (every `Speed dial key n
saved`); Options › View number (long and `+` numbers), Change, Erase (C on `Erase?`); Assign
      with no names; a key assigned to a location that is then erased (what shows?); Restore factory
      settings (factory image), then the keys (D3).
- [ ] **H hold:** held 2, 5, 9 and 1 at standby with Speed dialling Off and On, assigned and
      unassigned keys, and a key whose location is empty (record 6 s each, then End or C). Evidence
      for plan 22 (`pending:22`).
- [ ] **G voice tags:** Add voice tag per view, Start (through `Voice system error`), Quit during
      `Please speak now`, C on `Press Start`; Playback, Change, Erase with names.
- [ ] **P persistence and SIM:** `saveflash` + `reboot` after an Add, an Edit, an Erase, a speed-dial
      Assign and a tone; a run with `second` from the saved image (that SIM's names; the speed dials
      and tones made on `content`, D4).
- [ ] **W warning tones (factory):** audio of every new note (`Saved`, `Erased`, `Memory erased`,
      `Speed dial key n saved`/`erased`, `Done`, `Nothing to save`, `Memory full`, `Voice system
error`, `Business card sent`) with Warning tones On, and the error notes with it Off.
- [ ] **X pickers:** Write messages › Options › Send › `Search` (plan 18's prompt) with names (the
      list, `Select`, the number filled); Send to many with names (the list with `Send`, each send);
      Chat's `Phone number:` Search (18c evidence).
- [ ] OCR every new image into `plan19/text.json` (plan 14's format and command).
- [ ] `check`: every recording starts on its parent; the fixtures in `plan19/sims/` equal the capture
      set's `PHONE_BOOK_SIMS` (the repo file given as an argument); every audio recording has
      `keys.csv`.
- [ ] Append "Plan 19 supplementary captures" to `$REF/captures/README.md`.
- [ ] No commit. Record the outcome under this task: the standby delay, the sort order (accents,
      digits, case ties, duplicates), the search and letter rules, every layout per view (wrap
      points, truncation, the ellipsis), Add/Edit/Erase flows with every return target, unsupported
      SIM characters, speed-dial fallbacks and their persistence across SIMs and Restore, the tone
      list's numbering and previews, the link-time median and spread, the new notes' sounds.

### Task 1 - Contracts and documentation

**Files:** `VISION.md`, `docs/specs/stock/phone-book.md` (new), `docs/specs/nokia-3310.md` (§6: one
corrected bullet pointing to the new file), `docs/specs/nokia-3310-menu-tree.md` ("With content ›
Phone book": a pointer), `docs/plans/README.md` (row 19), this plan.

- [ ] Apply Task 0's outcome to D2-D12 and the contracts (Deviation lines where it changes them).
- [ ] VISION: the phone-core seam and the nokia-os contracts exactly as in "Contract changes"; a
      kernel-policy sentence for plan 19 (a standby key may open a standby application, after an
      optional leaving delay); the nokia-os row mentions the SIM card port. In the website's menu
      table, replace "just like the real phone" in the standby row with a note that v6.39 does the
      opposite (▼ names, ▲ dialled numbers; spec) and that the website keeps its mapping (D15).
- [ ] `docs/specs/stock/phone-book.md`: the S-findings as Task 0 verified them, the layouts, the
      flows with their timings, the artefacts above, and everything not yet asserted marked "(plan
      19, in progress)". Spec §6: the standby-arrow bullet corrected (manual-sourced history kept,
      the stripped-glyph explanation, a link to the new file).
- [ ] Plans README: row 19 `in progress`.
- [ ] No runtime code. `mise exec -- vp check --fix`.
- [ ] Commit: `docs: define the SIM phone book and standby list contracts (plan 19)`.

### Task 2 - Goldens and the capture set (TDD)

**Files:** `scripts/capture-sets/19-phone-book.ts` (new), the capture-set index (one-line
registration), `tests/capture-sets/19-phone-book.test.ts` (new), `tests/acceptance/19-phone-book.test.ts`
(new: the todo shim only), `goldens/**`.

- [ ] TDD the capture set on synthetic recordings (an injected loader, as plan 18's): ids, kinds,
      cut points, `trigger-frame` on the first changed frame (plan 14 D8), `note:` naming the SIM
      fixture, `pending:22` for call screens, sound goldens under `sound/note/<name>` and
      `sound/phone-book/*`.
- [ ] `PHONE_BOOK_SIMS`: the fixtures as `StockSimCard` values in a JSON-style block (the REF check
      reads it); a test validates each against the D2 rules.
- [ ] Integrity: no golden is `pending:19`; every `phone-book/*` golden's note names a fixture that
      exists.
- [ ] Register the set (one line). The acceptance file lists the new asserted goldens without a
      scenario as todos (`awaitsPlan19Scenario`; Task 11 deletes it).
- [ ] Run `import-captures` twice; the second run changes nothing. Record fixture counts, images and
      bytes in a completion note (budget guide: ≤ 2 MB of new text grids).
- [ ] `mise exec -- vp run @hellotimber/nokia-os#test`, `mise exec -- vp check --fix`.
- [ ] Commit: `feat(nokia-os): import phone book goldens (plan 19)`.

### Task 3 - Glyphs, sprites and timelines (TDD)

**Files:** `scripts/widget-sprites.ts` (crop rows), the text-run input as plan 18 Task 3 left it,
`scripts/glyph-overrides.ts`, `src/resources/generated/**` (generated), `tests/resources.test.ts`
(new cases only).

- [ ] Text runs for the new images from `plan19/text.json`; resolve harvester reports with overrides
      naming their golden. Every fixture name renders in `small` and `large`, every number in `small`
      and `large` (D2's validation relies on it).
- [ ] Crops: the name-list icon (assert equal to `prompt/phone-book`, else a new sprite), the
      ellipsis, the Service Nos. slider rail, the bin animation, the `Please speak now` icon frames,
      the `Business card sent` frames (compared with plan 18's `Message sent` frames; shared if
      equal), any new note icon.
- [ ] Named timelines (`WIDGET_TIMELINE_BY_NAME`): `saved`, `erased`, `memory-erased` (with `Erasing
memory`'s bar), `speed-dial-saved`, `speed-dial-erased`, `tone-done`, `nothing-to-save`,
      `memory-full`, `sending-bcard`, `bcard-sent`, `please-speak`, `voice-system-error`; the
      standby leaving frame (`STANDBY_KEY_DELAY_MS`) and `BCARD_LINK_MS` (medians, the spread in a
      comment).
- [ ] TDD freshness; every sprite binary and inside its golden's ink; every timeline finite.
- [ ] Run `extract-resources` twice; no diff.
- [ ] Commit: `feat(nokia-os): phone book glyphs, sprites and timelines`.

### Task 4 - phone-core: standby keys that open applications (TDD)

**Files:** `packages/phone-core/src/{types.ts,machine.ts,index.ts}`, README; tests
`standby-keys.test.ts` (new). Shared: phone-core; plan 18 Task 4's standby-application activation is
reused, not duplicated.

- [ ] TDD `standbyKeys` with an application: ▼ runs it as a standby application (path `standby`,
      empty stack, `menuIndicator()` without segments, `exit()` to standby, `levels`/`select`/`row`
      throw); a path still navigates as before; power-off deactivates it once; `navigate()` while it
      runs deactivates it (`navigate`); an exception in `createSession` shows `App error`.
- [ ] TDD `standbyKeyDelayMs`: standby with `leaving: true` for that long, then the target; keys
      during the delay per Task 0 S (kernel default: C returns to standby, other keys are ignored);
      invalid values throw.
- [ ] Existing tests pass unchanged; configs without the seams produce identical models.
- [ ] `mise exec -- vp run @hellotimber/phone-core#test`, `vp run -r test`, `vp run website#build`,
      `vp check --fix`.
- [ ] Commit: `feat(phone-core): standby keys that open applications`.

### Task 5 - SIM card, entries and the phone book record (pure, TDD)

**Files:** `src/phone-book/{sim-card.ts,entries.ts,store.ts}` (new), `src/firmware/records.ts` (one
line: `PHONE_BOOK_RECORD`), `tests/phone-book-store.test.ts` (new), `tests/phone-book-entries.test.ts`
(new).

- [ ] TDD `normaliseSim(sim)`: a string is `{ id }` with the defaults; validation per D2 with
      messages naming the field and the location.
- [ ] TDD `entries.ts`: `compareNames` per Task 0's order (case-insensitive; accents, digits, spaces
      and equal names as recorded); `searchIndex` per D6 (every Task 0 Q and L case as a row).
- [ ] TDD `PHONE_BOOK_RECORD` (plan 15 D2): `{ sims: { [id]: { locations: (Contact | null)[] } },
speedDials: { [key]: location }, tones: { [id]: { [location]: tone } } }` with sorted keys;
      decode drops malformed parts; no `factory` (a test runs `restoreFactory()`, unless Task 0 K
      said otherwise); the stored JSON shape pinned by a snapshot.
- [ ] TDD `StockPhoneBook`: the host's entries until the first write, then the record; `add` fills
      the location Task 0 A shows and returns `"full"` at capacity; `replace`, `erase`, `eraseAll`;
      `free`/`used`; `speedDial` with the location fallback (S13) and Task 0 K's rule for empty or
      erased locations; tones following Replace and dropped by Erase (Task 0 D, T); `byNumber`; two
      phones over one storage see the same SIM; another SIM id sees its own.
- [ ] `mise exec -- vp run @hellotimber/nokia-os#test`, `vp check --fix`.
- [ ] Commit: `feat(nokia-os): SIM card port and phone book record`.

### Task 6 - The name list widget and painters (TDD against goldens)

**Files:** `src/widgets/name-list.ts` (new), `src/display/widgets/name-list.ts` (new), the
widget-model union and the `paintWidget` switch (one line each), `tests/widgets-name-list.test.ts`
(new).

- [ ] Painters from literal models equal every `phone-book/view-*`, `letters-*` and `service-*`
      image: Large font (icon, the large name with its character break, the small-face fallback),
      Name list (full-width rows, no rail, the ellipsis, the window), Name, number (the small name
      broken at its width, the last digits right-aligned), the Assign tone page, the Service Nos.
      rows and slider.
- [ ] TDD the widget in a flow (`tests/support/flow-rig.ts`): the opening entry (first, given,
      found), ▲/▼ wrap, the rows window (plan 14 D3) in Name list view, letter keys with the
      multi-tap cycle and plan 18's commit timeout, inert keys, the soft key handing the entry to
      `choose(entry, flow)`, C → `back`, the view re-read on every open.
- [ ] Commit: `feat(nokia-os): the stock name list in three views`.

### Task 7 - Standby ▼, Search, Add name, Service Nos. and Options (TDD)

**Files:** `src/firmware/features/phone-book.ts` (new: the feature, its leaf bindings for 1-1, 1-2,
1-3, 1-8-2 and the standby list), the features index (one-line registration), `src/index.ts` (one
line: the `StockSimCard` and `StockContact` types). Shared, beyond one line:
`src/firmware/phone.ts` (`sim` accepts a `StockSimCard`, builds `StockPhoneBook`, sets
`standbyKeys.down` to the list application and `standbyKeyDelayMs`, corrects the
`STOCK_STANDBY_KEYS` comment), `src/firmware/bindings.ts` (delete the two Memory status
`VIRGIN_TEXTS` lines, D14), `tests/settings.test.ts` and its snapshot (those two texts gone),
`tests/firmware-phone.test.ts` (the standby-key test: ▼ the list, ▲ Dialled numbers). New:
`tests/phone-book-flows.test.ts`.

- [ ] Standby ▼: the name list with `Call` (Call → plan 22's placeholder widget); C and C held per
      Task 0 S; an empty SIM's `No phone numbers`, then standby.
- [ ] 1-1 Search: plan 18's `textInput` on the existing prompt layout; OK → the list at
      `searchIndex`; an empty SIM → `No phone numbers` → the level (plan 14's golden still passes).
- [ ] 1-2 Service Nos.: the SIM's numbers, else the existing note.
- [ ] 1-3 Add name: `textInput` (the SIM's limit and counter) → `numberEntry` (limit 20, `OK`) →
      `Saved` → the list on the new entry with `Call`; `Nothing to save`; `Memory full` → `Replace?`
      (OK replaces location 1, or what Task 0 A shows; C → `Name:` with the text kept).
- [ ] 1-8-2 Memory status computed (D14); 1-8-1 Type of view unchanged, now read by the list.
- [ ] TDD through keys against `phone-book/standby-*`, `search-*`, `service-*`, `add-*`, `memory-*`,
      `view-choose-*` (pixels exact; timelines ±2 ms; recording spreads per plan 14 closeout
      decision 2).
- [ ] `mise exec -- vp run @hellotimber/nokia-os#test`, `vp run -r test`, `vp check --fix`.
- [ ] Commit: `feat(nokia-os): standby name list, Search, Add name and Memory status`.

### Task 8 - Erase, Edit and Assign tone (TDD)

**Files:** `src/firmware/features/phone-book.ts` (its Erase, Edit and Assign tone section),
`tests/phone-book-flows.test.ts`.

- [ ] 1-4-1 One by one: the list with `Erase` → `Erase?` (a confirm query; C back) → `Erased` → the
      list on the next entry, or what Task 0 E shows after the last one.
- [ ] 1-4-2 Erase all: `Are you sure?` → plan 15's `codeEntry` (wrong code and lockout shared) →
      `Erasing memory` → `Memory erased` → the level; the empty SIM's note as captured.
- [ ] 1-5 Edit: the list with `Edit` → `Name:` (prefilled, counter) → `Phone number:` (prefilled) →
      `Replace`/`Add` (a list with no stored value) when the name changed → `Saved` (or `Memory
full` → `Replace?` for Add); the list position afterwards.
- [ ] 1-6 Assign tone: the name pages with `Assign` → the ringing tone list with `Default` first and
      the captured numbering → previews (D12) → OK stores and shows `Done` → the page.
- [ ] TDD through keys against `phone-book/erase-*`, `edit-*`, `tone-*` and `sound/phone-book/tone-*`.
- [ ] Commit: `feat(nokia-os): Erase, Edit and Assign tone`.

### Task 9 - Speed dials and Voice tags (TDD)

**Files:** `src/firmware/features/phone-book.ts` (its Speed dials and Voice tags section),
`tests/phone-book-flows.test.ts`.

- [ ] 1-9: the key page (`Key n:` and the entry's name, large or the small fallback, or `(empty)`)
      for keys 2-9 with ▲/▼ wrap; `Assign` (unassigned) → the list with `Select` → `Speed dial key n
saved` → `Options`; `Options` (assigned) → View number (`Back`), Change (the list again), Erase
      (`Erase?` → `Speed dial key n erased`); no names → `No phone numbers`.
- [ ] 1-10-1 Add voice tag: the list with `Add voice tag` → `Press Start, then` / `speak after tone`
      (`Start`) → `Please speak now` (`Quit`) → `Voice system error` → the list (D9); 1-10-2…4 keep
      their notes.
- [ ] `StockPhoneBook.speedDial` for plan 22 (D11); a test pins the fallback.
- [ ] TDD through keys against `phone-book/speed-*` and `voice-*`.
- [ ] Commit: `feat(nokia-os): Speed dials and Voice tags`.

### Task 10 - Send b'card and the pickers other plans use (TDD)

**Files:** `src/firmware/features/phone-book.ts` (its Send b'card section and the picker), plan
18's network module (shared, additive: `sendBusinessCard?` in the port type and the synthetic
network), `src/index.ts` (one line: `StockBusinessCard`), plan 18's `EDITOR_OPTIONS` and its
`numberEntry` Search hook (one line each: the picker), `tests/phone-book-bcard.test.ts` (new).

- [ ] 1-7: the list with `Send` → the leading frame → `numberEntry` (`Search` → the list with
      `Select` → the number filled) → `Sending b'card` for `max(BCARD_LINK_MS, settle)` → `Business
card sent` → the list; `"failed"` → plan 18's failure note.
- [ ] `createSyntheticNetwork().cards`; a port without `sendBusinessCard` settles `"sent"` (D10).
- [ ] `pickNumber(flow, done)`: the name list with `Select` for plan 18's number prompts' `Search`;
      Send to many with names (the list with `Send`) replacing plan 18's owner-19 placeholder.
- [ ] TDD through keys against `phone-book/bcard-*`, `sound/phone-book/bcard`, `phone-book/pick-*`.
- [ ] Commit: `feat(nokia-os): Send b'card and phone book pickers`.

### Task 11 - Acceptance and the coverage guard

**Files:** `tests/acceptance/19-phone-book.test.ts`, `tests/support/rig.ts` (shared: a `sim`
pass-through only if the rig does not already forward the whole `StockPhoneConfig`).

- [ ] A hand-written scenario for every asserted `phone-book/*` golden and every new sound golden
      (navigate as the capture did, the fixture's SIM as a `StockSimCard`, keys on the ticks their
      redraws start); delete `awaitsPlan19Scenario`.
- [ ] Coverage guard: every Phone book tree node (1-1 … 1-10-4 and the 1-8-1 choices) is covered by
      an asserted golden in both states it has (empty SIM: plan 14's; with names: this plan's), or
      by a `pending:22` golden for a call; no golden or placeholder names plan 19.
- [ ] Every asserted golden passes (pixels exact; timelines ±2 ms, or the stated tolerance where a
      scenario replays another recording's timing). New `KNOWN_GAPS` need a reason.
- [ ] `mise exec -- vp run @hellotimber/nokia-os#test`, `vp run -r test`, `vp check --fix`. Report
      the suite's run time.
- [ ] Commit: `test(nokia-os): drive the phone book against its goldens`.

### Task 12 - Demo, README, verification gate and closeout

**Files:** `packages/nokia-os/{README.md,demo/{index.html,main.ts,style.css}}`,
`docs/specs/stock/phone-book.md`, `docs/plans/README.md`, this plan.

- [ ] Demo: a SIM select (`Empty SIM`, `Sample SIM` with a handful of invented names and two service
      numbers, `Full SIM`) restarting the phone with that `StockSimCard`; the status line shows the
      SIM id and its used/free count. Verify with `mise exec -- vp run @hellotimber/nokia-os#demo` and
      `agent-browser` (headless, Skip boot, the `[role=status]` line): ▼ at standby (the list),
      Search `C`, Add name `Zoe` and `Saved`, Type of view › Name list, Erase one by one, Speed dials
      Assign.
- [ ] README: the SIM card port (a host passing its own contacts; the persistence rule, D3), what
      plan 22 adds (calls), what 18c adds (receiving cards).
- [ ] `mise exec -- vp check --fix`, `vp run -r test`, `vp run website#build`;
      `git diff --stat <commit before Task 1> -- website/` is empty.
- [ ] `docs/specs/stock/phone-book.md`: replace "(plan 19, in progress)" with verified facts; list
      what stays UNVERIFIED.
- [ ] Plans README: row 19 `done`. Completion notes; status `done`.
- [ ] Commit: `docs: complete the phone book (plan 19)`.

## Follow-up plan adjustments

- **18 - Messages I:** its `numberEntry` `Search` and Write messages › Send to many take plan 19's
  picker (Task 10); `StockNetworkPort` gains `sendBusinessCard?` (D10). If plan 18 has not reached
  its Task 9, Task 10 waits.
- **18c - Chat and content:** receiving a business card (`Business card received`, `Save business
card?`, saving through `StockPhoneBook.add`) over its binary SMS extension; Chat's number Search.
- **22 - Calls:** `Call` from the name list and Service Nos.; held 2-9 (`StockPhoneBook.speedDial`,
  `settings/call-settings/speed-dialling`) and held 1; standby ▲ (`No last dialled numbers`, the
  `pending:22` golden); caller names (`byNumber`) and assigned ringing tones (`tone`); Dialled numbers
  › Save into the phone book (`add`).
- **26 - Languages:** Cyrillic names (the SIM-alphabet rules per language).
- **Portfolio integration (not sequenced):** the website passes a `StockSimCard` with Lachlan's
  contacts (a SIM name holds 16 characters, so the integration decides how links appear) and, if it
  wants, a `StockNetworkPort` with `sendBusinessCard`.

## Open questions for Lachlan

Resolved provisionally so execution is not blocked; each is cheap to reverse.

1. **Standby arrows (D5):** nokia-os follows the firmware (▼ names, ▲ dialled numbers); the website
   keeps its ▲ = phone book. Reverse: keep the spec's mapping in nokia-os too (the `standby-*`
   goldens then stay pending).
2. **SIM persistence (D3):** the SIM's contents live in the host storage under the SIM's id, so a
   host's initial contacts apply only to a SIM the phone has not written. Reverse: always start from
   the host's contacts (edits are lost on reload unless the host saves them).
3. **Contacts seam (D2):** the whole SIM card is host config, so the portfolio integration only
   writes data. Reverse: a narrower `contacts` array beside the `sim` string.
4. **Voice tags (D9):** reproduce `Voice system error` (an emulator effect, and what a phone with no
   working voice system shows). Reverse: Start opens a placeholder owned by no plan.
5. **Speed dials across SIMs (D4):** phone-wide until Task 0 P shows otherwise.
6. **Send b'card with no host support (D10):** settles `"sent"`. Reverse: `"failed"` and plan 18's
   failure note.
7. **Default SIM (D13):** the emulator SIM, empty, so the demo starts with no names; the demo offers
   a sample SIM. Reverse: a sample SIM by default (the plan 14 empty-SIM goldens then pass an
   explicit empty SIM).

## Conflicts found while planning

- Spec §6, §9 and VISION's website table say ▲ at standby opens the phone book and ▼ the dialled
  numbers; v6.39 does the opposite (S1). The helpdoc names the actions without the arrow glyphs.
  `STOCK_STANDBY_KEYS` (plan 13) copied the spec.
- Plan 13's follow-up text and the brief mention "SIM/phone memory" and "Memory in use"; v6.39 has
  only the SIM (S16, D1).
- Plan 14's catalogue reads Speed dials `Key 2:` as `(empty)`; that holds only for an empty SIM
  location: an unassigned key shows SIM location n (S13). The menu-tree spec's content crawl reads
  `Key 2:` / `B` as an assignment; B is SIM location 2.
- Plan 14 makes every key but C inert on the Phone book prompts (D11); this plan replaces them.
- Plan 18 owns `Search` on number prompts only "if it is the name list"; it is (S12; Task 0 B and X
  confirm).

## Done means

- A host's `StockSimCard` provides the names and service numbers; edits persist per SIM identity;
  the default SIM reproduces the virgin, empty-SIM state, and every plan 13-18 golden still passes.
- Standby ▼, Search, Service Nos., Add name, Erase, Edit, Assign tone, Send b'card, Options, Speed
  dials and Voice tags match their goldens (pixels exact; timelines within ±2 ms after alignment, or
  a stated tolerance), in each Type of view.
- Every new string renders; generated data and resources are fresh and idempotent.
- No golden or placeholder names plan 19; calls are `pending:22`; the coverage guard accounts for
  every Phone book node.
- phone-core stays Nokia-agnostic; the website is unchanged; `vp check`, `vp run -r test` and
  `vp run website#build` pass; VISION, the specs and the plans README match what shipped.
