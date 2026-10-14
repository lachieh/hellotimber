# Plan 20 - Calculator

> **For agentic workers:** execute task-by-task; tick checkboxes; commit per task.
> If this plan contradicts VISION.md, AGENTS.md, or the code, STOP and report.

**Prerequisites:** plans 13, 14 and 15 complete; plan 16 Tasks 1-9 complete (the sound goldens,
`NOTE_SOUNDS`, the sounder and note tones; Tasks 10-11 are demo and closeout and do not block).
Plan 29 owns the shared capture/resource pipeline. Before resuming runtime, inspect its delivered
API and verify calculator text, note sound and timeline registration end to end. No plan 29
API or filename is assumed here. The per-plan file split (feature modules, per-plan capture sets and acceptance files, see
"Conventions") must have landed before Task 2; if it has not, stop and report.
**Ground truth:** the v6.39 emulator corpus at
`REF=/Volumes/SSD/Projects/lachieh/hellotimber/nokia-3310` (gitignored, main checkout only). Read
`$REF/captures/README.md` ("Script format", "Output format", "Plan 15 supplementary captures",
"Plan 16 supplementary captures") and plans 13-16 before starting. Task 0 writes this plan's
captures to `$REF/captures/6.39/plan20/`. The planning probes in `$REF/captures/scratch-plan20/`
are evidence for this plan only and are never imported.
**Status:** implemented except D9. Tasks 2-8 done on plan 29's registration; node 9 is the stock calculator. Options' numeric/star/hash escape (D9) waits on plan 22 and the dual-frequency sound contract (28 fixtures `pending:22`). Task 0 R stays unticked for the parent's review of the corrected criterion.

## Goal

Replace the Calculator placeholder (menu 9) of `@hellotimber/nokia-os` with the stock v6.39
calculator, pixel- and timing-faithful to the captures:

- number entry in the calculator's own layout (digits, `#` decimal point, the nine-character magnitude limit (minus excluded),
  C delete, C held clear, C on `0` leaving), the operator cycle on `*` (`+ - * /`), chaining;
- the Options menu in its three states (8, 4 and 5 entries): Equals, Add, Subtract, Multiply,
  Divide, In domestic, In foreign, Exchange rate;
- the firmware's arithmetic: 9-character decimal results, rounding, `Out of range` and
  `Dividing by zero not allowed`;
- currency conversion and the exchange-rate entry in both directions (`Rate saved`), the rate
  persisted in the phone's EEPROM;
- the calculator's sounds (keypad beeps, the warning tone of its error notes).

The website does not change. Its own `CalculatorApplication` (`website/src/phone/applications/
calculator.ts`) is a different design and is only contrasted ("Conflicts").

## Why this plan exists (measured gap)

| Area             | nokia-os after plans 13-16             | Evidence (planning probes, `$REF/captures/scratch-plan20/`)                                                           |
| ---------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Menu 9           | `PlaceholderApplication` (owner 20)    | `0` right-aligned in the small face above `Options`; `menu/09-calculator.sub` and `sound/note/9` are `pending:20`     |
| Entry, operators | none                                   | digits append, `#` adds one `.`, `*` cycles `+ - * /` with no timeout, the display grows to three right-aligned lines |
| Options          | none                                   | a rows list numbered by position (`1`…`8`) whose entries depend on the state (8, 4 or 5)                              |
| Arithmetic       | none                                   | results fit 9 characters, rounded half up; `Out of range` at 10 integer digits; `0.3333333 × 3 = 0.9999999`           |
| Currency         | none                                   | one stored rate, two directions, a pages list (`8-1`, `8-2`), an `Exchange rate:` entry, `Rate saved`, persistent     |
| Sound            | the opening beep only (`sound/note/9`) | 900 Hz beeps on every calculator key; `Out of range` plays the 1750 Hz warning tone (Warning tones On)                |

## Calculator investigation (planning, 2026-10-14)

Scratch scripts `probe-{a,b,c,d,e,f,g,g2,i,i2,k,l}.cap` ran on the virgin image
(`firmware/raw/6.39/combined/3310_v639_ppm_E_virgin_eeprom_2MiB.fls`, `v639-setup.inc`) and
`probe-h.cap` on plan 15's factory-restored image (`firmware/work/v639-plan15-restored.fls`,
`v639-factory-setup.inc`; audio). Outputs `out-<x>/`, contact sheets `sheet-*.png`, logs
`probe-*.log`. The calculator was opened with Menu, ▲×4, Select (`calc.inc`). Taps are the
harness's 42 ms presses ≈592 ms apart unless the probe says otherwise. Probes F, I2, L and H drifted
into standby number entry part-way (a C too many, or C held on a list); those parts are
disregarded and listed in Task 0.

| #   | Source                                     | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | crawl `tree/09-calculator/**`, `tree.json` | Select opens `0` (small face, right-aligned) with soft key `Options`, 46 ms after the key. Options is a rows list `Equals, Add, Subtract, Multiply, Divide, In domestic, In foreign, Exchange rate` (index `1`…`8`, soft key `OK`). Exchange rate opens a pages list (`8-1` Foreign unit / expressed in / domestic units, `8-2` Domestic unit / expressed in / foreign units), each an `Exchange rate:` prompt with a pen icon, a box, a large `0` and a 480 ms cursor blink. In foreign with the virgin rate shows `Dividing by zero not allowed` (info icon) and returns to `0`.                                                                                                                                                                                                    |
| C2  | `out-a`, `out-b`, `out-i`                  | Digits append; leading zeros collapse (`0 0` → `0`). `#` appends `.` once (a second `#` does nothing); `#` on a fresh entry gives `0.`. The entry takes 9 characters, the `.` included (`123456789`, `0.5123456`, `12.345678`); further keys are ignored. C deletes the last character; the last one leaves `0`; C on `0` leaves to the carousel (Calculator icon restarting). C held 1.5 s or 3 s clears to `0` and stays. ▲/▼ do nothing. A held digit enters once.                                                                                                                                                                                                                                                                                                                 |
| C3  | `out-c`                                    | `*` after a number shows the number one row up and the operator below it (`+`); each further `*` cycles `+ - * /` and wraps to `+`, at 292 ms and at 2.3 s between taps (no timeout). A digit then starts the second operand on a third row. `*` after a second operand evaluates and starts `+` on the result (`12 + 3`, `*` → `15 +`). C deletes the second operand's characters, then the operator (back to one line), then the first operand.                                                                                                                                                                                                                                                                                                                                     |
| C4  | `out-d`, `out-e`                           | Options › Equals with `a op b` shows the result alone. A digit after a result starts a new number; `*` (or an operator choice) continues from it; `#` starts `0.`. Equals with an operator but no second operand, or with no operator, changes nothing. Options lists: no operator → 8 entries; operator without second operand → `Add, Subtract, Multiply, Divide` (opening on Add, whatever the operator; OK replaces the operator); operator and second operand → `Equals, Add, Subtract, Multiply, Divide` (an operator choice evaluates, then sets that operator). C leaves Options without a change.                                                                                                                                                                            |
| C5  | `out-d`, `out-f`, `out-l`                  | `12 + 3 = 15`, `2 - 5 = -3`, `-3 × 7 = -21`, `1.5 + 2.25 = 3.75`, `2.5 × 2 = 5`, `0.1 + 0.2 = 0.3`, `1/3 = 0.3333333`, `2/3 = 0.6666667`, `1/7 = 0.1428571`, `10/3 = 3.3333333`, `100000000/3 = 33333333`, `123456789 + 1 = 123456790`, `24691357/2 = 12345679`, `0.0000001/100 = 0`, `(1/3) × 3 = 0.9999999`. `99999 × 99999`, `500000000 + 500000000`, `99999999 × 99999999` and `-1 - 999999999` show `Out of range` (info icon) and restore the screen before Equals. `x / 0` shows `Dividing by zero not allowed` and restores `-21 / 0`.                                                                                                                                                                                                                                        |
| C6  | `out-g`, `out-g2`, `out-k`                 | The rate prompt opens on the stored rate in the chosen direction (virgin `0`); a digit replaces a shown `0`, C edits a prefilled value (`0.5` → `0.` → `0`); `#`, C and C held (an empty box) work as in the calculator; `1.12345` was the longest value typed (7 characters; 9 shown when prefilled: `0.6666667`). OK shows `Rate saved` (tick 685/233/545 ms), then the calculator (not the list). One rate is stored: Foreign 1.5 shows Domestic as `0.6666667`; Domestic 2 shows Foreign as `0.5`. With Foreign rate r, In domestic = amount × r and In foreign = amount ÷ r (`10` → `15`, `15` → `10`); with Domestic rate r the reverse (`10` → `5`, `5` → `10`). The rate survives a power cycle (`saveflash`, cold boot); the calculator itself starts at `0` on every entry. |
| C7  | `out-h` (factory)                          | Every calculator key beeps 900 Hz on the tone generator (Keypad tones Level 2, 0x9104, ≈143 ms; no DTMF). `Out of range` plays 1750 Hz at 0x9105 for 287 ms in place of OK's beep and shows for 2905 ms. The Options list draws 63-66 ms and conversions 50-53 ms after their key.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

