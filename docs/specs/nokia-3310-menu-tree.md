# Nokia 3310 v6.39 menu tree

The complete stock menu tree of the Nokia 3310 (NHM-5) firmware **v6.39, PPM E (English)**,
read from the real firmware running in the djr-747 DCT3 emulator. Every list was walked
depth-first and every entry was opened, so each line below is an observation, not a recollection
of the user guide. Use it as the ground truth for menu order, labels, menu numbers, list styles,
soft-key labels and what each leaf opens.

Captures, the machine-readable tree and the crawler live in the gitignored reference corpus
(`nokia-3310/`, outside this repo):

- `captures/6.39/tree.json`: every node with menu number, label, firmware text id, list style,
  value hint, soft key, the opened screen's kind and text, option entries and their results, and
  the capture file names.
- `captures/6.39/tree/<n>-<slug>/…`: per node `item.png` (the list with the entry highlighted),
  `screen.png` (what it opens), `open/` and `after/` (every distinct LCD frame with timings),
  `then.png` (where a timed note goes). `tree/_with-content/` is the same for the second crawl.
- `tools/menutree/`: `crawl.py` (crawler), `ocr.py` (template OCR), `seed.py` (content seeding),
  `build_tree.py` (raw crawl to `tree.json`), `explore.py` (ad-hoc probes).

## How it was captured

- **Phone state.** Virgin EEPROM, power-on with security code 12345, clock set to 10:10 on
  13.10.2026 (`captures/scripts/v639-setup.inc`), emulator SIM on the synthetic network
  "Orange F" (PLMN 208-01). The clock does not run in the emulator.
- **Isolation.** The harness (`tools/harness/dct3cap`) gained `fork` / `exit` commands: before
  an entry is opened the emulator process forks, the child explores, then exits, and the parent
  continues from the identical state. No setting change, erase or game leaks into later
  traversal, and no reboots were needed.
- **Traversal.** A screen counts as a list when its top-right index is one level deeper than the
  entry that opened it ("6-1" → "6-1-1"), or when it has an inverted highlight bar. Lists are
  walked with ▼ until they wrap. Every entry, including entries of option lists, is opened with
  the soft key. Leaves get 3.5 s with no input to show where timed notes go. Editors with an
  **Options** key also have that menu opened. A security-code prompt is answered with 12345.
- **Reading labels.** Text is read from pixels with a template OCR built from the extracted
  firmware fonts (`extracted/6.39/fonts`). A glyph only matches where its whole box, ink and
  blank, equals the LCD, so readings are exact. Readings are then matched against the firmware
  strings (`extracted/6.39/text/english.txt`) and the ringing-tone table. Labels marked ⚠ could
  not be confirmed that way (see "Uncertain").
- **Second crawl, with content.** `seed.py` added two contacts (A 0412345678, B 0298765432), one
  dialled call (0400000001), a saved message ("High", T9), a reminder (09:00), an alarm at 07:00
  and a composed tone "A". It then crawled Phone book, Messages, Call register, Tones,
  Reminders and Clock again, and also pressed the soft key on prompts and one-entry views. Its
  results are in "With content" below.

## Conventions

- **Numbers.** `6-1-2` is the menu number. It is what the top-right index shows, and it is also
  the number-key shortcut (Menu 6 1 2). Deeper option lists sometimes show only their own
  position in the index ("1", "2"). Their numbers below are derived from the path. Lists opened
  from an editor's **Options** key are numbered `2-1/Options-n`.
- **Keys.** The 3310 has one labelled soft key, the Navi key under the display. Its label is
  centred on the bottom row and is shown here as **key**. **C** is Back in lists and Clear in
  editors, and it is never labelled. ▼▲ scroll and wrap at both ends.
- **List styles.**
  - _One entry per screen:_ the entry's name in bold, wrapped over up to three lines, with its
    current value in small plain text at the lower right (shown as `[value]`), plus a scroll bar.
  - _3-row list:_ three entries with an inverted bar on the highlighted one.
  - The main menu shows one large title and an animated icon per screen.
- **Option lists.** ▸ marks the entry highlighted when the list opens, which is the current
  value for settings. ☑/☐ mark multi-select entries (the key reads **Mark** or **Unmark**).
  "each: …" means every entry gives the same result when confirmed.
- **Results.** "then back to the list" means a timed note returned by itself to the entry that
  opened it.

### Leaf screen kinds

| kind                | what it is                                                                                                                                                                                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| option-list         | List of choices. Confirming one applies it or opens its own screen                                                                                                                                                                                                                                                 |
| info-pages          | One value per screen, scrolled with ▼▲, key **Back**                                                                                                                                                                                                                                                               |
| timed-note          | Note that clears by itself, then returns to the list. Confirmations ("Done" with its tick animation, "Topic erased", "No messages in inbox") last about 1.45 s from the key press. Information and error notes ("No phone numbers", "Not allowed", "Code error") last about 2.9 s. Times are emulated time, ±0.1 s |
| static-note         | Note or value with no soft key that stays until a key is pressed                                                                                                                                                                                                                                                   |
| progress-note       | "Requesting" / "Searching" with **Quit** (network operations)                                                                                                                                                                                                                                                      |
| text-input          | Labelled text entry with the input-mode icon (pen/T9), e.g. "Name:"                                                                                                                                                                                                                                                |
| number-input        | Labelled digit entry, e.g. "Phone number:" (key **Search**), "Set timer:"                                                                                                                                                                                                                                          |
| code-prompt         | "Security code:", "PIN code:", "PIN2 code:", "Barring password:" entry                                                                                                                                                                                                                                             |
| text-editor         | Free-text editor (Write messages, Welcome note, composer)                                                                                                                                                                                                                                                          |
| confirm-query       | Question, e.g. "Are you sure?", "Replace old ID?"                                                                                                                                                                                                                                                                  |
| item-view           | One entry shown large with an action key (Edit, Erase, Send, Assign, Call, Use)                                                                                                                                                                                                                                    |
| text-pages          | Long text paged with **More** (game instructions)                                                                                                                                                                                                                                                                  |
| level-bar           | "Level:" with a bar graph (game level)                                                                                                                                                                                                                                                                             |
| symbol-table        | Special-character grid, key **Use**                                                                                                                                                                                                                                                                                |
| application         | Calculator, stopwatch, game play field, voice recorder                                                                                                                                                                                                                                                             |
| returns-immediately | Applies at once and goes straight back, with no note                                                                                                                                                                                                                                                               |
| no-response         | Nothing happened within 3.5 s (see "Uncertain")                                                                                                                                                                                                                                                                    |
| standby             | Leaves the menus for the standby screen                                                                                                                                                                                                                                                                            |

## Size

Counted from `tree.json`. _Entries_ are menu nodes, including the Options menus of editors.
_Options_ are the entries of option lists. Depth counts the main menu as level 1.

| menu            | entries | submenus | leaves  | options | depth |
| --------------- | ------- | -------- | ------- | ------- | ----- |
| 1 Phone book    | 19      | 4        | 15      | 3       | 4     |
| 2 Messages      | 51      | 10       | 41      | 60      | 6     |
| 3 Chat          | 1       | 0        | 1       | 0       | 1     |
| 4 Call register | 11      | 2        | 9       | 16      | 3     |
| 5 Tones         | 21      | 3        | 18      | 71      | 4     |
| 6 Settings      | 35      | 7        | 28      | 39      | 5     |
| 7 Call divert   | 19      | 5        | 14      | 14      | 4     |
| 8 Games         | 35      | 8        | 27      | 21      | 5     |
| 9 Calculator    | 14      | 1        | 13      | 18      | 5     |
| 10 Reminders    | 4       | 1        | 3       | 2       | 3     |
| 11 Clock        | 10      | 2        | 8       | 5       | 4     |
| 12 Profiles     | 96      | 19       | 77      | 426     | 6     |
| **total**       | **316** | **62**   | **254** | **675** | **6** |

The crawl opened 1,487 entries in total (966 in the main crawl, 521 in a Profiles re-crawl),
plus 395 in the content crawl.

## The tree

Read each line as `number` **label** [value hint] → what the soft key opens. Identical sibling
subtrees are written out once and then referred to.

- `1` **Phone book** → submenu (3-row list)
  - `1-1` **Search** → text-input, "Name:", key **OK**
  - `1-2` **Service Nos.** → timed-note, "No phone numbers"; then back to the list after ≈3.0 s
  - `1-3` **Add name** → text-input, "Name:", key **OK**
  - `1-4` **Erase** → submenu (3-row list)
    - `1-4-1` **One by one** → timed-note, "No phone numbers"; then back to the list after ≈2.9 s
    - `1-4-2` **Erase all** → timed-note, "No phone numbers"; then back to the list after ≈2.9 s
  - `1-5` **Edit** → timed-note, "No phone numbers"; then back to the list after ≈2.9 s
  - `1-6` **Assign tone** → timed-note, "No phone numbers"; then back to the list after ≈2.9 s
  - `1-7` **Send b'card** → timed-note, "No phone numbers"; then back to the list after ≈2.9 s
  - `1-8` **Options** → submenu (one entry per screen)
    - `1-8-1` **Type of view** [Large font] → option-list, key **OK**
      - entries: Name list · Name, number · **Large font** ▸
      - each: timed-note "Done", then back
    - `1-8-2` **Memory status** → info-screen, "SIM card: / 50 free / 0 in use", key **Back**
  - `1-9` **Speed dials** → number-input, "Key 2: / (empty)", key **Assign**
  - `1-10` **Voice tags** → submenu (3-row list)
    - `1-10-1` **Add voice tag** → timed-note, "No phone numbers"; then back to the list after ≈2.9 s
    - `1-10-2` **Playback** → timed-note, "No voice tags saved"; then back to the list after ≈2.9 s
    - `1-10-3` **Change** → timed-note, "No voice tags saved"; then back to the list after ≈2.9 s
    - `1-10-4` **Erase** → timed-note, "No voice tags saved"; then back to the list after ≈2.9 s
