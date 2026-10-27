# Number entry, calls and the call register (plan 22)

v6.39 facts from the plan 22 captures (`$REF/captures/6.39/plan22/`, the emulator with a patched
network that assigns speech calls a traffic channel; see `docs/plans/22-call-register-divert-and-dialling.md`
"Task 0 outcome"). Times are emulated ms after the triggering key or network event. Divert, call
waiting, supplementary services and costs are plan 22b's.

## Standby number entry

- A digit, `*` or `#` at standby starts the entry with that key. The operator line goes (56 ms
  after the key); the clock and the ladders stay. 1-16 characters: the large face, right-aligned
  (rightmost cell from x 69), 8 per line, newest line at top 24, the older at top 9 (which hides
  the clock). 17-33: the small face, 11 per line at tops 29/20/11; past 33 only the last 33 show.
- Up to 60 characters, first in first out: a 61st key appends and drops the oldest.
- `*` cycles `*` `+` `p` `w` (in any position); the pending character commits ≈1427 ms after its
  key by vanishing for 480 ms and coming back; a digit commits it at once. `#` does not cycle.
- C deletes the last character (≈45 ms); C on the last one returns to standby (the operator drawn
  88 ms after the rest). Held C deletes at its down and clears at ≥ 500 ms held. No timeout.
- ▲/▼ cycle the soft key `Call` → `Save` → `Convert` (held: again at ≈787 ms, then every
  ≈480 ms); a digit or C edits the number and keeps the soft key. `Save` opens the phone book's
  `Name:` (plan 19), retaining the number and saving after OK; `Convert` converts with the Calculator's rate (plan 20: the virgin rate gives
  `Dividing by zero not allowed`); the power key opens the profile list (plan 17), C back.
- Held `1` on an empty entry (≥ 500 ms) calls the voice mailbox; other held keys are taps while
  Speed dialling is off.
- `#` typed after digits looks the number up as a SIM location at once: `No phone numbers` for an
  empty location (1-50 on the emulator SIM), `Invalid location` for 0 or past the SIM, ≈2.9 s, then
  standby; a digit on the note starts a new entry.
- `*#06#` shows `Serial No.` and the IMEI (`?` glyphs on the virgin EEPROM); `*#0000#` shows
  `V 06.39` / `23-12-04` / `NHM-5`; C or Navi leaves for standby; ▼ opens the phone book.
- **Hand-over:** a digit, `*` or `#` on a timed note (`Invalid shortcut` included), a list entered
  with Navi or after its shortcut window, an option list, the Level page, the calculator's Options,
  the carousel after its window and the missed-call notice start the entry with that key. A `#`
  code's note or page draws 16-36 ms after the entry's redraw; the code pages end on a key's down.
- The vanishing `*` leaves a space's width (3 px) at the end of the line (`hold/inside-star` c).

With Speed dialling On, held 2–9 shows the location's full number with End after about 0.5 s;
Calling starts on release (`phone-book/hold-on-2`). Off leaves the typed digit; held 1 calls the
voice mailbox independently.

## Calls

- **Call:** a digit 2–9 dials its assigned or fallback SIM location, else `Speed dial number not saved`; 33 or more digits → `Invalid phone
number` (then the entry); `112` → `Attempting emergency call`; a string ending in `#` after a
  non-digit or starting with a service prefix (`04`) → `Requesting` (22b). Otherwise the number is
  dialled, cut at a later `+` or the first `p`/`w`.
- **Calling:** `Calling.` small at (6, 7) at 53 ms, the number thin right-aligned at top 29 (14 per
  line, overflow at top 20) 48-111 ms later (≈100 ms from the entry, ≈55 ms from a list), dots
  476 ms later and then every ≈503 ms, `End`. Alerting: a 76 ms blank at
  2253 ms, then a 7×7 call icon at (6, 8) and `Call 1` thin at (17, 8). The connect redraws the
  same screen after a 73 ms blank. No call timer is ever drawn.
- **Saved names:** `phone-book/hold-on-2` replaces the number with `anna` at (6, 16)
  about 1 s after Calling; the 20-digit number in `standby-list-call` resolves after about 1.77 s.
  Calling's dots continue. The alerting screen shows the name at (17, 8), clipping its text before
  the three dots at x 72 when it is too wide. The short named call alerts about 2.1 s after
  Calling; the long SETUP reaches the stock cell later (2.873 s in this recording).
- **End:** a blank `End` frame ≈80 ms, `Menu` without the operator ≈85 ms, standby. C while
  calling does nothing; C in a call toggles the soft key `End`/`Options`.
- **The network ends the call:** a blank `End` 87 ms, the checkered `Call 1` 1471 ms, then
  standby; three 1000 Hz beeps. Every cause looks alike.