Conclusions:

1. **The calculator is a small state machine over a 9-character decimal display.** Its numbers are
   the displayed strings: a result is rounded to what fits, and the next operation uses that
   rounded value (C5's `0.9999999`). nokia-os reproduces it with exact decimal arithmetic on those
   strings, never with JavaScript floats (`0.1 + 0.2 = 0.3` must hold).
2. **The Options list is not one fixed menu.** Its entries follow the state (C4), so it is a widget
   list built per opening, not a kernel submenu or a tree node.
3. **The exchange rate is the calculator's only stored state** (C6); everything else resets on
   entry.

## Scope and non-goals

In scope: the Goal items; Task 0's captures; the calculator's goldens (LCD and sound), engine,
EEPROM record, widgets, painter and feature module; documentation in
`docs/specs/stock/calculator.md`.

Deliberately left to later plans (each in "Follow-up plan adjustments"):

- **Currency conversion in standby** (the user guide's `Convert` after digits and `#` at standby)
  → plan 22, which also owns the captured Options numeric/star/hash handoff; it reads the rate through this plan's
  `CalculatorRate`.
- **The other languages' strings** → plan 26.
- **The website's calculator** stays as it is (D10).

## Decisions

Each decision states what changes relative to the brief and to plans 13-16.

**D1 - The v6.39 Options are the captured eight; there is no Square, Square root or Change sign
(corrects the brief).** The brief's list (Square, Square root, Change sign, To home, To foreign) is
not in v6.39: the crawl and C1/C4 show `Equals, Add, Subtract, Multiply, Divide, In domestic, In
foreign, Exchange rate`. `In domestic`/`In foreign` are the firmware's names for the brief's "To
home"/"To foreign". A negative number can only come from a result (C5).

**D2 - `*` cycles operators and never means equals; `#` is the decimal point (corrects the
brief).** The brief's "= via `*`" is not what the firmware does: `*` after a second operand
evaluates and starts `+` on the result (C3), which reaches the same number, and the result alone is
shown only by Options › Equals. `*` has no multi-tap timeout (C3). `#` only adds a point (C2).

**D3 - Exact decimal arithmetic with a nine-character magnitude (Deviation from the provisional sign rule).** `src/calculator/decimal.ts` parses display strings as sign, BigInt digits and scale. Arithmetic is exact (division as a rational), then rounded half away from zero to fit at most nine magnitude characters, including `.` but excluding a leading `-`. Thus `-123456789` and `-0.3333333` are valid ten-character strings. Drop trailing fractional zeros and a trailing point from results, and show rounded zero as `0`. Ten integer digits, including rounding carry to ten digits, produce `out-of-range`; division by zero produces `divide-by-zero`. Later arithmetic uses the displayed result. Conversions use the same formatting rule but the original directional rate (D6). Task 0's literal over-limit inputs test entry truncation, not `calculate` with impossible operands; use its representable division cases for half rounding (Task 1 criterion correction).

**D4 - The calculator is a stock flow; its engine is pure (new; plan 14 D1 pattern).** The
application bound to node 9 is a `StockFlowApplication` whose root widget renders the calculator
screen and pushes the Options list, the exchange-rate list, the rate entry and notes, as other
stock leaves do. The rules (entry, operators, the Options entries per state, results and notes)
live in `src/calculator/engine.ts`, a pure state machine with no widget, timer or storage, so
they are tested without a phone. The Options list uses the rows-list presentation (opening on the first
entry). Existing `OptionListWidget` ignores numeric keys; D9 requires a later shared
standby-entry handoff before this path can be complete; the exchange-rate list reuses the info-pages widget (pages without values, soft key
`OK`); the rate entry is a small widget over plan 14's prompt model (D7).

**D5 - Indicators are rooted at the Options menu (new).** The calculator screen has no indicator;
Options reads `1`…`n` (the position in the list for its state) and the exchange-rate list `8-1`,
`8-2` (C1). The calculator's widgets see an indicator rooted at Options, not the kernel's `9`
(the info-pages `atPage` pattern), so no kernel change is needed.

**D6 - Persist the typed directional rate; Restore sets rate 1 (Deviation).** `CALCULATOR_RECORD` (`nokia-os/calculator`, version 1) holds `{ direction: "foreign" | "domestic", rate: string }`. Virgin state is Foreign `0`, with the Domestic prompt empty. Saving empty or `.` normalises to zero. Show the reciprocal in the other direction using D3, but convert with the original typed value. Domestic `3` shows Foreign `0.3333333`, yet `10` In domestic is `3.3333333` and In foreign is `30`. Multiplying by the displayed reciprocal would incorrectly give `3.333333`. Foreign `1.5` survives saveflash/cold boot. Restore factory settings resets the record to `{ direction: "foreign", rate: "1" }`, giving `1` in both prompts, after either captured direction. Register the record with an explicit factory value. This is a reproduction storage design; the firmware's physical EEPROM representation remains UNVERIFIED.

**D7 - A separate cursor-based rate editor (Deviation).** The rate entry uses the prompt presentation (pen, `Exchange rate:`, box, large value, ~480 ms cursor blink). Typed input has a seven-character limit including `.`, while a prefilled reciprocal can contain nine characters. The first digit replaces a prefilled value. `#` on virgin Foreign `0` starts `.`, and duplicate points are ignored. C can empty the field, C on empty returns to the rate list, held C clears, and OK on empty or `.` saves zero. Implement cursor movement, insertion and deletion: `123`, ▲, `4` gives `4123`; `123`, ▲, ▲, `4` gives `1423`; `123`, ▲, ▲, ▲, C gives `13`; ▼ at the end moves onto the last digit. Reject insertion at seven typed characters. Use paired blink PNGs when the cursor obscures a digit. Do not substitute calculator input or an unverified plan 18 editor.

**D8 - Calculator keys act while down (Deviation from release-only handling).** Held digit, `*` and `#` draw before release and enter once. Handle each captured key once on key-down, with no duplicate release action. C first deletes, then clears while held: clear redraw occurs 532.1 and 544.0 ms after down. These are observed draw times, consistent with an approximately 500 ms hold plus redraw latency; they do not prove the exact internal timer. Do not inherit the kernel's 800 ms threshold. C held on `0` exits through the carousel to standby. Verify press/release edges and the entire clear-held timeline before choosing the implementation timer. Align LCD timelines on the first changed frame; ordinary firmware redraw latency is not reproduced.

**D9 - Beeps, warnings and Options DTMF have different paths (Deviation).** Factory calculator/rate keys beep at 900 Hz, Level 2 (`0x9104`), about 140-148 ms. Error notes replace OK's beep with 1750 Hz at `0x9105` (Out of range 296.1 ms, divide-by-zero 288.1 ms). Virgin error-triggering OK is silent; its preceding Options beep is not. `Rate saved` adds no confirmation tone, but its OK key beeps.

Numeric, `*` and `#` keys leave Options for standby number entry with soft key `Call`, emitting DTMF pairs. Independent short-key confirmations give `0` = 1336+941 Hz and `1` = 1209+697 Hz; `*` = 1209+941 Hz and `#` = 1477+941 Hz. Arrows/C/OK in Options still beep at 900 Hz. Existing list handling and the single-frequency `StockSoundEvent` cannot reproduce this. Plan 22 owns standby entry; the parent/shared sound owner must reconcile dual-frequency events with VISION and host consumers. This is a bounded later gate for Options escape LCD/sound drivers and final acceptance. Keep their fixtures `pending:20` until that integration passes. Do not invent a telephony UI, flatten DTMF to one tone, emit two unrelated single-tone events, or modify shared sound/kernel code in plan 20.

**D10 - The website does not change.** `git diff --stat <commit before Task 1> -- website/` is
empty at the end. The record and engine are internal. D9 requires parent-owned sound-contract reconciliation before Options escape acceptance; this task does not edit VISION.

## Ground truth and artefacts

| Source (`$REF/captures/`)                                | Contents                                                          | Use                                               |
| -------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------- |
| `scratch-plan20/` (planning)                             | probes A-L (C1-C7)                                                | evidence for the decisions; never imported        |
| `6.39/plan20/` (Task 0)                                  | every recording below, `cases.json`, `text.json`, events and keys | `calculator/*` and `sound/calculator/*` goldens   |
| `6.39/menu/09-calculator/sub/01.png` (existing)          | the first screen                                                  | `menu/09-calculator.sub`: `pending:20` → asserted |
| `6.39/plan16/notes/9` (existing)                         | the opening beep (factory)                                        | `sound/note/9`: `pending:20` → asserted           |
| `6.39/tree/09-calculator/**` (crawl)                     | first screens of every Options entry                              | reference only (plan 14 D5)                       |
| `firmware/work/v639-plan15-restored.fls`, `-seccode.fls` | factory image; image with a working code (Restore)                | sound sections; the Restore section               |

Artefacts (added to `docs/specs/stock/calculator.md` in Task 1):

| Artefact                                               | Cause                      | Handling                      |
| ------------------------------------------------------ | -------------------------- | ----------------------------- |
| Rate `0`, `Dividing by zero not allowed` on In foreign | virgin EEPROM              | the virgin initial state (D6) |
| 46-88 ms between a key and its redraw                  | firmware key scan and draw | not reproduced (D8)           |
| Tone lead over the note's redraw                       | firmware draw latency      | not reproduced (plan 16 D12)  |

## Package boundaries

Unchanged from plans 13-16. nokia-os gains no dependency; phone-core and phone-screen do not
change. Scripts keep plan 13's conventions (Node type stripping, `node:*` and sibling imports).

## Contract changes

The calculator record and arithmetic require no routing or package-boundary changes. The new key `nokia-os/calculator` stays under `STOCK_STORAGE_PREFIX`. Node 9 eventually opens the calculator instead of a placeholder.

**Required later gate:** VISION's `StockSoundEvent` exposes one `hz` per tone event; the captured Options escape has two simultaneous frequencies. The parent/shared sound owner must define and verify a contract that preserves both frequencies and host behavior. Plan 22 must provide the standby-entry handoff. Neither API shape nor telephony behavior is invented here. Record their delivered contracts before implementing D9; final completion depends on both.

## Internal API (for plan 22)

Fixed by Tasks 3-4; a change is a Deviation recorded here.

```ts
// src/calculator/decimal.ts (pure)
export type CalcResult =
  | { readonly ok: string }
  | { readonly error: "out-of-range" | "divide-by-zero" };
export function calculate(a: string, op: CalcOperator, b: string): CalcResult; // D3
export type CalcOperator = "+" | "-" | "*" | "/";

// src/calculator/rate.ts
export const CALCULATOR_RECORD: EepromRecord<CalculatorRateState>;
export class CalculatorRate {
  constructor(eeprom: StockEeprom);
  shown(direction: "foreign" | "domestic"): string; // the prompt's value (reciprocal per D6)
  set(direction: "foreign" | "domestic", rate: string): void;
  convert(amount: string, to: "domestic" | "foreign"): CalcResult; // In domestic / In foreign
}
```

## Golden pipeline additions

Use the existing `pending:20` status and per-plan fixture vocabulary. Any resource or
dual-frequency extension must come from the verified shared-owner result. Plan 20's capture set (`scripts/capture-sets/20-calculator.ts`) holds LCD and
sound rows (the per-plan shape the file split defines) and exports `CALCULATOR_CASES`: per still
image, the keys pressed from the calculator's first screen (Task 0's `cases.json`, transcribed).
The importer names stills by case; the acceptance scenarios replay the same table, so a case's
keys have one source. Preserve case setup metadata for persistence/Restore, waits and held edges,
not just key names. Sources are under `$REF/captures/6.39/plan20/`. Import as `pending:20`;
promote each fixture to `asserted` only after its real behavioral scenario passes.

| Fixture id                                                                   | Source                        | Kind      | Asserts                                                                  |
| ---------------------------------------------------------------------------- | ----------------------------- | --------- | ------------------------------------------------------------------------ |
| `calculator/open`                                                            | `open`                        | timeline  | Select on Calculator → `0` (trigger: first changed frame)                |
| `calculator/entry`                                                           | `entry/*.png`                 | stills    | digits, leading zeros, the 9-character limit, `#`, C, C to `0`           |
| `calculator/exit`                                                            | `exit`                        | timeline  | C on `0` → carousel, icon restarting                                     |
| `calculator/clear-held`                                                      | `clear-held`                  | timeline  | C held: when the entry clears; held digit, `*`, `#` (D8)                 |
| `calculator/operators`                                                       | `operators/*.png`             | stills    | the `*` cycle and wrap, three lines, C through operand and operator      |
| `calculator/operator-slow`                                                   | `operator-slow`               | timeline  | `*` 3 s apart still cycles (no timeout)                                  |
| `calculator/options-{number,operator,operand}`                               | `options/<state>/*.png`       | stills    | the 8-, 4- and 5-entry lists scrolled through the wrap, ▲ from the first |
| `calculator/choose`                                                          | `choose/*.png`                | stills    | every Options entry in every state, and C on Options                     |
| `calculator/results`                                                         | `results/*.png`               | stills    | the arithmetic table (Task 0 R)                                          |
| `calculator/divide-by-zero`, `calculator/out-of-range`                       | `notes/*`                     | timeline  | each note from OK to the restored screen                                 |
| `calculator/note-keys`                                                       | `notes/keys-*`                | timeline  | C, a digit, ▼ and C held during a note                                   |
| `calculator/rate-list`                                                       | `rate/list/*.png`             | stills    | `8-1`, `8-2`, wrap, C                                                    |
| `calculator/rate-prompt-{foreign,domestic}`                                  | `rate/prompt-*`               | timeline  | the virgin prompt and its cursor blink                                   |
| `calculator/rate-keys`                                                       | `rate/keys/*.png`             | stills    | seven-character cursor edits, prefill, `#`, C/hold, empty OK             |
| `calculator/rate-saved`                                                      | `rate/saved`                  | timeline  | OK → `Rate saved` → the calculator                                       |
| `calculator/convert`                                                         | `convert/*.png`               | stills    | In domestic and In foreign in both directions, rate 0, overflow          |
| `calculator/persist`                                                         | `persist/*.png`               | stills    | the rate after a power cycle and after Restore; `0` on re-entry          |
| `sound/calculator/{keys,out-of-range,divide-by-zero,rate-saved,note-key}`    | `sound/*` (factory)           | sound     | beeps, warning tones, the silent confirmation (D9)                       |
| `sound/calculator/keys-rate-*`                                               | `sound/keys-rate-*`           | sound     | every rate key, paired with cursor LCD recordings                        |
| `sound/calculator/keys-options-*`, `sound/calculator/options-dtmf-confirm-*` | matching `sound/*`            | sound/LCD | Options escape, `Call`, simultaneous DTMF pairs; D9 gate                 |
| `sound/calculator/divide-by-zero-virgin`                                     | `sound/divide-by-zero-virgin` | sound     | silent error-triggering OK with preceding Options beep                   |

`menu/09-calculator.sub` and `sound/note/9` become `asserted` when node 9 leaves the placeholder
owners only after real node 9 LCD/sound drivers pass (Tasks 6-8). Task 2 keeps
their existing `pending:20` status and owner entries. The new goldens' text runs (OCR, `plan20/text.json`) feed the glyph harvester
through the capture set; the small face gains `/`, the only glyph the calculator needs that no
golden has yet (planning observation; verify the actual generated diff through plan 29).

## Stock display observations (from the scratch sheets; Task 5 measures from goldens)

| Element            | Observation                                                                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Calculator screen  | up to three lines in the small face, right-aligned at the right edge, the last line directly above the soft key row; `Options` centred at y 40 |
| Operator           | a single small-face character (`+ - * /`) on its own line, right-aligned                                                                       |
| Options            | plan 14 rows list (band, rail), index = position only, soft key `OK`                                                                           |
| Exchange rate list | plan 14 pages layout (label lines at tops 7/16/25, rail), index `8-k`, soft key `OK`                                                           |
| Rate prompt        | plan 14 prompt: pen icon, `Exchange rate:` (small, top 7), box x 0..83, y 16..36, large value right-aligned, cursor                            |
| Notes              | plan 14 notes: `Out of range` and `Dividing / by zero / not allowed` with the info icon; `Rate / saved` with the tick                          |

## Conventions for every task

- Run commands from the repo root with `mise exec --`.
- **File ownership (the per-plan split).** This plan writes its own files only:
  `src/calculator/**`, `src/firmware/features/calculator.ts`, `src/widgets/calculator.ts`,
  `src/display/widgets/calculator.ts`, `scripts/capture-sets/20-calculator.ts`,
  `tests/calculator-*.test.ts`, `tests/support/calculator.ts`,
  `tests/acceptance/20-calculator.test.ts`, `docs/specs/stock/calculator.md`, this plan and row 20
  of the plans README. Shared files get one-line registrations only, each named in its task: the
  `src/firmware/features/index.ts`, `src/firmware/records.ts`,
  `scripts/capture-sets/index.ts`, `src/display/widgets/index.ts` (model union and paint switch),
  `scripts/tree-capture-set.ts` (owner 20 group), and the owning
  `scripts/capture-sets/13-foundation.ts` / `16-tones-and-sound.ts` status entries.
  If a registration needs more than that, stop and report. `bindings.ts`, `leaves.ts`,
  `acceptance.test.ts`, `scripts/capture-set.ts` and `demo/` are not
  edited. Parent/shared owners handle changes beyond these registration exceptions.
- TDD: write the failing test first wherever the task names tests.
- After each task: `mise exec -- vp check --fix` and the named test commands.
- Commit rule: run `mise exec -- vp check --fix` yourself, stage files by explicit path, then
  `git commit --no-verify -m "<message>"`. Never `git add -A`/`git add .`. Never stage
  `TODOS.md` (Lachlan's untracked notes).
- Never hand-edit `goldens/**`, `src/resources/generated/**`, `src/firmware/generated/**` or
  `scripts/generated/**`; change the generator input and regenerate. Each generator runs twice with
  no diff before its commit.
- Tests never read `$REF`. Generators that read `$REF` fail clearly when it is missing.
- No new dependencies.
- When reality differs from this plan, follow the captures and append a `Deviation:` paragraph
  under the task. If a deviation breaks a contract in VISION.md, stop and report.
- Parallelism (max 3 concurrent agents): Task 0 gates everything, then Task 1. Then lanes A (2),
  B (3 → 4). Task 5 needs 2; Task 6 needs 3, 4 and 5; Task 7 needs 6; Task 8 needs 7.

## Tasks

### Task 0 - REF captures (no repository changes)

**Files (all under `$REF`, gitignored):** `captures/scripts/gen_v639_plan20.py`,
`captures/scripts/v639-plan20-<section>.cap`, `captures/6.39/plan20/**`, a "Plan 20
supplementary captures" section in `captures/README.md`, `firmware/work/v639-plan20-*.fls`.

Write only these paths (concurrent sessions use the harness). Drive sections as plan 16 did
(`tools/menutree/emu.py` with `fork`, or plain `tools/harness/cap` per section). Open the
calculator with Menu, ▲×4, Select from a settled standby. Every recording is `record <name> start`
before its trigger key; still sections write one `shot` per case and append `{ name, keys }` to
`plan20/cases.json` (keys from the calculator's first screen). Navigation is checked against the
LCD before each recording. Avoid the planning probes' traps: a C on `0` leaves the calculator, and
C held on a list goes to standby.

- [x] **O open/exit:** `open` (Select → first screen, 3 s), `exit` (C on `0` → carousel, 4 s),
      `clear-held` (`5 6 7` then C held 2 s; a digit held 1.2 s; `*` and `#` held 1.2 s; C held on
      `0` 2 s), each with raw `press`/`release` edges so the held frames are visible (D8).
- [x] **E entry** (stills): each digit; `0 0`; 9 digits then a 10th; `1 2 # 3 4 5 6 7 8` then
      a 9; `#` first; `#` twice; `#` after 9 characters; C after each kind of character; C down to
      `0`.
- [x] **P operators:** stills of `*` ×1…5 after a number, after `0`, after a result; a digit after
      each operator; C through `a op b` back to `0`; `*` after a second operand; `#` in the operator
      state; `operator-slow` (`*` three times 3 s apart).
- [x] **M Options:** scroll every state's list through its wrap (number, operator, operand); ▲
      from the first entry; C from the list; every entry chosen in every state where it exists.
- [ ] **R results** (stills, one case each): every C5 case; the half cases `24691357/2` and
      `-24691357/2` (via `0 - 24691357` then `/ 2`); `-1/3`, `-2/3`, `-12345678 × 1`, `-123456789`
      (`0 - 123456789`), `-99999999.5`, `999999999 + 1`, `0.00000005 × 1`, `-0.00000005 × 1`,
      `0.5 + 0.5`, `9.9999999 + 0.00000001`; results used as operands (`(2/3) × 3`, `(1/3) + (1/3)`);
      In domestic of `99999999` at rate `100` (overflow), and of `0.0000001` at rate `0.5`.
- [x] **N notes:** `divide-by-zero` and `out-of-range` from OK on Equals and from an operator
      choice, 4 s each; `keys-*`: C, a digit, ▼ and C held 1.5 s pressed 500 ms into each note.
- [x] **X exchange rate:** the list (both pages, wrap, C); both virgin prompts with 3 s of blink;
      `rate/keys` stills (first digit replaces a shown value, `#`, `##`, C, C to empty, C held,
      digits until the entry stops, C on an empty entry, OK on an empty entry, OK on `0.`); OK with
      `1.5` → `Rate saved` → screen (`rate/saved`, 4 s); the Domestic prompt after it; Domestic `3`
      then the Foreign prompt and `10` In domestic and In foreign (D6: typed value or reciprocal);
      `convert` stills for both directions, rate 0 and overflow.
- [x] **K persist:** after a rate is set, `saveflash`, cold boot from the image: the prompt shows
      the rate, the calculator starts at `0`. Restore factory settings (6-4, code `12345`) on
      `v639-plan15-seccode.fls` with a rate set, then the prompt (D6: kept or reset).
- [x] **S sound** (factory image, `audio` + `record` + `keys.csv` as plan 16): `keys` (every key
      on the calculator screen, in Options and in the rate entry), `out-of-range`,
      `divide-by-zero`, `rate-saved`, `note-key` (a digit on an error note); one virgin
      `divide-by-zero` (Warning tones unset: silent).
- [x] OCR every image (plan 15's command with `OUT='plan20'`) into `plan20/text.json`.
- [x] `gen_v639_plan20.py check`: every case has its image; every recording settles or ends on a
      blink; every factory recording has events and `keys.csv`.
- [x] Append "Plan 20 supplementary captures" to `$REF/captures/README.md`.
- [x] No commit. Record the outcome under this task: the entry limit (digits, `.`, `-`), the
      rounding mode for halves and negatives, the held-key behaviour (D8), the C-held clear time,
      the Options per state, every note's timeline and sound, the rate entry's limit and empty/OK
      cases, the stored rate form (D6), Restore's effect, and any section that failed.

#### Task 0 outcome — verified 2026-10-14

Research only, resumed in `/Volumes/SSD/Projects/.worktrees/hellotimber/p20-calculator`,
branch `t3/p20-calculator`, HEAD `d0e981c01662790259a251cc79393943ce2be622`. Tasks 1–9 remain
paused under AGENTS.md's discrepancy rule. This closeout does not reconcile their design or
implement a workaround. No code, goldens or tests changed; no commit, push or deployment.

**Capture checks.** Reused the existing 369 cases / 27 recordings. Indexed `persist/before`,
extended `exit` to 10 s (last frame starts at 5003.7 ms and holds for 5086.7 ms), added literal
input-limit cases, complementary cursor phases, complete factory key coverage in Options/rate
entry, independent numeric-key confirmations, and recordings of Restore and its resulting
prompts. Final counts: **388 indexed stills, 67 recordings, 405 recorded frames, 793 native
images (235 distinct)**. Case groups: entry 45, operators 39, options 23, choose 32, results 102,
rate 66, convert 60, persist 21. Every native image is in `text.json`; faces are `bold8`,
`large13`, `plain8`, `tiny6`. The generator's `cases`, `ocr` and strengthened `check` pass
(check exit 0): unique case names, images in both directions, each recording's frame files,
positive durations, ≥1000 ms settled tails or pixel-verified alternating ~480 ms blink tails,
nonempty audio/events, key edges, sound-event columns and complete OCR coverage. No final
`failed-*.txt` remains. Shared harness binaries/scripts were read only; no tools or dependencies
were installed.

Evidence paths below are relative to `$REF/captures/6.39/plan20/`. Full counts, frame durations,
key counts, sound pairs and harness hashes are in `task0-evidence.json`; `check.txt` holds the
successful check. Replay scripts are `$REF/captures/scripts/v639-plan20-<section>.cap`, generated
by `gen_v639_plan20.py`. The REF README's supplementary section is appended.

| Verified fact                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Canonical evidence                                                                                                                                                                                                                     | Consequence for later tasks                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entry accepts nine characters, counting `.`, with leading zeros collapsed and extra input ignored. `#` first gives `0.`; a second `#` is ignored. C removes a character, returns the last character to `0`, then leaves on another C.                                                                                                                                                                                                                                                                          | `entry/{nine-digits,ten-digits,point-eight,point-nine,point-first,point-twice,point-after-nine,c-to-zero,zero-c}.png` and their cases                                                                                                  | Tasks 3–4 retain this entry rule. A minus sign cannot be typed directly.                                                                                                                                                                                                                                   |
| Minus does **not** consume the magnitude's nine-character result budget. `-123456789`, `-999999999`, `-0.3333333` and `-0.0000001` are displayed successfully. `-99999999.5` rounds to `-100000000`; `999999999 × 1` succeeds. Ten integer digits overflow.                                                                                                                                                                                                                                                    | `results/{-123456789,-999999999+0,-1d3,-0.0000001d2,-99999999.5,999999999x1,999999999+1,-1-999999999}.png`                                                                                                                             | **Deviation: D3 and Tasks 3/5/8:** the total-string-length ≤9 property is false. Tests/painter must account for the additional sign after reconciliation.                                                                                                                                                  |
| Halves round away from zero: `±24691357/2 → ±12345679`; `±0.0000001/2 → ±0.0000001`; `±0.0000003/2 → ±0.0000002`. Results feed subsequent operations at displayed precision: `(1/3)×3 → 0.9999999`, `(2/3)×3 → 2.0000001`, `(1/3)+(1/3) → 0.6666666`.                                                                                                                                                                                                                                                          | `results/*d2*.png`, `results/{1d3x3,2d3x3,1d3+1d3}.png`, `cases.json`                                                                                                                                                                  | Tasks 3–4 use these observed rounding/operand results.                                                                                                                                                                                                                                                     |
| Keys redraw while held. In `clear-held`, digit `1` draws at 3746.5 ms with key down 3700.5–4900.7; `*` draws `+` at 5747.8 with key down 5700.8–6901.0; `#` draws `0.` at 7746.1 with key down 7701.1–8901.2. Each enters once. C first deletes, then clears `567` at 1432.2 ms, 532.1 ms after down (900.1 ms); the other clear is 544.0 ms after down. C held on `0` exits to the carousel, then standby.                                                                                                    | `clear-held/{timings,keys}.csv`, frames `000`–`013`; `entry/c-held-*.png`                                                                                                                                                              | **Deviation: D8 / Task 6:** release-only handling is contradicted. Clear is approximately 500 ms plus redraw latency, not the kernel's default 800 ms.                                                                                                                                                     |
| Options has 8 entries for a number/result, 4 for an operator without operand, 5 with operand, always opening on the first. Wrap, ▲ from first, C and every choice are captured. `*` continues cycling across 3 s gaps.                                                                                                                                                                                                                                                                                         | `options/**`, `choose/**`, `operator-slow/{timings,keys}.csv`                                                                                                                                                                          | Tasks 4/6 preserve state-dependent lists and cycling.                                                                                                                                                                                                                                                      |
| Error notes restore the arithmetic state after 2875.4–2906.4 ms. Equals/Add both produce them. Keys at 500.1 ms dismiss them: a digit also edits the restored operand (`7 / 0 → 7 / 5`; `99999 * 99999 → 99999 * 999995`); ▼ restores unchanged; C restores unchanged; held C then returns to standby.                                                                                                                                                                                                         | `notes/**/{timings,keys}.csv`, `sound/note-key/**`                                                                                                                                                                                     | Task 6 must forward the dismissing key appropriately.                                                                                                                                                                                                                                                      |
| The virgin Foreign prompt shows `0`; Domestic is empty. Blink is ~480 ms. Typed rate entry stops at seven characters (`1234567`, `1.12345`, `0.12345`), while a prefilled reciprocal can show nine (`0.6666667`). First digit replaces a prefilled value. `#` on the virgin value starts `.` (not calculator `0.`); a duplicate point is ignored. C can empty the field; C on empty returns to the rate list. Held C clears. OK on empty or `.` saves zero and returns through `Rate saved` to the calculator. | `rate/prompt-*`, `rate/keys/{limit*,point*,typed*,prefilled*,c*,ok-*}.png`, `rate/saved/**`                                                                                                                                            | **Deviation: D7 / Tasks 4/6:** rate editing has its own limit/empty rules; it cannot reuse calculator entry semantics blindly.                                                                                                                                                                             |
| Rate editing has cursor movement and insertion. `123`, ▲, `4` yields `4123`; `123`, ▲, ▲, `4` yields `1423`. ▲ advances/wraps from the end to the start; ▼ from the end moves onto the last digit. `123`, ▲, ▲, ▲, C yields `13` (delete at cursor). At seven typed characters, insertion is rejected. Cursor ink sometimes prevents OCR from reading the obscured digit; PNGs and paired blink phases are authoritative.                                                                                      | `rate/keys/{up-digit,up-mid,up-mid-digit,down,down-mid,start-c,limit-insert}.png` and `@8x` previews                                                                                                                                   | **Deviation: D7 / Tasks 4/6/8:** the planned digits/#/C/OK-only widget omits observed cursor state and insertion/deletion.                                                                                                                                                                                 |
| Foreign `1.5` gives Domestic `0.6666667`; Domestic `3` gives Foreign `0.3333333`. After Domestic `3`, `10` In domestic is `3.3333333` and In foreign is `30`, not multiplication by the rounded displayed reciprocal (`3.333333`).                                                                                                                                                                                                                                                                             | `rate/after/{foreign-1.5-domestic,domestic-3-foreign}.png`, `convert/domestic-3-10-in-{domestic,foreign}.png`                                                                                                                          | D6's typed rate plus direction is consistent with the observed conversions. Physical EEPROM encoding remains UNVERIFIED; these captures prove behavior, not its byte representation.                                                                                                                       |
| Foreign `1.5` survives `saveflash`/cold boot; the calculator starts at `0` after boot and re-entry. Restore (6-4, `12345`, security-code seed) resets the rate to **1 in both directions**, after either Domestic `2` or Foreign `1.5`.                                                                                                                                                                                                                                                                        | `persist/{before,boot-first,boot-foreign-blink,boot-domestic-blink,reentry}.png`; `persist/restore{,-foreign}-run/**`; `persist/restore{,-foreign}-prompt-{foreign,domestic}/**`; `firmware/work/v639-plan20-persist.fls` under `$REF` | **Deviation: D6 / Task 4:** Restore must not keep the record. Factory value differs from virgin zero/empty prompts.                                                                                                                                                                                        |
| Factory calculator/rate keys beep at 900 Hz, Level 2 (`0x9104`), about 140–148 ms. Error notes replace OK's beep with 1750 Hz, `0x9105` (Out of range 296.1 ms, divide-by-zero 288.1 ms). The virgin error-triggering OK is silent; its preceding Options key still beeps. `Rate saved` has no additional confirmation tone, but its OK key beeps. Its tick segments are 694.1/232.0/523.1 ms in `rate/saved`, 708.1/218.0/538.1 in the factory sound recording.                                               | `sound/{keys,out-of-range,divide-by-zero,divide-by-zero-virgin,rate-saved,note-key}.events.csv`, corresponding recordings                                                                                                              | Tasks 6–7 distinguish silent confirmation from silent triggering key.                                                                                                                                                                                                                                      |
| Numeric, `*`, `#` keys **leave Options for standby number entry** (`Call`), producing DTMF pairs. For example `0`: 1336+941 Hz; `1`: 1209+697 Hz; `*`: 1209+941 Hz; `#`: 1477+941 Hz. Arrows/C/OK there beep at 900 Hz. Independent short `0`/`1` recordings confirm the transition and pairs.                                                                                                                                                                                                                 | `sound/keys-options-{0…9,star,hash}/**` and `.events.csv`; `sound/options-dtmf-confirm-{0,1}/**` and `.events.csv`                                                                                                                     | **Deviation: D9 / Tasks 6–7:** the no-DTMF/every-key-900-Hz assumption fails, and the existing `OptionListWidget` ignores these numeric keys. Reconciling number-entry ownership (plan 22) and VISION's single-frequency tone event contract is required; no sounder or kernel workaround was implemented. |

**Remaining Task 0 input gap (R intentionally unticked).** The requested operands
`0.00000005`, `-0.00000005` and `0.00000001` cannot be represented as calculator operands
under the captured nine-character magnitude limit. Added `results/literal-0.00000005x1`,
`literal--0.00000005x1`, `literal-9.9999999+0.00000001` (and `-after`) with their exact key
sequences. The extra digit is discarded; the outputs are `0`, `0`, `9.9999999`. These are
**input-truncation captures, not proof of the requested mathematical calculations**. Existing
`±0.0000001/2` captures independently establish half rounding. The old generator captured
`9.9999999 + 0.0000001 → 10`, which is a different calculation. Task 1 must reconcile R and
Tasks 3/8 before implementation; no operand injection or alternate arithmetic was used.

**Infrastructure discrepancies (read only).** Task 2's pending-scenario mechanism is absent:
`packages/nokia-os/tests/support/acceptance.ts:36` declares only `plan`, `scenarios`, `knownGaps`
and `timeoutsMs`; `:166` makes non-asserted goldens todos, and `:179` throws
`no scenario for ${id}` for an asserted golden without a scenario. A `knownGaps` entry only
runs as an expected failure when a scenario exists; it cannot supply Task 2's proposed todo.
Task 6's per-plan timeline registration is absent: `scripts/widget-sprites.ts:280` owns the
shared `PROBE_TIMELINES` table; `scripts/extract-resources.ts:49` imports it and `:739` iterates
it. No plan-owned calculator registration seam exists. Both requirements exceed this plan's
one-line shared-file ownership rule. Tasks 1–9 remain paused until reconciliation, including
these infrastructure gaps and the captured D3/D6/D7/D8/D9 discrepancies.

**Transient failures resolved.** Initial indexing/exit checks failed and are now fixed. An
exploratory held-DTMF recording failed an incorrect assumption that Options would remain open
(held `1` reached telephony); it was discarded, and the independent short-key confirmations
pass. A first strengthened check attempted unavailable Pillow; it now uses the existing PNG
reader, with no dependency or shared-harness changes. No final section failed.

### Task 1 - Documentation reconciliation (bounded assignment)

**Owned files:** `docs/specs/stock/calculator.md` (new), this plan. Parent owns the plans README row 20, `docs/specs/nokia-3310.md` §10 index and VISION; the plan 29 worker owns shared tooling. No runtime, goldens, generated resources or dependencies change.

- [x] Apply verified D3/D6/D7/D8/D9 deviations to decisions, tests and contract gates.
- [x] Write the calculator spec with C1-C7 facts corrected by Task 0, evidence paths, artefacts, UNVERIFIED items and website contrast, marked "(plan 20, in progress)".
- [x] Parent: update plans README row 20 to `in progress` and add the calculator spec to the §10 index.
- [ ] Parent/shared owners: integrate and verify plan 29's resource registration before runtime resumes; reconcile D9's standby and dual-frequency contracts before those scenarios can pass.
- [x] No runtime code. `mise exec -- vp check --fix`; repeat formatting until stable.
- [x] Commit owned files only: `docs: reconcile stock calculator plan with measured behavior`.

**Exact R criterion correction.** The original requests `0.00000005 × 1`, `-0.00000005 × 1` and `9.9999999 + 0.00000001` require operands beyond the captured entry budget. Replace their acceptance meaning with two separate obligations: (1) replay the literal key sequences and assert truncation outputs `0`, `0`, `9.9999999` using `results/literal-*` and `-after`; (2) test representable calculations `±0.0000001 / 2 → ±0.0000001` and `±0.0000003 / 2 → ±0.0000002` for half rounding, plus captured `9.9999999 + 0.0000001 → 10` for carry. The carry is a different calculation, not evidence for the impossible sum. The canonical case keys and PNGs independently support these replacements. Do not inject operands or label literal captures as the requested arithmetic. R stays unticked in this documentation-only unit; the parent must review the revised criterion against the full original C5/R checklist before closing Task 0.

**Parent integration:** the plans README row 20 is `in progress` and the calculator spec is
linked in the authenticity-spec index. Any VISION contract update remains parent-owned.
Plan 29 resource registration is an additional runtime prerequisite, not evidence that the
original Task 1 is fully complete. The Task 0 outcome above is retained as its historical
closeout. Documentation reconciliation alone does not clear the runtime pause.

**Task 1 owned-unit verification (2026-10-14):** `vp check --fix` passes with no warnings,
lint errors or type errors in 399 files. Explicit `vp fmt` followed by `vp fmt --check` is
stable for both owned documents. `vp run @hellotimber/nokia-os#test` passes: 51 files,
2991 passed tests, 15 expected failures and 67 existing todos (19.50 s). No runtime or shared
files changed. Task 0 evidence is preserved; R remains unticked.

### Task 2 - Capture set and pending goldens (TDD; gated on plan 29)

**Files:** `scripts/capture-sets/20-calculator.ts` (new), the capture-set list (one-line
registration), `tests/calculator-capture-set.test.ts` (new),
`goldens/**` (generated), `tests/acceptance/20-calculator.test.ts` (new).

- [x] TDD the capture set on synthetic sources (injected loader, no REF): every fixture row of
      "Golden pipeline additions"; stills named by `CALCULATOR_CASES` in case order; a case with
      no image, or an image with no case, throws naming both; sound rows reuse plan 16's
      `sound-format`/normalisation with `state: factory` (`virgin` for the virgin row).
- [x] Keep new calculator fixtures and existing `menu/09-calculator.sub` / `sound/note/9`
      `pending:20`. Keep placeholder ownership until Tasks 6-8 supply passing behavioral drivers.
      Existing fixtures stay in their original per-plan indexes; do not move them to index 20.
- [x] Text runs from `plan20/text.json` reach the glyph harvester through the capture set; run
      the delivered regeneration command twice (no diff on the second run). Verify `/` in the
      small face and review all generated changes against the registered inputs. Do not assume
      that this is the only glyph or resource change. Shared resource-test updates belong to
      the plan 29 worker until the delivered registration API is verified.
- [x] Through the verified plan 29 registration, the sound goldens' quoted note text adds
      `Out of range` and `Dividing by zero not allowed` to `NOTE_SOUNDS`; verify regenerated warning programs and silent `Rate saved` behavior,
      rather than assuming plan 16's generator already discovers new per-plan notes.
- [x] Run `import-captures` twice; the second run changes nothing. Record counts and bytes in a
      completion note.
- [x] Use existing `pending:20` fixture statuses until real scenarios pass. Add
      `tests/acceptance/20-calculator.test.ts` with the existing `acceptancePlan` shape when its
      index is created. No awaits-scenario shim, fake driver or `knownGaps` substitute.
- [x] Text, note sounds and timeline resources depend on plan 29's delivered registration API.
      Inspect and record that API after integration; do not edit the shared pipeline or assume
      registration filenames. Verify repeated regeneration is stable before closing Task 2.
- [x] `mise exec -- vp run @hellotimber/nokia-os#test`, `mise exec -- vp check --fix`.
- [x] Commit: `feat(nokia-os): import calculator captures (plan 20)`.

**Task 2 completion (2026-10-14).** Plan 29's delivered API was used as documented:
`PlanCaptureSet.resources` from `scripts/resource-inputs/20-calculator.ts` (the small `/` text
run plus an `advance` override, and three named `note` timelines in batch 200), registered by
one line in `scripts/capture-sets/index.ts`. `import-captures` run three times: 117 plan 20
fixtures (16 stills holding all 388 cases, 61 timelines, 40 sound goldens; 89 `pending:20`,
28 `pending:22`; 2 482 309 bytes); the second and third runs left every golden byte-identical
(tree hash compared), and no other plan's golden or index changed. `regenerate` twice: the first
added the small `/` (`fonts.ts`), `Out of range` and `Dividing by zero not allowed` to
`NOTE_SOUNDS` (1750 Hz, 0x9105, 296/288 ms; `Rate saved` stays silent) and the
`calculator-out-of-range` (2906 ms), `calculator-divide-by-zero` (2890 ms) and
`calculator-rate-saved` (694/232/523 ms) timelines (`widgets.ts`); the second was up to date.

Deviation: the golden format names images [a-z0-9-] while 84 Task 0 stills have `.` or `+`
in their names (`results/0.1+0.2`). With the parent's authorisation the shared importer gained
named shots (`shots` entries may be `{ file, name }`, validated before writes; committed alone,
`feat(nokia-os): named shots in capture sets`, and recorded in plan 29); `imageNameOf` writes
`.` as `p` and `+` as `plus` (`0p1plus0p2`).

Deviation: the importer's io lists only numbered PNGs, so "an image with no case" is checked
for the numbered sequence directories at import and for every directory in the unit tests
(injected lister); Task 0's REF `check` verified images and cases in both directions.

Deviation: the two warning-tone sound goldens are `sound/note/calculator-out-of-range` and
`sound/note/calculator-divide-by-zero`, not `sound/calculator/*`: plan 29 has no note-sound
registration, and plan 16's extractor reads `NOTE_SOUNDS` from every `sound/note/*` golden whose
note quotes its text, so the ids carry them there with no shared change.

Deviation: the user's brief marks the D9 escape fixtures (`calculator/keys-options-{0-9,star,
hash}`, `calculator/options-dtmf-confirm-{0,1}` and their sound goldens) `pending:22`, not
`pending:20`, so they wait on plan 22 in plan 20's index.

Deviation (shared tests, one assertion each): `tests/goldens-integrity.test.ts` accepted only
`plan16/` sound sources and now accepts any plan's directory; `tests/resources.test.ts`'s pinned
`WIDGET_TIMELINE_BY_NAME` and `NOTE_SOUNDS` lists gain the three timelines and two notes.
`EepromRecord` registration (Task 4) goes through the feature's `records`, which
`src/firmware/records.ts` already composes, so that file needs no line.

Extra fixtures beyond the table: `calculator/operators-{star,star-zero,star-result,c-through}`
(one per capture directory, since a still's images are named by file), `calculator/rate-after`,
`calculator/rate-blink-keys`, `calculator/{divide-by-zero,out-of-range}-add`,
`calculator/in-foreign-rate-0`, `calculator/persist-*` recordings and the LCD of the factory key
recordings (`calculator/keys-rate-*`, `calculator/keys-options-*`).

### Task 3 - Decimal arithmetic (pure, TDD)

**Files:** `src/calculator/decimal.ts` (new), `tests/calculator-decimal.test.ts` (new).

- [x] TDD parse/format round trips for every display string in the goldens (`0`, `0.`, `123.`,
      `0.0012345`, `-21`); invalid strings throw.
- [x] TDD `calculate` against the representable arithmetic cases in `calculator/results`
      (expected strings transcribed from the goldens, independent of the code): exact sums and
      products, division as a rational, the nine-character magnitude rule (minus excluded), rounding (Task 0's representable
      half and negative cases), zero results,
      `out-of-range`, `divide-by-zero`; property tests that no `ok` magnitude exceeds 9 characters (strip one leading minus)
      and that `0.1 + 0.2` and other float traps are exact.
- [x] Literal over-limit cases are engine entry/replay tests (Tasks 4/8), never pure arithmetic
      proof using the impossible operands. Assert `-123456789`, `-999999999`, `-0.3333333`,
      the captured `results/-99999999.5` result `-100000000` from `0 - 99999999`, then
      subtracting `0.5` (the filename is not a literal operand), and ten-integer-digit overflow.
- [x] `mise exec -- vp run @hellotimber/nokia-os#test`, `mise exec -- vp check --fix`.
- [x] Commit: `feat(nokia-os): the calculator's decimal arithmetic`.

**Task 3 completion.** `src/calculator/decimal.ts` parses display strings to sign, BigInt
digits, scale and point, computes exactly (quotients as rationals) and shows the result with
`showRational`: fraction digits = 9 − integer digits − 1, half away from zero on the magnitude,
trailing zeros and point dropped, ten integer digits (also by carry) out of range. 64 tests: 59
transcribed result/convert rows, float traps, formatting, and a 400-value property run.

### Task 4 - Engine and exchange-rate record (pure, TDD)

**Files:** `src/calculator/engine.ts` (new), `src/calculator/rate.ts` (new),
`src/firmware/records.ts` (one-line registration of `CALCULATOR_RECORD`),
`tests/calculator-engine.test.ts` (new), `tests/calculator-rate.test.ts` (new).

- [x] TDD the engine from Task 0's cases: entry (limit, `#`, leading zeros, C, C held), the `*`
      cycle and chaining, the lines shown (one, two or three), `options()` per state (8, 4 or 5
      entries with their actions), each action's effect, notes as results that restore the state
      before the action, and C on `0` as `leave`. Replay literal input truncation per the corrected R criterion.
- [x] TDD a distinct rate-editor state with seven typed characters, nine-character prefill,
      replace-on-first-digit, point/empty behavior, cursor wrap and insertion/deletion from D7.
- [x] TDD `CALCULATOR_RECORD` (virgin value, encode/decode, version, stale content dropped, the
      factory reset to rate `1` in both directions after either stored direction) and `CalculatorRate` (`shown` per direction, `set`, `convert`
      per direction, virgin Foreign `0` / Domestic empty, saved empty/`.` as zero, exact Domestic
      `3` conversions `10 → 3.3333333` / `30`, rate 0) against the `calculator/convert` and `persist` cases.
- [x] `tests/eeprom.test.ts`'s pinned record list (if any) gains the record; nothing else changes.
- [x] `mise exec -- vp run @hellotimber/nokia-os#test`, `mise exec -- vp check --fix`.
- [x] Commit: `feat(nokia-os): calculator engine and exchange-rate record`.

**Task 4 completion.** `src/calculator/engine.ts` (`pressKey`, `clearHeld`, `displayLines`,
`optionsFor`, `chooseOption`; 99 tests from Task 0's cases, including the literal truncation
replays), `src/calculator/rate-entry.ts` (the D7 cursor editor) and `src/calculator/rate.ts`
(`CALCULATOR_RECORD`, `CalculatorRate`; 47 tests). Rules read from the stills beyond the plan's
wording: C on a shown result clears it to `0` (`choose/result-c`), C on a typed `0` empties the
entry and only C on nothing typed leaves (`entry/zero-c`, `entry/result-c-c`); the rate entry's
`*` does nothing (`rate/keys/star`) and `#` on a prefilled value replaces it with `.`
(`rate/keys/prefilled-point`).

Deviation: `CALCULATOR_RECORD` is registered by the calculator feature's `records` (plan 15
D2), which `src/firmware/records.ts` already composes; that file needs no line, and
`tests/eeprom.test.ts` pins no record list.

### Task 5 - Calculator painter (TDD against goldens)

**Files:** `src/display/widgets/calculator.ts` (new), `src/display/widgets/index.ts` (model union
and paint switch: two lines), `tests/calculator-paint.test.ts` (new).

- [x] TDD a `calculator` widget model (`lines`, `softkey`) painted against every still of
      `calculator/entry`, `operators`, `results` and `convert` that shows the calculator screen:
      right-aligned small-face lines including valid ten-character signed results, their tops measured from the goldens (record them in the
      spec), `Options` as every soft key. A line that does not fit throws in tests (plan 13 D10).
- [x] Rate lists and notes reuse plan 14's painters. Compare rate prompts at both blink phases
      and cursor positions; if the existing prompt model cannot express D7, report the required
      parent-owned model change before proceeding.
- [x] `mise exec -- vp run @hellotimber/nokia-os#test`, `mise exec -- vp check --fix`.
- [x] Commit: `feat(nokia-os): paint the stock calculator`.

**Task 5 completion.** `src/display/widgets/calculator.ts` paints a `calculator` model: the
screen (`lines`, `softkey`) or the rate entry (the plan 14 prompt with the value in a box and
its own between-character cursor, D7: the existing prompt model draws only an end or start
cursor, so the calculator model composes `paintPrompt` instead of changing the shared model).
344 tests: all 278 calculator-screen stills and all 63 rate-entry stills (both blink phases,
cursor at the start, inside and at the end) match pixel for pixel; coordinates are in the spec.
`src/display/widgets/index.ts` gains the import, the union member and the switch case.

### Task 6 - The calculator feature (TDD against goldens)

**Files:** `src/widgets/calculator.ts` (new: the calculator and rate-entry widgets),
`src/firmware/features/calculator.ts` (new: binds node 9, Options-rooted indicators, the notes and
their named timelines), the feature list (one-line registration), `tests/calculator-flow.test.ts`
(new), `tests/support/calculator.ts` (new: open the calculator, replay a case).

- [x] TDD the calculator widget with the flow rig: keys per D8, the engine's lines as the model,
      Options pushes a rows list built from `options()` (opening on the first entry,
      indicator rooted at Options, D5), choices run the engine and pop, notes replace the list and
      return to the restored calculator, C on `0` leaves (`flow.back()`). Assert no duplicate
      release action, once-only held digit/star/hash, initial C deletion and held clear timing
      against the 532.1-544.0 ms draws. Dismissing digit edits the restored operand; arrows/C
      dismiss unchanged; held C can continue to standby.
- [ ] (D9, pending:22) Options numeric/star/hash escape drivers depend on the later verified plan 22 handoff and
      dual-frequency contract (D9). Preserve their pending status until then; do not silently
      ignore these keys or implement a private standby substitute.
- [x] TDD the exchange-rate list (info pages, `8-k`, soft key `OK`) and the rate entry (D7):
      prefilled from `CalculatorRate.shown`, keys as Task 0, seven-character limit and cursor insertion/deletion/wrap, nine-character prefill, and
      both cursor phases from `calculator/rate-prompt-*`, OK → `set` → `Rate saved` → back to the calculator screen (three
      levels).
- [x] Note timelines (`Rate saved`, `Out of range`, `Dividing by zero not allowed`) come from
      their goldens through plan 29's verified per-plan resource registration (API recorded
      only after delivery); notes pass
      `sound` (plan 16) so their warning tones play.
- [x] After real opening LCD/sound drivers pass, node 9 opens the feature's application;
      promote the existing fixtures in their owning capture sets and remove placeholder ownership.
      `stockMenu` no longer has a placeholder for it
      (`tests/firmware-menu.test.ts`'s owner expectation for `menu/calculator` is removed with the
      owner, as plan 16 Task 2 did for the Composer).
- [x] `mise exec -- vp run @hellotimber/nokia-os#test`, `mise exec -- vp check --fix`.
- [x] Commit: `feat(nokia-os): the stock calculator and currency conversion`.

**Task 6 completion.** `src/widgets/calculator.ts` holds the calculator screen, Options, the
rate pages and entry and the notes; `src/firmware/features/calculator.ts` binds node 9 over the
phone's EEPROM (`StockServices.eeprom`, added with the parent's approval in
`feat(nokia-os): feature services reach the phone's EEPROM`). 17 flow tests; replaying every
Task 0 still on the stock phone matches 368 of 388 exactly, the other 20 only in the rate
entry's blink phase (Task 8). Node 9's placeholder group left `scripts/tree-capture-set.ts`;
`menu/09-calculator.sub` is asserted in plan 13's index and runs plan 13's level-one scenario.

