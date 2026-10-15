# Plan 26 - Languages: Русский, Български, Українська

> **For agentic workers:** execute task-by-task; tick checkboxes; commit per task.
> If this plan contradicts VISION.md, AGENTS.md, or the code, STOP and report.

**Prerequisites:** plans 13, 14, 15 and 16 complete; plan 18 merged (multi-tap engine `src/text/`,
the editor and its header, the messages goldens); plan 29's resource registrations. Task 7 needs
plan 18. Every other task needs only 13-16 and 29.
**Ground truth:** the v6.39 emulator corpus at
`REF=/Volumes/SSD/Projects/lachieh/hellotimber/nokia-3310` (gitignored, main checkout only). Read
`$REF/captures/README.md` ("Script format", "Output format", "Plan 14 supplementary captures",
"Plan 15 supplementary captures", "Plan 18 captures"), plans 13-16, 18, 18b and 29, and
`docs/specs/t9-behaviour.md` section 13 before starting. The planning probes are in
`$REF/captures/scratch-plan26/` (`gen.py`, `run.sh`, `sweep.sh`, `out-*`). They are evidence for
this plan only and are never imported. Task 0 writes this plan's captures to
`$REF/captures/6.39/plan26/`.
**Status:** not started (planning probes done 2026-10-14).

## Goal

Let `@hellotimber/nokia-os` run in every display language of the v6.39 PPM E pack, faithful in
pixels and behaviour:

- Settings › Phone settings › Language (6-2-1): all five choices work. The three placeholders
  (6-2-1-3…5, `pending:26`) become the stock flow: the note in the new language, then the page.
- Every screen nokia-os draws is in the chosen language. This covers the standby soft key, the
  carousel, every menu level, page, option list, note, prompt and soft key of the stock tree, the
  boot gates, Restore's note, the calculator, Snake II and plan 18's messages. The strings come
  from per-language captures through the importer.
- The fonts gain the Cyrillic glyphs, harvested from golden pixels only.
- Multi-tap text entry follows the display language: Cyrillic key cycles, key 1 lists and
  header modes.
- The language persists and survives Restore factory settings, as the firmware does.
- Later plans can add their strings in every language without editing this plan's files.

T9 in Russian and Bulgarian is plan 26b (scope below).

## Why this plan exists (measured gap)

| Area                     | nokia-os after plans 13-23                                                                                          | v6.39 (planning probes, `scratch-plan26/`)                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 6-2-1-3…5                | placeholders owned by `26`; `tree/06-settings/6-2-1-{3,4,5}.choose` and `sound/note/6-2-1-{3,4,5}` are `pending:26` | a tick note in the chosen language (`Есть!`, `Готово`, `Заверше-`/`но`), then the page in it           |
| Every other screen       | English literals in the generated tree, feature tables, widgets and painters                                        | the whole UI switches: `Меню`, `Тел. книжка`, `Выбрать`, 3-line page labels, `Откл.`, hyphenated notes |
| Fonts                    | Latin plus the three language names and their notes (plan 14 Task 6)                                                | about 70 Cyrillic letters per face (small, large, thin)                                                |
| Multi-tap                | one Latin table (plan 18 D2)                                                                                        | per display language: `абвг2abc`, …; key 1 differs per language; `Абв`/`абв` header modes              |
| Restore factory settings | resets every choice, the language too                                                                               | keeps the language (v6.39, probe L7)                                                                   |
| Generated tree           | 6-2-1-4's note reads `Γотово` with a Greek Γ (U+0393)                                                               | the firmware string is Bulgarian `Готово` (Cyrillic Г, U+0413)                                         |

## Languages investigation (planning, 2026-10-14)

