# Deeper levels and stock widgets (plan 14)

Part of the stock firmware's ground truth ([index](../nokia-3310.md#10-firmware-ground-truth-v639-captures)): the goldens under `packages/nokia-os/goldens/` are authoritative; where this file and a golden disagree, fix this file.

Source: the plan 14 recaptures (`captures/6.39/plan14/`, generator
`captures/scripts/gen_v639_plan14.py`) and `docs/specs/nokia-3310-menu-tree.md`. Everything here
is observed and reproduced by nokia-os pixel for pixel, with timing by the fidelity standard of
`AGENTS.md` after aligning on the first changed frame, against the plan 14 goldens, except the
items listed under "Not reproduced" (known gaps).

**Rows window.** With 3 or fewer items the window never moves. Otherwise it
keeps its position while the selection stays inside it (indices modulo the count); ▼ to the
item just after the bottom row scrolls so the selection is on the bottom row; any other move
outside the window (▲ above it, ▲ from the first item, a shortcut) puts the selection on the top
row. The rule follows the key, not only the position: with 4 items the item after the bottom row
is also the one above the top row, and ▲ to it puts it on the top row (`rowsWindowTop`'s `move`).
Evidence: ▼ past the last item (`Speed dials / Voice tags / Search`), ▲ from the first
(`Voice tags / Search / Service Nos.`), Games and Profiles both ways; for 4 items 7-3 Divert if
not answered and 4-4 Erase recent call lists (`scratch-rows4` probe: ▲ from Activate shows `Set
delay / Activate / Cancel`, ▲ from Cancel with `Cancel / Status / Set delay` shows `Activate /
Cancel / Status`, ▼ past Set delay shows `Status / Set delay / Activate`) and the calculator's
Options (`calculator/options-operator`). The window survives a child submenu or a timed note and
is rebuilt (opening item on top) when the level is entered again.

**Opening selection and softkeys.** Levels and option lists open on their
current value; with more than 3 items the window starts at it (`Maximum time / 1 hour / 6
hours`), otherwise at 0. 19 submenus read `OK` instead of `Select` (Info service, Screen saver,
the divert levels, every profile); option lists read `OK`; info pages `Back` (or `Select` on a
page that opens something); multi-select rows `Mark`/`Unmark`. A list whose virgin-EEPROM value
is invalid opens unset: no rows, index `-0` (`5-2-0`), softkey `Quit`; its first ▼ selects the
first item, its first ▲ the last item on the top row, and closing it without a choice keeps it
unset. Tones settings are the General profile's (choosing in one shows in the other); the other
profiles are independent.

**Shortcut digits.** Digits form menu numbers: at the top level `1` waits ≈2.95 s for a second
digit (10, 11, 12), showing `1` and three dots, then means Phone book; `1 1` is Clock, `1 2`
Profiles; `1 8` and `1 9` show `Invalid shortcut` (≈2.9 s), then standby, where further digits
start a phone number (not reproduced). A digit that selects an entry shows the typed path (`8-6`,
`1-9`) without the softkey and opens it 1427-1502 ms after the digit's redraw (nokia-os: 1460 ms
after the key); an opened submenu shows `<path>-` and three dots for ≈1.47 s, then its index.
`Menu 8 1` plays the Snake II splash first; a digit during a splash only skips it. An
application the shortcut opened takes the digits typed into it at once (Calculator: `Menu 9`,
then `5` 6 ms after it shows reads `5`; Write messages: `Menu 2 1`, then `4 5 6` 0.4-4.1 s after
it opens types `gjm`), and a digit while a leaf is about to open opens it at once and is spent
(`Menu 9 5`: Calculator shows `0` 47 ms after the `5`). An option list is a level to the
firmware: after `Menu 8 6 3` it shows `8-6-3-` and dots, and a digit in that window that numbers
an option stores it (`1`: Shakes Off), draws only the option's label at the bottom right for
≈1.92 s and goes to standby; one that numbers none shows `Invalid shortcut`, then standby
(`Menu 8 6 3 1` typed before the list opens does the same as `1` in it). After the window a digit
in an option list starts a phone number at standby (2026-10-14 probes,
`$REF/captures/scratch-inv/shortcut/`). The label is the thin face at the soft key's top (40),
its last cell ending at x 84 (`Off`'s ink ends at x 82), for 1913 ms (1934 ms after a digit typed
while the list was about to open), then the 8 ms partial draw that closes Invalid shortcut
(edges 5..78) and standby; Shakes' list opens on the stored `Off` afterwards (goldens
`probe/shortcut-m8-6-3-then-1`, `-then-3`, `-1`, `-late-1`). nokia-os: phone-core matches the
digits among a shortcut level's options (`PhoneApplicationSession.shortcutLevel`) as at a menu
level, and every tree option list is one; an option whose OK stores it and shows a timed note or
returns stores it and shows its label, then standby. Entering
Screen saver with Select (5-9 and every profile's 12-n-2-9) shows the level's path with a dash
and three dots (`5-9-`, `12-1-2-9-`) for ≈2.9 s before the selection's number (the firmware
opens a digit window there; nokia-os: the 2948 ms shortcut window); the list works meanwhile (▼
shows `5-9-2`, OK opens Off). The firmware redraws 50-125 ms after a key and runs its timers from
the key, so these delays measured between redraws jitter by tens of milliseconds (window
2920-2948 ms); nokia-os redraws at the key. While a typed `8-6` (Settings,
a pages level) is opening, the firmware draws Settings' first page value `On` over the Games list
(not reproduced).