Deviation: plan 16's importer folds equal note recordings into one golden, so once node 9 left
the placeholders `sound/note/9` joined the asserted `sound/note/2-7-1-1` group (its note now
lists 9); that group's scenario drives its first node, so Task 7 drives node 9's opening beep
against it.

Deviation (D8): Options and the rate pages act as keys go down too, as the screen and the
entry do: a note's warning tone replaces the beep of the OK that opens it only at that key's
down (`sound/note/calculator-*`: the note draws 57 ms after OK goes down, before its release).
Each widget ignores the release of a key whose down it did not see.

Deviation (resolved after delivery): Options was first the calculator's own rows widget, because
with four entries ▲ from the first puts Divide on the top row (`options/operator-up`) and the
kernel's direction-blind `rowsWindowTop` scrolled it onto the bottom row. Probes of the stock
4-item lists (7-3, 4-4) showed the same rule, so `rowsWindowTop` now takes the move's direction
and Options uses the shared `openRows`/`moveRows`.

Deviation: OK on an untouched prefilled rate stores nothing (`rate/after/ok-unchanged-domestic-
foreign` reopens Foreign at `1.5`, not the reciprocal of `0.6666667`).

Deviation (shared tests, one assertion each): `tests/firmware-menu.test.ts` lists 9 among the
stock leaves and drops its owner; `tests/paint-lists.test.ts` leaves Calculator's first screen
(an application) out of the level-one lists; plan 13's acceptance runs `menu/09-calculator.sub`.

