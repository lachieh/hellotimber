# T9 predictive text on the Nokia 3310 (v6.39): behaviour and dictionary architecture

This is the clean-room specification for plan 18b. It describes what the v6.39 firmware's T9 text
entry does and how its English dictionary is organised, in enough detail to build a faithful engine
with a dictionary of our own. It was written from a study of the firmware and from emulator
captures (2026-10-14). Implementers of plan 18b work from this file, the plan, the repository and
the committed goldens only (see the plan's clean-room protocol).

**Clean-room rules for this file.** It contains no dictionary content beyond what a behaviour
needs, no byte dumps, no decoded tables, no addresses and no firmware code. Examples use a few
common English words. Counts and distributions describe the firmware's dictionary statistically.
Where a statement rests on a single observation or was not tested, it says so (UNVERIFIED).

Terms used below:

- **key sequence**: the letter keys pressed for the word being written, 2-9 plus 1 (section 7).
- **candidate list**: the strings the firmware offers for a key sequence, in order.
- **word** and **stem**: a candidate is a complete word, or a stem, the first letters of a longer
  word (`hom` while typing `home`).
- **composing word**: the word at the cursor that T9 is still building; `*`, `C` and the letter
  keys act on it.
- **no-match state**: the editor after a letter key that no candidate can follow (section 6).
- **user word**: a word the user added with Spell or Insert word (section 11).

Coordinates are LCD pixels (84x48, x right, y down). Fonts and editor layout are plan 18's. Times
are emulated milliseconds.

## 1. Where T9 is used, and its first screen

- Write messages (Messages 2-1) opens in T9 mode in the virgin phone: the header shows the T9
  icon (a pen with three bars, x 0..17, y 0..5), the mode text `Abc` in the 6-row face from x 21,
  and the counter `459/1` right-aligned. The text area is empty, the cursor blinks at x 1 of the
  first text line, and the soft key is `Options`.
- Plan 18's multi-tap header has the plain pen (x 1..9) and the mode text from x 14. The T9
  header differs only in the icon and the text position.
- Options › Dictionary sets the mode for every editor that offers it: `Dictionary off`, `English`,
  `Русский`, `Български`, in that order, opening on the current choice. The choice is stored in the
  phone's memory and is the same for all messages (UNVERIFIED for other editors, see 15).
- The Welcome note editor has no T9 (plan 18).

## 2. Keys and letters

T9 maps each letter key to its letters and nothing else:

| Key | T9 letters (English)                                                    |
| --- | ----------------------------------------------------------------------- |
| 2   | a b c                                                                   |
| 3   | d e f                                                                   |
| 4   | g h i                                                                   |
| 5   | j k l                                                                   |
| 6   | m n o                                                                   |
| 7   | p q r s                                                                 |
| 8   | t u v                                                                   |
| 9   | w x y z                                                                 |
| 1   | inside a word: apostrophe and full stop; alone: punctuation (section 7) |
| 0   | not a letter: space, which also ends the composing word (section 5)     |

- The English dictionary has no accented letters and no letters outside a-z. Accented letters
  reach the text only through multi-tap: the symbol table, held keys in multi-tap mode, and the
  Insert word prompt, which uses plan 18's multi-tap cycles. A user word containing an accented
  letter is matched through the key that carries the letter in plan 18's table (UNVERIFIED).
- Each key's digit is the last candidate when the key sequence is that single key (section 3.4).
- The Russian and Bulgarian dictionaries map the keys to Cyrillic letters. They are outside plan
  18b's scope (section 13).

## 3. The candidate list

### 3.1 Contents and order

For a key sequence of n keys the firmware offers, in this order:

1. **Complete words of exactly n letters** that the sequence spells, most frequent first.
2. **Stems**: the first n letters of longer words whose first n keys are the sequence, ordered by
   how common the words they begin are. A stem that is also a complete word appears once, as the
   word.
3. **User words** (section 11): a user word of exactly n letters is placed second, directly after
   the first built-in candidate. User words with more than n letters whose keys begin with the
   sequence are appended after everything else, shown in full.

Measured against an independent English frequency list, the firmware's lists put every complete
word before every stem in 94% of the lists with more than one entry; the remaining 6% are
misclassifications by the comparison (rare words counted as stems), not observed reversals. Pairs
of complete words in one list follow the independent frequency order in 78% of cases, and stems in
80% when stems are ranked by the total frequency of the words they begin (78% by the most
frequent such word). The engine should rank stems by the total.

Example: `4 6 6 3` offers four-letter words such as _good_, _home_ and _gone_ first, then the
first four letters of longer words (the stem of _immediately_, for one). `4 6 8 6` offers _into_
and _goto_, then stems.

### 3.2 Length

- At most 32 candidates are considered per list. Observed lists are much shorter: over the 24,657
  key sequences of the words among the 50,000 most frequent English words that the dictionary
  holds, a list has 1 candidate in 62.6% of sequences, 2 in 27.8%, 3 in 5.1%, 4 in 1.7%, 5 in
  1.1%, and 6-15 in the remaining 1.7%. The longest list in the database holds 15.
- A key sequence is at most 32 keys. The 33rd letter key puts the editor in the no-match state.

### 3.3 What counts as a match

- A key sequence has a list when at least one candidate exists; it then shows the first. While a
  longer word is typed the display shows the best candidate for the keys so far, which may be a
  stem of that word or another word (typing _into_ shows `i`, `in`, `got`, then `into`).
- The firmware's dictionary is compressed by sharing structure between sequences (section 14.3),
  which makes it offer a few nonsense stems for sequences no real word follows. A new engine
  should not reproduce them: lists should contain real words and their stems only.

### 3.4 Single keys

- A one-key sequence lists the key's letters, ranked like any list, followed by the key's digit
  (`2` gives _a_, then two more letters, then `2`).
- The last entry of a one-key list has no `?` (section 4.2).

## 4. Display

### 4.1 The composing word

- The composing word is drawn in the editor's small face like committed text, in the current
  candidate, with each letter's case as it was typed (section 8).
- It is underlined: a 1-pixel line on the text line's tenth row (y = line top + 8, the cursor's
  bottom row), from the word's first ink column to its last. Committed words are not underlined.