- `2` **Messages** → submenu (one entry per screen)
  - `2-1` **Write messages** → text-editor, key **Options**
    - **Options** → submenu (3-row list)
      - `2-1/Options-1` **Send** → number-input, "Phone number:", key **Search**
      - `2-1/Options-2` **Send to many** → timed-note, "No phone numbers"; then back to the list after ≈4.0 s
      - `2-1/Options-3` **Template** → no-response (the screen stays as it was for 3.5 s)
      - `2-1/Options-4` **Insert smiley** → no-response (the screen stays as it was for 3.5 s)
      - `2-1/Options-5` **Insert word** → text-input, "Insert word:", key **OK**
      - `2-1/Options-6` **Insert number** → text-input, "Insert number:", key **OK**
      - `2-1/Options-7` **Insert symbol** → symbol-table, "? + # \* ( / ) \ ' " \_ @ & $ £ % / / < > ¿ § = ¤ €¥", key **Use**
      - `2-1/Options-8` **Dictionary** → submenu (3-row list), opens on English
        - `2-1/Options-8-1` **Dictionary off** → static-note, "T9 dictionary deactivated"; then back to the editor
          - **Options** → returns-immediately, "Send / Send to many / Template", key **OK**
        - `2-1/Options-8-2` **English** → timed-note, "T9 dictionary activated"; then back to the list after ≈4.3 s
        - `2-1/Options-8-3` **Русский** → timed-note, "T9 dictionary activated"; then back to the list after ≈4.3 s
        - `2-1/Options-8-4` **Български** → timed-note, "T9 dictionary activated"; then back to the list after ≈4.3 s
      - `2-1/Options-9` **Send by set** → submenu (3-row list)
        - `2-1/Options-9-1` **Set 1** → option-list, key **OK**
          - entries: **Numeric** ▸ · Alphanumeric
          - Numeric: number-input "Phone number:" [Search]
          - Alphanumeric: text-input "Routing address:" [OK]
        - `2-1/Options-9-2` **Set 2** → item-view, "Alphanumeric", key **OK**
      - `2-1/Options-10` **Save** → timed-note, "Message saved"; then back to the list after ≈4.4 s
      - `2-1/Options-11` **Erase** → returns-immediately, key **Options**
      - `2-1/Options-12` **Exit** → standby, "Orange F", key **Menu**
  - `2-2` **Inbox** → timed-note, "No messages in inbox"; then back to the list after ≈1.5 s
  - `2-3` **Outbox** → timed-note, "No messages in outbox"; then back to the list after ≈1.5 s
  - `2-4` **Picture messages** → no-response (the screen stays as it was for 3.5 s)
  - `2-5` **Templates** → no-response (the screen stays as it was for 3.5 s)
  - `2-6` **Smileys** → no-response (the screen stays as it was for 3.5 s)
  - `2-7` **Message settings** → submenu (3-row list)
    - `2-7-1` **Set 1** → submenu (one entry per screen)
      - `2-7-1-1` **Message centre number** → text-input, "Centre number: / +1234567890", key **OK**
      - `2-7-1-2` **Messages sent as** [Text] → option-list, key **OK**
        - entries: **Text** ▸ · Fax · Paging · E-mail
        - each: timed-note "Done", then back
      - `2-7-1-3` **Message validity** [Maximum time] → option-list, key **OK**
        - entries: 1 hour · 6 hours · 24 hours · 72 hours · 1 week · **Maximum time** ▸
        - each: timed-note "Done", then back
    - `2-7-2` **Set 2** → submenu (one entry per screen)
      - `2-7-2-1` **Message centre number** → number-input, "Centre number:", key **Search**
      - `2-7-2-2` **Messages sent as** [Text] → option-list, key **OK**
        - entries: **Text** ▸ · Fax · Paging · E-mail
        - each: timed-note "Done", then back
      - `2-7-2-3` **Message validity** [Maximum time] → option-list, key **OK**
        - entries: 1 hour · 6 hours · 24 hours · 72 hours · 1 week · **Maximum time** ▸
        - each: timed-note "Done", then back
    - `2-7-3` **Common** → submenu (one entry per screen)
      - `2-7-3-1` **Delivery reports** [No] → option-list, key **OK**
        - entries: Yes · **No** ▸
        - each: timed-note "Done", then back
      - `2-7-3-2` **Reply via same centre** [No] → option-list, key **OK**
        - entries: Yes · **No** ▸
        - each: timed-note "Done", then back
      - `2-7-3-3` **Character support** [Full] → option-list, key **OK**
        - entries: **Full** ▸ · Reduced
        - each: timed-note "Done", then back
  - `2-8` **Info service** [Off] → submenu (3-row list), opens on Off
    - `2-8-1` **On** → timed-note, "Info message reception on"; then back to the list after ≈1.5 s
    - `2-8-2` **Off** → timed-note, "Info message reception off"; then back to the list after ≈1.5 s
    - `2-8-3` **Topic index** → timed-note, "Index reception on"; then back to the list after ≈1.5 s
    - `2-8-4` **Topics** → submenu (3-row list)
      - `2-8-4-1` **Select** → option-list, key **Unmark**
        - entries: **☑ (unreadable: box glyphs) ⚠** ▸ · ☐ (unreadable: box glyphs) ⚠ · ☐ (unreadable: box glyphs) ⚠ · ☐ (unreadable: box glyphs) ⚠ · ☑ (unreadable: box glyphs) ⚠
        - each: returns immediately
      - `2-8-4-2` **Edit** → option-list, key **OK**
        - entries: **(unreadable: box glyphs) ⚠** ▸ · (unreadable: box glyphs) ⚠ · (unreadable: box glyphs) ⚠ · (unreadable: box glyphs) ⚠ · (unreadable: box glyphs) ⚠
        - (unreadable: box glyphs): text-input "Topic number:" [OK]
        - (unreadable: box glyphs): text-input "Topic number:" [OK]
        - (unreadable: box glyphs): text-input "Topic number:" [OK]
        - (unreadable: box glyphs): text-input "Topic number: / p9" [OK]
        - (unreadable: box glyphs): text-input "Topic number:" [OK]
      - `2-8-4-3` **Erase** → option-list, key **OK**
        - entries: **(unreadable: box glyphs) ⚠** ▸ · (unreadable: box glyphs) ⚠ · (unreadable: box glyphs) ⚠ · (unreadable: box glyphs) ⚠ · (unreadable: box glyphs) ⚠
        - each: timed-note "Topic erased", then back
    - `2-8-5` **Language** → option-list, key **Unmark**
      - entries: **☑ All** ▸ · ☑ Suomi · ☐ Norsk · ☑ Svenska · ☐ Dansk · ☑ Nederlands · ☐ Deutsch · ☐ English · ☐ Français · ☐ Italiano · ☑ Español · ☐ Português · ☑ Greek · ☑ Türkçe · ☐ Hebrew · ☐ Czech · ☐ Polish
      - All: returns immediately
      - Suomi: returns immediately
      - Norsk: returns immediately
      - Svenska: returns immediately
      - Dansk: returns immediately
      - Nederlands: returns immediately
      - Deutsch: returns immediately
      - English: returns immediately
      - Français: returns immediately
      - Italiano: returns immediately
      - Español: returns immediately
      - Português: returns immediately
      - Greek: returns immediately
      - Türkçe: returns immediately
      - Hebrew: returns immediately
      - Czech: returns immediately
      - Polish: no-response "Hebrew / Czech / Polish" [Mark]
  - `2-9` **Voice mailbox number** → text-input, "Phone number: / 793000333", key **OK**
  - `2-10` **Service command editor** → text-editor, key **Back**
- `3` **Chat** → number-input, "Phone number:", key **Search**
- `4` **Call register** → submenu (one entry per screen)
  - `4-1` **Missed calls** → timed-note, "No numbers"; then back to the list after ≈2.9 s
  - `4-2` **Received calls** → timed-note, "No numbers"; then back to the list after ≈2.9 s
  - `4-3` **Dialled numbers** → timed-note, "No numbers"; then back to the list after ≈2.9 s
  - `4-4` **Erase recent call lists** → option-list, key **OK**
    - entries: **All** ▸ · Missed · Dialled · Received
    - All: timed-note "All call lists erased", then back
    - Missed: timed-note "Missed calls erased", then back
    - Dialled: timed-note "Dialled numbers erased", then back
    - Received: timed-note "Received calls erased", then back
  - `4-5` **Show call duration** → info-pages, key **Back**
    - entries: **Last call duration** ▸ [00:00:00] · All calls' duration [00:00:00] · Received calls' duration [00:00:00] · Dialled calls' duration [00:00:00] · Clear timers
    - Last call duration: returns immediately
    - All calls' duration: returns immediately
    - Received calls' duration: returns immediately
    - Dialled calls' duration: returns immediately
    - Clear timers: code-prompt "Security code:" [OK]
  - `4-6` **Show call costs** → info-pages, key **Back**
    - entries: **Last call cost** ▸ [0] · All calls' cost [0] · Clear counters
    - Last call cost: returns immediately
    - All calls' cost: returns immediately
    - Clear counters: timed-note "Not allowed", then back
  - `4-7` **Call cost settings** → submenu (one entry per screen)
    - `4-7-1` **Call cost limit** [Off] → timed-note, "Not allowed"; then back to the list after ≈2.9 s
    - `4-7-2` **Show costs in** [Units] → timed-note, "Not allowed"; then back to the list after ≈2.9 s
  - `4-8` **Prepaid credit** → info-pages, key **Select**
    - entries: **Credit info display** ▸ [Off] · Credit available [0] · Last event costs [0] · Recharge status
    - Credit info display: option-list
    - Credit available: returns immediately
    - Last event costs: returns immediately
    - Recharge status: info-pages
- `5` **Tones** → submenu (one entry per screen)
  - `5-1` **Ringing tone** → option-list, key **Quit**
    - entries: Ring ring · Low · Mosquito · Bee · City bird · Hopping down · Kick · Playground · That's it! · Improvisation · Rocket · Croak · Nokia tune · Mozart 40 · Badinerie · Attraction · Dawn · Polite · Tick tick · Samba rumble · Jumping · Lamb · Toreador · Matilda · Merry Xmas · Auld lang syne · Hurdy-gurdy · Groovy Blue · Sunny walks · The Buffoon · Indifference · Barn dance · Mangrove · Knick-knack · Get cool · (empty) · (empty) · (empty) · (empty) · (empty) · (empty) · (empty)
    - each: timed-note "Done", then back
    - opens with nothing highlighted (index -0): no current value in the virgin EEPROM
  - `5-2` **Ringing volume** [Level 1] → option-list, key **Quit**
    - entries: Level 1 · Level 2 · Level 3 · Level 4 · Level 5
    - Level 1: timed-note "Done", then back
    - Level 2: timed-note "Done", then back
    - Level 3: timed-note "Done", then back
    - Level 4: timed-note "Done", then back
    - Level 5: confirm-query "Select maximum volume for ringing tone?" [OK]
    - opens with nothing highlighted (index -0): no current value in the virgin EEPROM
  - `5-3` **Incoming call alert** → option-list, key **Quit**
    - entries: Ringing · Ascending · Ring once · Beep once · Off
    - each: timed-note "Done", then back
    - opens with nothing highlighted (index -0): no current value in the virgin EEPROM
  - `5-4` **Composer** → submenu (3-row list)
    - `5-4-1` **(empty)** → text-editor, key **Back**
    - `5-4-2` **(empty)** → text-editor, key **Back**
    - `5-4-3` **(empty)** → text-editor, key **Back**
    - `5-4-4` **(empty)** → text-editor, key **Back**
    - `5-4-5` **(empty)** → text-editor, key **Back**
    - `5-4-6` **(empty)** → text-editor, key **Back**
    - `5-4-7` **(empty)** → text-editor, key **Back**
  - `5-5` **Message alert tone** [No tone] → option-list, key **OK**
    - entries: **No tone** ▸ · Standard · Special · Beep once · Ascending
    - each: timed-note "Done", then back
  - `5-6` **Keypad tones** [Level 1] → option-list, key **Quit**
    - entries: Off · Level 1 · Level 2 · Level 3
    - each: timed-note "Done", then back
    - opens with nothing highlighted (index -0): no current value in the virgin EEPROM
  - `5-7` **Warning tones** → option-list, key **Quit**
    - entries: On · Off
    - each: timed-note "Done", then back
    - opens with nothing highlighted (index -0): no current value in the virgin EEPROM
  - `5-8` **Vibrating alert** → option-list, key **Quit**
    - entries: On · Off
    - each: timed-note "Done", then back
    - opens with nothing highlighted (index -0): no current value in the virgin EEPROM
  - `5-9` **Screen saver** [Off] → submenu (3-row list)
    - `5-9-1` **Off** → timed-note, "Done"; then back to the list after ≈2.9 s
    - `5-9-2` **On** → timed-note, "Done"; then back to the list after ≈2.9 s
    - `5-9-3` **Timeout** → option-list, key **Quit**
      - entries: 5 seconds · 20 seconds · 1 minute · 2 minutes · 5 minutes · 10 minutes
      - each: timed-note "Timeout selected", then back
      - opens with nothing highlighted (index -0): no current value in the virgin EEPROM
    - `5-9-4` **Screen saver** → no-response (the screen stays as it was for 3.5 s)