Scripts: `$REF/captures/scratch-plan26/gen.py` writes the `.cap` files and `run.sh` runs them on
the virgin image (`firmware/raw/6.39/combined/3310_v639_ppm_E_virgin_eeprom_2MiB.fls`,
`v639-setup.inc`). Probe E ran on plan 15's `firmware/work/v639-plan15-seccode.fls`. The SIM
variants use `SWSIM_FS=<fixture>` (plan 15's mechanism) with copies of the emulator's
`third_party/swsim/gsm.json`. Probes C and C2 and `sweep.sh` cover the SIM variants. Readings
come from `tools/menutree/ocr.py` (raw glyph readings; see L13).

| #   | Probe (`out-*`)                     | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1  | `a-*/switch`, `a-*/to-auto`         | The Language list is `Automatic`, `English`, `Русский`, `Български`, `Українська` and opens on the current choice. The language names are always native. Only `Automatic` is translated: `Автомат` (ru), `Автоматично` (bg), `Авт. вибір` (uk). Soft key `OK` in every language.                                                                                                                                                                                                                                                                                                                          |
| L2  | `a-*/*/02-choose`                   | OK shows a tick note in the **new** language, the same note as `Done`: `Есть!` (ru), `Готово` (bg), `Заверше-`/`но` (uk), `Done` (English, and Automatic with an English SIM). Phases 671-690 / 232-247 / 514-542 ms. The first frame comes 215-235 ms after OK for a Cyrillic language, 75-82 ms for English and 140-146 ms for Automatic (key-to-redraw latency, plan 14 D8). Then the 6-2-1 page in the new language: `Язык` / `Език` / `Мова`, the value is the native name in the thin face, and the soft key is `Выбрать` / `Избиране` / `Вибрати`.                                                 |
| L3  | `a-*/tour/{carousel,sub,deep}`      | The whole UI switches. Standby: `Меню` in all three (operator, clock and date unchanged). Carousel titles, e.g. ru `Тел. книжка`, `Сообщения`, `Чат`, `Звонки`, `Сигналы`, `Настройки`, `Перевод зв.`, `Игры`, `Кальк-р`, `Напомнить`, `Часы`, `Режимы`. Page labels use up to three lines (tops 7/16/25, e.g. `Установка`/`режимов`/`звонков`); values are in the thin face (`Откл.`, `Громкость 1`). Notes are large, up to three lines with firmware hyphenation (`Телефон-`/`ных`/`номеров нет`). Game names stay Latin (`Snake II`, `Space impact`, `Bantumi`, `Pairs II`).                          |
| L4  | `a-*/tour/sub/*` counts             | Same structure in every language: every top-level level and the Settings and Tones pages have the same entries in the same order (Phone book 10, Messages 10, Call register 8, Tones 9, Settings 4, Call divert 5, Games 5, Reminders 3, Clock 6, Profiles 6).                                                                                                                                                                                                                                                                                                                                            |
| L5  | `c-*`, `sweep.sh` (`sim-lp-x10…2f`) | **Automatic is English.** The firmware reads EF_LP (6F05) at power-on (SIM log) and never EF_ELP (2F05). The UI stays English with EF_LP `01` (the fixture), `00` German, `03` French, `0F` unspecified and every value `10`-`2F` (`23` is Russian in GSM 03.38's CBS coding). The same holds with EF_ELP `ru`/`bg`/`uk` and EF_LP `0F`.                                                                                                                                                                                                                                                                  |
| L6  | `d`                                 | The language survives `saveflash` + cold boot. The boot is in the chosen language: `Защитный`/`код:` prompt, `Код`/`принят` tick, the hands, the clock wizard (`Задать время:` `чч:мм`, `Время`/`уста-`/`новлено`, `Дата:` `дд.мм.гггг`, `Дата`/`уста-`/`новлена`), then standby `Меню`. Boot timeline as English (self-test 254/969/1171/1665 ms).                                                                                                                                                                                                                                                       |
| L7  | `e` (seccode image)                 | Restore factory settings in Russian: prompt `Защитный код:`, note `Станд.`/`на-`/`стройки` (tick), the page. The language stays Русский afterwards (list opens on it, page shows it). This confirms on v6.39 what plan 15 saw on v5.79.                                                                                                                                                                                                                                                                                                                                                                   |
| L8  | `b-*`, `b2`                         | **Multi-tap follows the display language, not the T9 dictionary.** English UI with T9 Русский chosen and then Dictionary off gives Latin cycles (`b2`). Cyrillic cycles are the language's letters, the digit, then Latin a-z with no accents. ru: 2 `абвг2abc`, 3 `дежз3def` (no ё), 4 `ийкл4ghi`, 5 `мноп5jkl`, 6 `рсту6mno`, 7 `фхцч7pqrs`, 8 `шщъы8tuv`, 9 `ьэюя9wxyz`. bg: as ru but 8 `шщъ8tuv`, 9 `ьюя9wxyz`. uk: 2 `абвг2abc`, 3 `деє3def`, 4 `жзиі4ghi`, 5 `їйкл5jkl`, 6 `мнопр6mno`, 7 `стуфх7pqrs`, 8 `цчшщ8tuv`, 9 `ьюя9wxyz`. Upper case mirrors these (OCR-level reading; Task 0 confirms). |
| L9  | `b-*/keys/1-*`                      | Key 1 after a full stop: ru `. , ' ? ! - & : 1` (9; `:` added), bg `? ! - , . & 1` (7; another order), uk `. , ' ? ! - & 1` (English). The sentence-start cycle was hidden by the cursor in these shots (Task 0).                                                                                                                                                                                                                                                                                                                                                                                         |
| L10 | `b-*/symbols`                       | The symbol table is the English one (31 symbols). Its soft key is translated (`Вставить` / `Използвай` / `Взяти`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| L11 | `b-*/keys` header rows              | The editor header shows Cyrillic mode sprites (`Абв` at a sentence start, `абв`) in all three languages; `123` and the counter are unchanged. After two Cyrillic letters the counter equals English's: no 70-character count was seen (Task 0 checks longer texts and the sent payload).                                                                                                                                                                                                                                                                                                                  |
| L12 | `b-*/01-dict-off*`                  | Options › Dictionary in every UI: `Dictionary off` translated (`Словарь откл.`, `Речник изкл.`, `Вимкн. словн.`), then `English`, `Русский`, `Български`. There is no Ukrainian T9. The off note is translated (`Словарь`/`Т9 -`/`отключен`, `Речник`/`Т9 е`/`деактивиран`, `Вимкнено`/`словник`/`Т9`). In the English UI, T9 Русский on shows `T9 dictionary activated`.                                                                                                                                                                                                                                 |
| L13 | every probe                         | Raw OCR mixes look-alikes. Latin and Greek letters show up for Cyrillic ones (`Тeл. книжкa`, `Πoиск`, `Γpoмкoсть`), and the small face's `й` reads as `Й` because the two share a bitmap. Ukrainian `ї` and `і` read as Latin `ï` and `i`. `ocr.py` keeps the lowest code point for a bitmap, which is why the generated tree has `Γотово`.                                                                                                                                                                                                                                                               |

Hygiene note: probe `b2`'s first run typed keys 2 and 3 while T9 Русский was on, which showed
Cyrillic T9 candidates. Those shots were deleted. The rerun types nothing while T9 is on. Plan
26b's clean room must not use this planning transcript (26b outline).

Conclusions:

1. **A full re-crawl per language is needed for text.** It is cheap because it is a replay. The
   strings cannot be derived from English: across the firmware's 1,082 distinct English strings,
   65-70 per language translate to two or more different strings (`Send` → `Отосл.`/`Отправить`/
   `Послать`, `On` → `Вкл.`/`Включен`/…). Line breaks, abbreviations and hyphenation are
   per-language too. The structure is identical (L4), so plan 14's positional capture script
   replays as it is after a language switch. Plan 14 took ≈10 min wall (3 workers, ≈5300 s
   emulated) and ≈4,400 images, so a replay costs about that per language.
2. **Full goldens per language would be too big.** As goldens, plan 14's images are ≈18 MB per
   language, and plans 13, 15, 18, 20 and 23 add more, so the total would be 54 MB or more. The
   repository's goldens are 20.8 MB today. The text needs the full crawl. The pixels need only
   enough goldens to cover every glyph, every adjacent pair and every layout class (D5).
3. **English text stays the internal identity.** Feature tables, note sounds (plan 16 D12),
   query results and note styles are keyed by English text. Localising at the display boundary
   keeps every one of them working (D2).

## Scope and non-goals

In scope: the Goal items; Task 0's captures; the per-language text catalogue and its importer;
Cyrillic glyphs; the display-boundary localisation; the language choices; multi-tap per language;
Restore keeping the language; per-language goldens and acceptance; a coverage guard and a
convention for later plans; documentation in `docs/specs/stock/languages.md`.

Deliberately left to later plans (each in "Follow-up plan adjustments"):

- **T9 Русский and Български** → plan 26b (outline below). Plan 18b D11's placeholders move from
  `26` to `26b`. This needs open Cyrillic word lists, a dirty-room spec addendum for Cyrillic T9 and
  plan 18b's engine. Ukrainian has no T9 in this pack (L12).
- **Strings of plans not merged when Task 0 runs** (at planning: 17, 18b, 18c, 19, 21, 22, 24,
  25, 27, 28): each adds its own language replays and catalogue entries through D9's convention.
  Until then the coverage guard lists their strings as `untranslated:<plan>`.
- **A SIM language port** for Automatic: no SIM language selects a Cyrillic UI on this pack (L5).
- **The website** does not change (D12).

## Decisions

**D1 - Four display languages; Automatic is English (new; L1, L5).** `StockLanguage` is `"english"
| "russian" | "bulgarian" | "ukrainian"`. The setting `settings/phone-settings/language` keeps plan
14's choice indexes (0 Automatic, 1 English, 2 Русский, 3 Български, 4 Українська). The display
language is `english` for 0 and 1, and the named language for 2-4. Automatic resolves to English
because no EF_LP or EF_ELP value tried selects another language (L5). There is no SIM language
port (reverse: Open question 1). The language is read when a screen is drawn, so a choice takes
effect on the next frame, which is the note (L2).

**D2 - English text stays the internal identity; nokia-os localises at the display boundary
(new; contrasts with per-language source trees).** Every English string nokia-os already uses
(the generated tree, feature tables, widget literals) keeps its meaning and keeps keying note
sounds, note styles, query results and setting labels. A string is shown in the display language
at two choke points only:

1. **Kernel screens.** `createStockPhone`'s wrapper (it already wraps `send`/`tick`) returns
   `screen` and snapshot screens through `localiseScreen(screen, path, language)`. That covers
   list items, soft key and detail, the carousel label, and the standby and carousel soft keys
   (via D4's fields). Items are matched to tree nodes through the path. An item whose text is not
   its node's English label is left as it is: a typed name such as a renamed profile under plan
   17's label seam is never translated.
2. **Flow widgets.** `StockFlowApplication.render` passes the widget model through
   `localiseWidget(model, context, language)` before `paintWidget`. Each model kind declares its
   firmware-text fields (lines, labels, soft keys). User-text fields are never localised: typed
   entries, the editor text, the welcome note and, later, phone book names and SMS bodies.

Rejected: (a) a per-language `STOCK_TREE` plus semantic string ids in every feature. Every
feature and widget of plans 13-25 would change, and every English-keyed table would need
re-keying. (b) A phone-core `localise(text, context)` seam inside the kernel: Nokia text belongs
to nokia-os, and the wrapper already exists. Both stay possible later; neither changes D3's data.

**D3 - The catalogue: English text → language text, with a context only where the firmware
differs (new).** Each language has a generated table:
`{ text: Record<english, string>, context: Record<"<node>|<role>", Record<english, string>> }`.
`role` is `label`, `softkey`, `value`, `option` or `text`. Lookup tries `context[node|role]`, then
`text`. A multi-line string is looked up whole (lines joined with `\n`) and returns its own
lines, so `Settings`/`restored` becomes `Станд.`/`на-`/`стройки`. A string with no letters
(digits, `10:10`, `*****`) passes through. When the importer pairs one English string with two
different translations, it moves both into `context` under the nodes and roles they came from. If
they conflict inside one node and role, the import fails and names both captures; the fix is an
override in `scripts/language-overrides.ts` that cites a capture. Contexts come from the kernel
(the item's node, the level's node, the page's node) and from the flow (its root node; `boot` for
the boot gates).

**D4 - Soft keys of standby and the carousel become model fields (phone-core, additive,
type-only).** `ScreenModel` `standby` and `menu-carousel` gain `softkey?: string`. The kernel
never sets it. nokia-os's wrapper sets the localised `Menu`/`Select`, and the stock painter draws
`screen.softkey ?? "Menu"` (`?? "Select"`). Without it the static `paintStockScreen` could not
know the language, and hosts already paint `phone.screen`. The website and phone-core's own
painters are unaffected.

**D5 - Text from a full replay per language; pixels from a covering sample (new; answers the
golden-volume question).** Task 0 replays the capture scripts of every merged plan in each
language: plan 14's whole tree plus plans 13, 15, 18, 20 and 23. Their sound-only sections are
skipped, since sound does not depend on the language. The OCR'd text of every replayed image
feeds the catalogue (D3), so every string is captured. Goldens are a deterministic sample per
language. `scripts/capture-sets/26-languages.ts`'s selector picks greedily from the replayed
images whose English counterpart is a golden, so a scenario exists. It stops when the sample
covers every (face, character) and every (face, adjacent pair) in that language's text, plus the
fixed set: standby, the 12 carousel titles, one golden per layout class (rows; pages with 1, 2
and 3 label lines, with and without a value; notes with 1, 2 and 3 lines; prompts; info pages;
an unset list's `Quit`; multi-select `Mark`/`Unmark`; a query), the language flows, the boot gate,
Restore's note, the calculator and its Options, Snake II's menu and an instructions page, and
plan 18's editor, note and Inbox screens. Budget: at most 250 stills and 20 timelines per language
(≈1-1.5 MB). Reverse: import every replayed image (Open question 2).

**D6 - OCR resolves look-alikes before anything reaches the repository (new; extends plan 14
D13).** Task 0's `captures/scripts/ocr_lang.py` wraps `tools/menutree/ocr.py` per language (REF
side, no edit to the shared tool):

- a word with any Cyrillic letter is all Cyrillic (Latin and Greek look-alikes mapped);
- a letter whose upper and lower bitmaps coincide in a face (`й`/`Й` small) takes its
  neighbours' case;
- `ï` and `i` become `ї` and `і` in Ukrainian words;
- each resolved run is checked against the language's firmware strings. Like plan 14's
  `ocr.resolve`, this cross-check reads `$REF/extracted/6.39/text/ppm_E/<LANG>.txt` in REF only.
  A run that matches no string goes to `plan26/<lang>/unresolved.json`, and Task 2 settles it
  with an override.

Only OCR readings (`text.json`) cross into the repository. Nothing from `$REF/extracted` is
copied. The harvester's per-glyph consistency and the pixel acceptance catch a wrong code point
wherever two glyphs differ. Where they coincide, the code point is what text entry and storage
see, which is why the rules above matter. The same normaliser fixes plan 14's `Γотово` when
`import-tree` reruns.

**D7 - Cyrillic glyphs are harvested from the language goldens (continues plan 13 D8, plan 14
D13).** The language goldens' text runs come from the importer's generated
`scripts/generated/language-text-runs.ts` through plan 26's resource input (plan 29). They give
every Cyrillic letter in the faces that show it: `small` (rows, pages, soft keys, the editor),
`large` (titles, notes, prompts' entries), `thin` (page values). Typeable letters that the UI
never shows in a face come from Task 0's glyph sheets. Those sheets are every key cycle in the
editor (small) and in Phone book Add name (large), as plan 18 did. Touching pairs that the
harvester reports get overrides that name their golden. `missingStockGlyphs` then reports nothing
for any catalogue string in its face (a test).

**D8 - Multi-tap per display language (extends plan 18 D2, D6).** `src/text/keys-cyrillic.ts`
holds the ru, bg and uk tables (cycles in both cases, the key 1 lists, the sentence-start cycle)
read from Task 0's key captures, one row per key with its capture cited. Plan 18's
`MULTITAP_KEYS` stays English, and `multitapKeys(language)` selects one. The editor reads the
display language when a key is pressed. `TYPEABLE` becomes `typeable(language)`. The symbol table
is shared (L10). The header's Cyrillic mode sprites (`Абв`, `абв`, and `АБВ` if Task 0 shows
it) are crops in plan 26's resource input. The T9 dictionary choice does not change the
multi-tap alphabet (L8).

**D9 - Later plans translate their own strings (new convention; AGENTS.md "Parallel plan
conventions" item 8).** A plan's capture set may declare `languages: { replay: [...] }`, the
sections of its own Task 0 scripts to replay per language. Task 0 runs them through
`gen_v639_plan26.py replay --plan <NN>`. `import-languages` merges every plan's pairs into the
catalogue. The coverage guard (D10) lists untranslated firmware strings by owner plan, so a later
plan finishes by clearing its own `untranslated:<NN>` entries. The catalogue files are shared
generated outputs: on a merge conflict, rerun `import-languages`, as AGENTS.md item 4 does for
resources.

**D10 - Coverage guard and strict lookups (new).** Tests run with `strictText: true` (rig
default). A firmware string that a non-English screen shows and the catalogue lacks throws,
naming the string, its context and the language. Production falls back to English and records
the miss (`stockTextMisses()`, internal). A static test checks that every English text run
registered for harvesting (every plan's `resources.textRuns` and the generated tree runs) has a
translation in each language. Exceptions are `NOT_FIRMWARE_TEXT` (user text in goldens: `Hi`, the
long welcome note, typed names) and `UNTRANSLATED` (owner plan, reason).

**D11 - Restore keeps the language (fixes plan 15's factory; L7).** The languages feature lists
`settings/phone-settings/language` in `restoreKeeps`. Plan 15's `factorySettings` applies
`restoreKeeps` to choices as well as texts and numbers (one line in `src/firmware/settings.ts`).

**D12 - The website does not change.** phone-core's change is optional and type-only.
`git diff --stat <commit before Task 1> -- website/` is empty at the end.

**D13 - Language goldens live under `goldens/languages/<language>/` with the English golden's id
after it (new).** For example `languages/russian/tree/06-settings/6-2.scroll` or
`languages/bulgarian/menu/06-settings.sub`. They are indexed in `goldens/index/26.json`, imported
`pending:26`, and promoted per golden when its scenario passes. Their scenarios reuse the English
golden's driver on a phone whose storage holds the language (`tests/support/languages.ts`), so no
golden-format change is needed.

**D14 - No public language API (new).** The phone's own menu is the only control, and a host
seeds a language through `storage` as for any setting. `StockPhoneConfig` and the package exports
do not change. Reverse: export `StockLanguage` and a `language` config that seeds the setting
(Open question 6).

## Ground truth and artefacts

| Source (`$REF/captures/`)                          | Contents                                                                                     | Use                                                      |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `scratch-plan26/` (planning)                       | probes L1-L13                                                                                | evidence for the decisions; never imported               |
| `6.39/plan26/flows/` (Task 0 A)                    | the language flows in every UI, Automatic, persistence, Restore, the boot                    | `languages/*/flows/*` goldens                            |
| `6.39/plan26/<language>/plan<NN>/` (Task 0 B)      | replays of plans 13, 14, 15, 18, 20, 23 (and any merged plan) after a language switch        | catalogue text (all) and sampled goldens (D5)            |
| `6.39/plan26/<language>/text/` (Task 0 C)          | key cycles both cases, key 1 at a sentence start, held keys, `#`, header modes, glyph sheets | D8 tables, D7 glyphs, `languages/*/text/*` goldens       |
| `6.39/plan26/<language>/text.json`                 | language-resolved OCR of every image (D6)                                                    | the importer's only text input                           |
| `6.39/plan14/text.json`, `6.39/plan<NN>/text.json` | the English counterparts                                                                     | pairing (D3)                                             |
| `6.39/tree.json`                                   | the tree's structure                                                                         | the per-language tree model (Task 2)                     |
| `extracted/6.39/text/ppm_E/{RUSS,BULG,UKRA}.txt`   | firmware strings                                                                             | D6's cross-check inside REF only; never read by the repo |

Artefacts (added to `docs/specs/stock/languages.md` in Task 1):

| Artefact                                         | Cause                                  | Handling                                               |
| ------------------------------------------------ | -------------------------------------- | ------------------------------------------------------ |
| Automatic always English                         | the emulator SIM; EF_ELP is never read | reproduced (D1); UNVERIFIED for real SIMs              |
| 215-235 ms before a Cyrillic choice's note draws | firmware language load (key-to-redraw) | not reproduced (plan 14 D8): align on the first change |
| Clock wizard in the chosen language              | virgin EEPROM                          | cut from goldens, as plan 15                           |

## Package boundaries

Unchanged from plans 13-18. phone-core gains two optional, type-only `ScreenModel` fields (D4).
The language code is internal to nokia-os (`src/firmware/languages/`). Scripts keep plan 13's
conventions (Node type stripping; `node:*` and sibling imports). No new dependencies.

## Contract changes

Task 1 writes these into `VISION.md`.

### `@hellotimber/phone-core` (additive, type-only)

```ts
// ScreenModel
//   | { kind: "standby"; ...unchanged...; /** Plan 26: the soft key; painters default to "Menu". */ softkey?: string }
//   | { kind: "menu-carousel"; ...unchanged...; /** Plan 26: the soft key; painters default to "Select". */ softkey?: string }
```

The kernel never sets them. A host's wrapper or adapter may. Configs and models without them are
unchanged.

### `@hellotimber/nokia-os`

Public API unchanged (D14). `paintStockScreen` draws D4's soft keys when present.

## Language API (internal)

Signatures are fixed by Tasks 5-6; a change is a Deviation recorded here.

```ts
// src/firmware/languages/language.ts (pure)
export type StockLanguage = "english" | "russian" | "bulgarian" | "ukrainian";
export const LANGUAGE_KEY = "settings/phone-settings/language";
/** D1: the display language of a stored choice (0 Automatic → english). */
export function displayLanguage(choice: number | null): StockLanguage;
export function currentLanguage(settings: StockSettings): StockLanguage;

// src/firmware/languages/catalogue.ts (pure)
export type TextRole = "label" | "softkey" | "value" | "option" | "text";
export interface TextContext {
  readonly node: string; // tree node number, or "boot"
  readonly role: TextRole;
}
export interface StockText {
  /** D3: a firmware string (lines joined with "\n") in `language`; English returns it unchanged. */
  localise(english: string, context: TextContext, language: StockLanguage): string;
  /** Lines in, lines out (a note's or a page label's). */
  localiseLines(
    english: readonly string[],
    context: TextContext,
    language: StockLanguage,
  ): string[];
}
export function createStockText(options?: { readonly strict?: boolean }): StockText; // D10
export function stockTextMisses(): readonly {
  english: string;
  context: TextContext;
  language: StockLanguage;
}[];

// src/firmware/languages/screen.ts
export function localiseScreen(
  screen: ScreenModel,
  path: string,
  language: StockLanguage,
  text: StockText,
): ScreenModel;

// src/firmware/languages/widgets.ts
export function localiseWidget(
  model: WidgetModel,
  context: { readonly node: string },
  language: StockLanguage,
  text: StockText,
): WidgetModel;

// src/text/keys-cyrillic.ts
export function multitapKeys(language: StockLanguage): Readonly<Record<TextKey, KeyCycles>>;
export function typeable(language: StockLanguage): ReadonlySet<string>;
```

## Golden pipeline additions

**Capture set** `scripts/capture-sets/26-languages.ts` (`plan: "26"`), registered by one line
in `scripts/capture-sets/index.ts`. Sources are under `$REF/captures/6.39/plan26/`. Every new
golden imports as `pending:26`.

| Fixture id                                             | Source                                 | Kind       | Asserts                                                                |
| ------------------------------------------------------ | -------------------------------------- | ---------- | ---------------------------------------------------------------------- |
| `languages/<l>/flows/choose`                           | `flows/<l>/choose`                     | timeline   | 6-2-1 list → OK → the note in `<l>` → the page in `<l>`                |
| `languages/<l>/flows/to-automatic`, `.../to-english`   | `flows/<l>/to-*`                       | timeline   | back from `<l>`: list in `<l>` (`Автомат`…), `Done`, the English page  |
| `languages/<l>/flows/list`                             | `flows/<l>/list/*.png`                 | stills     | the Language list scrolled in `<l>`                                    |
| `languages/<l>/standby`, `languages/<l>/menu/<NN>.sub` | replay of plan 13                      | stills     | `Меню`, the 12 carousel titles and `Выбрать`                           |
| `languages/<l>/tree/…` (sampled, D5)                   | replay of plan 14 (`scroll/`, `open/`) | as English | the English golden's screens in `<l>`                                  |
| `languages/<l>/boot/security-gate`                     | replay of plan 15 `boot/gate`          | timeline   | `Защитный код:`, `Код принят`, the hands                               |
| `languages/<l>/probe/accept-6-4-restore`               | replay of plan 15 `accept/6-4-restore` | timeline   | Restore's note in `<l>`; the language kept (`flows/<l>/restore-kept`)  |
| `languages/<l>/calculator/*` (sampled)                 | replay of plan 20                      | stills     | `Варианты`, the Options list, notes                                    |
| `languages/<l>/game/snake/*` (sampled)                 | replay of plan 23                      | stills     | the Snake II menu and an instructions page                             |
| `languages/<l>/messages/*` (sampled)                   | replay of plan 18                      | stills     | editor header modes, a prompt, a note, the Inbox                       |
| `languages/<l>/text/key-<k>-{upper,lower}`             | `<l>/text/key-*`                       | stills     | every multi-tap cycle twice (D8)                                       |
| `languages/<l>/text/glyphs-{small,large}`              | `<l>/text/glyphs-*`                    | stills     | every typeable character in both faces (D7)                            |
| `languages/<l>/flows/persist-boot`                     | `flows/<l>/persist-boot`               | timeline   | power-on after `saveflash`: the gate and standby in `<l>` (wizard cut) |

`<l>` is `russian`, `bulgarian`, `ukrainian`. The existing `tree/06-settings/6-2-1-{3,4,5}.choose`
(plan 14's index) and `sound/note/6-2-1-{3,4,5}` (plan 16's index) stay in their indexes. Task 6
flips their status there through the importer by deleting plan 26's group from
`PLACEHOLDER_OWNERS`.

**Resource input** `scripts/resource-inputs/26-languages.ts`: `textRuns` from
`scripts/generated/language-text-runs.ts`; `glyphOverrides` that the harvester asks for, each
naming its golden; `spriteBatches` at order 260 for the header modes (`Абв`, `абв`, …). Batch
positions follow plan 29 (260, then 261 if a second block is needed).

**Catalogue generator** `scripts/import-languages.ts` (REF-reading, like `import-tree`; package
script `import-languages`). It writes `src/firmware/languages/generated/{russian,bulgarian,
ukrainian}.ts` and `scripts/generated/language-text-runs.ts`. It is idempotent, and running it
twice gives no diff.

## Conventions for every task

- Run commands from the repo root with `mise exec --`.
- **File ownership (parallel conventions).** Plan 26 owns: `src/firmware/languages/**`,
  `src/firmware/features/languages.ts`, `src/text/keys-cyrillic.ts`,
  `scripts/capture-sets/26-languages.ts`, `scripts/resource-inputs/26-languages.ts`,
  `scripts/import-languages.ts`, `scripts/language-text.ts`, `scripts/language-overrides.ts`,
  `scripts/generated/language-text-runs.ts`, `goldens/languages/**`, `goldens/index/26.json`,
  `tests/language-*.test.ts`, `tests/support/languages.ts`, `tests/acceptance/26-languages.test.ts`,
  `docs/specs/stock/languages.md`, this plan and row 26 of the plans README. **Shared edits beyond
  one-line registrations**, each named in its task: `packages/phone-core/src/types.ts` (D4),
  `src/display/{standby,carousel}.ts` (D4), `src/firmware/phone.ts` (the wrapper, D2),
  `src/widgets/flow.ts` (the choke point, D2), `src/firmware/settings.ts` (D11),
  `src/text/keys.ts` and plan 18's editor call site (D8), `scripts/import-tree.ts` (D6's
  normaliser, one call), `scripts/tree-capture-set.ts` (delete plan 26's owner group),
  `package.json` (one script), `AGENTS.md` (convention 8), `VISION.md` and the specs. Land each
  shared edit when no other worktree has that file open (ask the orchestrator); if one needs more
  than named, stop and report.
- TDD: write the failing test first wherever the task names tests.
- After each task: `mise exec -- vp check --fix` (rerun `mise exec -- vp fmt` until stable) and the
  task's test commands. A task that touches phone-core also runs `mise exec -- vp run -r test` and
  `mise exec -- vp run website#build`.
- Commit rule: run `mise exec -- vp check --fix` yourself, stage files by explicit path, then
  `git commit --no-verify -m "<message>"` (prefer `git commit -- <paths>`). Never `git add -A`/
  `git add .`, never `git stash`, never stage `TODOS.md`.
- Never hand-edit `goldens/**`, `src/resources/generated/**`, `src/firmware/generated/**`,
  `src/firmware/languages/generated/**` or `scripts/generated/**`; change the generator, its tables
  or its overrides and regenerate (`mise exec -- vp run @hellotimber/nokia-os#regenerate` for
  resources). Each generator runs twice with no diff before its commit.
- Tests never read `$REF`. Generators that read `$REF` fail clearly when it is missing. Nothing
  from `$REF/extracted` enters the repository.
- No new dependencies.
- When reality differs from this plan, follow the captures and append a `Deviation:` paragraph
  under the task. If a deviation breaks a contract in VISION.md, stop and report.
- Parallelism: Task 0 gates everything, then Task 1. Then lanes A (2 → 3), B (4) and C (5).
  Task 6 needs 3, 4 and 5; Task 7 needs 6 and plan 18; Task 8 needs 6; Task 9 needs 7 and 8;
  Task 10 needs 9; then 11.

## Tasks

### Task 0 - REF captures (no repository changes)

**Files (all under `$REF`, gitignored):** `captures/scripts/gen_v639_plan26.py`,
`captures/scripts/ocr_lang.py`, `captures/scripts/v639-lang-{russian,bulgarian,ukrainian}.inc`,
`captures/scripts/v639-plan26-<section>.cap`, `captures/6.39/plan26/**`,
`firmware/work/v639-plan26-*.fls`, a "Plan 26 supplementary captures" section in
`captures/README.md`. Write only these paths (other sessions use the harness). Never edit
`tools/menutree/*` or `tools/harness/*`. Never read `t9/` or `captures/plan18b/`.

`v639-lang-<l>.inc` switches from a settled standby: Menu, `6 2 1`, ▼ to the language, OK,
`run 7s`, C held 2 s, `run 2500ms`. `gen_v639_plan26.py replay --plan <NN> --lang <l>` copies a
plan's generated command streams (its `captures/scripts/v639-plan<NN>-*.cap`, or plan 14's
`v639-plan14.cap` through `tools/menutree/emu.py`). It inserts the include after the setup
include and its `key c`/`run 2000ms`, and rewrites output paths `plan<NN>/…` →
`plan26/<l>/plan<NN>/…`. It keeps sound-only sections out. Factory-image streams get the include
after `v639-factory-setup.inc`.

- [ ] **A flows** (each UI, virgin image): from each language, the Language list scrolled
      (`flows/<l>/list`); `choose` recorded from before OK to 3 s after the page; `to-automatic`
      and `to-english` the same; on plan 15's seccode image, Restore in `<l>` (`flows/<l>/restore`
      recorded, then `restore-kept`: the list and the page); `saveflash` and a cold boot recorded
      30 s (`flows/<l>/persist-boot`, code at 9 s, wizard keys). Record the note timeline and
      first-frame latency of every choice.
- [ ] **B replays** (each language): plans 13 (`menu/`, standby; not `menu-anim-long`), 14 (all of
      `v639-plan14.cap`), 15 (`boot/gate`, `accept/*`, `menu/*-wrong`, `welcome/*`), 18 (every
      LCD section; `sms/*` with the plan's `CAP_EPOCH`), 20 (every LCD section; Options escape
      included) and 23 (menus, instructions, game-over and top-score screens), plus any plan merged
      on the base commit that has LCD captures. Use `-j 4`. Record wall time per plan and language.
- [ ] **C text entry** (each language, Write messages with Dictionary off): every key `1`-`9`,
      `0` 2 × its cycle at a sentence start and after a committed letter, with both blink phases
      (plan 18's two-shot steps); key 1 at a sentence start; `#` through its modes; held digits;
      the symbol table; the header in every mode (`header/<mode>.png`). Then a 200-character
      Cyrillic text: the counter at 1, 70, 71, 160 and 161 characters. Send it through plan
      18's network port and log the payload's coding (7-bit or UCS2). Glyph sheets: every typeable
      character in the editor (small) and in Phone book › Add name (large). Also the Insert word
      prompt with T9 Русский on, header only and no typing (26b evidence: which alphabet does it
      type?).
- [ ] **D OCR** with `ocr_lang.py` (D6) into `plan26/<l>/text.json` and `plan26/flows/text.json`
      (plan 14's format plus `"lang"`), and `plan26/<l>/unresolved.json`. Report counts per
      language: images, distinct images, runs, unresolved runs.
- [ ] **E check**: `gen_v639_plan26.py check`. Every replayed image needs its English
      counterpart, the same header index (menu number) as English, and each recording must settle
      or end on a blink. Any path whose structure differs from English is listed (expected: none,
      L4).
- [ ] Append "Plan 26 supplementary captures" to `$REF/captures/README.md`: commands, the
      language include, the replay rules, findings and the planning probes table above.
- [ ] No commit. Record the outcome under this task: wall times, image counts, unresolved runs,
      the key tables (D8), the sentence-start key 1 lists, the header modes, the counter and SMS
      coding, the note timelines, and any section that failed.

### Task 1 - Contracts and documentation

**Files:** `VISION.md`, `AGENTS.md` (convention 8), `docs/specs/nokia-3310.md` (§10 index row),
`docs/specs/stock/languages.md` (new), `docs/specs/stock/storage-and-settings.md` (Restore keeps
the language: v6.39), `docs/specs/nokia-3310-menu-tree.md` (6-2-1-4 `Готово`; the Cyrillic
reading rule), `docs/specs/t9-behaviour.md` §13 (multi-tap follows the display language, L8),
`docs/plans/README.md` (row 26; ask the parent for a 26b row), this plan.

- [ ] Apply Task 0's outcome to D5, D8 and the golden table (Deviation lines where it changes
      them).
- [ ] VISION: D4's fields; the nokia-os row gains "four display languages (plan 26)".
- [ ] AGENTS.md "Parallel plan conventions" item 8: D9 (a plan's `languages.replay`, its
      `untranslated:<NN>` entries, rerun `import-languages` on a catalogue conflict).
- [ ] `stock/languages.md` with L1-L13, the artefacts and the UNVERIFIED items, marked "(plan 26,
      in progress)".
- [ ] No runtime code. `mise exec -- vp check --fix`.
- [ ] Commit: `docs: define display language contracts (plan 26)`.

### Task 2 - Language-resolved text and the catalogue importer (TDD)

**Files:** `scripts/language-text.ts` (new, pure), `scripts/import-languages.ts` (new),
`scripts/language-overrides.ts` (new), `scripts/import-tree.ts` (one call to the normaliser),
`src/firmware/languages/generated/*.ts` (generated), `scripts/generated/language-text-runs.ts`
(generated), `src/firmware/generated/stock-tree.ts` (regenerated: `Γотово` → `Готово` only),
`package.json` (`import-languages`), `tests/language-text.test.ts` (new).

- [ ] TDD `normaliseCyrillic(run, language)` on synthetic runs: mixed-script words, Greek letters,
      `й`/`Й` by context, Ukrainian `і`/`ї`, Latin words left alone (`Snake II`, `OK`).
- [ ] TDD the tree pairing: plan 14's `buildStockTree` over the language's text with a structure
      check in place of the English spelling check (same nodes, kinds, option and page counts),
      then `pairTrees(english, language)` → entries `(english, text, node, role)`.
- [ ] TDD screen pairing for non-tree images: soft key band, rows (line by line when both sides
      have the same rows), body by face (joined lines), page value; a count mismatch is reported,
      not guessed.
- [ ] TDD the merge (D3): agreeing contexts collapse into `text`; differing ones go to `context`;
      a conflict within one node and role throws, naming both captures; overrides win and must
      cite a capture; untranslated strings stay out.
- [ ] `import-languages <REF>`: reads `plan26/<l>/text.json`, the English text files and
      `tree.json`; writes the three catalogues (sorted keys, a header naming the sources and
      counts) and the text runs of the goldens Task 3 selects. Run twice, no diff. Record entry
      counts and file sizes here.
- [ ] Rerun `import-tree` and check that the only diff is 6-2-1-4's `Готово`.
- [ ] `mise exec -- vp run @hellotimber/nokia-os#test`, `mise exec -- vp check --fix`.
- [ ] Commit: `feat(nokia-os): per-language text catalogue from language replays (plan 26)`.

### Task 3 - Capture set, sampled goldens and Cyrillic glyphs (TDD)

**Files:** `scripts/capture-sets/26-languages.ts` (new), `scripts/capture-sets/index.ts` (one
line), `scripts/resource-inputs/26-languages.ts` (new), `tests/language-capture-set.test.ts`
(new), `goldens/languages/**`, `goldens/index/26.json` (generated),
`src/resources/generated/{fonts,widgets}.ts` (regenerated),
`tests/acceptance/26-languages.test.ts` (new: `acceptancePlan({ plan: "26", scenarios: {} })`).

- [ ] TDD the selector on synthetic text (injected loader): the fixed set first; then greedy
      coverage of (face, character) and (face, pair), ties by path order; only images whose English
      counterpart is a golden; the budget; deterministic output.
- [ ] The golden table rows as "Golden pipeline additions", all `pending:26`.
- [ ] Resource input: generated text runs, header-mode crops (order 260), overrides the harvester
      asks for (each naming its golden).
- [ ] `import-captures` twice (no second diff); `regenerate` twice (no second diff). Record
      fixtures, bytes, and new glyphs per face here.
- [ ] TDD (resources): for every catalogue string and face it is drawn in, `missingStockGlyphs`
      returns `[]`; every typeable character of each language exists in `small` and `large`.
- [ ] `mise exec -- vp run @hellotimber/nokia-os#test`, `mise exec -- vp check --fix`.
- [ ] Commit: `feat(nokia-os): Cyrillic glyphs and language goldens (plan 26)`.

### Task 4 - phone-core: optional standby and carousel soft keys (TDD)

**Files:** `packages/phone-core/src/types.ts`, `packages/phone-core/README.md`,
`packages/phone-core/tests/screen-softkey.test.ts` (new),
`packages/nokia-os/src/display/{standby,carousel}.ts`,
`packages/nokia-os/tests/paint-standby.test.ts`, `packages/nokia-os/tests/paint-carousel.test.ts`.

- [ ] TDD (phone-core): models without the fields are unchanged; the kernel never sets them
      (snapshot of standby and carousel models from an existing config).
- [ ] TDD (nokia-os): `softkey` absent paints today's pixels (existing goldens); present paints
      it centred at `SOFTKEY_TOP` (a literal `Меню`/`Выбрать` model against
      `languages/russian/standby` and `languages/russian/menu/01-phone-book.sub`).
- [ ] `mise exec -- vp run @hellotimber/phone-core#test`, `mise exec -- vp run -r test`,
      `mise exec -- vp run website#build`, `mise exec -- vp check --fix`.
- [ ] Commit: `feat(phone-core): optional standby and carousel soft keys`.

### Task 5 - Language model and catalogue lookup (pure, TDD)

**Files:** `src/firmware/languages/{language,catalogue,index}.ts` (new),
`tests/language-catalogue.test.ts` (new).

- [ ] TDD `displayLanguage`: 0 and 1 → english, 2-4 → the languages, null → english (D1).
- [ ] TDD lookup with a hand-made table: `context` before `text`; multi-line in, multi-line out;
      letterless strings pass through; English is the identity; strict mode throws naming string,
      context and language; non-strict falls back to English and records the miss.
- [ ] TDD against the generated tables: `Done` → `Есть!`/`Готово`/`Заверше-\nно` (L2);
      `Settings\nrestored` → Russian three lines (L7); `Select` (softkey) → `Выбрать`; every
      ambiguous key listed in `context` has at least two nodes (no dead contexts).
- [ ] `mise exec -- vp run @hellotimber/nokia-os#test`, `mise exec -- vp check --fix`.
- [ ] Commit: `feat(nokia-os): display language and text catalogue`.

### Task 6 - Localised screens and the language choices (TDD against goldens)

**Files:** `src/firmware/languages/{screen,widgets}.ts` (new), `src/firmware/phone.ts` (wrapper),
`src/widgets/flow.ts` (choke point), `src/firmware/features/languages.ts`,
`src/firmware/settings.ts` (D11), `scripts/tree-capture-set.ts` (delete plan 26's group),
`tests/language-screens.test.ts` (new), `tests/support/languages.ts` (new),
`tests/support/rig.ts` (`language` seed and `strictText`), `tests/acceptance/26-languages.test.ts`.

- [ ] TDD `localiseScreen`: list items by child node, level soft key, page detail by `value`, the
      carousel label, D4's soft keys; an item whose text is not its node's label is left alone;
      English returns the same object (no allocation).
- [ ] TDD `localiseWidget` per model kind: firmware fields localised, user fields untouched
      (prompt entry, welcome note, editor text); unknown kinds throw in strict mode.
- [ ] Wrapper and flow wiring (D2); the flow passes its root node (`boot` for gates). Every
      English golden still passes with an empty storage.
- [ ] Languages feature: 6-2-1-3…5 bound like 6-2-1-1/2 (store the choice, `Done` tick note with
      the 6-2-1-2 timeline, then the page); `restoreKeeps` (D11); placeholders deleted. The
      `tree/06-settings/6-2-1-{3,4,5}.choose` and `sound/note/6-2-1-{3,4,5}` goldens become
      asserted (re-import) and pass.
- [ ] `tests/support/languages.ts`: `languageScenario(language, englishId)` reuses the English
      golden's driver (`tests/support/tree.ts` for tree goldens) on a rig seeded with the language.
      Add scenarios for the `flows/*`, `standby`, `menu/*` and `tree/*` language goldens; promote
      each to asserted as it passes.
- [ ] TDD Restore: a Russian phone restores to Russian (`flows/<l>/restore-kept`).
- [ ] `mise exec -- vp run @hellotimber/nokia-os#test`, `mise exec -- vp check --fix`.
- [ ] Commit: `feat(nokia-os): display languages on every stock screen (plan 26)`.

### Task 7 - Multi-tap per display language (TDD against goldens)

**Needs plan 18 merged.**

**Files:** `src/text/keys-cyrillic.ts` (new), `src/text/keys.ts` (selector export),
plan 18's editor key handler (one call: `multitapKeys(currentLanguage(settings))`),
`tests/text-keys-cyrillic.test.ts` (new), `tests/acceptance/26-languages.test.ts`.

- [ ] TDD the three tables against Task 0's stills, as transcribed rows that cite their capture
      (independent expected values): cycle lengths, wrap, upper and lower case, key 1 at a
      sentence start and after a letter, `0`.
- [ ] TDD the editor: the key cycle follows the display language at the key press; T9 dictionary
      choice does not change it (L8); header mode sprites per mode; `typeable(language)` for the
      counter and storage.
- [ ] Scenarios for `languages/<l>/text/*` and `messages/*` goldens; promote as they pass.
- [ ] If Task 0 found a UCS2 count or payload: a Deviation and the counter rule here; plan 18's
      network port payload gains the coding (stop and report if that changes VISION).
- [ ] `mise exec -- vp run @hellotimber/nokia-os#test`, `mise exec -- vp check --fix`.
- [ ] Commit: `feat(nokia-os): Cyrillic multi-tap text entry (plan 26)`.

### Task 8 - Boot, Restore, calculator and Snake II in every language (TDD against goldens)

**Files:** `tests/acceptance/26-languages.test.ts`, `tests/support/languages.ts`,
`scripts/language-overrides.ts` (only for strings the goldens prove), `src/firmware/languages/*`
(only if a model kind needs a field mapping).

- [ ] Scenarios for `boot/security-gate`, `flows/<l>/persist-boot` (wizard cut),
      `probe/accept-6-4-restore`, `calculator/*` and `game/snake/*` language goldens, through D2's
      choke points; promote as they pass. A failure means a missing field mapping or catalogue
      entry, not a scenario change.
- [ ] `mise exec -- vp run @hellotimber/nokia-os#test`, `mise exec -- vp check --fix`.
- [ ] Commit: `test(nokia-os): boot, Restore, calculator and Snake II in every language`.

### Task 9 - Coverage guard (TDD)

**Files:** `tests/language-coverage.test.ts` (new), `src/firmware/languages/coverage.ts` (new:
`NOT_FIRMWARE_TEXT`, `UNTRANSLATED`).

- [ ] Static guard (D10): every registered English text run has a translation per language, or an
      entry in one of the two tables with its reason or owner plan. An entry that is no longer
      needed fails.
- [ ] Dynamic guard: every language golden's scenario runs strict (already the rig default); a
      test asserts the default.
- [ ] `mise exec -- vp run @hellotimber/nokia-os#test`, `mise exec -- vp check --fix`.
- [ ] Commit: `test(nokia-os): language coverage guard`.

### Task 10 - Demo and README

**Files:** `packages/nokia-os/README.md`, `packages/nokia-os/demo/**` only if a panel is needed.

- [ ] README: the four languages, Automatic = English (D1), how strings reach the catalogue,
      D9's convention, what 26b adds.
- [ ] Verify with `mise exec -- vp run @hellotimber/nokia-os#demo` and `agent-browser` (headless:
      drive through the `[role=status]` line, Skip boot): Menu 6 2 1, Русский, the note and the
      page; the carousel in Russian; Write messages with Dictionary off types `абвг2abc` on key 2;
      reload: still Russian; Restore with `12345`: still Russian; back to English. Screenshots to
      `/tmp/nokia-os-p26-*.png`.
- [ ] Commit: `docs(nokia-os): display languages`.

### Task 11 - Verification gate and closeout

**Files:** `tests/acceptance/26-languages.test.ts`, this plan, `docs/plans/README.md` (row 26),
`docs/specs/stock/languages.md`, `docs/specs/nokia-3310.md` (§10 row).

- [ ] Every `languages/*` golden is asserted and passes (pixels exact; timelines ±2 ms after
      alignment, ±25 ms where plan 15's boot rule applies); no golden or placeholder names plan 26.
- [ ] `mise exec -- vp check --fix`, `mise exec -- vp run -r test`,
      `mise exec -- vp run website#build`; `git diff --stat <commit before Task 1> -- website/` is
      empty.
- [ ] Spec: replace "(plan 26, in progress)" with verified facts; list what stays UNVERIFIED
      (Automatic on real SIMs, the sentence-start key 1 lists if Task 0 could not read them).
- [ ] Plans README row 26 `done`. Completion notes; status `done`.
- [ ] Commit: `docs: complete display languages (plan 26)`.

## Plan 26b outline - T9 Русский and Български (to be written as its own plan)

Not part of this plan; recorded so its scope is not lost.

- **Ownership:** plan 18b D11's `Русский`/`Български` dictionary placeholders move from `26` to
  `26b` (both owner tables), when 18b lands.
- **Clean room (18b D1):** a dirty-room agent who has not read this planning transcript writes a
  `docs/specs/t9-behaviour.md` addendum for Cyrillic T9. It covers key-to-letter maps, the header
  mode text, what Insert word types (Task 0 C's header evidence), the no-match and key 1 rules
  that differ, and stem behaviour from `$REF/captures/plan18b/{russian,bulgarian}` and new
  captures. Implementers follow 18b's protocol.
- **Dictionaries:** Russian from `IlyaSemenov/wikipedia-word-frequency`
  `results/ruwiki-2022-08-29.txt` (MIT, Wikipedia counts; pin commit and SHA-256 as 18b D2),
  filtered to Cyrillic а-я plus the apostrophe rule, through 18b's build. Bulgarian: the repository
  has no `bgwiki` list. Provisional: counts computed with the same MIT tool from a pinned bgwiki
  dump (statistics only, 18b's reasoning). Alternatives: Leipzig `bul_wikipedia` word lists if
  their CC BY 4.0 licence is confirmed. Rejected: hermitdave/FrequencyWords and wordfreq (CC BY-SA).
- **Entry points:** `@hellotimber/nokia-os/t9-russian`, `/t9-bulgarian`; `StockPhoneConfig.t9`
  gains `russian?`, `bulgarian?` (18b D5's shape).
- **Depends on:** 18b, 26.

## Follow-up plan adjustments

- **17 - Profiles:** default profile names are firmware text (localised); renamed names are user
  text. The label seam's typed names pass through D2's rule. Profiles' strings follow D9.
- **18 - Messages I:** the editor reads `multitapKeys(language)` (Task 7); SMS payload coding
  per Task 0 C. Messages' strings are replayed here (Task 0 B).
- **18b - T9:** D11's owner becomes `26b`. The T9 language stays independent of the display
  language (spec 13), and multi-tap follows the display language (L8).
- **18c, 19, 21, 22, 24, 25, 27, 28:** follow D9: declare `languages.replay`, add catalogue entries
  through `import-languages`, clear `untranslated:<NN>`. Composed strings with user text (`Erase
<name>?`) keep the user part in a separate model field, so the firmware part stays a catalogue
  string.
- **20 - Calculator:** its Options and notes are replayed here (Task 0 B); `Out of range` keeps
  keying its warning tone in English (D2).
- **Portfolio integration:** a host that wants a Cyrillic start seeds storage (D14).

## Open questions for Lachlan

Resolved provisionally so execution is not blocked; each is cheap to reverse.

1. **Automatic (D1):** English, because no SIM language code selects Cyrillic on this pack in the
   emulator (L5). Reverse: a `simLanguage` port that maps a SIM's EF_LP to a pack language.
2. **Golden volume (D5):** a covering sample (≈250 stills per language, ≈1-1.5 MB) with the full
   replay as text only. Reverse: import every replayed image as a golden (≈18 MB per language for
   plan 14 alone).
3. **Localisation boundary (D2):** English text as identity, localised at the kernel wrapper and
   the flow. Reverse: per-language source trees and semantic string ids.
4. **Strings of unmerged plans (D9):** each plan translates its own; until then English shows in a
   Cyrillic UI and the guard lists them. Reverse: block plan 26's closeout until every plan's
   strings are in.
5. **T9 Cyrillic (26b):** a separate plan; Bulgarian list source provisional (26b outline).
6. **Public API (D14):** none. Reverse: export `StockLanguage` and a `language` config seed.
7. **Catalogue bundling:** the three tables ship in the main entry (≈30-40 KB each, before gzip).
   Reverse: lazy entry points like 18b's dictionaries.

## Conflicts found while planning

- `src/firmware/generated/stock-tree.ts` and the menu-tree spec read 6-2-1-4's note as `Γотово`
  with a Greek Γ; the firmware string is Bulgarian `Готово` (L13, D6).
- Plan 15's spec says Restore keeps the language (v5.79 evidence), but `factorySettings` resets
  every choice; v6.39 keeps it (L7, D11).
- Plan 14's leaf table says the native-language choices show a "native-language note". The note
  is the ordinary `Done` tick note drawn in the new language (L2).
- Plan 18b D11 owns the Cyrillic dictionaries as `26`; they move to `26b`.
- `docs/specs/t9-behaviour.md` §13 says T9's language is independent of the display language;
  the multi-tap alphabet, by contrast, follows the display language (L8). Both hold.
- Plan 15 D12 assigned only 6-2-1-3…5 to plan 26. The text of every other screen comes with
  them, which is this plan's main work.

## Done means

- Every Language choice works as captured: the note in the new language, then the page; Automatic
  is English; the choice persists and survives Restore.
- Every screen nokia-os draws for plans 13-16, 18, 20 and 23 is in the display language, from a
  catalogue generated from per-language captures; English-keyed tables and note sounds work
  unchanged.
- The fonts hold every Cyrillic character the UI and multi-tap need, harvested from goldens.
- Multi-tap types the display language's cycles, with the Cyrillic header modes.
- Every `languages/*` golden passes; no golden or placeholder names plan 26; the coverage guard
  accounts for every registered English string.
- phone-core's change is optional and type-only; the website is unchanged; `vp check`,
  `vp run -r test` and `vp run website#build` pass; VISION, AGENTS.md, the specs and the plans
  README match what shipped.