- The cursor (plan 18's 1x10 bar) stays at the end of the composing word and keeps blinking every
  ≈480 ms while the word is composed.
- There is no commit timeout: a composing word stays composing until a key ends it (section 5).
  A 3 s recording after the last key shows only the cursor blink.
- The counter counts the composing word's letters as they are typed: each letter key lowers it
  by one; `*` leaves it unchanged unless the new candidate's length differs.

### 4.2 The end of the list: `?` and Spell

- When `*` reaches the last candidate of a sequence of two keys or more, the firmware draws it
  followed by `?` (small face, normal spacing, not underlined), and the soft key changes from
  `Options` to `Spell`. The `?` is not part of the text and is not counted.
- The next `*` goes back to the first candidate (`?` gone, soft key `Options`).
- A list with one candidate shows it plainly after typing; the first `*` shows it with `?` and
  `Spell`, and every further `*` shows the same.
- The first `*` never shows `?` on a one-key sequence (section 3.4).

### 4.3 Indicators

- The header keeps the T9 icon while T9 is on. The mode text shows `Abc`, `abc`, `ABC` or `123`
  (section 8). The counter is plan 18's.
- No other indicator shows the T9 state. The no-match state shows only the `?` and `Spell`.

## 5. Keys while a word is composed

| Key                   | Effect                                                                                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2-9                   | Add the key to the sequence and show the new list's first candidate (no-match: section 6).                                                                               |
| `*`                   | Next candidate (sections 4.2, 6). The case pattern of the typed letters is kept.                                                                                         |
| `0`                   | End the word as displayed, then insert a space. The cursor follows the space.                                                                                            |
| `1`                   | Add key 1 to the sequence (section 7).                                                                                                                                   |
| `#`                   | Toggle the case for the next letters (section 8). The composing word does not change.                                                                                    |
| held `#`              | Number mode `123` on (held again: back to the text mode it left). Digits insert directly; the next letter key starts a new composing word with no space.                 |
| held 0-9              | End the composing word and insert the digit.                                                                                                                             |
| `C`                   | Remove the last key of the sequence and show the shorter sequence's first candidate. Removing the only key removes the word. `C` on an empty editor leaves it (plan 18). |
| held `C`              | Clear the whole text (plan 18 timing).                                                                                                                                   |
| ▲ / ▼                 | End the composing word and move the cursor (section 9).                                                                                                                  |
| Options               | The Options list with Matches (section 10).                                                                                                                              |
| Spell (no-match, `?`) | The Insert word prompt (section 10.3).                                                                                                                                   |

With no composing word: `0` inserts a space; `1` starts a punctuation word (section 7); a short
`*` does nothing (it never opens the symbol table in T9); **held `*`** (held ≈1.5 s in the
capture) opens plan 18's symbol table, and `C` closes it without inserting. Held `*` while a word
is composing is UNVERIFIED.

## 6. Keys that match nothing

- **One key typed.** If the second key has no list for the two keys, it is ignored silently: the
  display does not change, no `?`, and a later key continues from the one key.
- **Two keys or more.** A letter key with no list puts the editor in the no-match state: the
  sequence keeps its keys without the new one, the display shows the candidate that was displayed
  (the first, or the one `*` had reached) followed by `?`, and the soft key becomes `Spell`. Every
  further letter key is ignored until the state ends.
- **`*` in the no-match state** leaves the state and continues with the current list (verified
  when the first candidate was displayed):
  - three candidates or more: the first `*` shows the second candidate, as from a normal display
    of the first;
  - two candidates: the first `*` shows the first candidate again with `?`; the next `*` shows it
    plain and cycling continues normally;
  - one candidate: every `*` shows it with `?`.
- **Spell** opens the Insert word prompt (section 10.3).
- **`0`** ends the state: the displayed candidate is committed without the `?`, followed by a
  space.
- **`C`** ends the state and removes the last kept key (the rejected key is already gone): the
  display shows the shorter sequence's first candidate.

## 7. Key 1: punctuation and apostrophes

- **Key 1 with no composing word** starts a punctuation candidate list: `.` `,` `-` `?` `!` `'`
  `@` `:` and finally `1`. `*` cycles it. No `?` marker (it is a one-key list).
- **Key 1 as the last key of a composing word** offers the word as displayed followed by each of
  the eight marks in the order above (`into.`, `into,`, ... `into:`), then the dictionary entries
  for the whole sequence (words or stems ending in `.` or `'`), skipping any already listed. The
  `?` belongs to the last entry of this list counted before duplicates are skipped: when the
  dictionary's last entry is a duplicate (for example the stem `don'` after `don'` was offered as
  word + mark), no entry shows `?`, and `*` from the eighth mark wraps to the first. `0` commits
  the chosen mark with the word and adds a space; the next word starts in sentence case only after
  `.`, `?` or `!` (section 8).