D9 seam: Options does not act on digits, `*` and `#` (a commented seam in `OptionsWidget`);
plan 22's standby number entry binds there. Their fixtures stay `pending:22`.

### Task 7 - Calculator sounds (TDD against sound goldens)

**Files:** `tests/calculator-sound.test.ts` (new), `tests/support/calculator.ts`.

- [x] Drive `sound/calculator/*` and `sound/note/9` from the factory state
      (`seededStorage({ factory: true })`) with plan 16's `recordSound`/`expectSoundTimeline` and
      tolerances: calculator/rate keys and Options arrows/C/OK beep at 900 Hz; warning tones
      replace OK's beep; `Rate saved` adds no tone but its OK beeps; virgin error OK is silent
      while preceding Options beeps. Drive every `keys-options-*`, `keys-rate-*` and independent
      `options-dtmf-confirm-*` recording, preserving both tone columns for DTMF. The latter
      Options escape paths remain pending until the shared D9 gate passes.
- [x] Do not change the shared sounder. D9's dual-frequency contract is parent/shared-owner work;
      inspect its delivered API and verify host output before promoting DTMF fixtures.
- [x] `mise exec -- vp run @hellotimber/nokia-os#test`, `mise exec -- vp check --fix`.
- [x] Commit: `feat(nokia-os): calculator beeps and warning tones`.