**Stock widgets.** Layouts measured from the plan 14 goldens (Task 6): notes
draw large text from x 0 at tops 3/18/33 and their icon within x 63..83, y 3..22; progress notes a
hatched bar x 0..83, y 7..14, `small` text at top 18; confirm queries `small` lines from x 0 at
tops 2/12/22 (or 4/13); info pages the page layout with the value in `thin` (last cell ending at
x 78, top 29) and the rail; info screens (`SIM card:`) `small` lines at tops 7/16/25 with no
rail; prompts a mode icon at y 0..5 from x 1, the label in `small` at top 7, and either an entry
frame x 0..83, y 16..36 with the value in `large` at top 23 ending at x 82 (time, date, numbers)
or the value in `large` at top 16 from x 0 (Speed dials `(empty)`); the level bar `Level:` in
`small` at x 5, top 0, with bars within x 5..74, y 13..36; text pages `thin` lines from x 0 at
tops 7/16/25, softkey `More`, no rail. Behaviour:

- _Option lists_: rows with the current value highlighted (no radio glyph); OK applies and shows
  the result, then the page with the new value. Some return without a note (Set delay goes back
  two levels to the Call divert page). Message settings › Set n lists number their entries `1`..
  `6`; the Call divert lists show their parent's path (`7-3-1`). Language › Polish: OK does
  nothing.
- _Setter levels_: Info service (On, Off, Topic index) and Screen saver (Off, On) set their page
  value with a leaf and a note, then return to the page (two levels up); the level opens on the
  stored value. Hide clock and the Time format choices also return to the Clock page; 12-hour
  shows the clock as `10:10 am`.
- _Multi-select_: ☑/☐ marks at x 1..5, band from x 8, text at x 10; the softkey toggles
  (`Unmark` on a marked row); C after a change asks `Save changes?` [Yes].
- _Timed notes_: large text from x 0 at tops 3/18/33 plus an icon. Tick confirmations (`Done`,
  `... erased`, `... selected`) ≈1.45 s in three steps (box ≈690, half ≈232, full ≈545 ms); long
  confirmations (Screen saver `Done`, `Selected profile: ...`) ≈2.9 s; information and error notes
  (`No phone numbers`, `Not allowed`, `Invalid shortcut`) one step ≈2.9 s. Identical notes jitter
  by up to ±17 ms. C dismisses a note and stays on the list; ▼ dismisses it and moves.
- _Progress notes_: `Requesting`/`Searching` with a hatched bar looping ≈271 ms per step and
  `Quit`. C returns at once; Quit after 10 s on `Requesting` shows `Request not confirmed`, then
  standby. The emulator's network never answers (artefact).
- _Confirm queries_: small-face lines; C returns to the list; OK/Yes runs the result (Level 5
  stores only then and shows `Done`; Erase › All shows `Reminder memory empty`; Club Nokia ID
  asks `Club Nokia ID:`).
- _Prompts_: a mode icon, a label, an entry box or value, softkey `OK`/`Search`/`Assign`/`Start`.
  Text and number prompts blink a cursor every ≈480 ms; Search, Speed dials and code prompts do
  not.
- _Info pages_: one value per page, `Back`; a page with `Select` opens its own list.
- _Games_: each game opens with an animated splash (Snake II ≈2.56 s, Space impact ≈2.48 s,
  Bantumi ≈3.46 s, Pairs II ≈3.06 s), skipped by any key. Level: `Level:` and bars. Plan 14
  read ▲/▼ as inert; Snake II's are not (see [snake-ii.md](snake-ii.md); Bantumi's and Pairs II's are
  unmeasured, plan 24).
  Instructions: `More` pages cycle; C leaves. Top score: an animated note that returns by itself
  after ≈5.84 s (or on a key). Snake II returns with New game selected on the bottom row (`Score IDs
/ Instructions / New game`; ▼ during the note lands on Level: `Instructions / New game / Level`);
  Space impact and Pairs II return with New game selected on the top row (`New game / Top score /
Score IDs`).
- _View all_ (Reminders, nothing stored) returns straight to the carousel; the Reminders icon then
  holds 1382 ms before animating (its own return timing).