- `6` **Settings** → submenu (one entry per screen)
  - `6-1` **Call settings** → submenu (one entry per screen)
    - `6-1-1` **Automatic redial** [Off] → option-list, key **OK**
      - entries: On · **Off** ▸
      - each: timed-note "Done", then back
    - `6-1-2` **Speed dialling** [Off] → option-list, key **OK**
      - entries: On · **Off** ▸
      - each: timed-note "Done", then back
    - `6-1-3` **Call waiting options** → option-list, key **OK**
      - entries: **Activate** ▸ · Cancel · Status
      - each: progress-note "Requesting" [Quit]
    - `6-1-4` **Own number sending** [On] → option-list, key **OK**
      - entries: Set by network · **On** ▸ · Off
      - each: timed-note "Done", then back
  - `6-2` **Phone settings** → submenu (one entry per screen)
    - `6-2-1` **Language** [Automatic] → option-list, key **OK**
      - entries: **Automatic** ▸ · English · Русский · Български · Українська
      - Automatic: timed-note "Done", then back
      - English: timed-note "Done", then back
      - Русский: timed-note "Есть!", then back
      - Български: timed-note "Γотово", then back
      - Українська: timed-note "Заверше- / но", then back
    - `6-2-2` **Cell info display** [Off] → option-list, key **OK**
      - entries: On · **Off** ▸
      - each: timed-note "Done", then back
    - `6-2-3` **Welcome note** → text-editor, key **Options**
      - **Options** → option-list, key **OK**
        - entries: **Save** ▸ · Erase
        - each: timed-note "Welcome note erased", then back
    - `6-2-4` **Network selection** [Automatic] → submenu (3-row list)
      - `6-2-4-1` **Automatic** → timed-note, "Done"; then standby
      - `6-2-4-2` **Manual** → progress-note, "Searching", key **Quit**
    - `6-2-6` **Confirm SIM service actions** [Not asked] → option-list, key **OK**
      - entries: Asked · **Not asked** ▸
      - each: timed-note "Done", then back
  - `6-3` **Security settings** → submenu (one entry per screen)
    - `6-3-1` **PIN code request** [Off] → code-prompt, "Enter PIN code:", key **OK**
    - `6-3-2` **Call barring service** → submenu (one entry per screen)
      - `6-3-2-1` **Outgoing calls** → option-list, key **OK**
        - entries: **Activate** ▸ · Cancel · Status
        - Activate: code-prompt "Barring password:" [OK]
        - Cancel: code-prompt "Barring password:" [OK]
        - Status: progress-note "Requesting" [Quit]
      - `6-3-2-2` **International calls** → option-list, key **OK**
        - entries: **Activate** ▸ · Cancel · Status
        - Activate: code-prompt "Barring password:" [OK]
        - Cancel: code-prompt "Barring password:" [OK]
        - Status: progress-note "Requesting" [Quit]
      - `6-3-2-3` **International except to home country** → option-list, key **OK**
        - entries: **Activate** ▸ · Cancel · Status
        - Activate: code-prompt "Barring password:" [OK]
        - Cancel: code-prompt "Barring password:" [OK]
        - Status: progress-note "Requesting" [Quit]
      - `6-3-2-4` **Incoming calls** → option-list, key **OK**
        - entries: **Activate** ▸ · Cancel · Status
        - Activate: code-prompt "Barring password:" [OK]
        - Cancel: code-prompt "Barring password:" [OK]
        - Status: progress-note "Requesting" [Quit]
      - `6-3-2-5` **Incoming calls when abroad** → option-list, key **OK**
        - entries: **Activate** ▸ · Cancel · Status
        - Activate: code-prompt "Barring password:" [OK]
        - Cancel: code-prompt "Barring password:" [OK]
        - Status: progress-note "Requesting" [Quit]
      - `6-3-2-6` **Cancel all barrings** → code-prompt, "Barring password:", key **OK**
    - `6-3-4` **Closed user group** [Default] → option-list, key **OK**
      - entries: **Default** ▸ · On · Off
      - Default: timed-note "Done", then back
      - On: text-input "Group number:" [Back]
      - Off: timed-note "Done", then back
    - `6-3-5` **Phone security** [Off] → code-prompt, "Security code:", key **OK**
      - **with security code 12345** → timed-note, "Code error" (emulator effect, see "Behind codes"); then the empty prompt again after ≈2.9 s
    - `6-3-6` **Change access codes** → submenu (one entry per screen)
      - `6-3-6-1` **Change security code** → code-prompt, "Security code:", key **OK**
        - **with security code 12345** → timed-note, "Code error" (emulator effect, see "Behind codes"); then the empty prompt again after ≈2.9 s
      - `6-3-6-2` **Change PIN code** → timed-note, "Set PIN code request on"; then back to the list after ≈2.9 s
      - `6-3-6-3` **Change PIN2 code** → code-prompt, "Current PIN2 code:", key **OK**
      - `6-3-6-4` **Change barring password** → code-prompt, "Current password:", key **OK**
  - `6-4` **Restore factory settings** → code-prompt, "Security code:", key **OK**
    - **with security code 12345** → timed-note, "Code error" (emulator effect, see "Behind codes"); then the empty prompt again after ≈2.9 s
- `7` **Call divert** → submenu (one entry per screen)
  - `7-1` **Divert all voice calls without ringing** → submenu (3-row list)
    - `7-1-1` **Activate** → option-list, key **OK**
      - entries: **Voice mailbox** ▸ · Other number
      - Voice mailbox: progress-note "Requesting" [Quit]
      - Other number: number-input "Phone number:" [Search]
    - `7-1-2` **Cancel** → progress-note, "Requesting", key **Quit**
    - `7-1-3` **Status** → progress-note, "Requesting", key **Quit**
  - `7-2` **Divert when busy** → same subtree as `7-1` Divert all voice calls without ringing, renumbered 7-2-…
  - `7-3` **Divert if not answered** → submenu (3-row list)
    - `7-3-1` **Activate** → option-list, key **OK**
      - entries: **Voice mailbox** ▸ · Other number
      - Voice mailbox: progress-note "Requesting" [Quit]
      - Other number: number-input "Phone number:" [Search]
    - `7-3-2` **Cancel** → progress-note, "Requesting", key **Quit**
    - `7-3-3` **Status** → progress-note, "Requesting", key **Quit**
    - `7-3-4` **Set delay** → option-list, key **Quit**
      - entries: 5 seconds · 10 seconds · 15 seconds · 20 seconds · 25 seconds · 30 seconds
      - each: not probed
      - opens with nothing highlighted (index -0): no current value in the virgin EEPROM
  - `7-4` **Divert when phone off or no coverage** → same subtree as `7-1` Divert all voice calls without ringing, renumbered 7-4-…
  - `7-6` **Cancel all diverts** → progress-note, "Requesting", key **Quit**
- `8` **Games** → submenu (3-row list)
  - `8-1` **Snake II** → splash screen, then submenu (3-row list)
    - `8-1-1` **New game** → application
    - `8-1-2` **Level** → level-bar, "Level:", key **OK**
    - `8-1-3` **Mazes** → option-list, key **OK**
      - entries: **No maze** ▸ · Maze 1 · Maze 2 · Maze 3 · Maze 4 · Maze 5
      - No maze: timed-note "No maze / selected", then back
      - Maze 1: timed-note "Maze 1 / selected", then back
      - Maze 2: timed-note "Maze 2 / selected", then back
      - Maze 3: timed-note "Maze 3 / selected", then back
      - Maze 4: timed-note "Maze 4 / selected", then back
      - Maze 5: timed-note "Maze 5 / selected", then back
    - `8-1-4` **Top score** → static-note, "Top score: / 45"
    - `8-1-5` **Score IDs** → info-pages, key **Back**
      - entries: **Last score ID** ▸ [ç] · Top score ID [ÆG] · Bonus ID [No ID]
      - each: returns immediately
    - `8-1-6` **Instructions** → text-pages, "Make the snake / grow longer by / directing it to the", key **More**
  - `8-2` **Space impact** → splash screen, then submenu (3-row list)
    - `8-2-1` **New game** → application
    - `8-2-2` **Top score** → static-note, "Top score: / 45"
    - `8-2-3` **Score IDs** → info-pages, key **Back**
      - entries: **Last score ID** ▸ [ç] · Top score ID [ÆG]
      - each: returns immediately
    - `8-2-4` **Instructions** → text-pages, "Use your weapons / to survive attacks. / Use keys 8 and 0 to", key **More**
  - `8-3` **Bantumi** → splash screen, then submenu (3-row list)
    - `8-3-1` **New game** → static-note, "..……………………"
    - `8-3-2` **Level** → level-bar, "Level:", key **OK**
    - `8-3-3` **Instructions** → text-pages, "Play against phone / and drop beans into / pots. 4 and 6 pick a", key **More**
  - `8-4` **Pairs II** → splash screen, then submenu (3-row list)
    - `8-4-1` **Time trial** → submenu (3-row list)
      - `8-4-1-1` **New game** → application
      - `8-4-1-2` **Level** → level-bar, "Level:", key **OK**
      - `8-4-1-3` **Top score** → static-note, "Top score: / 0"
      - `8-4-1-4` **Score IDs** → info-pages, key **Back**
        - entries: **Last score ID** ▸ [No ID] · Top score ID [No ID]
        - each: returns immediately
      - `8-4-1-5` **Instructions** → text-pages, "Reveal pictures to / find pairs. Move the / cursor using keys", key **More**
    - `8-4-2` **Puzzle** → submenu (3-row list)
      - `8-4-2-1` **New game** → application
      - `8-4-2-2` **Level** → level-bar, "Level:", key **OK**
      - `8-4-2-3` **Top score** → static-note, "Top score: / 0"
      - `8-4-2-4` **Score IDs** → info-pages, key **Back**
        - entries: **Last score ID** ▸ [No ID] · Top score ID [No ID]
        - each: returns immediately
      - `8-4-2-5` **Instructions** → text-pages, "Reveal pictures to / find pairs with as / few tries as possible.", key **More**
  - `8-6` **Settings** → submenu (one entry per screen)
    - `8-6-1` **Sounds** [On] → option-list, key **OK**
      - entries: Off · **On** ▸
      - each: timed-note "Done", then back
    - `8-6-2` **Lights** → option-list, key **OK**
      - entries: Off · **On** ▸
      - each: timed-note "Done", then back
    - `8-6-3` **Shakes** [1 player] → option-list, key **OK**
      - entries: Off · **On** ▸
      - each: timed-note "Done", then back
    - `8-6-4` **Club Nokia ID** [T] → confirm-query, "Replace old ID?", key **OK**
