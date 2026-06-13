# Nokia 3310 (original, year 2000) — Authenticity Specification

Ground truth for replica behavior. Researched 2026-06-12.

**Model researched:** Nokia 3310 (NHM-5), released September 2000, Series 20 software, GSM 900/1800.
**Primary source:** Original Nokia 3310 User Guide (document 9357246, Issue 3, © Nokia 2000/2001), accessed via [ManualsLib (116-page scan)](https://www.manualslib.com/manual/112008/Nokia-3310.html) and the HTML mirror at [nokia-3310.helpdoc.net](https://nokia-3310.helpdoc.net/en/). Secondary: [Wikipedia – Nokia 3310](https://en.wikipedia.org/wiki/Nokia_3310), [Wikipedia – Snake II](https://en.wikipedia.org/wiki/Snake_II), [mobile-review.com original 2000 review](https://mobile-review.com/review/nokia-3310.shtml), [AVID – Nokia boot animations](https://www.avid.wiki/Nokia).
Items marked **UNVERIFIED** could not be confirmed against a primary source; best guess is given. **Where the spec is unverified, implementations use the stated best guess.**

---

## 1. Hardware front-face layout (for 3D model)

Sources: [Wikipedia](https://en.wikipedia.org/wiki/Nokia_3310), manual "Your phone" section ([p.18–19](https://www.manualslib.com/manual/112008/Nokia-3310.html?page=18)), [mobile-review.com](https://mobile-review.com/review/nokia-3310.shtml).

- **Dimensions: 113 × 48 × 22 mm — VERIFIED** (Wikipedia). Weight 133 g with standard BMC-3 NiMH 900 mAh battery. Candy-bar with rounded "pebble" outline; Wikipedia notes the design language of arcs; the fan archive notes the control buttons were styled to "resemble a smile". Xpress-on interchangeable front/back covers (default colors incl. dark blue, grey).
- **Top edge: power button.** A single small, stiff black oval button on the top of the phone (Wikipedia: "stiff black power/profile button on top"). Functions (manual p.18, verified): press-and-hold ≈1 s = on/off; short press in standby = opens the **profile list**; short press inside a menu = turns on display/keypad lights for 15 seconds.
- **Front, top-to-bottom:**
  1. Earpiece grille above the display.
  2. **Display window** (1.5″, 84×48 LCD) in upper third of face.
  3. **NaviKey** — the single large **blue**, horizontally elongated pill/lozenge key directly below the display, centered. It is the phone's only softkey. Its current function is shown as a **dynamic guiding text at the bottom of the screen directly above it** ("Menu", "Select", "OK", "Call", "Answer", "Unlock", "Options", "Use", "Send", "Read"...). (Manual p.19, verified.)
  4. **C key** — small grey key **below-left** of the NaviKey. (Verified: "C button on the left".)
  5. **Up/down scroll keys** — **below-right** of the NaviKey, mirroring the C key. The manual calls them "scroll keys" (two logical keys, ▲ and ▼). Physically they are molded as a single vertical rocker piece with the up arrow on the upper end and down arrow on the lower end (mobile-review describes a rocker; Wikipedia-derived sources say "the up/down navigation button on the right"). **UNVERIFIED nuance:** whether the plastic is one rocker or two abutting keys — model it as one vertical rocker with two press zones, right of center, symmetric with the C key.
  6. **Digit grid 4×3** below: rows `1 2 3` / `4 5 6` / `7 8 9` / `* 0 #`. The 3310's signature keypad styling: each row of keys is a wide, curved "wave" — keys are broad, gently arc-shaped slivers that interlock with the rows above/below (later revisions used a one-piece "peanut-like interconnected silicone key mat" per Wikipedia), giving the keypad its smiling, scalloped look. Keys get printed letters `ABC`…`WXYZ` on 2–9, `+` on `*` key (UNVERIFIED print detail), space symbol on 0 (UNVERIFIED print detail).
- No side buttons, no IR port, no camera. Charger socket and mic on bottom.

---

## 2. Display

Sources: [Wikipedia](https://en.wikipedia.org/wiki/Nokia_3310) (84×48), manual "Display indicators" ([p.20](https://www.manualslib.com/manual/112008/Nokia-3310.html?page=20)), [helpdoc standby page](https://nokia-3310.helpdoc.net/en/1-your-phone/display-indicators/standby-mode/).

- **Resolution: 84 × 48 px, monochrome — VERIFIED** (Wikipedia: 1.5″, 64 ppi, "5 lines"). Black pixels on green backlit background (backlight green; see §9).
- **Zones:**
  - **Left edge:** signal-strength indicator — antenna glyph with a vertical bar stack; "the higher the bar, the stronger the signal" (manual, verified).
  - **Right edge:** battery indicator — battery glyph with vertical bar stack; "the higher the bar, the more power left" (verified).
  - **Bar segment count: UNVERIFIED — best guess 4 segments each**, drawn as short horizontal rungs stacked vertically, growing upward (some Nokia models use 5; period photos of the 3310 most commonly show 4).
  - **Top row / status area:** operator (network) name centered; status icons appear here — e.g. envelope (message received), voicemail icon, keyguard icon, alarm icon, and a "2" in the **top-left corner** when phone line 2 is selected (manual p.71, verified). The **menu shortcut number appears top-right** when inside menus (manual p.40, verified).
  - **Content area:** middle of screen.
  - **Bottom row:** the **NaviKey guiding text**, centered at the very bottom (single softkey label — never two).
- **Font:** Nokia's tall narrow pixel font. **UNVERIFIED metrics, best guess:** body text ≈5×7 px glyphs + 1 px spacing → ~14 characters per line in editors; ~3 text lines in the content area plus header and softkey rows ("5 lines" total per Wikipedia/GSMArena convention). Standby operator name and dialed digits render in a larger/bolder variant. In the SMS editor the remaining-character counter (counting down from 160) and input-mode indicator (`Abc` / `123` / dictionary) sit in the top-right/top row (manual "Writing text"; counter position UNVERIFIED).

---

## 3. Boot / power-off sequence

Sources: manual p.25 ([ManualsLib](https://www.manualslib.com/manual/112008/Nokia-3310.html?page=25)), [AVID wiki – Nokia](https://www.avid.wiki/Nokia), [startup-comparison video](https://www.youtube.com/watch?v=bxx54-uzccs).

1. **Press and hold power "for a second"** (manual, verified).
2. Backlight turns on; the **"connecting hands" animation** plays: two hands animate toward each other and clasp; on the 3310 specifically the NOKIA wordmark is **small and at the bottom right** (AVID wiki, verified) — unlike the 3210 where the wordmark fades in below the hands.
3. **No startup sound** on the original 3310 (the Nokia startup jingle arrived on later models) — **UNVERIFIED but consistently shown in period videos**. **No power-on vibration** — **UNVERIFIED, best guess: none**.
4. **PIN prompt** if _PIN code request_ is enabled: "key in the code and press OK" (manual p.25, verified). **UNVERIFIED ordering, best guess: after the hands animation, before standby.**
5. **Welcome note**, if the user has set one (Settings → Phone settings → Welcome note): "a message which is shown briefly when the phone is switched on" (manual p.72, verified).
6. Network search completes → **standby screen** with operator name.

- **Power-off:** press and hold power; display clears to blank. **UNVERIFIED: no shutdown animation/sound — best guess: screen simply blanks.**
- Total boot ≈3–5 s (UNVERIFIED timing from videos).

---

## 4. Standby screen

Source: manual "Display indicators / Standby mode" (p.20, verified) and [helpdoc](https://nokia-3310.helpdoc.net/en/1-your-phone/display-indicators/standby-mode/).

Exactly four elements (manual, verbatim list):

1. **Network indicator** — operator name (or "No service"), centered upper area.
2. **Signal strength** bar stack, left edge.
3. **Battery level** bar stack, right edge.
4. **Navi key function** — the word **`Menu`** at bottom center. **VERIFIED: only "Menu" is shown — the 3310 has ONE softkey; there is no "Names" label** (that two-label layout belongs to two-softkey Nokias like the 3210/6110).

- **Clock:** if _Clock settings → time display on_, the time is shown in standby (12/24 h selectable) (helpdoc Clock settings, verified). Position: below/beside operator name — **UNVERIFIED exact pixel position, best guess upper-right under the battery bars** (per period photos).
- **Screensaver:** after a user-set **timeout**, the selected **picture** (chosen from the picture-message graphics set) replaces the standby display; configured at **Tones → Screen saver (Menu 5-9)** with `On / Off / Timeout`-style options (manual p.69 + helpdoc, verified). Wikipedia adds screensavers could come from received picture messages. Any keypress dismisses it (UNVERIFIED, best guess). Per-profile screensaver setting is referenced in Profiles (manual p.90, verified).
- Typing a digit in standby replaces the label with **`Call`** options flow; up arrow opens **phone book name list**, down arrow opens **last dialled numbers** (see §6).

---

## 5. Complete main menu tree (names and order from the user guide)

Source: "List of menu functions", manual p.41–43 ([p.41](https://www.manualslib.com/manual/112008/Nokia-3310.html?page=41), [p.42](https://www.manualslib.com/manual/112008/Nokia-3310.html?page=42), [p.43](https://www.manualslib.com/manual/112008/Nokia-3310.html?page=43)) cross-checked against the [helpdoc section list](https://nokia-3310.helpdoc.net/en/). All items below are **VERIFIED** against the manual unless noted.

**Menu presentation:** one top-level item shown at a time as a full-screen page with the menu name and an icon (icons are animated — **UNVERIFIED but iconic; best guess: small 2–4 frame animation per menu**); scroll ▲▼ cycles through; a **scroll/position indicator on the right edge** shows place in the list (UNVERIFIED for 3310 specifically; present on Series 20 lists). **Shortcut numbering (verified, p.40):** press `Menu`, then key the item number(s) **within three seconds** to jump (e.g. `Menu` `2` `1` = Write messages); the **shortcut number is displayed top-right**. Exit/back one level with `C`; **press and hold `C` to exit to standby** (p.40; key glyph stripped in scan — hold-to-exit key is C, minor UNVERIFIED).

1. **Phone book (Menu 1)** — 1-1 `Search` · 1-2 `Service Nos.` · 1-3 `Add name` · 1-4 `Erase` · 1-5 `Edit` · 1-6 `Assign tone` · 1-7 `Send b'card` (send/receive business card via SMS) · 1-8 `Options` → `Type of view`, `Memory status` · 1-9 `Speed dials` · 1-10 `Voice tags` (voice dialling — yes, the original 3310 has it; helpdoc "Voice dialling (Menu 1-10)", verified). Contacts are stored on the SIM (UNVERIFIED, widely reported; "Memory status" reports SIM usage).
2. **Messages (Menu 2)** — 2-1 `Write messages` · 2-2 `Inbox` · 2-3 `Outbox` (the 3310 uses _Outbox_, not "Sent items" — verified) · 2-4 `Picture messages` · 2-5 `Templates` · 2-6 `Smileys` · 2-7 `Message settings` → per-set (`Set 1`…) and `Common` · 2-8 `Info service` · 2-9 `Voice mailbox number` · 2-10 `Service command editor`.
3. **Chat (Menu 3)** — no submenu; SMS-based conversation mode: enter recipient number (or from Phone book), choose a **chat name** (nickname); incoming replies prefixed `>` with sender's nickname, your messages prefixed `<`; write/`Send` loop; Options as in SMS editor minus Save/Chat history (manual p.60, verified).
4. **Call register (Menu 4)** — 4-1 `Missed calls` · 4-2 `Received calls` · 4-3 `Dialled numbers` · 4-4 `Erase recent call lists` · 4-5 `Show call duration` · 4-6 `Show call costs` · 4-7 `Call cost settings` · 4-8 `Prepaid credit`.
5. **Tones (Menu 5)** — 5-1 `Ringing tone` · 5-2 `Ringing volume` · 5-3 `Incoming call alert` (options verified: `Ringing`, `Ascending`, `Ring once`, `Beep once`, `Off`) · 5-4 `Composer` · 5-5 `Message alert tone` · 5-6 `Keypad tones` (volume levels; exact level list UNVERIFIED — best guess `Off / Level 1 / Level 2 / Level 3`) · 5-7 `Warning and game tones` · 5-8 `Vibrating alert` · 5-9 `Screen saver`. (Note: screensaver really does live under Tones on this phone.)
6. **Settings (Menu 6)** —
   - 6-1 `Call settings` → `Automatic redial` (up to 10 attempts) · `Speed dialling` (on/off; hold key 2–9 dials; **hold 1 = voice mailbox**) · `Call waiting options` · `Own number sending` (On/Off/Set by network) · `Phone line in use` (line 1/2) · `Automatic answer` (car kit/headset only). (p.70–71, verified.)
   - 6-2 `Phone settings` → `Language` · `Cell info display` · `Welcome note` · `Network selection` (Automatic/Manual) · `Lights` (only with car kit PPH-1) · `Confirm SIM service actions`. (p.72–73, verified.)
   - 6-3 `Security settings` → `PIN code request` · `Call barring service` (5 barring options) · `Fixed dialling` · `Closed user group` · `Security level` · access-code change items (exact label `Access codes`/`Change access codes` — UNVERIFIED). (p.74+, partially verified.)
   - 6-4 `Restore factory settings`.
7. **Call divert (Menu 7)** — `Divert all voice calls` (without ringing) · `Divert when busy` · `Divert when not answered` · `Divert when phone off or no coverage` · `Divert when off, no answer or no coverage` · `Cancel all diverts`. (p.43, verified.)
8. **Games (Menu 8)** — game list **in phone order: `Snake II`, `Space Impact`, `Bantumi`, `Pairs II`** ([helpdoc Games](https://nokia-3310.helpdoc.net/en/12-games-menu-8/), verified). Per-game options (verified): `New game` · `Top score` · `Instructions` (scrollable help text) · `Level` (difficulty) · `Continue` (resume paused game) · `Settings` (game `Sounds`, `Lights`, `Shakes` i.e. vibration — vibration effects only work if Vibrating alert is on; also Club Nokia membership info).
9. **Calculator (Menu 9)** — single editor, no submenu. `#` inserts decimal point (key glyph stripped; UNVERIFIED which key, best guess `#`); **`*` pressed once/twice/three/four times = `+`, `-`, `*`, `/`** (verified wording "press once for +, twice for -, three times for \*, four times for /"); `Options` → `Equals`, plus currency functions (`Exchange rate`, `To home`/`To foreign` conversions, incl. conversion in standby); **press and hold `C` to clear display** for new calculation; limited accuracy disclaimer (p.82, verified).
10. **Reminders (Menu 10)** — `Add new` (write note text → `Alarm on` (date+time) / `Alarm off`) · `View all` (scroll; Options incl. erase). Phone alarms when date/time reached. (p.85, verified.)
11. **Clock (Menu 11)** — 11-1 `Alarm clock` (with snooze) · 11-2 `Clock settings` (time display on/off in standby, set time, 12/24 h format) · 11-3 `Date setting` · 11-4 `Stopwatch` · 11-5 `Countdown timer` · 11-6 `Auto update of date and time`. (p.43 + p.87 + helpdoc, verified.)
12. **Profiles (Menu 12)** — profile list (verified, p.91): `General` ("the default setting") · `Silent` (mutes all tones) · `Discreet` (quiet tones) · `Loud` · a fifth **`(empty)`/replaceable slot** that "you can replace with a profile that you have received" (Club Nokia downloadable). Per-profile: `Activate`, `Personalise` (ringing tone, ringing volume, and the other Tones-menu items incl. screensaver), `Rename` for custom (UNVERIFIED rename scope).
13. **SIM services (Menu 13)** — operator/SIM-dependent; appears only if SIM supports it.

---

## 6. Navigation behaviors

Sources: manual p.19 keys, p.28, p.34–38, p.32 ([scroll keys verbatim](https://nokia-3310.helpdoc.net/en/1-your-phone/using-the-keys/scroll-keys/), [power key](https://nokia-3310.helpdoc.net/en/1-your-phone/using-the-keys/power-key/), [traditional input](https://nokia-3310.helpdoc.net/en/3-basic-functions/writing-text/traditional-text-input/)).

- **NaviKey:** context softkey = select/confirm/primary action. Standby: `Menu`. Number typed: `Call`. Incoming call: `Answer`. In lists: `Select`/`OK`/`View`. In editors: `Options`. Also `Send`, `Use`, `Unlock`, `Read` etc. There are no Send/End hardware keys — calls are placed with NaviKey (`Call`) and ended with it (`End`).
- **C key (verified, p.19):** deletes character to the left when entering text; **press-and-hold deletes all characters**; steps back to the previous menu level; **rejects an incoming call**; (with `Options`) used for clearing. Back out of menus level-by-level with C; hold to return to standby.
- **Scroll keys in standby (VERIFIED, helpdoc verbatim):** **▲ up = opens the Phone book name/number list; ▼ down = opens the list of last dialled numbers** (redial list, last 20 numbers; scroll then press `Call`).
- **Scroll keys elsewhere (verified):** browse menus/settings; **in text entry they move the cursor left (▲) and right (▼)**; during a call they adjust earpiece volume.
- **Power key short-press in standby = profile switcher** (verified). **Long-press `#`: no documented function on the 3310** (silent-profile toggle via # arrived on later models) — UNVERIFIED/absent, recommend no-op.
- **Long-press `1` in standby = dial voice mailbox** (verified, speed-dial section). Long-press `2`–`9` = speed dial if enabled (verified).
- **Keyguard (verified, p.32):** lock = press **`Menu` then `*` "quickly"** (within ~1.5 s); unlock = press **`Unlock` (NaviKey) then `*`** quickly; keyguard icon shown; answering calls still works; emergency 112 possible while locked.
- **Text entry (verified):**
  - Two modes: **predictive text input** (T9-style dictionary; one keypress per letter; word matched against dictionary; dictionary language selectable; can be set off via Options → `Dictionary`) and **traditional multi-tap**.
  - Multi-tap: press key repeatedly until the character appears; **`0` = space** (verified); **`1` cycles punctuation/special characters**; **`*` opens the special-character picker** (grid of symbols; scroll, press `Use`) (verified); **short press `#` switches upper/lower case** (verified); **press-and-hold a digit key inserts that number; press-and-hold `0` toggles letter/number mode (`123` indicator shown)** (verified); same-key consecutive letters: press ▼ (cursor right) or wait one second (verified); `C` deletes left, hold-`C` clears all.
  - In predictive mode, accept word with `0` (space) — UNVERIFIED detail, standard Nokia behavior.
  - Dialing screen: `*` pressed repeatedly cycles `*`/`+`/`p`/`w` for international prefix and dialing pauses — UNVERIFIED exact cycle, standard Nokia behavior.

---

## 7. Games

Sources: [helpdoc Games](https://nokia-3310.helpdoc.net/en/12-games-menu-8/) (list + options, verified), [Nokia 8390 manual Snake 2 rules](https://www.manualslib.com/manual/653654/Nokia-8390.html?page=134), [Wikipedia – Snake II](https://en.wikipedia.org/wiki/Snake_II), [StrategyWiki – Snake II](https://strategywiki.org/wiki/Snake_II) (via search snippets; full page fetch was blocked — flagged below).

**Shipped games (VERIFIED): Snake II, Space Impact, Bantumi, Pairs II** (in that in-phone order). Common options per game: New game / Top score / Instructions / Level / Continue / Settings (sounds, lights, shakes). A paused game resumes via `Continue`; "to start a paused game, press any key except the navigation or menu keys" (helpdoc, verified).

### Snake II — reimplementation detail

- **Controls (VERIFIED via Nokia 8390 manual + StrategyWiki snippets):** `2` = up, `4` = left, `6` = right, `8` = down ("use keys 2, 4, 6 and 8 to turn the snake toward food"). The snake **cannot reverse** into itself. On the 3310 the ▲/▼ scroll keys also steer (relative turn) — **UNVERIFIED**. Pause: reported as `C`/softkey (StrategyWiki snippet) — **UNVERIFIED which exact key; an incoming event also pauses; resume via Games → Continue.**
- **Movement:** discrete cell grid; snake advances one cell per tick; constant tick rate set by level. Grid dimensions on the 84×48 screen — **UNVERIFIED; best guess ~20×11 cells of 4×4 px plus a 1-row score bar at top.**
- **Playfield:** **wraparound edges** — leaving one side re-enters from the opposite side; game over **only** on collision with own body or maze walls (verified, Wikipedia + 8390 manual).
- **Mazes (VERIFIED count, names via StrategyWiki snippet):** "No maze" + **five mazes: Box, Tunnel, Mill, Rails, Apartment** — Maze 1 (Box) is just a perimeter wall; complexity increases with number.
- **Levels (VERIFIED): speed levels 1–9**; higher level = faster snake **and more points per food** ("the higher the level, the more points you get when you eat things" — StrategyWiki snippet). Exact formula **UNVERIFIED — best guess: points per food = level number** (widely reported for Nokia Snake).
- **Food & bonus (partially verified):** normal food appears one at a time; eating grows the snake by one segment. A **bonus bug appears after every 5 foods eaten and disappears after ~20 movement ticks** (fan sources via search, UNVERIFIED primary); it's drawn as a larger insect/beetle; **eating it scores more the faster you reach it** (countdown value) and **does not grow the snake** (fan sources, UNVERIFIED). Best guess: bonus value displayed/decrementing from a level-scaled maximum.
- **HUD:** current score top-left in a 1-line bar — UNVERIFIED layout.
- **Death:** snake collides with itself or wall → brief death animation (snake flashes), then **"Game over"** screen with final score; if it beats the stored best, a **new top score notice** is shown and persisted per game (`Top score` option shows "the highest score so far" — verified wording). **UNVERIFIED:** exact death animation/text.
- **Two-player via infrared exists in Snake II generally (Wikipedia) but NOT on the 3310 — the 3310 has no IR port.** Single-player only.

### Others (brief)

- **Space Impact:** side-scrolling shoot-'em-up; `2`/`8` move up/down, `5` fires (UNVERIFIED keys); levels with boss fights; lives counter.
- **Bantumi:** mancala variant vs. phone AI or pass-and-play; difficulty via Level option.
- **Pairs II:** memory/matching game flipping tiles on a grid; themed picture sets.
  (Mechanical details for these three are **UNVERIFIED** — manual only documents the common option menu.)

---

## 8. Sounds

Sources: manual Tones chapter p.65–69, Composer pages ([helpdoc composer](https://nokia-3310.helpdoc.net/en/9-tones-menu-5/composer/creating-a-new-ringing-tone/), verified), [Wikipedia](https://en.wikipedia.org/wiki/Nokia_3310).

- **Key beeps:** `Keypad tones` volume setting (off or levels); short square-wave beep per keypress, muted in Silent profile (profile mutes all tones — verified).
- **Ringtones:** ~**35 built-in monophonic ringing tones** plus space for **7 user/downloaded tones** (Wikipedia, verified secondary). Default tone: **Nokia tune** (Francisco Tárrega, _Gran Vals_ excerpt) — **UNVERIFIED as factory default, best guess yes; it is in the tone list**.
- **Incoming call alert modes (verified):** Ringing / Ascending / Ring once / Beep once / Off. Ringing volume: leveled setting (count UNVERIFIED, best guess 5 levels). Separate `Message alert tone`; `Warning and game tones` toggle; `Vibrating alert` on/off.
- **Composer (Menu 5-4, verified mechanics):** notes entered with number keys (**1–7 = c, d, e, f, g, a, b**); **8 = shorten duration (−), 9 = lengthen (+)** (default duration 1/4); **0 = insert rest** of same duration as previous note; **`*` = set octave** (octave shown as digit after note, e.g. `e1`); **`#` = sharp** (shown as `#` before note, e.g. `#f`); **press-and-hold a note key = dotted note (+50% length, shown as dot, e.g. `8.a`)**; ▲/▼ move cursor; `C` deletes; Options → `Play`, `Save` (name it; appended to end of ringing-tone list), `Tempo` (bpm), `Clear screen`, `Exit`. _(Exact key-glyph assignments for 8/9/0/\*/# were stripped from the scan; mapping above matches the manual's ordering and the standard Nokia composer — treat 1–7 note mapping as high confidence, 8/9 assignment as minor-UNVERIFIED.)_ Notation format (RTTTL-like, manual example verbatim): `16.a2 16d2 16#f2 16a1 16d2 16#f2 8a2 1- 8-` — i.e. `[duration][.][#][note][octave]`, `-` = rest. Tones can also be received via SMS.
- **Profiles (VERIFIED list): General (default), Silent, Discreet, Loud, + one replaceable "(empty)" slot** for a received/downloaded profile. Quick access: short-press power button. Each profile personalizes the Tones-menu items (ringing tone, volumes, vibrating alert, screensaver, etc.).
- **No startup/shutdown jingle** (see §3, UNVERIFIED).

---

## 9. Quirks worth replicating

Sources as cited inline.

- **Green backlight** for display and keypad (Wikipedia, verified; blue only on the Singapore/Malaysia 3315 variant). Backlight turns on with any keypress and times out after ~15 s of inactivity (15 s figure verified for the power-key light function, p.18; general timeout UNVERIFIED but same best guess).
- **Screen contrast setting:** **UNVERIFIED location** — not present in the documented Settings tree above; the 3310's contrast is famously adjustable via the hidden `*#*#` style codes/service menu rather than a user menu. Best guess: omit from menu, optionally emulate as hidden code.
- **Vibrating alert** = user option (Tones 5-8, verified); games can "shake" only when it's enabled (verified).
- **Signal/battery as side-mounted vertical bar stacks** (verified concept; 4-segment count is the UNVERIFIED best guess). On charge, battery bars scroll/animate (standard Nokia behavior, UNVERIFIED).
- **Menu shortcut numbers** with the 3-second entry window and top-right shortcut display (verified) — power users navigate `Menu`+digits blind.
- **One-softkey UI**: every screen has exactly one bottom-center label; "back" is always the C key. This asymmetry is core to the 3310 feel.
- **Up=phonebook / Down=redial-list** standby shortcuts (verified) — opposite of what many remember.
- **Screensaver lives in the Tones menu** (verified) and uses picture-message graphics.
- **Welcome note** text on boot (verified), **Chat** as a headline feature (verified), **160-char SMS with countdown counter**, long-SMS chaining up to 459 chars (3 × 153) — Wikipedia, secondary-verified.
- Battery: BMC-3 NiMH 900 mAh, talk 2.5–4.5 h, standby up to ~260 h (mobile-review/Wikipedia) — useful for replica battery-drain pacing.
- **Xpress-on covers** — replica theming hook (verified).

---

## Source index

| Topic                                                             | Source                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dimensions, display, games list, ringtones, covers, backlight     | https://en.wikipedia.org/wiki/Nokia_3310                                                                                                                                                                                                                                                                                            |
| Full user manual (Issue 3, doc 9357246)                           | https://www.manualslib.com/manual/112008/Nokia-3310.html (key pages: 18–20 keys/display, 25 power, 28 redial, 32 keyguard, 34–38 text, 39–43 menus, 44+ phone book, 51+ messages, 60 chat, 61+ call register, 65–69 tones/composer/screensaver, 70–79 settings, 80–81 games, 82 calculator, 85 reminders, 87 clock, 90–91 profiles) |
| HTML manual mirror (verbatim key/scroll/standby/games/clock text) | https://nokia-3310.helpdoc.net/en/                                                                                                                                                                                                                                                                                                  |
| Snake II mechanics                                                | https://en.wikipedia.org/wiki/Snake_II ; https://strategywiki.org/wiki/Snake_II (fetch blocked — snippets only); https://www.manualslib.com/manual/653654/Nokia-8390.html?page=134 (official Nokia Snake 2 rules text)                                                                                                              |
| Boot animation specifics                                          | https://www.avid.wiki/Nokia ; https://www.youtube.com/watch?v=bxx54-uzccs                                                                                                                                                                                                                                                           |
| Original 2000 review (rocker keys, battery, profiles)             | https://mobile-review.com/review/nokia-3310.shtml                                                                                                                                                                                                                                                                                   |

**Open UNVERIFIED items for a follow-up pass (ideally against video/photo evidence):** signal/battery segment count; exact boot timing and PIN-vs-animation order; Snake II grid size, scoring formula and bonus-bug values; scroll-key plastic (one rocker vs two keys); composer 8/9 key assignment; contrast adjustment mechanism; default ringtone; chars-per-line font metrics.