**Task 7 completion.** `tests/calculator-sound.test.ts` drives all 27 factory/virgin
calculator sound goldens that are not D9 escapes (`CALCULATOR_SOUND_SCENARIOS` in
`tests/support/calculator.ts`, reused by Task 8) with plan 16's `playSound` /
`expectSoundTimeline` tolerances, plus node 9's opening beep against `sound/note/2-7-1-1`. No
sounder change: key beeps are the phone's, the notes' warning tones come from `NOTE_SOUNDS`
(Task 2). Removing the notes' `sound` hook fails the four warning-tone goldens. The 14 D9
escape sound goldens (DTMF pairs, both columns kept by the importer) stay `pending:22` with no
driver.

### Task 8 - Acceptance

**Files:** `tests/acceptance/20-calculator.test.ts`, `tests/support/calculator.ts`.

- [x] One scenario per asserted calculator golden (LCD and sound), replaying `CALCULATOR_CASES`
      for stills and the recordings' keys for timelines; `menu/09-calculator.sub` and
      `sound/note/9` included in their original owning indexes. Promote only passing fixtures
      through capture-set inputs and reimport; remove matching placeholder ownership only with
      real node coverage. There is no pending-scenario entry to delete. The split's coverage guard
      fails for an asserted calculator golden without a scenario, and for node 9 if uncovered.
