# T9 predictive text (plan 18b, in progress)

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