- `9` **Calculator** → application, "0", key **Options**
  - **Options** → submenu (3-row list)
    - `9/Options-1` **Equals** → returns-immediately, "0", key **Options**
    - `9/Options-2` **Add** → application, "0 / +", key **Options**
      - **Options** → option-list, key **OK**
        - entries: **Add** ▸ · Subtract · Multiply · Divide
        - each: returns immediately
    - `9/Options-3` **Subtract** → application, "0", key **Options**
      - **Options** → option-list, key **OK**
        - entries: **Add** ▸ · Subtract · Multiply · Divide
        - each: returns immediately
    - `9/Options-4` **Multiply** → application, "0 / \*", key **Options**
      - **Options** → option-list, key **OK**
        - entries: **Add** ▸ · Subtract · Multiply · Divide
        - each: returns immediately
    - `9/Options-5` **Divide** → application, "0 / /", key **Options**
      - **Options** → option-list, key **OK**
        - entries: **Add** ▸ · Subtract · Multiply · Divide
        - each: returns immediately
    - `9/Options-6` **In domestic** → returns-immediately, "0", key **Options**
    - `9/Options-7` **In foreign** → timed-note, "Dividing by zero not allowed"; then back to the list after ≈2.9 s
    - `9/Options-8` **Exchange rate** → option-list, key **OK**
      - entries: **Foreign unit expressed in domestic units** ▸ · Domestic unit expressed in foreign units
      - Foreign unit expressed in domestic units: text-input "Exchange rate: / 0" [OK]
      - Domestic unit expressed in foreign units: text-input "Exchange rate:" [OK]
- `10` **Reminders** → submenu (3-row list)
  - `10-1` **Add new** → text-input, "Remind about:", key **OK**
  - `10-2` **View all** → returns-immediately, "Reminders", key **Select**
  - `10-3` **Erase** → option-list, key **OK**
    - entries: **One by one** ▸ · All
    - One by one: returns immediately
    - All: confirm-query "Are you sure?" [Yes]
- `11` **Clock** → submenu (one entry per screen)
  - `11-1` **Alarm clock** [Off] → text-input, "Set alarm time: / 00:00", key **OK**
  - `11-2` **Clock settings** [10:10] → submenu (3-row list)
    - `11-2-1` **Hide clock** → timed-note, "Clock hidden"; then back to the list after ≈1.4 s
    - `11-2-2` **Set the time** → text-input, "Time: / 10:10", key **OK**
    - `11-2-3` **Time format** → option-list, key **OK**
      - entries: **24-hour** ▸ · 12-hour
      - 24-hour: timed-note "24-hour clock selected", then back
      - 12-hour: timed-note "12-hour clock selected", then back
  - `11-3` **Date setting** [13.10.2026] → text-input, "Date: / 13.10.2026", key **OK**
  - `11-4` **Stopwatch** → application, "0:00:00.00", key **Start**
  - `11-5` **Countdown timer** [Off] → number-input, "Set timer: / hh:mm", key **Start**
  - `11-6` **Auto update of date and time** [Off] → option-list, key **OK**
    - entries: On · Confirm first · **Off** ▸
    - each: timed-note "Done", then back
- `12` **Profiles** → submenu (3-row list, one entry per screen)
  - `12-1` **General** → submenu (3-row list)
    - `12-1-1` **Activate** → timed-note, "Selected / profile: / General"; then standby
    - `12-1-2` **Personalise** → submenu (one entry per screen)
      - `12-1-2-1` **Ringing tone** → option-list, key **Quit**
        - entries: Ring ring · Low · Mosquito · Bee · City bird · Hopping down · Kick · Playground · That's it! · Improvisation · Rocket · Croak · Nokia tune · Mozart 40 · Badinerie · Attraction · Dawn · Polite · Tick tick · Samba rumble · Jumping · Lamb · Toreador · Matilda · Merry Xmas · Auld lang syne · Hurdy-gurdy · Groovy Blue · Sunny walks · The Buffoon · Indifference · Barn dance · Mangrove · Knick-knack · Get cool · (empty) · (empty) · (empty) · (empty) · (empty) · (empty) · (empty)
        - each: timed-note "Done", then back
        - opens with nothing highlighted (index -0): no current value in the virgin EEPROM
      - `12-1-2-2` **Ringing volume** [Level 1] → option-list, key **Quit**
        - entries: Level 1 · Level 2 · Level 3 · Level 4 · Level 5
        - Level 1: timed-note "Done", then back
        - Level 2: timed-note "Done", then back
        - Level 3: timed-note "Done", then back
        - Level 4: timed-note "Done", then back
        - Level 5: confirm-query "Select maximum volume for ringing tone?" [OK]
        - opens with nothing highlighted (index -0): no current value in the virgin EEPROM
      - `12-1-2-3` **Incoming call alert** → option-list, key **Quit**
        - entries: Ringing · Ascending · Ring once · Beep once · Off
        - each: timed-note "Done", then back
        - opens with nothing highlighted (index -0): no current value in the virgin EEPROM
      - `12-1-2-5` **Message alert tone** [No tone] → option-list, key **OK**
        - entries: **No tone** ▸ · Standard · Special · Beep once · Ascending
        - each: timed-note "Done", then back
      - `12-1-2-6` **Keypad tones** [Level 1] → option-list, key **Quit**
        - entries: Off · Level 1 · Level 2 · Level 3
        - each: timed-note "Done", then back
        - opens with nothing highlighted (index -0): no current value in the virgin EEPROM
      - `12-1-2-7` **Warning tones** → option-list, key **Quit**
        - entries: On · Off
        - each: timed-note "Done", then back
        - opens with nothing highlighted (index -0): no current value in the virgin EEPROM
      - `12-1-2-8` **Vibrating alert** → option-list, key **Quit**
        - entries: On · Off
        - each: timed-note "Done", then back
        - opens with nothing highlighted (index -0): no current value in the virgin EEPROM
      - `12-1-2-9` **Screen saver** [Off] → submenu (3-row list)
        - `12-1-2-9-1` **Off** → timed-note, "Done"; then back to the list after ≈2.9 s
        - `12-1-2-9-2` **On** → timed-note, "Done"; then back to the list after ≈2.9 s
        - `12-1-2-9-3` **Timeout** → option-list, key **Quit**
          - entries: 5 seconds · 20 seconds · 1 minute · 2 minutes · 5 minutes · 10 minutes
          - each: timed-note "Timeout selected", then back
          - opens with nothing highlighted (index -0): no current value in the virgin EEPROM
        - `12-1-2-9-4` **Screen saver** → no-response (the screen stays as it was for 3.5 s)
  - `12-2` **Silent** → submenu (3-row list)
    - `12-2-1` **Activate** → timed-note, "Selected / profile: / Silent"; then standby
    - `12-2-2` **Personalise** → submenu (one entry per screen)
      - `12-2-2-1` **Ringing tone** → option-list, key **Quit**
        - entries: Ring ring · Low · Mosquito · Bee · City bird · Hopping down · Kick · Playground · That's it! · Improvisation · Rocket · Croak · Nokia tune · Mozart 40 · Badinerie · Attraction · Dawn · Polite · Tick tick · Samba rumble · Jumping · Lamb · Toreador · Matilda · Merry Xmas · Auld lang syne · Hurdy-gurdy · Groovy Blue · Sunny walks · The Buffoon · Indifference · Barn dance · Mangrove · Knick-knack · Get cool · (empty) · (empty) · (empty) · (empty) · (empty) · (empty) · (empty)
        - each: timed-note "Done", then back
        - opens with nothing highlighted (index -0): no current value in the virgin EEPROM
      - `12-2-2-2` **Ringing volume** [Level 1] → option-list, key **Quit**
        - entries: Level 1 · Level 2 · Level 3 · Level 4 · Level 5
        - Level 1: timed-note "Done", then back
        - Level 2: timed-note "Done", then back
        - Level 3: timed-note "Done", then back
        - Level 4: timed-note "Done", then back
        - Level 5: confirm-query "Select maximum volume for ringing tone?" [OK]
        - opens with nothing highlighted (index -0): no current value in the virgin EEPROM
      - `12-2-2-3` **Incoming call alert** → option-list, key **Quit**
        - entries: Ringing · Ascending · Ring once · Beep once · Off
        - each: timed-note "Done", then back
        - opens with nothing highlighted (index -0): no current value in the virgin EEPROM
      - `12-2-2-5` **Message alert tone** [No tone] → option-list, key **OK**
        - entries: **No tone** ▸ · Standard · Special · Beep once · Ascending
        - each: timed-note "Done", then back
      - `12-2-2-6` **Keypad tones** [Level 1] → option-list, key **Quit**
        - entries: Off · Level 1 · Level 2 · Level 3
        - each: timed-note "Done", then back
        - opens with nothing highlighted (index -0): no current value in the virgin EEPROM
      - `12-2-2-7` **Warning tones** → option-list, key **Quit**
        - entries: On · Off
        - each: timed-note "Done", then back
        - opens with nothing highlighted (index -0): no current value in the virgin EEPROM
      - `12-2-2-8` **Vibrating alert** → option-list, key **Quit**
        - entries: On · Off
        - each: timed-note "Done", then back
        - opens with nothing highlighted (index -0): no current value in the virgin EEPROM
      - `12-2-2-9` **Screen saver** [Off] → submenu (3-row list)
        - `12-2-2-9-1` **Off** → timed-note, "Done"; then back to the list after ≈2.9 s
        - `12-2-2-9-2` **On** → timed-note, "Done"; then back to the list after ≈2.9 s
        - `12-2-2-9-3` **Timeout** → option-list, key **Quit**
          - entries: 5 seconds · 20 seconds · 1 minute · 2 minutes · 5 minutes · 10 minutes
          - each: timed-note "Timeout selected", then back
          - opens with nothing highlighted (index -0): no current value in the virgin EEPROM
        - `12-2-2-9-4` **Screen saver** → no-response (the screen stays as it was for 3.5 s)
      - `12-2-2-10` **Rename** [Silent] → text-input, "New name: / Silent", key **OK**
  - `12-3` **Discreet** → same subtree as `12-2` Silent, renumbered 12-3-…
  - `12-4` **Loud** → same subtree as `12-2` Silent, renumbered 12-4-…
  - `12-5` **(empty)** → submenu (3-row list)
    - `12-5-1` **Activate** → timed-note, "Selected / profile: / (empty)"; then standby
    - `12-5-2` **Personalise** → submenu (one entry per screen)
      - `12-5-2-1` **Ringing tone** → option-list, key **Quit**
        - entries: Ring ring · Low · Mosquito · Bee · City bird · Hopping down · Kick · Playground · That's it! · Improvisation · Rocket · Croak · Nokia tune · Mozart 40 · Badinerie · Attraction · Dawn · Polite · Tick tick · Samba rumble · Jumping · Lamb · Toreador · Matilda · Merry Xmas · Auld lang syne · Hurdy-gurdy · Groovy Blue · Sunny walks · The Buffoon · Indifference · Barn dance · Mangrove · Knick-knack · Get cool · (empty) · (empty) · (empty) · (empty) · (empty) · (empty) · (empty)
        - each: timed-note "Done", then back
        - opens with nothing highlighted (index -0): no current value in the virgin EEPROM
      - `12-5-2-2` **Ringing volume** [Level 1] → option-list, key **Quit**
        - entries: Level 1 · Level 2 · Level 3 · Level 4 · Level 5
        - Level 1: timed-note "Done", then back
        - Level 2: timed-note "Done", then back
        - Level 3: timed-note "Done", then back
        - Level 4: timed-note "Done", then back
        - Level 5: confirm-query "Select maximum volume for ringing tone?" [OK]
        - opens with nothing highlighted (index -0): no current value in the virgin EEPROM
      - `12-5-2-3` **Incoming call alert** → option-list, key **Quit**
        - entries: Ringing · Ascending · Ring once · Beep once · Off
        - each: timed-note "Done", then back
        - opens with nothing highlighted (index -0): no current value in the virgin EEPROM
      - `12-5-2-5` **Message alert tone** [No tone] → option-list, key **OK**
        - entries: **No tone** ▸ · Standard · Special · Beep once · Ascending
        - each: timed-note "Done", then back
      - `12-5-2-6` **Keypad tones** [Level 1] → option-list, key **Quit**
        - entries: Off · Level 1 · Level 2 · Level 3
        - each: timed-note "Done", then back
        - opens with nothing highlighted (index -0): no current value in the virgin EEPROM
      - `12-5-2-7` **Warning tones** → option-list, key **Quit**
        - entries: On · Off
        - each: timed-note "Done", then back
        - opens with nothing highlighted (index -0): no current value in the virgin EEPROM
      - `12-5-2-8` **Vibrating alert** → option-list, key **Quit**
        - entries: On · Off
        - each: timed-note "Done", then back
        - opens with nothing highlighted (index -0): no current value in the virgin EEPROM
      - `12-5-2-9` **Screen saver** [Off] → submenu (3-row list)
        - `12-5-2-9-1` **Off** → timed-note, "Done"; then back to the list after ≈2.9 s
        - `12-5-2-9-2` **On** → timed-note, "Done"; then back to the list after ≈2.9 s
        - `12-5-2-9-3` **Timeout** → option-list, key **Quit**
          - entries: 5 seconds · 20 seconds · 1 minute · 2 minutes · 5 minutes · 10 minutes
          - each: timed-note "Timeout selected", then back
          - opens with nothing highlighted (index -0): no current value in the virgin EEPROM
        - `12-5-2-9-4` **Screen saver** → no-response (the screen stays as it was for 3.5 s)
      - `12-5-2-10` **Rename** [(empty)] → text-input, "New name: / (empty)", key **OK**
  - `12-6` **□□** → submenu (3-row list)
    - `12-6-1` **Activate** → timed-note, "Selected / profile: / "; then standby
    - `12-6-2` **Personalise** → submenu (one entry per screen)
      - `12-6-2-1` **Ringing tone** → option-list, key **Quit**
        - entries: Ring ring · Low · Mosquito · Bee · City bird · Hopping down · Kick · Playground · That's it! · Improvisation · Rocket · Croak · Nokia tune · Mozart 40 · Badinerie · Attraction · Dawn · Polite · Tick tick · Samba rumble · Jumping · Lamb · Toreador · Matilda · Merry Xmas · Auld lang syne · Hurdy-gurdy · Groovy Blue · Sunny walks · The Buffoon · Indifference · Barn dance · Mangrove · Knick-knack · Get cool · (empty) · (empty) · (empty) · (empty) · (empty) · (empty) · (empty)
        - each: timed-note "Done", then back
        - opens with nothing highlighted (index -0): no current value in the virgin EEPROM
      - `12-6-2-2` **Ringing volume** [Level 1] → option-list, key **Quit**
        - entries: Level 1 · Level 2 · Level 3 · Level 4 · Level 5
        - Level 1: timed-note "Done", then back
        - Level 2: timed-note "Done", then back
        - Level 3: timed-note "Done", then back
        - Level 4: timed-note "Done", then back
        - Level 5: confirm-query "Select maximum volume for ringing tone?" [OK]
        - opens with nothing highlighted (index -0): no current value in the virgin EEPROM
      - `12-6-2-3` **Incoming call alert** → option-list, key **Quit**
        - entries: Ringing · Ascending · Ring once · Beep once · Off
        - each: timed-note "Done", then back
        - opens with nothing highlighted (index -0): no current value in the virgin EEPROM
      - `12-6-2-5` **Message alert tone** [No tone] → option-list, key **OK**
        - entries: **No tone** ▸ · Standard · Special · Beep once · Ascending
        - each: timed-note "Done", then back
      - `12-6-2-6` **Keypad tones** [Level 1] → option-list, key **Quit**
        - entries: Off · Level 1 · Level 2 · Level 3
        - each: timed-note "Done", then back
        - opens with nothing highlighted (index -0): no current value in the virgin EEPROM
      - `12-6-2-7` **Warning tones** → option-list, key **Quit**
        - entries: On · Off
        - each: timed-note "Done", then back
        - opens with nothing highlighted (index -0): no current value in the virgin EEPROM
      - `12-6-2-8` **Vibrating alert** → option-list, key **Quit**
        - entries: On · Off
        - each: timed-note "Done", then back
        - opens with nothing highlighted (index -0): no current value in the virgin EEPROM
      - `12-6-2-9` **Screen saver** [Off] → submenu (3-row list)
        - `12-6-2-9-1` **Off** → timed-note, "Done"; then back to the list after ≈2.9 s
        - `12-6-2-9-2` **On** → timed-note, "Done"; then back to the list after ≈2.9 s
        - `12-6-2-9-3` **Timeout** → option-list, key **Quit**
          - entries: 5 seconds · 20 seconds · 1 minute · 2 minutes · 5 minutes · 10 minutes
          - each: timed-note "Timeout selected", then back
          - opens with nothing highlighted (index -0): no current value in the virgin EEPROM
        - `12-6-2-9-4` **Screen saver** → no-response (the screen stays as it was for 3.5 s)
      - `12-6-2-10` **Rename** [] → text-input, "New name: / ", key **OK**

