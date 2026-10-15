# Phone book (plan 19)

Source: plan 19 Task 0's v6.39 emulator captures under `$REF/captures/6.39/plan19/` (eight
invented SIM fixtures passed to the emulator as `SWSIM_FS`), documented in
[plan 19](../../plans/19-phone-book.md#task-0---canonical-ref-captures-no-repository-changes),
and plan 14's empty-SIM goldens (`tree/01-phone-book/*`). Facts marked "(plan 19, in progress)"
are measured on the captures but not yet asserted by a golden scenario.

## The SIM is the phone book

v6.39 keeps names on the SIM only (`EF_ADN`). There is no phone memory: Options lists Type of view
and Memory status, and Memory status shows `SIM card:` / `<n> free` / `<n> in use` and nothing
else. The DCT3 strings `Saved to phone memory` and `Save to another memory?` are never reached.
The emulator SIM has 50 locations of 30 bytes: 16-character names and 20 digits. A SIM number
holds `0-9 * # p` after an optional `+`; saving a `w` shows `Invalid char. for SIM card`. Names are
the GSM alphabet; `€` is stored. An entry may have a name without a number or a number without a
name (the list then shows the number in the name's place). Service Nos. lists the SIM's `EF_SDN`.

Speed dials and assigned ringing tones are phone memory. They survive a cold boot and Restore
factory settings, and do not show with another SIM (`sim/second-*`). Whether the phone forgets
them when the SIM changes is UNVERIFIED; nokia-os keeps them per SIM identity.

## Standby keys

**▼ opens the name list; ▲ shows `No last dialled numbers`** (or the dialled numbers, plan 22).
The helpdoc's "Scroll keys" page names both actions with the arrow glyphs stripped, so the
spec's §6 once guessed the reverse. Both keys first show standby with the signal and battery
ladders erased for ≈23 ms (22-37 ms over 16 presses). A key in that frame acts on the list once
it opens. With an empty SIM ▼ shows `No phone numbers` (≈2.90 s), then standby. C in the list
returns to standby through an 85 ms frame of standby without its operator line; C held shows
that frame twice (at the press and ≈530 ms later).

## Sort order

1. Leading spaces are skipped.
2. Characters compare in this order: space; letters case-insensitively, accents folded to their
   letter (`Ä Å à → a`, `É → e`, `Ñ → n`, `Ö Ø → o`, `ü → u`); digits; then every other character
   by its code (`-` < `.` < `_`).
3. A name that is a prefix of another sorts equal to it (SIM order decides: after Edit › Replace
   `annab` at `anna`'s location 2 comes before `Ånna` at 14; added at location 24, after it).
4. Equal keys keep SIM order (`Zed`, `zed`; `Ånna`, `Anna`, `anna`; `Ben`, `ben`, `Ben`).

Folding for the accented letters not in the `sort` fixture (`Æ`, `Ç`, `ß`, …) follows the same rule
by analogy (UNVERIFIED). A name starting with GSM `@` (byte 0x00) breaks the firmware's order (an
artefact); nokia-os sorts `@` by its code.

## The name list

Three views, chosen by Options › Type of view (virgin: Large font). Every flow that opens it
starts on the first name (a found name after Search). ▲/▼ move one name and wrap. (plan 19, in
progress)

- **Large font:** the phone-book icon top left, the name in the large face from x 1, top 7,
  broken by character onto a second line (`Abcdefghijklm` / `nop`), the flow's soft key.
- **Name list:** three full-width rows (no rail, no indicator), small face, the selected row
  inverted, a long name cut with a dotted ellipsis; plan 14's circular rows window.
- **Name, number:** the name in the small face from x 0, wrapped after 15 characters; the number
  right-aligned in the small face on the lines the name leaves (of three), showing its last 14
  digits per line (`12345` / `67890123456789`).

Soft keys: `Call` (standby, Search, after `Saved`/`Replaced`), `Erase`, `Edit`, `Send`, `Select`
(Speed dials), `OK` (Search from a number prompt), `Add voice tag`.

**Letter keys:** 2-9 type a one-letter query from the key's upper-case multi-tap cycle
(`J K L 5 £`, plan 18's commit timeout); another key, or a press after the commit, starts a new
one-letter query. `0`, `1`, `*`, `#` do nothing. The list jumps to the first name whose key is at
or after the letter, else to the first name, ≈190 ms after the key. In Name list view a name
inside the window keeps the window; otherwise the highlight keeps its row.

## Search

`Name:` (pen, `Abc`, a box with the typed letters in the large face, `OK`; multi-tap, `#` and the
symbol table as in plan 18). OK opens the list on the first name at or after the query (case and
accents folded), else the first name: `Bz` → Carl, `M` → Pause, `zz` → 1st, an empty query → the
first name. In Name list view the found name is on the top row. C on the empty prompt returns to
the Phone book level; C held returns to standby. With an empty SIM: `No phone numbers` (≈2.88 s),
then the level.

## Add name

`Name:` counts the SIM's name length down (16 → 0; the 17th key is ignored); a name wider than
the large-face box drops to two lines. OK → `Phone number:` (counter 20, soft key `OK` even when
empty). OK → `Saved` (tick: frames at 0, ≈684, ≈919 ms) for ≈2.85 s → the list on the new name
with `Call`. Add fills the first free location.

- Name and number empty: `Nothing to save` (≈2.92 s, the 1750 Hz warning tone), then the level.
- C on the empty `Name:` or the empty `Phone number:` returns to the level.
- A name equal to an existing one asks `Replace?` / that name (▲/▼ inert): OK → `Replaced` (as
  `Saved`), C → `Name:` with the text.
- A full SIM: `Memory full` (≈2.83 s, warning tone) → `Replace?` browsing the names sorted (▲
  wraps to the last); OK replaces the shown name (`Saved`), C → `Name:` with the text.

## Erase

**One by one:** the list with `Erase` → `Erase?` / the name (small) with `OK` → `Erased` (the
bin: nine frames ≈232 ms apart, ≈2.91 s) → the list on the next name (the first after the last).
C on `Erase?` returns to the list. Erasing the last name shows `Memory erased` with the bin's
timing, then the level. **Erase all:** `Are you sure?` → `Security code:` → `Erasing memory` (the
hatched bar, steps at 0, 360, 748, 1131, 1554, 1906, 2251 ms) → `Memory erased` (tick) for
≈2.92 s → the Erase level. A wrong code: `Code error`, then the prompt. With an empty SIM both
show `No phone numbers`. Erasing a name drops its speed dial; its location keeps its tone.

## Edit

The list with `Edit` → `Name:` with the name (counter 16 − length) → `Phone number:` with the
number. An unchanged name saves at once (`Saved`). A changed (or emptied) name asks `Replace` /
`Add` (rows, `Select`; C → `Name:` with the text): both show `Saved`; Add on a full SIM shows
`Memory full` → `Replace?`. Name and number both emptied: `Nothing to save`, then `Name:` with
the old name. The list afterwards is on the edited name with `Edit`. A tone and a speed dial
follow the entry through Replace.

## Assign tone

One page per name, sorted: the name in the small face from x 0, its tone in the thin face at the
lower right, `Assign`. Assign opens the list `No tone` (1-6-1), `Default` (1-6-2), then the
ringing tone list (1-6-3 … 1-6-44, its last entries the composer's `(empty)` slots), on the
name's tone. ▲/▼ preview the highlighted entry ≈990 ms later (the first move too): a tone plays
as Tones › Ringing tone previews it, `Default` the profile's ringing tone, `No tone` a 1750 Hz
beep (≈340 ms), an `(empty)` slot nothing. OK → `Done` (tick: 0, ≈670, ≈902 ms) for ≈1.40 s →
the page with the tone. Tones belong to the SIM location: a new name in an erased location
inherits it.

## Send b'card

The list with `Send` → a 33 ms frame with only `OK` → `Phone number:` (counter 30, `Search`: the
name list with `OK`, then the chosen number filled) → OK → `Sending b'card` (plan 18's bar) for
the link time, **3240 ms** (3237-3359 over six sends, the synthetic cell; UNVERIFIED live) →
`Business card sent` (six frames, ≈1.37 s) → the list on the name.

## Speed dials

`Key 2:` … `Key 9:` with ▲/▼ wrapping. An unassigned key shows SIM location n (its name, or
`(empty)`) with `Assign`. Keys stop at the SIM's last location (a 3-location SIM has keys 2-3;
▼ there hangs the emulator's page, an artefact). Assign → the list with `Select` → `Speed dial
key n saved` (tick, ≈1.40 s) → the key with `Options`: View number (the number in the large
face, `Back`), Change (the list again), Erase (`Erase?` → `Speed dial key n erased`, the bin,
≈2.84 s → the key's fallback with `Assign`). Assign with no names: `No phone numbers`. View
number's digits end at x 82 (the name list's large numbers at x 81). C held on a key, its Options
or View number goes to standby. A name wider than the large face on a key page is not captured;
nokia-os draws it in the small face (UNVERIFIED). Held 2-9
at standby dials the key's entry when Settings › Call settings › Speed dialling is On, else opens
number entry; held 1 dials the voice mailbox (plan 22).

## Voice tags

The emulator has no voice DSP. Add voice tag: the list with `Add voice tag` → `Press Start,
then` / `speak after tone` (`Start`) → `Please` / `speak now` (an icon animating in seven frames
≈190 ms apart, `Quit`) → ≈2.27 s later `Voice system error` (≈2.84 s, 675 Hz DSP beeps) → the
list. Quit and C return to the list. Playback, Change and Erase show `No voice tags saved`.
Start's key beep is the voice DSP's (900 Hz on word 0x7008 for 14 ms, then 0x99B4), and the error's
three beeps are 675 Hz on 0x99B5 (145, 217, 147 ms, 39 and 38 ms apart).

## Notes and sounds

`Saved`, `Replaced`, `Erased`, `Memory erased`, `Speed dial key n saved`/`erased`, `Done` and
`Business card sent` only beep the key. `Nothing to save` and `Memory full` play the 1750 Hz
warning tone (none with Warning tones Off).

## Capture artefacts

| Artefact                                             | Cause                                        | Handling                                      |
| ---------------------------------------------------- | -------------------------------------------- | --------------------------------------------- |
| 50 locations, 16-character names, no service numbers | the emulator SIM (`gsm.json`)                | the default `StockSimCard`; hosts pass theirs |
| Every name in a fixture                              | invented test contacts                       | test inputs only                              |
| `Voice system error` after `Please speak now`        | the emulator has no voice DSP                | reproduced (nokia-os has no microphone)       |
| `Sending b'card` link time                           | synthetic cell timing                        | the phone's link time, UNVERIFIED live        |
| SIM writes lost between emulator processes           | the harness never writes the fixture back    | nokia-os keeps the SIM under its identity     |
| ▼ past a small SIM's last speed-dial key hangs       | the emulator SIM's reply to a missing record | not reproduced                                |
| `Code error` for `12345` in menus (virgin image)     | plan 15's stale code record                  | Erase all's success is a factory capture      |
| A name starting with GSM `@` breaks the order        | byte 0x00 ends the firmware's string compare | not reproduced (`@` sorts by its code)        |