- **In a call:** ▲/▼ show `Volume` (its first redraw erases the ladders 42 ms) with stepped bars
  for ≈1.9 s after the last; held, they repeat at 812 ms and every ≈478 ms. Digits, `*`, `#` sound
  their DTMF at the earpiece word and stay shown in the entry's layout (`*` cycling and committing
  as in the entry) with `Options` until 5684 ms after the first or 4551 ms after the last, then
  `End`. Options, the power key's list: the ladders erased ≈35 ms, the screen with the handset at
  (1, 1), back through a 74 ms blank call screen; the in-call Options act on key-downs. Options:
  `End active call`, `Hold`, `New call`, `Send DTMF`, `Phone book`, `Mute` (`Muted`, then `Muted`
  under the call). The power key opens the profile list.
- **Incoming:** 1982 ms after the network's ring: the number thin right-aligned at top 8 (15+
  digits on two left-aligned lines from x 8; a `+` dropped), `calling` blinking 480/480 ms,
  `Answer`. Answer (or Navi held) → `Call 1`, the traffic channel's blank ≈870 ms after the key
  (859-949 ms); C rejects (not listed in Received calls; Missed calls UNVERIFIED). Keys while ringing
  change nothing on screen; ▲/▼ show Volume. The far end hanging up first makes a missed call:
  the checkered `Call 1` 664 ms, then the notice `<n>` / `missed` / `call(s)` with `List`; List →
  `<n> new number(s)` (distinct numbers) → `Missed 1:`.
- **Interruptions:** the ringing screen replaces any screen (the cell's paging: 1662-2116 ms after
  the ring over other screens). Reject and missed return to it with the handset drawn at (1, 1)
  444-684 ms (missed ≈710 ms); a timed note under it has ended. An answered call over another
  screen keeps it (with the handset) until the call connects, then the call screen; it ends at
  standby, except over the number entry, whose characters stay with End for the call and come
  back 146 ms after End. A Snake II game in play is suspended to its menu. A ring during a call
  shows 2506 ms after that call left the screen.
- **Sound:** DTMF pairs (1209/1336/1477 × 697/770/852/941 Hz) on the tone generator at the Keypad
  tones word, ≈140 ms for a tap, to the release for a hold; the ringback 425 Hz ≈1016 ms on /
  ≈3820 ms off from ≈2218 ms until the connect; ringing per Incoming call alert (Ringing,
  Ascending, Ring once: one pass, its vibrator pulses continuing 287 ms before Ringing's second
  cycle; Beep once: one 3000 Hz beep, Off: the vibrator only); the caller's hangup stops the
  ringing 167 ms later. In a call keys beep 900 Hz at the earpiece word; ▲ at the top and every ▼
  sound 1125 Hz for ≈322 ms at the new level's word (a tone still sounding ends a ▼'s with it),
  ▲ that raises the level is silent; an emergency call beeps 900 Hz 54 ms in the earpiece.

## Call register

- Missed calls (10), Received calls (10), Dialled numbers (20), newest first, a repeated number
  moved to the top. Entry view: `Missed 1:` small at (0, 7), the number large with its last cell
  ending at x 83, top 24, `Options`; ▲/▼ wrap, C acts on its key-down. Standby ▲ opens the dialled
  list with `Call` (standby with the ladders erased ≈23 ms first; ▲ to older numbers, ▼ back; C
  draws standby without the operator 72 ms), or `No last dialled numbers`.
- Options (opening on Call): `Call`, `Send SMS`, `Time of call` (`13.10.2026` / `10:10:00`, or
  `10:10:00 am`; large at tops 7/21), `Edit number` (plan 18's `Phone number:`; OK → the standby
  entry), `Save`, `Erase` (`Erase?` small at top 4 over the number at top 15; OK → `Erased`, C →
  the entry view). The Options list has no indicator. Messages' Use number opens the standby entry
  with the number.
- The lists are RAM: a power-off empties them. Erase recent call lists erases the chosen lists.
- Show call duration counts connected time in seconds from the connect's redraw to End (`00:00:00`
  until ≈865 ms, then one more every ≈980 ms of emulated time); the totals persist; Clear timers
  and Restore factory settings zero them.

## UNVERIFIED

- Whether a rejected call is listed in Missed calls (not listed); a name in the entry view (the
  phone book's, plan 19); numbers longer than 10 digits in the entry view (lines of 10).
- Time of call's seconds (the emulator's RTC is frozen: `10:10:00`).

## Artefacts (not reproduced)

| Artefact                                              | Cause                                         |
| ----------------------------------------------------- | --------------------------------------------- |
| The ringback for the whole call, durations `00:00:00` | the stock emulator assigns no traffic channel |
| Standby without its signal ladder after a short call  | the patched network's first TCH measurement   |
| `10:10:00` in Time of call                            | the emulator's RTC is frozen                  |
| Link times 2253 / 1982 / ≈80 ms                       | the synthetic cell (phone time, UNVERIFIED)   |
| One call alerting at 2107 ms, releases at 109 ms      | the cell's timing (known gaps, Task 10)       |