## With content

These are the second-level branches whose behaviour changes once the phone holds data, and the
screens behind prompts and one-entry views (the content crawl pressed the soft key on those as
well). Seed data: contacts **A** and **B**, dialled call 0400000001, saved message "High", one
reminder "Hi", alarm 07:00, composed tone "A". The Phone book view setting is the default
**Large font**, so names show one per screen with the action as the key.

### Phone book › Search

- `1-1` **Search** → text-input, "Name:", key **OK**
  - **pressing OK** → item-view, "A", key **Call**

### Phone book › Add name

- `1-3` **Add name** → text-input, "Name:", key **OK**
  - **pressing OK** → text-input, "Phone number:", key **OK**

### Phone book › Erase

- `1-4` **Erase** → submenu (3-row list)
  - `1-4-1` **One by one** → item-view, "A", key **Erase**
    - **pressing Erase** → item-view, "Erase? / A", key **OK**
  - `1-4-2` **Erase all** → confirm-query, "Are you sure?", key **OK**
    - **pressing OK** → code-prompt, "Security code:", key **OK**
      - **with security code 12345** → timed-note, "Code error" (emulator effect, see "Behind codes"); then the empty prompt again after ≈2.9 s

### Phone book › Edit

- `1-5` **Edit** → item-view, "A", key **Edit**
  - **pressing Edit** → text-input, "Name: / A", key **OK**; then "Name:" [OK]

### Phone book › Assign tone

- `1-6` **Assign tone** → item-view, "A / Default", key **Assign**
  - **pressing Assign** → item-view, "Default / Ring ring / Low", key **OK**

### Phone book › Send b'card

- `1-7` **Send b'card** → item-view, "A", key **Send**
  - **pressing Send** → number-input, "Phone number:", key **Search**

### Phone book › Options

- `1-8` **Options** → submenu (one entry per screen)
  - `1-8-1` **Type of view** [Large font] → option-list, key **OK**
    - entries: Name list · Name, number · **Large font** ▸
    - each: timed-note "Done", then back
  - `1-8-2` **Memory status** → info-screen, "SIM card: / 48 free / 2 in use", key **Back**

### Phone book › Speed dials

- `1-9` **Speed dials** → number-input, "Key 2: / B", key **Assign**
  - **pressing Assign** → item-view, "A", key **Select**

### Phone book › Voice tags

- `1-10` **Voice tags** → submenu (3-row list)
  - `1-10-1` **Add voice tag** → item-view, "A", key **Add voice tag**
    - **pressing Add voice tag** → application, "Press Start, then speak after tone", key **Start**
  - `1-10-2` **Playback** → timed-note, "No voice tags saved"; then back to the list after ≈2.9 s
  - `1-10-3` **Change** → timed-note, "No voice tags saved"; then back to the list after ≈2.9 s
  - `1-10-4` **Erase** → timed-note, "No voice tags saved"; then back to the list after ≈2.9 s

### Messages › Write messages

- `2-1` **Write messages** → text-editor, key **Options**
  - **Options** → submenu (3-row list)
    - `2-1/Options-1` **Send** → number-input, "Phone number:", key **Search**
      - **pressing Search** → text-editor, "A", key **OK**
    - `2-1/Options-2` **Send to many** → item-view, "A", key **Send**
      - **pressing Send** → timed-note, "Message sent"; then back to the list after ≈4.1 s
    - `2-1/Options-3` **Template** → no-response (the screen stays as it was for 3.5 s)
    - `2-1/Options-4` **Insert smiley** → no-response (the screen stays as it was for 3.5 s)
    - `2-1/Options-5` **Insert word** → text-input, "Insert word:", key **OK**
      - **pressing OK** → returns-immediately, key **Options**
    - `2-1/Options-6` **Insert number** → text-input, "Insert number:", key **OK**
      - **pressing OK** → returns-immediately, key **Options**
    - `2-1/Options-7` **Insert symbol** → symbol-table, "? + # \* ( / ) \ ' " \_ @ & $ £ % / / < > ¿ § = ¤ €¥", key **Use**
      - **pressing Use** → returns-immediately, key **Options**
    - `2-1/Options-8` **Dictionary** → submenu (3-row list), opens on English
      - `2-1/Options-8-1` **Dictionary off** → static-note, "T9 dictionary deactivated"; then back to the editor
        - **Options** → returns-immediately, "Send / Send to many / Template", key **OK**
      - `2-1/Options-8-2` **English** → timed-note, "T9 dictionary activated"; then back to the list after ≈4.3 s
      - `2-1/Options-8-3` **Русский** → timed-note, "T9 dictionary activated"; then back to the list after ≈4.2 s
      - `2-1/Options-8-4` **Български** → timed-note, "T9 dictionary activated"; then back to the list after ≈4.3 s
    - `2-1/Options-9` **Send by set** → submenu (3-row list)
      - `2-1/Options-9-1` **Set 1** → submenu (3-row list)
        - `2-1/Options-9-1-1` **Numeric** → number-input, "Phone number:", key **Search**
          - **pressing Search** → text-editor, "A", key **OK**
        - `2-1/Options-9-1-2` **Alphanumeric** → text-input, "Routing address:", key **OK**
          - **pressing OK** → timed-note, "Message sent"; then back to the list after ≈6.4 s
      - `2-1/Options-9-2` **Set 2** → item-view, "Alphanumeric", key **OK**
        - **pressing OK** → number-input, "Phone number:", key **Search**
    - `2-1/Options-10` **Save** → timed-note, "Message saved"; then back to the list after ≈4.4 s
    - `2-1/Options-11` **Erase** → returns-immediately, key **Options**
    - `2-1/Options-12` **Exit** → standby, "Orange F", key **Menu**

### Messages › Outbox