**Not reproduced** (known gaps; each golden runs as an expected failure): Settings' `On` drawn
over the Games list while `8-6` opens. Within the fidelity standard and not gaps: partial draws
under a display frame (a 16 ms draw after `Menu 8`; Done's 16 ms draw after Type of view) and the
shortcut delays' spread between recordings (Speed dials opening 1427-1502 ms after `9`, the window
ending 2920-2948 ms after `3`). Owned by later plans (pending goldens): standby number entry after Invalid shortcut
(plan 22) and the Reminders level after Erase › All (only `Add new`; plan 21).

**UNVERIFIED** (no capture; nokia-os's choice): ▲/▼ during a note on rows levels (nokia-os only
dismisses; P6 probed pages), C on `Requesting`, other keys on notes, OK on a page's list
(Prepaid credit's On/Off does not store), Screen saver's opening after On, Screen saver's entry
indicator after a shortcut or a path, digits during it, ▲ during Snake II's Top score, Rename in Discreet,
Loud and the empty slots (`10 - length` characters left), digits during a splash shortcut, `0 1` as a shortcut, the 12-hour clock beyond `10:10 am`.
Digits in a shortcut-opened option list beyond the probes: options whose OK shows a query, a
prompt, a progress note or a feature's screen (nokia-os does what OK does), lists of 10 or more
options (nokia-os waits on a prefix such as `1` as a menu level does), `0` (waits, then Invalid
shortcut), keys while the label shows (ignored), feature-built lists (profiles, messages, security,
call register: digits stay keys), and multi-select lists and level bars (digits stay keys: no
probe types one there).

**Capture artefacts (never reproduced as behaviour):**

| Artefact                                                                     | Cause                           | Handling                                                    |
| ---------------------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------- |
| Operator `Orange F`                                                          | emulator synthetic PLMN 208-01  | host `carrier`; used only as a test input                   |
| Clock frozen at `10:10`                                                      | emulator RTC                    | host `clock()`; used only as a test input                   |
| Date on Clock → Date setting                                                 | date typed during setup         | host `date()`                                               |
| Security-code prompt, `Code accepted`, time/date wizard                      | virgin EEPROM                   | not reproduced                                              |
| First standby `Snooze` prompt and `0000000000`                               | virgin EEPROM alarm state       | not imported                                                |
| Profiles slot 6 (two boxes)                                                  | uninitialised EEPROM name       | label and Rename value are two U+E000 boxes                 |
| Page values (`Level 1`, `No tone`, `Off`, ...)                               | virgin-EEPROM settings          | in-memory store's initial state until plan 15               |
| Unset tone lists (`-0`, no rows, `Quit`), `Level 1`                          | invalid stored index            | virgin initial state (plan 14 D10)                          |
| `Top score: 45`, score IDs `ç`/`ÆG`, `Shakes` `1 player`                     | uninitialised game EEPROM       | virgin initial state                                        |
| Club Nokia ID `T`                                                            | uninitialised game EEPROM       | virgin initial state                                        |
| `+1234567890`, `793000333`, `SIM card: 50 free`                              | emulator SIM                    | virgin initial state                                        |
| Info service topic names (six U+E000 boxes)                                  | uninitialised EEPROM            | Topics stay a placeholder (plan 18)                         |
| `Requesting` / `Searching` never finish                                      | emulator network                | the bar loops until Quit or C                               |
| Picture messages, Templates, Smileys, Screen saver › Screen saver do nothing | no preloaded content            | placeholders (plan 18)                                      |
| Snake II level 175 (nine bars; one cell per timer unit; +175 per meal)       | virgin EEPROM                   | the virgin state (plan 23 D2); Restore returns it to virgin |
| Identical first food in every game at one clock setting                      | emulator RTC frozen; clock seed | "seed from the clock" (plan 23 D4); `10:10` is a test input |
| Timer unit ≈7.745 ms (the firmware assumes 7.97 ms)                          | emulator timebase               | reproduced as captured; UNVERIFIED on hardware              |
| Key-to-game latency ≈30-45 ms, Navi-to-menu ≈100 ms                          | firmware key scan and redraw    | not reproduced (plan 23 D6)                                 |
| Silent games (Tones › Warning tones unset)                                   | virgin EEPROM                   | virgin state; cues still emitted (plan 23 D8)               |

Factory restore could not be captured either (`Code error` for `12345`), so the page values and
Profiles slot 6 above remain virgin-EEPROM values. Plan 15 captured Restore on a re-provisioned
image; the factory state is in [storage-and-settings.md](storage-and-settings.md).