- [x] Replay literal truncation and representable rounding as separate obligations, preserving
      setups, timing and raw held edges. Include cursor blink/edits and both Restore directions.
- [ ] (D9, pending:22) D9 standby/DTMF drivers must pass the shared integration gate before final acceptance.
      Missing integration stays `pending:20`, not a known gap or a fake asserted scenario.
- [x] Known gaps, if any, require real scenarios and measured comparison failures with causes,
      as plan 14's do.
- [x] Every other plan's goldens still pass.
- [x] `mise exec -- vp run @hellotimber/nokia-os#test`, `mise exec -- vp run -r test`,
      `mise exec -- vp check --fix`. Report the calculator file's run time.
- [x] Commit: `test(nokia-os): drive every calculator golden`.

**Task 8 completion.** `tests/acceptance/20-calculator.test.ts` runs 117 goldens of index 20 in
11.9 s: 84 pass, 5 run as known gaps, 28 are `pending:22` todos (14 LCD, 14 sound). Every
other fixture of the capture set is asserted. Stills replay their Task 0 case on a fresh phone
(`stillScenario`, setups included: saveflash/cold boot, re-entry, Restore after either
direction); timelines replay their recording's keys on the rows their effects start
(`recordingScenario`, held edges included), the rate entry's key recordings aligned on the key
(`keyAlignedScenario`: the blink runs from the prompt, not the key). Literal truncation
(`results/literal-*`) replays as entry; representable rounding is Task 3's arithmetic.
`menu/09-calculator.sub` runs in plan 13's acceptance; node 9's opening beep is in
`sound/note/2-7-1-1`'s group (plan 16) and in `tests/calculator-sound.test.ts`.