- `2-3` **Outbox** → submenu (3-row list)
  - `2-3-1` **Message** → text-editor, "Highh", key **Options**
    - **Options** → submenu (3-row list)
      - `2-3-1/Options-1` **Erase** → confirm-query, "Erase message?", key **OK**
        - **pressing OK** → timed-note, "No more messages in outbox"; then back to the list after ≈1.7 s
      - `2-3-1/Options-2` **Edit** → text-editor, "Highh", key **Options**
        - **Options** → submenu (3-row list)
          - `2-3-1/Options-2/Options-1` **Send** → number-input, "Phone number:", key **Search**
            - **pressing Search** → text-editor, "A", key **OK**
          - `2-3-1/Options-2/Options-2` **Send to many** → item-view, "A", key **Send**
            - **pressing Send** → timed-note, "Sending message"; then back to the list after ≈4.0 s
          - `2-3-1/Options-2/Options-3` **Template** → no-response (the screen stays as it was for 3.5 s)
          - `2-3-1/Options-2/Options-4` **Insert smiley** → no-response (the screen stays as it was for 3.5 s)
          - `2-3-1/Options-2/Options-5` **Matches** → submenu (3-row list)
            - `2-3-1/Options-2/Options-5-1` **Highh** → text-editor, "High", key **Options**
              - **Options** → returns-immediately, "Send / Send to many / Template", key **OK**
            - `2-3-1/Options-2/Options-5-2` **Highi** → text-editor, "High", key **Options**
              - **Options** → returns-immediately, "Send / Send to many / Template", key **OK**
          - `2-3-1/Options-2/Options-6` **Insert word** → text-input, "Insert word:", key **OK**
            - **pressing OK** → returns-immediately, "Highh", key **Options**
          - `2-3-1/Options-2/Options-7` **Insert number** → text-input, "Insert number:", key **OK**
            - **pressing OK** → returns-immediately, "High", key **Options**
          - `2-3-1/Options-2/Options-8` **Insert symbol** → symbol-table, "? + # \* ( / ) \ ' " \_ @ & $ £ % / / < > ¿ § = ¤ €¥", key **Use**
            - **pressing Use** → text-editor, "Highh", key **Options**
              - **Options** → returns-immediately, "Send / Send to many / Template", key **OK**
          - `2-3-1/Options-2/Options-9` **Dictionary** → submenu (3-row list), opens on English
            - `2-3-1/Options-2/Options-9-1` **Dictionary off** → static-note, "T9 dictionary deactivated"; then back to the editor
              - **Options** → returns-immediately, "Send / Send to many / Template", key **OK**
            - `2-3-1/Options-2/Options-9-2` **English** → static-note, "T9 dictionary activated"; then back to the editor
              - **Options** → returns-immediately, "Send / Send to many / Template", key **OK**
            - `2-3-1/Options-2/Options-9-3` **Русский** → static-note, "T9 dictionary activated"; then back to the editor
              - **Options** → returns-immediately, "Send / Send to many / Template", key **OK**
            - `2-3-1/Options-2/Options-9-4` **Български** → static-note, "T9 dictionary activated"; then back to the editor
              - **Options** → returns-immediately, "Send / Send to many / Template", key **OK**
          - `2-3-1/Options-2/Options-10` **Send by set** → submenu (3-row list)
            - `2-3-1/Options-2/Options-10-1` **Set 1** → option-list, key **OK**
              - entries: **Numeric** ▸ · Alphanumeric
              - Numeric: number-input "Phone number:" [Search]
              - Alphanumeric: text-input "Routing address:" [OK]
            - `2-3-1/Options-2/Options-10-2` **Set 2** → item-view, "Alphanumeric", key **OK**
              - **pressing OK** → number-input, "Phone number:", key **Search**, cursor blinks
          - `2-3-1/Options-2/Options-11` **Save** → static-note, "Message saved"; then back to the editor
            - **Options** → returns-immediately, "Send / Send to many / Template", key **OK**
          - `2-3-1/Options-2/Options-12` **Erase** → text-editor, key **Options**
            - **Options** → returns-immediately, "Send / Send to many / Template", key **OK**
          - `2-3-1/Options-2/Options-13` **Exit** → standby, "Orange F", key **Menu**
      - `2-3-1/Options-3` **Use number** → timed-note, "No number found on this screen"; then back to the list after ≈2.9 s
      - `2-3-1/Options-4` **Forward** → text-editor, "Highh", key **Options**
        - **Options** → submenu (3-row list)
          - `2-3-1/Options-4/Options-1` **Send** → number-input, "Phone number:", key **Search**
            - **pressing Search** → text-editor, "A", key **OK**
          - `2-3-1/Options-4/Options-2` **Send to many** → item-view, "A", key **Send**
            - **pressing Send** → timed-note, "Sending message"; then back to the list after ≈4.0 s
          - `2-3-1/Options-4/Options-3` **Template** → no-response (the screen stays as it was for 3.5 s)
          - `2-3-1/Options-4/Options-4` **Insert smiley** → no-response (the screen stays as it was for 3.5 s)
          - `2-3-1/Options-4/Options-5` **Matches** → submenu (3-row list)
            - `2-3-1/Options-4/Options-5-1` **Highh** → text-editor, "High", key **Options**
              - **Options** → returns-immediately, "Send / Send to many / Template", key **OK**
            - `2-3-1/Options-4/Options-5-2` **Highi** → text-editor, "High", key **Options**
              - **Options** → returns-immediately, "Send / Send to many / Template", key **OK**
          - `2-3-1/Options-4/Options-6` **Insert word** → text-input, "Insert word:", key **OK**
            - **pressing OK** → returns-immediately, "Highh", key **Options**
          - `2-3-1/Options-4/Options-7` **Insert number** → text-input, "Insert number:", key **OK**
            - **pressing OK** → returns-immediately, "High", key **Options**
          - `2-3-1/Options-4/Options-8` **Insert symbol** → symbol-table, "? + # \* ( / ) \ ' " \_ @ & $ £ % / / < > ¿ § = ¤ €¥", key **Use**
            - **pressing Use** → text-editor, "Highh", key **Options**
              - **Options** → returns-immediately, "Send / Send to many / Template", key **OK**
          - `2-3-1/Options-4/Options-9` **Dictionary** → submenu (3-row list), opens on English
            - `2-3-1/Options-4/Options-9-1` **Dictionary off** → static-note, "T9 dictionary deactivated"; then back to the editor
              - **Options** → returns-immediately, "Send / Send to many / Template", key **OK**
            - `2-3-1/Options-4/Options-9-2` **English** → static-note, "T9 dictionary activated"; then back to the editor
              - **Options** → returns-immediately, "Send / Send to many / Template", key **OK**
            - `2-3-1/Options-4/Options-9-3` **Русский** → static-note, "T9 dictionary activated"; then back to the editor
              - **Options** → returns-immediately, "Send / Send to many / Template", key **OK**
            - `2-3-1/Options-4/Options-9-4` **Български** → static-note, "T9 dictionary activated"; then back to the editor
              - **Options** → returns-immediately, "Send / Send to many / Template", key **OK**
          - `2-3-1/Options-4/Options-10` **Send by set** → submenu (3-row list)
            - `2-3-1/Options-4/Options-10-1` **Set 1** → option-list, key **OK**
              - entries: **Numeric** ▸ · Alphanumeric
              - Numeric: number-input "Phone number:" [Search]
              - Alphanumeric: text-input "Routing address:" [OK]
            - `2-3-1/Options-4/Options-10-2` **Set 2** → item-view, "Alphanumeric", key **OK**
              - **pressing OK** → number-input, "Phone number:", key **Search**
          - `2-3-1/Options-4/Options-11` **Save** → static-note, "Message saved"; then back to the editor
            - **Options** → returns-immediately, "Send / Send to many / Template", key **OK**
          - `2-3-1/Options-4/Options-12` **Erase** → text-editor, key **Options**
            - **Options** → returns-immediately, "Send / Send to many / Template", key **OK**
          - `2-3-1/Options-4/Options-13` **Exit** → standby, "Orange F", key **Menu**

### Messages › Message settings

- `2-7` **Message settings** → submenu (3-row list)
  - `2-7-1` **Set 1** → submenu (one entry per screen)
    - `2-7-1-1` **Message centre number** → text-input, "Centre number: / +1234567890", key **OK**
      - **pressing OK** → timed-note, "Centre number saved"; then back to the list after ≈1.6 s
    - `2-7-1-2` **Messages sent as** [Text] → option-list, key **OK**
      - entries: **Text** ▸ · Fax · Paging · E-mail
      - each: timed-note "Done", then back
    - `2-7-1-3` **Message validity** [Maximum time] → option-list, key **OK**
      - entries: 1 hour · 6 hours · 24 hours · 72 hours · 1 week · **Maximum time** ▸
      - each: timed-note "Done", then back
  - `2-7-2` **Set 2** → submenu (one entry per screen)
    - `2-7-2-1` **Message centre number** → number-input, "Centre number:", key **Search**
      - **pressing Search** → text-editor, "A", key **OK**
    - `2-7-2-2` **Messages sent as** [Text] → option-list, key **OK**
      - entries: **Text** ▸ · Fax · Paging · E-mail
      - each: timed-note "Done", then back
    - `2-7-2-3` **Message validity** [Maximum time] → option-list, key **OK**
      - entries: 1 hour · 6 hours · 24 hours · 72 hours · 1 week · **Maximum time** ▸
      - each: timed-note "Done", then back
  - `2-7-3` **Common** → submenu (one entry per screen)
    - `2-7-3-1` **Delivery reports** [No] → option-list, key **OK**
      - entries: Yes · **No** ▸
      - each: timed-note "Done", then back
    - `2-7-3-2` **Reply via same centre** [No] → option-list, key **OK**
      - entries: Yes · **No** ▸
      - each: timed-note "Done", then back
    - `2-7-3-3` **Character support** [Full] → option-list, key **OK**
      - entries: **Full** ▸ · Reduced
      - each: timed-note "Done", then back

### Messages › Info service

