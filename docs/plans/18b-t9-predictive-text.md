# Plan 18b - Messages II: T9 predictive text

> **For agentic workers:** execute task-by-task; tick checkboxes; commit per task.
> If this plan contradicts VISION.md, AGENTS.md, the spec or the code, STOP and report.
> **Read "Clean-room protocol" before anything else. It limits what you may open.**

**Prerequisites:** plan 18 done (multi-tap engine `src/text/`, the `editor`, `textInput` and
`numberEntry` widgets, Write messages and its Options, the `messages/dictionary` setting with its
`VIRGIN_OVERRIDES` entry, `EDITOR_OPTIONS`, the messages goldens). Plans 13-16 done. Plan 18c
follows this plan (Chat's editor is T9 by default).
**Ground truth:** `docs/specs/t9-behaviour.md` (the behaviour and the firmware dictionary's
architecture, written for this plan) and the goldens Task 2 imports from the dirty-room captures.
**Status:** not started (Task 0 done by the planning agent).

## Goal

Give `@hellotimber/nokia-os` the v6.39 T9 predictive text, faithful in behaviour and pixels, with
an English dictionary built from an openly licensed word-frequency list:

- a pure T9 engine: candidate lists ranked as the spec says (words, then stems, then user
  completions; exact user words second), the `?`/Spell end-of-list rules, the no-match rules, key
  1 punctuation and contractions, the 32-key and 32-entry limits;
- the editor in T9 mode: the composing word (underline, blinking cursor, per-letter case), `*`,
  `0`, `1`, `#`, held `#`, held digits, `C` and held `C`, word-wise ▲/▼ with word re-entry, the T9
  header, the counter;
- Options: Matches, Insert word, Spell, Dictionary › English; Dictionary off/on;
- a user dictionary in an EEPROM record;
- Write messages starting in T9, as the virgin phone does (`tree/02-messages/2-1.leaf` asserted);
- the dictionary build script, its generated data, licence notice and lazy loading in the demo.

## Clean-room protocol

This plan is the clean-room half of a clean-room reimplementation. The dirty room (the planning
agent) studied the firmware, decoded its dictionary and captured the emulator; it wrote the spec
and this plan. The clean room implements from them.

**Implementers of Tasks 1 and 3-9 may read only:** `docs/specs/t9-behaviour.md`, this plan,
AGENTS.md, VISION.md, the other plans and specs in `docs/`, the repository's code and tests, the
committed goldens (`packages/nokia-os/goldens/**`), and the open word list (D2).

**They must not read, list, open, run or ask about:** anything under
`$REF/t9/`, `$REF/captures/plan18b/` (images, manifests, logs, flash files), `$REF/extracted/`,
`$REF/firmware/`, `$REF/captures/scratch-plan18/`, any other firmware dump, the emulator, the
planning agent's transcript or notes, or a disassembly of any phone firmware.
(`REF=/Volumes/SSD/Projects/lachieh/hellotimber/nokia-3310`.)

**Task 2 is the only bridge.** It runs the golden importer over `$REF/captures/plan18b/` with the
explicit table in "Golden pipeline additions" and commits the resulting goldens. It is done by the
planning agent or by an agent that implements none of Tasks 3-7 and does nothing but run the
importer, fix importer errors, and commit. It must not copy any other content out of `$REF`.

**Rules for everyone:**

- If the spec, this plan and the goldens do not say what to do, stop and report the question; do
  not look for the answer in the firmware.
- No firmware dictionary content enters the repository: the shipped dictionary is generated only
  from the open list by `scripts/build-t9-dictionary.ts`. Goldens are screens; the importer table
  below avoids screens that show the firmware's nonsense stems or Cyrillic dictionary output.
- Test fixtures use hand-made dictionaries (a few common words with invented weights), never word
  lists copied from goldens.

## Why this plan exists (measured gap)

| Area                    | nokia-os after plan 18                                                        | v6.39 (spec)                                                                               |
| ----------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Write messages, virgin  | multi-tap (`VIRGIN_OVERRIDES` sets Dictionary off, plan 18 D3)                | T9 English on, T9 header (spec 1)                                                          |
| Dictionary list         | `Dictionary off` works; English, Русский, Български open an `18b` placeholder | English switches to T9 at once; off shows the tick note (spec 10.4)                        |
| Letter keys             | multi-tap cycles and commit timeout                                           | one press per letter, ranked candidates, no timeout, underline (spec 3-5)                  |
| `*`, `1`, `0`, `#`, ▲/▼ | symbol table, punctuation cycle, space, case cycle, character cursor          | next candidate, punctuation words, commit + space, two-state case toggle, word stops (5-9) |
| Options                 | plan 18's 12 entries without Insert word behaviour                            | Matches with a composing word; Insert word and Spell prompts; user dictionary (10, 11)     |
| Goldens                 | `tree/02-messages/2-1.leaf` is `pending:18b`                                  | asserted                                                                                   |

## Planning investigation (2026-10-14, dirty room; summary)

The planning agent located the dictionary in the firmware's language pack, decoded it, and checked
the decoder against the firmware running in the emulator: for 246 key sequences without key 1
(random dictionary paths of 1-10 keys, random digit strings, common words) the decoder predicted
every display the firmware showed when typing the sequence and pressing `*` until the list
wrapped: each candidate, its order, the `?` marker and the soft key. That match is the evidence
behind the spec's ranking, end-of-list and no-match rules. Key-1 sequences (32 probed) are covered
by the spec's section 7, with the exact composition order left open.

Behaviour was then captured in `$REF/captures/plan18b/` (60 scenarios). Findings are in the spec;
the ones that shape this plan:

| #   | Finding                                                                                                                                         | Spec      |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| T1  | Write messages opens in T9 English; the T9 header has its own icon and the mode text from x 21                                                  | 1         |
| T2  | Lists: words, then stems, ranked by frequency (94% of lists strictly); no frequencies stored, rank only                                         | 3, 14     |
| T3  | `?` + Spell on the last candidate reached by `*`; one-entry lists; one-key lists never                                                          | 4.2       |
| T4  | No-match: silent drop after one key; `?` state after two or more; three `*` behaviours by list size; `0` and `C` end it                         | 6         |
| T5  | Key 1: punctuation list alone; word + 8 marks after a word; contractions; compositions                                                          | 7         |
| T6  | `#` toggles two states, which depend on the cursor; case fixed per letter; ABC lasts one word                                                   | 8         |
| T7  | ▲/▼ stop at word starts and ends; a stop at a word end re-enters the word; `C` re-enters across a deleted space                                 | 9         |
| T8  | Matches lists the other candidates then the current; Insert word/Spell prompt is plan 18's text input; user words join the lists                | 10, 11    |
| T9  | User words: second place when exact (oldest first), completions at the end; a byte budget (≈840), oldest dropped; kept when the text is cleared | 11        |
| T10 | No commit timeout; no T9-specific sound; Dictionary off persists across power cycles; English on has no note                                    | 4, 10, 12 |

## Scope and non-goals

In scope: the Goal items; the open-list dictionary and its build; a public nokia-os contract
change (D5); goldens; documentation.

Out of scope (owner in brackets): T9 in Chat (18c); Русский and Български dictionaries and
Cyrillic T9 (26); the firmware's nonsense stems (spec 3.3: not reproduced); a profanity filter for
the open list (Open question 6); key tones (16 already plays them on every key); any website
change.

## Decisions

**D1 - Clean-room split (new).** See "Clean-room protocol". Task 0 (captures) and Task 2 (golden
import) are dirty-room operations; every other task is clean-room. A reviewer checks each clean
task's diff for content that could only come from the firmware (word lists, tables, addresses).

**D2 - The dictionary source is IlyaSemenov/wikipedia-word-frequency, English results (new).**

| Item       | Value                                                                                                                                                            |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository | https://github.com/IlyaSemenov/wikipedia-word-frequency                                                                                                          |
| File       | `results/enwiki-2023-04-13.txt` (word, space, count; lower case; 2,765,377 lines; 34,948,684 bytes)                                                              |
| Pinned at  | commit `798ea9062d6e5aed1fa87deeeda1cd99d5b37903` (2023-04-17, "Add new English word frequency result")                                                          |
| SHA-256    | `e2071140a49a6c40c732bd68c36836ef13c0978233fb3d5e1b2a3c2d34faef59`                                                                                               |
| Licence    | MIT (repository `LICENSE`, © 2015 Ilya Semenov). Counts are derived from English Wikipedia article text (April 2023 dump); word counts are statistics, not text. |

Why: it is permissive (MIT, no share-alike), has real frequencies (needed to rank stems by the
total of their words, spec 3.1), modern everyday vocabulary including contractions (_don't_,
_it's_), and one file. Measured against it, the firmware puts that list's top word first for 97%
of the key sequences of the 3,000 most common words, and its whole list matches the firmware's for
57% of them. Rejected: wordfreq and hermitdave/FrequencyWords (data CC BY-SA, share-alike); Google
Books Ngram (CC BY 3.0, but gigabytes of 1-grams and dated vocabulary); SCOWL (permissive, no
frequencies); Norvig/Google Web 1T derivatives (LDC terms unclear). Its weakness is encyclopaedic
bias (more proper nouns and abbreviations than texting vocabulary), accepted for a portfolio demo.

**D3 - Build: the top 30,000 filtered words, weights on a log scale, one generated module (new).**
`scripts/build-t9-dictionary.ts` (Task 3) reads the pinned file from a path or URL, checks the
SHA-256, and keeps a line when the word is lower-case a-z with at most one internal apostrophe
(not first or last), is 1-32 characters long, and is not a single letter other than `a` and `i`.
It takes the first 30,000 kept words in file order (descending count) and writes
`src/text/t9/generated/english.ts`: a header comment (source, commit, SHA-256, licence, filter,
count) and one exported string. The string lists the words in descending count, one per line;
a line `#<w>` sets the weight of the following words, `w = floor(4 * log2(count))`, written only
when it changes. Size: ≈246 KB of source, ≈117 KB gzipped. The engine ranks with `2^(w/4)`.
30,000 is comparable to the firmware's vocabulary (spec 14.5: 20,000-30,000 forms, 93% of the
top 10,000 words) and covers the open list's top 20,000 completely. The generated file is
committed; tests never download. Running the script twice gives no diff.

**D4 - The engine follows the spec's ranking model exactly; the dictionary decides the words
(new).** For a key sequence: exact-length words by weight (ties: list order), then stems ranked by
the summed weight of the words they begin (ties: first occurrence), then user words (spec 3.1);
at most 32 entries; at most 32 keys; one-key lists end with the key's digit; key-1 rules as spec 7
with its suggested composition order. All rules are unit-tested against a hand-made fixture
dictionary (Task 4), independent of the shipped data.

**D5 - The dictionary is a separate entry point that hosts pass in (contract change).**
`@hellotimber/nokia-os/t9-english` exports `englishT9: T9Dictionary` (built from the generated
string on first use). `StockPhoneConfig.t9?: { readonly english?: T9Dictionary }`. With an English
dictionary, the virgin phone starts in T9 (D6). Without one, nokia-os behaves as after plan 18:
`messages/dictionary` keeps its plan 18 virgin override (Dictionary off) and the English entry
keeps its placeholder, now owned by `config` (documented in the README). Tests always pass a
dictionary (the fixture or `englishT9`). The demo loads it with `await
import("@hellotimber/nokia-os/t9-english")` before `createStockPhone`: Vite emits it as its own
chunk, fetched once, and hosts that never open Write messages can leave it out.

**D6 - The virgin default is T9 English (completes plan 18 D3).** With `t9.english` present,
`VIRGIN_OVERRIDES` no longer overrides `messages/dictionary`; the initial choice is `English`, as
the firmware has it. `tree/02-messages/2-1.leaf` becomes asserted. Plan 18's goldens recorded
after Options › Dictionary › Dictionary off stay valid (their scenarios already switch it off).

**D7 - The user dictionary is an EEPROM record (new; plan 15 D2 record).** `t9-user` (v1): the
user words in the order they were added, each with its case as typed. Rules: adding a word that is
already present (same letters and case) does nothing; the store holds words while the sum of
(length + 1) stays within 840 (spec 11: fitted to the two capacity measurements), and adding a word
that does not fit drops the oldest words until it does; clearing the text keeps the words; Restore
factory settings keeps them (UNVERIFIED). The record is written at once, as every plan 15 record,
so user words survive a power cycle. This is a deliberate deviation from the emulator evidence
(spec 11: a user word did not survive a cold boot there, while the Dictionary choice did), on the
assumption that a real phone keeps its learned words (Open question 5).

**D8 - The editor gains a composing word; plan 18's multi-tap engine is not changed (extends plan
18 D2).** `TextState` gets `t9: T9Composing | null` (the key sequence, the per-letter case flags,
the candidate index, the no-match flag). The T9 rules live in `src/text/t9/`; the editor widget
calls them when the dictionary setting is a language, multi-tap otherwise. Display additions
(underline, `?`, Spell, the T9 header icon and text position) are painter changes in plan 18's
editor painter.

