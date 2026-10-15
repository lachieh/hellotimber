# T9 predictive text (plan 18b)

Source: plan 18b Task 0's v6.39 emulator captures (`$REF/captures/plan18b/`, dirty room only),
imported as committed goldens (`goldens/index/18b.json`: `t9/*`) by plan 18b Task 2. The behaviour
is specified in [T9 behaviour](../t9-behaviour.md), the clean-room specification; this file lists
the findings that shape the implementation and, once the plan is done, what the goldens verify.

The shipped English dictionary is not the firmware's: it is built from an openly licensed
word-frequency list (plan 18b D2, D3). Which words a key sequence offers, and their order, may
therefore differ from the firmware (T9 behaviour, section 15).

## Findings (plan 18b planning investigation, 2026-10-14)

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
| T10 | No commit timeout; no T9-specific sound; Dictionary off persists across power cycles; English on shows `T9 dictionary activated` (corrected)    | 4, 10, 12 |

## What the goldens verify (plan 18b Tasks 6-8)

`@hellotimber/nokia-os` plays every `t9/*` golden's keys on a stock phone with the open-list
dictionary: 302 of 303 match pixel for pixel (stills in either cursor-blink phase, recordings by
the fidelity standard of `AGENTS.md`).
Beyond the spec they show:

- The underline covers the typed letters' cells without the last one's blank column (key 1's `1`
  from x 1 to x 5), on the line's tenth row. A user word's completion is not underlined; its
  untyped letters and the `?` wrap as a word of their own, kept on the line while they fit its
  whole width (`inun?` ending at x 81 stays; `Into` + `s?` breaks after `Into`).
- No `?` display shows the cursor; in 123 the header is multi-tap's (plain pen, `123` from x 14);
  the symbol table opened from the T9 editor has the T9 header.
- The mode text after any key-1 or letter key is `abc`; the empty editor and the text's start show
  `Abc`; a held digit leaves the mode; a held digit undoes its press and types the digit (`5`,
  held `0`: `50`).
- English chosen in the Dictionary list shows `T9 dictionary activated` (the tick note, ≈656/232/
  488 ms), then the T9 editor; after a note the editor's cursor blink starts over, shown.
- Restore factory settings keeps the Dictionary choice (`sms/restore`, plan 18).

Unexplained (known gap): after `Into ` a short `*` leaves one lit pixel at the cursor's column on
the underline row (`g-star-free/07-star-after-space`); the empty editor's second `*` shows none.