- `2-8` **Info service** [Off] → submenu (3-row list), opens on Off
  - `2-8-1` **On** → timed-note, "Info message reception on"; then back to the list after ≈1.5 s
  - `2-8-2` **Off** → timed-note, "Info message reception off"; then back to the list after ≈1.4 s
  - `2-8-3` **Topic index** → timed-note, "Index reception on"; then back to the list after ≈1.5 s
  - `2-8-4` **Topics** → submenu (3-row list)
    - `2-8-4-1` **Select** → option-list, key **Unmark**
      - entries: **☑ (unreadable: box glyphs) ⚠** ▸ · ☐ (unreadable: box glyphs) ⚠ · ☐ (unreadable: box glyphs) ⚠ · ☐ (unreadable: box glyphs) ⚠ · ☑ (unreadable: box glyphs) ⚠
      - each: returns immediately
    - `2-8-4-2` **Edit** → submenu (one entry per screen)
      - `2-8-4-2-1` **(unreadable: box glyphs) ⚠** → text-input, "Topic number:", key **OK**
        - **pressing OK** → returns-immediately, "Topic number:", key **OK**
      - `2-8-4-2-2` **(unreadable: box glyphs) ⚠** → text-input, "Topic number:", key **OK**
        - **pressing OK** → returns-immediately, "Topic number:", key **OK**
      - `2-8-4-2-3` **(unreadable: box glyphs) ⚠** → text-input, "Topic number:", key **OK**
        - **pressing OK** → returns-immediately, "Topic number:", key **OK**
      - `2-8-4-2-4` **(unreadable: box glyphs) ⚠** → text-input, "Topic number: / p9", key **OK**, cursor blinks
        - **pressing OK** → text-input, "Topic name: / ", key **OK**
      - `2-8-4-2-5` **(unreadable: box glyphs) ⚠** → text-input, "Topic number:", key **OK**
        - **pressing OK** → returns-immediately, "Topic number:", key **OK**
    - `2-8-4-3` **Erase** → option-list, key **OK**
      - entries: **(unreadable: box glyphs) ⚠** ▸ · (unreadable: box glyphs) ⚠ · (unreadable: box glyphs) ⚠ · (unreadable: box glyphs) ⚠ · (unreadable: box glyphs) ⚠
      - each: timed-note "Topic erased", then back
  - `2-8-5` **Language** → option-list, key **Unmark**
    - entries: **☑ All** ▸ · ☑ Suomi · ☐ Norsk · ☑ Svenska · ☐ Dansk · ☑ Nederlands · ☐ Deutsch · ☐ English · ☐ Français · ☐ Italiano · ☑ Español · ☐ Português · ☑ Greek · ☑ Türkçe · ☐ Hebrew · ☐ Czech · ☐ Polish
    - All: returns immediately
    - Suomi: returns immediately
    - Norsk: returns immediately
    - Svenska: returns immediately
    - Dansk: returns immediately
    - Nederlands: returns immediately
    - Deutsch: returns immediately
    - English: returns immediately
    - Français: returns immediately
    - Italiano: returns immediately
    - Español: returns immediately
    - Português: returns immediately
    - Greek: returns immediately
    - Türkçe: returns immediately
    - Hebrew: returns immediately
    - Czech: returns immediately
    - Polish: no-response "Hebrew / Czech / Polish" [Mark]

### Messages › Voice mailbox number

- `2-9` **Voice mailbox number** → text-input, "Phone number: / 793000333", key **OK**
  - **pressing OK** → timed-note, "Saved"; then back to the list after ≈1.5 s

### Call register › Dialled numbers

- `4-3` **Dialled numbers** → item-view, "Dialled 1: / 0400000001", key **Options**
  - **Options** → submenu (3-row list), opens on Call
    - `4-3/Options-1` **Time of call** → info-screen, "13.10.2026 / 10:10:00", key **Back**
    - `4-3/Options-2` **Edit number** → text-input, "Phone number: / 0400000001", key **OK**
      - **pressing OK** → item-view, "04 / 00000001", key **Call**
    - `4-3/Options-3` **Save** → text-input, "Name:", key **OK**
      - **pressing OK** → text-input, "Phone number: / 040000000", key **OK**
    - `4-3/Options-4` **Erase** → item-view, "Erase? / 0400000001", key **OK**
      - **pressing OK** → timed-note, "Dialled numbers erased"; then back to the list after ≈2.9 s
    - `4-3/Options-5` **Call** → progress-note, "Calling.. / 0400000001", key **End**; then "I Call 1" [End]
    - `4-3/Options-6` **Send SMS** → text-editor, key **Options**
      - **Options** → submenu (3-row list)
        - `4-3/Options-6/Options-1` **Send** → text-input, "Phone number: / 040000000", key **OK**
          - **pressing OK** → timed-note, "Message sent"; then back to the list after ≈6.4 s
        - `4-3/Options-6/Options-2` **Send to many** → item-view, "A", key **Send**
          - **pressing Send** → timed-note, "Message sent"; then back to the list after ≈4.1 s
        - `4-3/Options-6/Options-3` **Template** → no-response (the screen stays as it was for 3.5 s)
        - `4-3/Options-6/Options-4` **Insert smiley** → no-response (the screen stays as it was for 3.5 s)
        - `4-3/Options-6/Options-5` **Insert word** → text-input, "Insert word:", key **OK**
          - **pressing OK** → returns-immediately, key **Options**
        - `4-3/Options-6/Options-6` **Insert number** → text-input, "Insert number:", key **OK**
          - **pressing OK** → returns-immediately, key **Options**
        - `4-3/Options-6/Options-7` **Insert symbol** → symbol-table, "? + # \* ( / ) \ ' " \_ @ & $ £ % / / < > ¿ § = ¤ €¥", key **Use**
          - **pressing Use** → timed-note, key **Options**; then back to the list after ≈3.8 s
        - `4-3/Options-6/Options-8` **Dictionary** → submenu (3-row list), opens on English
          - `4-3/Options-6/Options-8-1` **Dictionary off** → static-note, "T9 dictionary deactivated"; then back to the editor
            - **Options** → returns-immediately, "Send / Send to many / Template", key **OK**
          - `4-3/Options-6/Options-8-2` **English** → timed-note, "T9 dictionary activated"; then back to the list after ≈4.3 s
          - `4-3/Options-6/Options-8-3` **Русский** → static-note, "T9 dictionary activated"; then back to the editor
            - **Options** → returns-immediately, "Send / Send to many / Template", key **OK**
          - `4-3/Options-6/Options-8-4` **Български** → static-note, "T9 dictionary activated"; then back to the editor
            - **Options** → returns-immediately, "Send / Send to many / Template", key **OK**
        - `4-3/Options-6/Options-9` **Send by set** → submenu (3-row list)
          - `4-3/Options-6/Options-9-1` **Set 1** → submenu (3-row list)
            - `4-3/Options-6/Options-9-1-1` **Numeric** → text-input, "Phone number: / 040000000", key **OK**
              - **pressing OK** → timed-note, "Message sent"; then back to the list after ≈6.4 s
            - `4-3/Options-6/Options-9-1-2` **Alphanumeric** → text-input, "Routing address: / 040000000", key **OK**
              - **pressing OK** → timed-note, "Message sent"; then back to the list after ≈6.4 s
          - `4-3/Options-6/Options-9-2` **Set 2** → item-view, "Alphanumeric", key **OK**
            - **pressing OK** → text-input, "Phone number: / 040000000", key **OK**
        - `4-3/Options-6/Options-10` **Save** → timed-note, "Message saved"; then back to the list after ≈4.4 s
        - `4-3/Options-6/Options-11` **Erase** → returns-immediately, key **Options**
        - `4-3/Options-6/Options-12` **Exit** → standby, "Orange F", key **Menu**

### Tones › Ringing tone

> Previews (plan 16): in the factory state ▲/▼ in Ringing tone, Ringing volume and Message alert
> tone play the highlighted entry ≈991 ms later; the virgin EEPROM crawled here leaves them silent.
> See [`docs/specs/stock/sound.md`](stock/sound.md).

- `5-1` **Ringing tone** → option-list, key **Quit**
  - entries: Ring ring · Low · Mosquito · Bee · City bird · Hopping down · Kick · Playground · That's it! · Improvisation · Rocket · Croak · Nokia tune · Mozart 40 · Badinerie · Attraction · Dawn · Polite · Tick tick · Samba rumble · Jumping · Lamb · Toreador · Matilda · Merry Xmas · Auld lang syne · Hurdy-gurdy · Groovy Blue · Sunny walks · The Buffoon · Indifference · Barn dance · Mangrove · Knick-knack · Get cool · A · (empty) · (empty) · (empty) · (empty) · (empty) · (empty)
  - each: timed-note "Done", then back
  - opens with nothing highlighted (index -0): no current value in the virgin EEPROM

### Tones › Ringing volume

- `5-2` **Ringing volume** [Level 1] → submenu (3-row list)
  - `5-2-1` **Level 1** → timed-note, "Done"; then back to the list after ≈1.5 s
  - `5-2-2` **Level 2** → timed-note, "Done"; then back to the list after ≈1.5 s
  - `5-2-3` **Level 3** → timed-note, "Done"; then back to the list after ≈1.5 s
  - `5-2-4` **Level 4** → timed-note, "Done"; then back to the list after ≈1.4 s
  - `5-2-5` **Level 5** → confirm-query, "Select maximum volume for ringing tone?", key **OK**
    - **pressing OK** → timed-note, "Done"; then back to the list after ≈1.5 s

### Tones › Composer

- `5-4` **Composer** → submenu (3-row list)
  - `5-4-1` **A** → text-editor, "4c1 4d1 4e1", key **Options**
    - **Options** → submenu (3-row list)
      - `5-4-1/Options-1` **Play** → timed-note, "4c1 4d1 4e", key **Stop**; then back to the list after ≈4.3 s
      - `5-4-1/Options-2` **Save** → text-input, "Tone name:", key **OK**
        - **pressing OK** → splash screen, then submenu (3-row list), opens on Save
          - `5-4-1/Options-2/softkey-1` **Play** → timed-note, "4c1 4d1 4e1", key **Stop**; then back to the list after ≈4.3 s
          - `5-4-1/Options-2/softkey-2` **Save** → returns-immediately, "Tone name: / A", key **OK**
          - `5-4-1/Options-2/softkey-3` **Tempo** → submenu (3-row list), opens on 112 BPM
            - `5-4-1/Options-2/softkey-3-1` **140 BPM** → timed-note, "Done"; then back to the list after ≈1.5 s
            - `5-4-1/Options-2/softkey-3-2` **160 BPM** → timed-note, "Done"; then back to the list after ≈1.5 s
            - `5-4-1/Options-2/softkey-3-3` **180 BPM** → timed-note, "Done"; then back to the list after ≈1.5 s
            - `5-4-1/Options-2/softkey-3-4` **200 BPM** → timed-note, "Done"; then back to the list after ≈1.5 s
            - `5-4-1/Options-2/softkey-3-5` **225 BPM** → timed-note, "Done"; then back to the list after ≈1.5 s
            - `5-4-1/Options-2/softkey-3-6` **40 BPM** → timed-note, "Done"; then back to the list after ≈1.5 s
            - `5-4-1/Options-2/softkey-3-7` **45 BPM** → timed-note, "Done"; then back to the list after ≈1.5 s
            - `5-4-1/Options-2/softkey-3-8` **50 BPM** → timed-note, "Done"; then back to the list after ≈1.5 s
            - `5-4-1/Options-2/softkey-3-9` **56 BPM** → timed-note, "Done"; then back to the list after ≈1.5 s
            - `5-4-1/Options-2/softkey-3-10` **63 BPM** → timed-note, "Done"; then back to the list after ≈1.5 s
            - `5-4-1/Options-2/softkey-3-11` **70 BPM** → timed-note, "Done"; then back to the list after ≈1.5 s
            - `5-4-1/Options-2/softkey-3-12` **80 BPM** → timed-note, "Done"; then back to the list after ≈1.5 s
            - `5-4-1/Options-2/softkey-3-13` **90 BPM** → timed-note, "Done"; then back to the list after ≈1.5 s
            - `5-4-1/Options-2/softkey-3-14` **100 BPM** → timed-note, "Done"; then back to the list after ≈1.4 s
            - `5-4-1/Options-2/softkey-3-15` **112 BPM** → timed-note, "Done"; then back to the list after ≈1.5 s
            - `5-4-1/Options-2/softkey-3-16` **125 BPM** → timed-note, "Done"; then back to the list after ≈1.5 s
          - `5-4-1/Options-2/softkey-4` **Send** → returns-immediately, "Tone name: / A", key **OK**
          - `5-4-1/Options-2/softkey-5` **Clear screen** → text-editor, key **Back**
          - `5-4-1/Options-2/softkey-6` **Exit** → returns-immediately, "Composer", key **Select**
      - `5-4-1/Options-3` **Tempo** → submenu (3-row list), opens on 112 BPM
        - `5-4-1/Options-3-1` **140 BPM** → timed-note, "Done"; then back to the list after ≈1.5 s
        - `5-4-1/Options-3-2` **160 BPM** → timed-note, "Done"; then back to the list after ≈1.5 s
        - `5-4-1/Options-3-3` **180 BPM** → timed-note, "Done"; then back to the list after ≈1.5 s
        - `5-4-1/Options-3-4` **200 BPM** → timed-note, "Done"; then back to the list after ≈1.5 s
        - `5-4-1/Options-3-5` **225 BPM** → timed-note, "Done"; then back to the list after ≈1.5 s
        - `5-4-1/Options-3-6` **40 BPM** → timed-note, "Done"; then back to the list after ≈1.5 s
        - `5-4-1/Options-3-7` **45 BPM** → timed-note, "Done"; then back to the list after ≈1.5 s
        - `5-4-1/Options-3-8` **50 BPM** → timed-note, "Done"; then back to the list after ≈1.5 s
        - `5-4-1/Options-3-9` **56 BPM** → timed-note, "Done"; then back to the list after ≈1.5 s
        - `5-4-1/Options-3-10` **63 BPM** → timed-note, "Done"; then back to the list after ≈1.5 s
        - `5-4-1/Options-3-11` **70 BPM** → timed-note, "Done"; then back to the list after ≈1.5 s
        - `5-4-1/Options-3-12` **80 BPM** → timed-note, "Done"; then back to the list after ≈1.5 s
        - `5-4-1/Options-3-13` **90 BPM** → timed-note, "Done"; then back to the list after ≈1.4 s
        - `5-4-1/Options-3-14` **100 BPM** → timed-note, "Done"; then back to the list after ≈1.5 s
        - `5-4-1/Options-3-15` **112 BPM** → timed-note, "Done"; then back to the list after ≈1.5 s
        - `5-4-1/Options-3-16` **125 BPM** → timed-note, "Done"; then back to the list after ≈1.5 s
      - `5-4-1/Options-4` **Send** → text-input, "Tone name:", key **OK**
        - **pressing OK** → number-input, "Phone number:", key **Search**
      - `5-4-1/Options-5` **Clear screen** → text-editor, key **Back**
      - `5-4-1/Options-6` **Exit** → returns-immediately, "Composer", key **Select**
  - `5-4-2` **(empty)** → text-editor, key **Back**
  - `5-4-3` **(empty)** → text-editor, key **Back**
  - `5-4-4` **(empty)** → text-editor, key **Back**
  - `5-4-5` **(empty)** → text-editor, key **Back**
  - `5-4-6` **(empty)** → text-editor, key **Back**
  - `5-4-7` **(empty)** → text-editor, key **Back**