**D9 - Goldens are chosen for dictionary independence (new).** Every imported golden is one of:
`asserted` (its screens depend only on mechanics, or on key sequences whose lists the open-list
dictionary shares with the firmware, checked by the dirty room with a simulation of D3/D4);
`asserted` on a subset of steps (the rest not imported); or not imported (screens that show
firmware-only words, nonsense stems or Cyrillic). The table in "Golden pipeline additions" says
which, per scenario, with the reason.

**D10 - Key-1 compositions follow the spec's suggested order; no golden asserts them (new).** The
firmware's exact set and order are open (spec 7). The engine lists: dictionary entries with the
mark, then word-before-mark + `'` + each candidate of the remaining keys, then
word-before-mark + `.` + each candidate, deduplicated, at most 32. Only the first display of a
contraction is asserted.

**D11 - Русский and Български stay placeholders, owned by plan 26 (re-owns plan 18 D1's `18b`).**
The firmware's Cyrillic dictionaries are out of scope; selecting them opens the placeholder note.

**D12 - The website does not change.** `git diff --stat <commit before Task 1> -- website/` is
empty at the end.

## Ground truth and artefacts

| Source                                     | Contents                                                 | Who may read it            |
| ------------------------------------------ | -------------------------------------------------------- | -------------------------- |
| `docs/specs/t9-behaviour.md`               | behaviour, ranking model, firmware dictionary (abstract) | everyone                   |
| `packages/nokia-os/goldens/t9/**` (Task 2) | LCD goldens for the scenarios in the table below         | everyone                   |
| `$REF/captures/plan18b/<scenario>/`        | shots, recordings, `manifest.json` per scenario          | Task 2 importer only       |
| `$REF/t9/` (decoder, tools, notes)         | the dirty room's extraction                              | nobody in the clean room   |
| the open list (D2)                         | word counts                                              | everyone (Task 3 reads it) |

Firmware-dependent facts that differ in our build (spec section 15): which words exist and their
order; which stems appear; single-key letter order for some keys; the compositions after key 1.

## Package boundaries

Unchanged from plans 13-18. The engine (`src/text/t9/`) is pure TypeScript with no time source and
no I/O. The generated dictionary is data. phone-core does not change.

## Contract changes

Task 1 writes these into `VISION.md`.

### `@hellotimber/nokia-os` (additive)

```ts
/** Plan 18b: a T9 language dictionary (opaque; build it with `createT9Dictionary`). */
export interface T9Dictionary {
  readonly language: "english";
  /** Number of words. */
  readonly size: number;
}

/**
 * Plan 18b: a dictionary from the generated format (D3): words in descending frequency, one per
 * line, `#<w>` lines setting the weight 2^(w/4) of the words after them. Throws on a malformed
 * line, naming it.
 */
export function createT9Dictionary(language: "english", source: string): T9Dictionary;

export interface StockPhoneConfig {
  // ...plan 13-18 fields unchanged...
  /**
   * Plan 18b: T9 dictionaries. With `english`, Write messages starts in T9 English as the virgin
   * firmware does. Without it, T9 English is unavailable (Dictionary off, plan 18 behaviour).
   */
  t9?: { readonly english?: T9Dictionary };
}
```

```ts
// @hellotimber/nokia-os/t9-english (package.json "exports": "./t9-english": "./src/text/t9/english.ts")
export const englishT9: T9Dictionary; // the generated string, indexed on first lookup
```

## Internal API

```ts
// src/text/t9/dictionary.ts (pure)
export interface T9Index {
  /** Exact-length words for a key sequence, best first. */
  words(keys: string): readonly string[];
  /** Stems for a key sequence, best first (spec 3.1). */
  stems(keys: string): readonly string[];
}
export function keysOf(word: string): string; // letters to keys 2-9, apostrophe and full stop to 1

// src/text/t9/engine.ts (pure)
export type T9Key = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";
export interface T9Composing {
  readonly keys: string; // accepted keys, ≤ 32
  readonly upper: readonly boolean[]; // per letter, fixed when typed (spec 8)
  readonly index: number; // displayed candidate
  readonly noMatch: boolean;
  readonly viaStar: boolean; // the display was reached with * (for `?`)
}
export interface T9Display {
  readonly text: string; // the displayed candidate with case applied
  readonly question: boolean; // draw `?`, soft key Spell
}
export function t9Candidates(
  dict: T9Dictionary,
  user: readonly string[],
  keys: string,
): readonly string[] | null;
export function t9Key(
  state: T9Composing | null,
  key: T9Key,
  dict: T9Dictionary,
  user: readonly string[],
): T9Composing | null;
export function t9Star(
  state: T9Composing,
  dict: T9Dictionary,
  user: readonly string[],
): T9Composing;
export function t9Delete(
  state: T9Composing,
  dict: T9Dictionary,
  user: readonly string[],
): T9Composing | null;
export function t9Display(
  state: T9Composing,
  dict: T9Dictionary,
  user: readonly string[],
): T9Display;
export function t9FromWord(word: string): T9Composing; // re-entry (spec 9)

// src/text/t9/user.ts
export const T9_USER_RECORD: EepromRecord<T9UserState>;
export function addUserWord(state: T9UserState, word: string): T9UserState; // D7
```

Signatures are fixed by Task 4; a change is a Deviation recorded here.

## Golden pipeline additions

A new explicit table `scripts/t9-capture-set.ts` (like `messages-capture-set.ts`), appended by the
importer. Source paths are relative to `$REF/captures/plan18b/` (not `6.39/`). Ids
`t9/<scenario>/<NN-label>` for stills and `t9/<scenario>/<NN-label>` for timelines (the recording
directory). Two-shot steps (`-a` suffix, the other cursor-blink phase) import both stills. Every
scenario starts from the empty T9 Write-messages editor of the virgin phone at 10:10 on 13.10.2026
unless the table says `page`.

| Scenario                | Status       | What it shows                                                                                    | Notes                                                          |
| ----------------------- | ------------ | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| `first`                 | asserted     | Write messages page, the T9 editor, 3 s blink (timeline)                                         | base `page`                                                    |
| `g-compose`             | asserted     | `4 6 8 6` key by key, 3 s with no commit (timeline), `*` six times through the list and the wrap | lists shared with the open list                                |
| `single`                | asserted     | `2` and `*` four times (letters, digit, no `?`)                                                  |                                                                |
| `punct-alone`           | asserted     | `1` and `*` nine times                                                                           | no dictionary                                                  |
| `g-punct-word`          | asserted     | word + `1`, `*` through the eight marks and the wrap, `0`, next word                             |                                                                |
| `apostrophe`            | steps 01-03  | `3 6 6`, `1`, `8`: the contraction as first display                                              | later steps show compositions (D10): not imported              |
| `g-nomatch3`            | asserted     | no-match after a five-entry list; ignored key; `*` cycle                                         |                                                                |
| `g-nomatch2`            | asserted     | no-match after a two-entry list; the first-`*` quirk                                             |                                                                |
| `g-nomatch1`            | asserted     | no-match after a one-entry list                                                                  |                                                                |
| `g-nomatch-keys`        | asserted     | `0` and `C` in the no-match state                                                                |                                                                |
| `g-case`                | asserted     | `#` at word starts, held `#` number mode and back                                                |                                                                |
| `g-case-upper`          | asserted     | `#` mid-word gives ABC for that word only                                                        |                                                                |
| `case-word`             | steps 01-02  | `#` while composing                                                                              | later steps show a firmware-only list order                    |
| `digits`                | steps 01-03  | held 5, 0, 1 insert digits                                                                       | step 04 shows a firmware-only first candidate                  |
| `g-delete`              | asserted     | `C` through a composing word and out of the editor                                               |                                                                |
| `g-delete-across`       | asserted     | `C` back across a space re-enters the previous word                                              |                                                                |
| `g-cursor-down`         | asserted     | ▼ word stops, both blink phases                                                                  |                                                                |
| `g-cursor-up`           | asserted     | ▲ word stops, both blink phases                                                                  |                                                                |
| `g-cursor-reenter`      | asserted     | ▼ onto a word, `*`, `C`, `0`                                                                     |                                                                |
| `g-cursor-insert`       | asserted     | typing before a word                                                                             |                                                                |
| `options-empty`         | asserted     | Options of the empty T9 editor (12)                                                              |                                                                |
| `g-options`             | asserted     | Options with a composing word (13, Matches)                                                      |                                                                |
| `g-matches`             | asserted     | Matches, scrolling, Use                                                                          |                                                                |
| `g-matches-single`      | asserted     | Matches offered for a one-entry list                                                             |                                                                |
| `g-spell`               | asserted     | Spell from no-match, typing, OK; the user word matches and completes                             |                                                                |
| `g-insert-word`         | asserted     | Insert word; an exact user word second; a completion last                                        |                                                                |
| `g-userwords-two`       | asserted     | two exact user words, oldest first                                                               |                                                                |
| `insert-word-empty`     | asserted     | OK and C on an empty Insert word prompt                                                          |                                                                |
| `g-star-free`           | asserted     | a short `*` does nothing with no composing word; held `*` opens the symbol table; `C` closes it  |                                                                |
| `dictionary-list`       | asserted     | Options › Dictionary list (opens on English, wraps)                                              | the Cyrillic labels are UI text, not dictionary output         |
| `dictionary-off-on`     | asserted     | Dictionary off (note timeline), the multi-tap Options list, English on (timeline), typing        |                                                                |
| `g-persist-dict`        | asserted     | Dictionary off survives `saveflash` + cold boot                                                  | the rig's two phones over one storage                          |
| planning probes (below) | not imported | firmware-only lists, superseded by the `g-` scenarios                                            | dictionary-dependent                                           |
| `longword`              | not imported | the 32-key limit                                                                                 | shows nonsense stems; covered by a unit test                   |
| `russian`, `bulgarian`  | not imported | Cyrillic T9                                                                                      | plan 26                                                        |
| `g-audio`               | not imported | key tones only                                                                                   | evidence for spec 12; no `keys.csv`, plan 16's format needs it |

Planning probes not imported (their screens show firmware-only candidate lists; each has a `g-`
counterpart or a unit test): `compose`, `compose-timing`, `commit`, `short`, `nomatch`,
`nomatch2`, `nomatch3`, `silentdrop`, `punct-word`, `case`, `delete`, `delete-across`,
`delete-hold`, `cursor`, `cursor-edit`, `cursor-reenter`, `matches`, `matches-use`, `spell`,
`insert-word`, `counter`, `multi-to-t9`, `g-persist` (navigation went wrong) and `g-persist-word`
(the user word was gone after the boot: evidence for Open question 5, not a behaviour to assert).

Mechanics the goldens cannot show with the open list (the one-key silent drop: nearly every
two-key sequence has stems in a 30,000-word list; the 32-key limit; the `?` rule after duplicates)
are unit tests on the fixture dictionary in Task 4.

## Conventions for every task

- Run commands from the repo root with `mise exec --`.
- TDD: write the failing test first wherever the task names tests.
- After each task: `mise exec -- vp check --fix` and the task's test commands.
- Commit rule: run `mise exec -- vp check --fix` yourself, stage files by explicit path, then
  `git commit --no-verify -m "<message>"`. Never `git add -A`/`git add .`. Never stage `TODOS.md`.
- Never hand-edit `goldens/**`, `src/**/generated/**` or `scripts/generated/**`; change the
  generator or its table and regenerate. Each generator runs twice with no diff before its commit.
- Tests never read `$REF` or the network. Generators that read `$REF` fail clearly when it is
  missing.
- No new dependencies (the build script uses `node:crypto`, `node:fs` and `fetch`).
- When reality differs from this plan, follow the spec and the goldens and append a `Deviation:`
  paragraph under the task. If a deviation breaks a contract in VISION.md, stop and report.
- Parallelism (max 3 concurrent agents): Task 1, then Tasks 2 and 3 together (different people:
  D1), then 4 → 5 → 6 → 7 → 8 → 9.

## Tasks

### Task 0 - Dirty-room captures (done; no repository changes)

Done by the planning agent on 2026-10-14: `$REF/captures/plan18b/<scenario>/` with shots
(`NN-<label>.png` + `@8x`), `record` directories (`timings.csv`) and `manifest.json` per
scenario, written by `$REF/t9/tools/gen_plan18b.py` (`--list`, `--only`). Not to be repeated by
the clean room. If Task 2 finds a scenario missing or broken, it reports to the planning agent.

### Task 1 - Contracts and documentation

**Files:** `VISION.md`, `docs/specs/nokia-3310.md`, `docs/specs/nokia-3310-menu-tree.md`,
`docs/plans/README.md`, this plan.

- [ ] VISION: the contract changes above; the nokia-os row gains "T9 English (open dictionary)".
      Settle the non-goal "T9 dictionaries beyond what the UI bit needs": it stays a website
      non-goal; nokia-os ships one open-list English dictionary (this plan).
- [ ] Spec §6: point "Text entry" to `docs/specs/t9-behaviour.md` for predictive text. Spec §10:
      a "T9 (plan 18b, in progress)" entry with the findings table above.
- [ ] Menu-tree spec: Dictionary list order and behaviour (spec 10.4).
- [ ] Plans README: row 18b links this file, `in progress`.
- [ ] Commit: `docs: define T9 predictive text contracts (plan 18b)`.

### Task 2 - Import the T9 goldens (dirty-room bridge, D1)

**Files:** `scripts/t9-capture-set.ts` (new), `scripts/import-captures.ts`,
`tests/t9-capture-set.test.ts` (new), `tests/goldens-integrity.test.ts`, `goldens/**`,
`tests/acceptance.test.ts` (todo shim only).

- [x] TDD `t9-capture-set.ts` on synthetic recordings (injected loader, as
      `game-capture-set.test.ts`): ids, kinds, step subsets, two-shot steps, timelines with
      `trigger-frame` on the first changed frame.
- [x] The table exactly as "Golden pipeline additions".
- [x] Integrity: every `t9/*` golden is asserted; no source path outside `plan18b/`. (Pending
      until promoted: see Deviation.)
- [x] `tests/acceptance.test.ts`: list the new goldens without a scenario as todos
      (`awaitsPlan18bScenario`; Task 8 deletes it). (Replaced by the plan file: see Deviation.)
- [x] Run `import-captures` twice; no diff. Record counts and bytes here.
- [x] Commit: `feat(nokia-os): import T9 goldens (plan 18b)`.

Outcome (2026-10-14, bridge agent): 303 goldens from the 32 table scenarios, 294 stills (25 of
them two-shot) and 9 timelines, 349 images; `goldens/t9/` holds 1,551,480 bytes and
`goldens/index/18b.json` 54,283 bytes. Two importer runs give identical bytes; no other golden
and no generated resource changed (no regeneration needed).

Deviation: the parallel-plan conventions (AGENTS.md) and plan 29's pending workflow replace three
items above. The table is `scripts/t9-capture-set.ts`, registered through
`scripts/capture-sets/18b-t9-predictive-text.ts` and one line in `capture-sets/index.ts`. Every
golden is imported `pending:18b`: a golden becomes asserted when its scenario lands, by adding its
id to `T9_PROMOTED` and reimporting (Tasks 6-8); the integrity test checks exactly that and that
every source lies under `captures/plan18b/`. There is no `awaitsPlan18bScenario` shim:
`tests/acceptance/18b-t9-predictive-text.test.ts` declares no scenarios yet and the harness lists
the pending goldens as todos. Golden ids and image names are the capture labels in lower case
(the golden grammar allows no capitals). Each golden's note gives its row's description and every
key pressed from the scenario's base (the manifest's commands, in the key vocabulary of the table
file's header), so Tasks 6-8 can drive a scenario from its goldens. The importer reads plan 18b
paths as `../plan18b/` from its root and writes them as `captures/plan18b/...`.
`plan18b/g-persist-poweroff/` (not in the table above) is not imported: a known bad run.

### Task 3 - Dictionary build and data (TDD)

**Files:** `scripts/build-t9-dictionary.ts` (new), `src/text/t9/generated/english.ts` (generated),
`src/text/t9/THIRD_PARTY.md` (new), `tests/t9-build.test.ts` (new), `package.json`
(`build-t9-dictionary` script).

- [ ] TDD the filter and format on an in-memory sample (a dozen invented lines): case, apostrophe
      rules, single letters, length, top-N cut, weight lines only on change, deterministic output.
- [ ] Run it on the pinned file (D2): `node scripts/build-t9-dictionary.ts <path-or-url>`; SHA-256
      mismatch fails. Record word count, file size and gzip size here.
- [ ] `THIRD_PARTY.md`: source, commit, SHA-256, the MIT licence text, the Wikipedia provenance
      note, the filter.
- [ ] Commit: `feat(nokia-os): T9 English dictionary from an open word list`.

### Task 4 - T9 engine (pure, TDD from the spec)

**Files:** `src/text/t9/{dictionary.ts,engine.ts,punctuation.ts,index.ts}` (new),
`tests/t9-engine.test.ts` (new), `tests/support/t9-fixture.ts` (new: a hand-made dictionary of
about 30 common words with invented weights).

- [ ] `createT9Dictionary`/`T9Index`: parse (errors name the line), index by key sequence, stems
      with summed weights; building `englishT9` takes under 150 ms in the test environment.
- [ ] TDD each spec rule with the fixture: ranking (3.1); 32-entry cap; one-key lists and the
      digit (3.4); `?` on the last `*` display, one-entry lists, one-key lists (4.2); no-match:
      silent drop after one key, the state after two, ignored keys, the three `*` cases, `0`,
      `C` (6); key 1 alone, after a word (eight marks, dictionary extras, the `?` after
      duplicates), contractions first and D10 compositions (7); per-letter case and the two-state
      `#` (8); re-entry from a word (9); the 33rd key.
- [ ] A property test: for random words of the fixture, typing `keysOf(word)` and pressing `*`
      at most 32 times reaches the word.
- [ ] Commit: `feat(nokia-os): T9 predictive text engine`.

### Task 5 - User dictionary record (TDD)

**Files:** `src/text/t9/user.ts` (new), `src/firmware/records.ts`, `tests/t9-user.test.ts` (new).

- [ ] TDD `T9_USER_RECORD` (plan 15 D2): v1 shape pinned by a snapshot; decode drops malformed
      entries; add, duplicate, the 840 budget and oldest-first eviction (D7); kept by
      `restoreFactory()` (D7, provisional).
- [ ] Engine integration: exact user words after the first built-in candidate, oldest first;
      completions at the end; a user word alone is the whole list (spec 11).
- [ ] Commit: `feat(nokia-os): T9 user dictionary record`.

### Task 6 - Editor in T9 mode (TDD against goldens)

**Files:** `src/text/` (TextState), `src/widgets/editor.ts`, `src/display/widgets/editor.ts`,
`src/resources/**` (only via generators: the T9 header icon from plan 18 Task 3's crop table, if
it was not cropped there), `tests/widgets-editor-t9.test.ts` (new).

- [ ] `TextState.t9` (D8); the editor dispatches to the T9 engine when the setting is English.
- [ ] Painter: T9 header (icon, mode text at x 21), underline under the composing word, `?` after
      it, soft key `Spell`, counter counting the composing word. TDD against the `g-compose`,
      `g-nomatch*`, `single`, `punct-alone`, `g-punct-word` stills.
- [ ] Keys: `*`, `0`, `1`, `#`, held `#`, held digits, `C`, held `C`, ▲/▼ word stops and
      re-entry. TDD through keys against `g-case*`, `digits`, `case-word`, `g-delete*`,
      `g-cursor-*`, `apostrophe`.
- [ ] No commit timeout: the `g-compose` idle timeline passes (blink only) within ±2 ms.
- [ ] Commit: `feat(nokia-os): T9 mode in the text editor`.

### Task 7 - Options, prompts and the virgin default (TDD)

**Files:** `src/messages/bindings.ts` (`EDITOR_OPTIONS`, `VIRGIN_OVERRIDES`), `src/messages/write.ts`,
`src/widgets/` (Matches list), `src/firmware/phone.ts` (`config.t9`), `src/index.ts`,
`package.json` (`exports` `./t9-english`), `tests/messages-t9.test.ts` (new).

- [ ] Options: the 12/13-entry T9 lists and the 9-entry multi-tap list; Matches (rotation, `Use`,
      C); Insert word and Spell through plan 18's `textInput` with the `Insert word:` layout; OK
      stores the user word (the whole word at the cursor, spec 10.3); empty OK and C return.
- [ ] Dictionary: off (the note, plan 18), English on (no note), persistence; Русский and
      Български → placeholder owned by `26` (D11) in both owner tables.
- [ ] D5/D6: `config.t9.english` present → virgin T9; absent → plan 18 behaviour, English entry's
      placeholder owned by `config`. `tree/02-messages/2-1.leaf` → asserted.
- [ ] TDD through keys against `options-empty`, `g-options`, `g-matches*`, `g-spell`,
      `g-insert-word`, `g-userwords-two`, `insert-word-empty`, `g-star-free`, `dictionary-*`,
      `g-persist-dict`.
- [ ] Commit: `feat(nokia-os): T9 options, user words and the virgin T9 default`.

### Task 8 - Acceptance and the coverage guard

**Files:** `tests/support/messages.ts`, `tests/support/rig.ts` (`t9` option, default the fixture
dictionary; `englishT9` where a golden needs it), `tests/acceptance.test.ts`.

- [ ] A hand-written scenario for every imported `t9/*` golden, with `englishT9` (the goldens'
      lists are the ones the open list shares).
- [ ] Coverage guard: no golden or placeholder names `18b`; delete `awaitsPlan18bScenario`.
- [ ] Every asserted golden passes (pixels exact; timelines ±2 ms). New `KNOWN_GAPS` need a reason.
- [ ] `mise exec -- vp run @hellotimber/nokia-os#test`, `vp run -r test`, `vp check --fix`. Report
      the suite's run time.
- [ ] Commit: `test(nokia-os): drive T9 against its goldens`.

### Task 9 - Demo, README, verification gate and closeout

**Files:** `packages/nokia-os/{README.md,demo/main.ts}`, `docs/specs/nokia-3310.md`,
`docs/plans/README.md`, this plan.

- [ ] Demo: `const { englishT9 } = await import("@hellotimber/nokia-os/t9-english")`, then
      `createStockPhone({ ..., t9: { english: englishT9 } })`. Check with
      `mise exec -- vp run @hellotimber/nokia-os#demo` and `agent-browser` (headless: drive
      through the `[role=status]` line, Skip boot): Write messages in T9, type `4 6 8 6`, `*`
      through the list, `0`, a no-match key and Spell, Insert word, Dictionary off and on. Report
      the dictionary chunk's size from `vp build` of the demo.
- [ ] README: T9, the dictionary entry point and its licence, what is not reproduced (spec 15).
- [ ] `mise exec -- vp check --fix`, `vp run -r test`, `vp run website#build`;
      `git diff --stat <commit before Task 1> -- website/` is empty.
- [ ] Spec §10 and this plan: verified facts, UNVERIFIED items, status `done`; plans README row.
- [ ] Commit: `docs: complete T9 predictive text (plan 18b)`.

## Follow-up plan adjustments

- **18c - Chat:** Chat's editor in T9 by default (plan 18 S12) reuses this plan's editor mode.
- **26 - Languages:** Русский and Български T9 need Cyrillic dictionaries (an open list per
  language, the same build) and the Cyrillic mode text.
- **Portfolio integration:** the website host passes `englishT9` when it adopts nokia-os.

## Open questions for Lachlan

Resolved provisionally so execution is not blocked; each is cheap to reverse.

1. **Dictionary source (D2) — confirmed by Lachlan 2026-10-14:** IlyaSemenov/wikipedia-word-frequency (MIT, Wikipedia counts).
   Reverse: Google Books Ngram 1-grams (CC BY 3.0) with the same build, or a smaller hand-curated
   list.
2. **Size (D3):** 30,000 words (≈117 KB gzipped). Reverse: 20,000 (≈76 KB) or 50,000 (≈200 KB).
3. **Loading (D5):** a separate entry point the host imports; without it T9 English is
   unavailable. Reverse: bundle it into the main entry (simpler, +117 KB gzipped for every user).
4. **User dictionary capacity (D7):** a budget of 840 = Σ(length + 1), oldest dropped, fitted to
   two measurements (166-169 four-letter or 91-99 eight-letter words). Reverse: a plain word count
   (about 160).
5. **User words across power cycles (D7) — confirmed by Lachlan 2026-10-14:** kept (stored at once). In the emulator a user word was
   lost after a cold boot in all three variants tried (saved in the editor, at standby, and during
   the phone's own switch-off, which wrote nothing), while the Dictionary choice was kept. Reverse:
   keep user words in memory only (lost at power-off), matching the emulator. Restore factory
   settings keeps user words (provisional).
6. **Profanity (D3):** no filter. Reverse: a blocklist in the build script.
7. **Key-1 compositions (D10):** the spec's suggested order, not asserted. Reverse: drop
   compositions entirely (contractions and word + mark only).

## Conflicts found while planning

- Plan 18's scope table and Open question 3 propose harvesting the firmware's word list through the
  UI and committing it. This plan replaces that with the clean-room split (D1) and an open list
  (D2): no firmware word list is committed.
- Plan 18 D3 overrides the virgin Dictionary to off "until 18b"; D6 removes the override only when
  a dictionary is configured (D5), so a host without one keeps plan 18's behaviour.
- Plan 18 D1 gives the Dictionary's Cyrillic entries to 18b; D11 re-owns them to 26.
- VISION's non-goal "T9 dictionaries beyond what the UI bit needs" (website era): Task 1 keeps it
  for the website and records nokia-os's open-list dictionary.
- Spec §6 (user guide): "▲ moves the cursor left"; T9 mode moves by word stops and ▲ moves right
  (spec 9), as plan 18 S7 found for multi-tap.

## Done means

- The T9 engine follows every rule of `docs/specs/t9-behaviour.md` sections 1-12 (unit tests on the
  fixture dictionary).
- Every imported `t9/*` golden passes with `englishT9` (pixels exact; timelines ±2 ms).
- Write messages starts in T9 English when the host passes the dictionary; Dictionary off/on,
  Matches, Insert word, Spell and user words work and persist.
- The shipped dictionary is regenerated identically from the pinned open list; its licence notice
  ships with it; the demo loads it as a separate chunk.
- No file in the repository contains firmware dictionary content; the clean-room protocol was
  followed (each task's report says so).
- The website is unchanged; `vp check`, `vp run -r test` and `vp run website#build` pass.