- **Key 1 followed by more letter keys** first offers dictionary entries that contain the mark
  (contractions such as _don't_, spelt with the apostrophe). After them the firmware offers
  compositions of the word before the mark, the mark, and a candidate for the keys after it
  (`don't` first, then forms such as `don.t`). The exact set and order of the compositions are
  not fully determined (see 15). An engine may list the dictionary contractions first; then, for
  each candidate of the keys after the mark, the word before the mark joined to it by `'`; then
  the same joined by `.`; without duplicates and at most 32 entries.
- Two or more presses of 1 in a row (`..`, `.,`) behave as a punctuation word whose first mark is
  fixed: the following presses cycle the last mark.

## 8. Case

- Modes: `Abc` (sentence case), `abc`, `ABC`, and number mode `123`. The editor starts in `Abc`.
- In `Abc` the first letter of a word that starts a sentence is upper case; after that letter the
  mode text shows `abc`. A sentence starts at the beginning of the text and after `.`, `?` or `!`
  followed by a space (verified for `.`). `,` does not start a sentence.
- `#` toggles between a lower and an upper mode, and the upper mode depends on the cursor:
  - at the start of a word (empty text, after a space, no composing word): `Abc` ↔ `abc`;
  - inside a composing word: `abc` ↔ `ABC`.
- The case is fixed per letter when its key is pressed. Pressing `#` in the middle of a word makes
  only the following letters upper case; `*` keeps that per-position pattern for every candidate
  (typing three letters, `#`, a fourth letter, then `*` gives a candidate whose fourth letter is
  upper case).
- Number mode (held `#`): the mode text is `123`, digits insert directly, and held `#` returns to
  the previous text mode. A word typed straight after digits joins them (no space) and is not
  capitalised.
- `ABC` lasts for the composing word only: after `0` the next word is lower case (`abc`), unless a
  sentence starts.
- User words keep the case they were typed with in the prompt (a user word saved as `Intos` shows
  `Intos` even mid-sentence).

## 9. Editing committed text in T9

- **C across words.** `C` with no composing word deletes the character left of the cursor. When
  that leaves the cursor directly after a word (the space after it was deleted), the word becomes
  the composing word again: it is underlined, its key sequence is the keys of its letters, `C`
  removes its last key, and `*` cycles that sequence's list.
- **▲ and ▼ move by word stops**, not by characters, in T9 mode. For a text of words w1 ... wk
  the stops, in text order, are: start of w1, end of w1, start of w2, end of w2, ..., end of wk,
  and finally the end of the text with no composing word. ▲ moves to the next stop and wraps from
  the last to the first; ▼ moves to the previous stop, skips the final "end of text" stop, and
  wraps from the start of w1 to the end of wk.
  - a stop at the end of a word makes that word the composing word (underlined, cursor after it;
    `*` cycles its alternatives, `C` shortens it and shows the shorter sequence's first
    candidate, `0` ends it and inserts a space at the cursor);
  - any other stop leaves no composing word;
  - with "Into into" composing its second word: ▼ gives start of word 2, end of word 1
    (composing), start of text, then end of word 2 (composing) again; ▲ gives end of text, start
    of text, end of word 1 (composing), start of word 2, end of word 2 (composing). The direction
    is opposite to the user guide (plan 18 S7 reports the same for multi-tap).
- **Typing in the middle.** A letter key at a word start or between words starts a new composing
  word at the cursor; it is matched on its own keys and is not joined to the following letters for
  matching (`4` at the start of a word _into_ shows `i` directly before it; `*` cycles the one-key
  list; `0` then inserts a space after the new word).

## 10. Options with T9

### 10.1 The Options list

- Empty T9 editor (12 entries, indicator = entry number): Send, Send to many, Template, Insert
  smiley, Insert word, Insert number, Insert symbol, Dictionary, Send by set, Save, Erase, Exit.
- With a composing word (13): `Matches` is inserted after Insert smiley.
- In multi-tap (Dictionary off) the list has no Insert word, Insert number, Insert symbol or
  Matches: Send, Send to many, Template, Insert smiley, Dictionary, Send by set, Save, Erase, Exit
  (from the captures; plan 18 owns it).
- Matches is offered whenever a word is composing, also when its list has one candidate.

### 10.2 Matches

- A list of the composing word's candidates starting with the one after the current, wrapping, so
  the current candidate is last (for a five-entry list: entries 2, 3, 4, 5, 1). The index
  indicator counts from 1. The soft key is `Use`; `Use` replaces the composing word with the
  selected candidate and returns to the editor with the word still composing. `C` returns without
  change.

### 10.3 Insert word and Spell

- Options › Insert word, and the `Spell` soft key, open the `Insert word:` prompt: plan 18's
  text-input layout (prompt text at the top, a full-width box below, soft key `OK`), with the
  multi-tap header (plain pen, mode text from x 14) and plan 18's multi-tap entry, its case mode
  following the editor's (sentence case at a sentence start).
- From Spell the prompt opens empty; the composing word is not copied in.
- `OK` with text inserts it at the cursor (from Spell it replaces the composing word), returns to
  the editor and stores it as a user word. `OK` on an empty prompt and `C` on an empty prompt
  return to the editor unchanged.
- The stored user word is the whole word around the cursor after the insertion: inserting next to
  existing letters stores the joined word.

### 10.4 Dictionary

- `Dictionary off` shows `T9 / dictionary / deactivated` (large, tick icon; ≈657/232/504 ms
  phases as plan 18 S2) and switches the editor to multi-tap. The choice survives a power cycle.
  Text typed so far stays (verified with no composing word).
- `English` (from off) switches back to T9 at once: no note, the editor is redrawn within ≈90 ms
  with the T9 header.
- `Русский` and `Български` switch T9 to those dictionaries: the header's mode text becomes the
  Cyrillic one and the keys spell Cyrillic. Out of scope for 18b (section 13).

## 11. The user dictionary

- Words added with Insert word or Spell are kept separately from the text: clearing the text,
  leaving the editor and writing a new message keep them.
- Across a power cycle the evidence is negative and UNVERIFIED for a real phone: in the emulator a
  user word was gone after a cold boot from the saved memory in three variants (saved while in the
  editor, at standby, and during the phone's own switch-off), while the Dictionary choice saved the
  same way was kept. The virgin memory image may lack a user-dictionary area, or the store may be
  held elsewhere. The reimplementation's choice is the plan's (18b D7).
- They take part in matching as section 3.1 says: second place for an exact-length user word, full
  completions at the end of longer sequences' lists. A user word alone on a sequence (no built-in
  candidate) is the whole list.
- Several exact-length user words on one sequence follow the first built-in candidate in the
  order they were added (oldest first), then the remaining built-in candidates.
- Capacity is a byte budget, not a word count, and the oldest words are dropped first. With
  four-letter words the first word was gone after 170 additions and present after 165; with
  eight-letter words, gone after 100 and present after 90. Both fit a budget of about 840 bytes
  where a word costs its length plus one (UNVERIFIED as an exact rule; 1,000 bytes at two per word
  fits the four-letter case only).

## 12. Timings and sounds

- Letter keys and `*` redraw within about 0.1 s of the key (the captures show the new word 51-117
  ms after the key; plan 14 D8: key-to-redraw latency is not reproduced).
- Cursor blink ≈480 ms per phase, also while composing.
- No commit timeout (4.1). No timer runs in the no-match state.
- No T9-specific sound. Every key press, including `*`, a no-match key and Spell, gives the same
  keypad tone (900 Hz for ≈142 ms at the virgin level) that plan 16 plays for any key; there is no
  error beep for a no-match key (`g-audio`).

## 13. Languages

- The v6.39 language packs carry T9 dictionaries per language. Pack E (English UI plus Russian,
  Bulgarian and Ukrainian) has English, Russian and Bulgarian dictionaries: the Dictionary list
  has no Ukrainian entry. Other packs carry other sets (for example Danish, Finnish, Norwegian and
  Swedish; German, French, Dutch, Italian and Turkish), and two packs carry a US English
  dictionary of the same size instead of the British one.
- The English dictionary is byte-identical in the 20 packs that have it.
- The T9 language is independent of the phone's display language.

## 14. The firmware's dictionary (architecture, abstract)

### 14.1 Container

- Each language pack holds one dictionary container with one sub-database per T9 language. In pack
  E the container is 301,792 bytes: English 36,752, Russian 128,606, Bulgarian 136,401.
- An English sub-database has: a small header (format version, language id, the sizes and
  offsets of its sections); the key-to-letter tables; the coding tables of 14.4; the punctuation
  list for key 1; and the node data, 35,229 bytes, 96% of the total.

### 14.2 Structure

- The dictionary is a graph of nodes, one per key sequence prefix. Each node lists, for every key
  that can follow, how to build that key's candidate list from the current node's list, and where
  that key's node is.
- A candidate list is built by **instructions**, one per new candidate, in rank order. An
  instruction says which candidate of the parent list to extend and which letter of the new key to
  add. The order of the instructions is the ranking: no frequencies are stored.
- Root to depth n spells every candidate of every n-key sequence; a candidate's letters are
  recovered by following its chain of parent references back to the root.
- The English graph has 2,609 distinct nodes, 14,387 child entries and 26,644 instructions. A
  child entry's instruction list has 1 instruction in 57% of entries, 2 in 25%, 3 in 9%, 4-6 in
  7.7% and 7-15 in 2%.
- Nodes are shared: 1,370 nodes are reached from more than one parent, and three generic nodes
  are reached from about 450, 1,200 and 2,500 parents. Sharing is what makes the database small,
  and also why it offers occasional nonsense stems (3.3).

### 14.3 Letters and ranking contexts

- Within a key, letters are numbered in a fixed per-key order (by overall frequency, not
  alphabetical), and an instruction names a letter by that number.
- The number is further permuted by context: for the first four letters of a key, the mapping
  depends on the previous key and on which letter of it the parent candidate ends with (256
  contexts of 2-bit permutations). This lets the most likely letter in each context take the
  shortest code.
- The tree's alphabet is a-z, the apostrophe and full stop on key 1, and each key's digit.

### 14.4 Coding

- Node data is a stream of 4-bit units. Numbers use a variable-length code whose thresholds are in
  the header, so small values take one unit.
- The 64 most frequent instructions (parent position, letter) are coded as an index into a table;
  an index skips table entries already used in the same list. Rare instructions use an escape and
  a 9-bit literal (5 bits of parent position, so at most 32 parents, and 4 bits of letter).
- The set of keys that follow a node is coded as an index into a table of the 143 most frequent
  sets, or as a 12-bit literal.
- A child's location is: inline (immediately after the node), one of two very common targets, or
  a (size class, index) pair into 68 classes of equally sized nodes.

### 14.5 Coverage (measured with an independent English frequency list)

| Most frequent English words | Found among the firmware's candidates | Shown first |
| --------------------------- | ------------------------------------- | ----------- |
| 1,000                       | 99.8%                                 | 93.9%       |
| 5,000                       | 97.8%                                 | 91.0%       |
| 10,000                      | 92.9%                                 | 85.3%       |
| 20,000                      | 81.3%                                 | 73.1%       |
| 50,000                      | 58.2%                                 | 50.8%       |

The firmware vocabulary is therefore of the order of 20,000-30,000 words including inflected
forms, weighted to everyday English (contractions such as _don't_ and _won't_ are present), with
word lengths of 1-20 letters (most 5-9).

## 15. Guidance for a new engine

Must match the firmware (asserted by goldens): the key and display rules of sections 1-12; the
ordering model (words, then stems, then user completions; exact user words second); the `?`/Spell
rules; the no-match rules including the one-key and two-candidate cases; the 32-key and 32-entry
limits; key 1 alone and after a word; case and editing rules.

May differ (dictionary-dependent): which words exist and their order, which stems are offered,
single-key letter order, and the compositions after key 1 inside a word. Goldens that depend on
these use key sequences whose lists an open English frequency list is expected to share with the
firmware; the rest are mechanics-only or pending (plan 18b).

Open (UNVERIFIED): the exact composition rule of 7; the user dictionary's exact budget and its
persistence across power cycles (11); accented user words (2); held `*` while composing (5); T9 in
editors other than Write messages (Reply, Forward and Edit open the same editor; Chat is 18c).