### Reminders › Add new

- `10-1` **Add new** → text-input, "Remind about:", key **OK**
  - **pressing OK** → item-view, "Alarm off", key **OK**

### Reminders › View all

- `10-2` **View all** → text-editor, "Hi", key **Options**
  - **Options** → submenu (3-row list)
    - `10-2/Options-1` **Erase** → item-view, "Erase? Hi", key **OK**
      - **pressing OK** → static-note, "Reminder erased"; then "Reminders" [Select]
    - `10-2/Options-2` **Edit** → text-input, "Remind about: / Hi", key **OK**
      - **pressing OK** → item-view, "Alarm off", key **OK**
    - `10-2/Options-3` **Send** → number-input, "Phone number:", key **Search**
      - **pressing Search** → text-editor, "A", key **OK**

### Reminders › Erase

- `10-3` **Erase** → submenu (3-row list)
  - `10-3-1` **One by one** → item-view, "Hi", key **Erase**
    - **pressing Erase** → item-view, "Erase? Hi", key **OK**
  - `10-3-2` **All** → confirm-query, "Are you sure?", key **Yes**
    - **pressing Yes** → timed-note, "Reminder memory empty"; then back to the list after ≈2.9 s

### Clock › Alarm clock

- `11-1` **Alarm clock** [07:00] → submenu (3-row list)
  - `11-1-1` **On** → text-input, "Set alarm time: / 07:00", key **OK**
    - **pressing OK** → timed-note, "Alarm on"; then back to the list after ≈1.5 s
  - `11-1-2` **Off** → timed-note, "Alarm off"; then back to the list after ≈1.5 s

### Clock › Clock settings

- `11-2` **Clock settings** [10:10] → submenu (3-row list)
  - `11-2-1` **Hide clock** → timed-note, "Clock hidden"; then back to the list after ≈1.4 s
  - `11-2-2` **Set the time** → text-input, "Time: / 10:10", key **OK**
    - **pressing OK** → timed-note, "Time is set"; then back to the list after ≈1.5 s
  - `11-2-3` **Time format** → option-list, key **OK**
    - entries: **24-hour** ▸ · 12-hour
    - 24-hour: timed-note "24-hour clock selected", then back
    - 12-hour: timed-note "12-hour clock selected", then back

### Clock › Date setting

- `11-3` **Date setting** [13.10.2026] → text-input, "Date: / 13.10.2026", key **OK**
  - **pressing OK** → timed-note, "Date is set"; then back to the list after ≈1.6 s

## Hidden, unreachable or uncertain

**Numbers skipped in the emulator** are entries the firmware hides for this phone, SIM or
accessory set. The user guide's list of menu functions names most of them, and their strings
exist in the firmware text table:

| number       | entry                                                                          | why it is hidden here                                                                                                                                   |
| ------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6-1-5, 6-1-6 | Line selection, Automatic answer ("Automatic answer" 0x0fc, "Line 1"/"Line 2") | Line selection needs a two-line (ALS) SIM. Automatic answer needs a headset or car kit. Both would come after 6-1-4, so no gap shows                    |
| 6-2-5        | Lights (0x260 / 0x2b4)                                                         | only with the PPH-1 car kit                                                                                                                             |
| 6-3-3        | Fixed dialling (0x2d2)                                                         | needs a SIM with fixed dialling (FDN)                                                                                                                   |
| 7-5          | not identified                                                                 | a network- or SIM-dependent divert. The firmware has "Divert when off, no answer, or no coverage" (0x215), which is a candidate, but this is unverified |
| 8-5          | not identified                                                                 | hidden Games entry                                                                                                                                      |
| 12-n-2-4     | (none)                                                                         | Personalise reuses the Tones numbers, and 5-4 Composer has no per-profile equivalent                                                                    |
| 13           | SIM services (0x3f2)                                                           | only with a SIM Toolkit SIM. The emulator SIM has none                                                                                                  |

The main-menu table (`extracted/6.39/menu/main_menu.json`) also has hidden entries for SIM
services (dynamic text), "Net monitor" (0x00a, service-enabled) and "Picture" (0x047). None of
them appeared.

**Behind codes the emulator could not pass.** The crawl's in-menu `Code error` for `12345` was
an emulator effect, not a different code (plan 15 Task 0): the virgin PMM stores the code record
enciphered under another key, the firmware reloads it when the clock wizard is left, and from
then on no 5-digit code verifies. The emulator's own oracle (`build/dct3_boot_trace` with
`SECCODE=1`) and calling the firmware's set-code routine with `12345` at standby fixed it, and
plan 15 captured what follows the code for `6-3-5` Phone security, `6-3-6-1` Change security code,
`6-4` Restore factory settings and `4-5-5` Clear timers (`captures/6.39/plan15/accept/`; see the
spec [`stock/storage-and-settings.md`](stock/storage-and-settings.md)). A wrong code's `Code error` (≈2.9 s) returns
to the empty `Security code:` prompt, not to the list: the crawl's return to the list was the
crawler pressing C on that empty prompt. Phone book › Erase › Erase all, and the PIN, PIN2 and
barring-password prompts (`6-3-1`, `6-3-6-3`, `6-3-6-4`, call barring) were not entered.

**No response in the virgin EEPROM.** `2-4` Picture messages, `2-5` Templates, `2-6` Smileys,
the editor's Options › Template and Insert smiley, and Screen saver › Screen saver (`5-9-4`,
`12-n-2-9-4`) do nothing for 3.5 s and later. On a shipped phone these hold preloaded pictures,
templates and smileys, so their lists are missing here.

**Needs incoming traffic.** Inbox (`2-2`), Missed calls (`4-1`) and Received calls (`4-2`) only
showed their empty notes, because the emulator cannot inject an SMS or a call. Their entry
views and Options menus should match the Outbox / Dialled numbers ones in "With content", but
that was not verified.

**Network operations.** "Requesting" (call waiting, barring and divert Activate/Cancel/Status,
`7-6`) and "Searching" (`6-2-4-2`) never finished within the observation window on the
emulator's synthetic network, so the result notes are unknown.

**Virgin-EEPROM values** (they differ on a factory-fresh phone):

- Several option lists open with nothing highlighted: the index reads `-0` and the key reads
  **Quit** until ▼ is pressed. This happens for Ringing tone, Ringing volume, Incoming call
  alert, Keypad tones, Warning tones and Vibrating alert, both in Tones and in each profile,
  and for Screen saver › Timeout and `7-3-4` Set delay. The item screens still show a value hint
  (e.g. "Level 1").
- Info service topic names are drawn as six U+E000 boxes. The 6th profile is named with two
  boxes (□□), and the 5th is "(empty)".
- Game score IDs show junk ("ç", "ÆG"), and Snake II / Space impact report "Top score: 45".
- Message centre "+1234567890" and voice mailbox "793000333" come from the emulator SIM.

**Not explored further.** Game play after New game, the Snake II and Bantumi Level bars, the
calculator's arithmetic, and the stopwatch and countdown once started. Leaves were captured
only up to the first screen, except where "With content" presses the key once more.

**Labels.** 893 labels equal a firmware string or a ringing-tone name. 56 others ("Level 1"…
"Level 5") have I/l confirmed against the firmware vocabulary, and 22 are glyph-exact with no
look-alike characters ("Set 1", "5 seconds"). The Cyrillic language names Русский, Български
and Українська are exact glyph readings, with Latin/Cyrillic look-alikes resolved as Cyrillic.
The topic box glyphs are marked ⚠. A label is a pixel reading in every case. Where a label is
not a firmware string, the firmware probably composes it at run time (e.g. "Level %d").

**Crawl artefacts handled.** The firmware can redraw a list well after a key press (tone lists
play a preview), so the crawler re-identifies the highlighted entry before opening each one.
`aligncheck` over all 1,379 opened entries found no entry opened under the wrong label.
`7-3-4` Set delay opens with nothing highlighted and no deeper index, so it was walked separately
(`tools/menutree/set-delay.cap`).

## Cross-check against the user guide

The user guide's list of menu functions (manualslib 299870, pp. 4–5) agrees with the crawl on
the 12 main menus and on the Phone book, Tones and Clock entries in order. It agrees on Settings
too, apart from the hidden entries above. Two labels differ: the guide calls 2-3 "Saved messages"
where this firmware shows **Outbox**, and 5-7 "Warning and game tones" where it shows
**Warning tones**. The guide is for a different firmware and region, so the crawl's labels win.