Tolerances beyond ±2 ms, each with its cause in the scenario: rate-entry stills accept either
blink phase within one 480 ms step (the phase follows the harness's tap timing, not recorded);
blink timelines, the carousel's icon after exit, `in-foreign-rate-0`, Rate saved after the
key recording and the Restore runs compare within PROBE_TOLERANCE_MS (another recording's
timeline replayed).

Known gaps (real scenarios, measured failures): `calculator/clear-held` (C held on `0` exits at
its down; the firmware goes on to standby while C is held, which phone-core's kernel swallows
across an application's exit); `calculator/note-keys-{divide-by-zero,out-of-range}-c-held`
(standby 475 ms after the dismissing C, 491 ms in the capture, without the firmware's 84 ms
partial draw); `calculator/persist-restore-prompt-{foreign,domestic}` (after Restore with
Domestic 2 the prompt opens with the cursor hidden; UNVERIFIED cause).

### Task 9 - Verification gate and closeout

**Files:** this plan, `docs/plans/README.md` (row 20), `docs/specs/stock/calculator.md`.

- [x] `mise exec -- vp check --fix`, `mise exec -- vp run -r test`,
      `mise exec -- vp run website#build`; `git diff --stat <commit before Task 1> -- website/` is
      empty.
- [x] Demo check (no demo edit): `mise exec -- vp run @hellotimber/nokia-os#demo` with
      `agent-browser`: Menu 9, `1 2 * 3`, Options › Equals shows `15`; Exchange rate › Foreign
      `1.5`, `Rate saved`; `10` In domestic shows `15`. Screenshots in the completion note.
- [x] Spec: replace "(plan 20, in progress)" with verified facts; list what stays UNVERIFIED.
- [ ] Plans README row 20 `done`. Completion notes; status `done`. (Parent-owned; blocked on D9.)
- [x] Commit: `docs: complete the stock calculator (plan 20)`.

**Task 9 completion.** `vp check` passes (423 files); `vp run -r test` passes in all six
workspaces (nokia-os: 3825 passed, 20 expected failures, 93 todos); `vp run website#build`
passes; `git diff --stat ece981c -- website/` is empty. Demo (port 5291, agent-browser,
screenshots `/tmp/nokia-os-p20-*.png`): Menu ▲×4 Select opens `0`; `0.1 + 0.2` Equals shows
`0.3`; `* 12 * * * * 3` chains to `12.3 / 3`, Equals `4.1`; `99999 * 99999` shows Out of range,
then the operands again; `7 / 0` shows Dividing by zero not allowed, then `7 / 0`; Exchange
rate › 8-1 › `1.5` OK shows Rate saved and stores `{"direction":"foreign","rate":"1.5"}` in
localStorage; `10` In domestic shows `15`. The spec records what shipped and what stays
UNVERIFIED. The plan is not `done`: D9 remains.

## Follow-up plan adjustments

- **22 - Call register and standby number entry:** currency conversion at standby (digits, `#`
  twice, `Convert`) reads `CalculatorRate`; its captures belong to plan 22. It also owns the
  captured Calculator Options numeric/star/hash transition to standby `Call`. Agree the handoff
  and preserve both DTMF frequencies with the parent/shared sound owner before D9 acceptance.
  This requirement does not authorise invented call progress or network behavior.
- **26 - Languages:** the calculator's strings (Options entries, notes, the rate pages and prompt)
  in the other languages.
- **Portfolio integration (not sequenced):** the website's calculator is replaced when the website
  adopts nokia-os.

## Remaining gates

1. Parent: the plans README row 20 stays `in progress` until D9 lands.
2. Task 0 R remains unticked pending full checklist review under the corrected criterion.
3. Done: plan 29's registration carries the calculator's text, note timelines and warning tones (Task 2).
4. Plan 22 standby entry and parent/shared sound-contract reconciliation gate Options numeric/star/hash acceptance and final completion. Required proof is the captured `Call` LCD plus both simultaneous DTMF frequencies, using real behavioral drivers.
5. Physical EEPROM encoding and the exact internal C-hold timer remain UNVERIFIED. Preserve observable behavior without claiming those internals.

## Conflicts found while planning

- The brief lists Square, Square root, Change sign, To home and To foreign, and `=` via `*`;
  v6.39 has none of them (D1, D2).
- `docs/specs/nokia-3310-menu-tree.md` records `9/Options-3` Subtract and `9/Options-7` In foreign
  as the crawl saw them from `0`; the crawl did not explore the arithmetic or the state-dependent
  lists (its "Not explored further"). `docs/specs/stock/calculator.md` is the reference from now on.
- VISION's menu table says "`*` cycles + − × ÷"; the display shows `+ - * /` (C3).
- The website's `CalculatorApplication` offers `Equals, Exchange rate, To home, To foreign`, a
  14-character display and float arithmetic (D10: unchanged; recorded in the spec).

## Done means

- Menu 9 opens the stock calculator: entry, operators, Options in every state, results, notes,
  exchange rate and conversions match their goldens pixel for pixel and within ±2 ms after
  alignment; its sounds match their sound goldens with plan 16's tolerances.
- The exchange rate persists in `nokia-os/calculator`; the calculator starts at `0` on entry.
- No golden or placeholder names plan 20; every asserted calculator golden has a scenario.
- phone-core and the website are unchanged; `vp check`, `vp run -r test` and
  `vp run website#build` pass; the spec and the plans README match what shipped. The D9 standby/dual-frequency gate
  must be verified; pending fixtures cannot be counted as completion.
