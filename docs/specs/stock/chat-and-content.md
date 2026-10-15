# Chat and Messages content (plan 18c)

Source: plan 18c Task 0's v6.39 emulator captures under `$REF/captures/6.39/plan18c/`
(`captures/scripts/gen_v639_plan18c.py`, the plan 18c harness copy `tools/harness-p18c`),
documented in [plan 18c](../../plans/18c-chat-templates-pictures-info-service.md) and imported as
committed goldens (`goldens/index/18c.json`: `content/*`, `chat/*`, `topics/*`,
`service-command/*`). Three image states: **virgin** (the PPM E virgin EEPROM, `v639-setup.inc`),
**factory** (plan 15's restored image, `v639-factory-setup.inc`; its Dictionary is off) and
**seccode** (plan 15's virgin image with the re-provisioned code, for a fresh Restore). Facts below
are verified by those goldens unless marked UNVERIFIED. Typed text is invented and entered with
multi-tap; no T9 candidate list appears in any golden (plan 18b's clean-room boundary).

## Content provenance

| Content                    | Source                                                                       | Policy                     |
| -------------------------- | ---------------------------------------------------------------------------- | -------------------------- |
| Template and smiley texts  | factory Read views (`content/*-read`) and editor counters (`content/*-edit`) | LCD-visible, from captures |
| Topics' virgin junk        | plan 14's `tree/02-messages/2-8-4-*` goldens, `topics/edit`                  | reproduced as captured     |
| Chat's on-air text         | the emulator's MO SMS log (`plan18c/mo-sms.json`, not imported)              | measured                   |
| Picture art, picture slots | none: no verified v6.39 capture (see Unresolved)                             | not implemented            |

Nothing was read from `$REF/extracted`, `$REF/t9` or `$REF/captures/plan18b`.

## Templates (2-5) and Smileys (2-6)

- **Virgin:** Menu 2 5 / 2 6 (and Select) open nothing (`content/restore-virgin`; plan 14's
  shared no-response golden).
- **Restore factory settings provisions both lists** (seccode image: virgin no-response, then
  Restore, then the lists, `content/restore-templates`, `-smileys`). Whether the factory line seeds
  the EEPROM or runs the same reset is UNVERIFIED (Open question 1).
- **Eight slots each**, ▼ wraps after the eighth (`content/*-list`). Slots 1-5 hold the defaults,
  6-8 `(empty)`:

  | Slot | Template (length)                                  | Smiley |
  | ---- | -------------------------------------------------- | ------ |
  | 1    | `Please call␠` (12)                                | `:-)`  |
  | 2    | `I'm at home. Please call` (24)                    | `:-(`  |
  | 3    | `I'm at work. Please call` (24)                    | `:-/`  |
  | 4    | `I can't answer right now, call me later at␠` (43) | `;o)`  |
  | 5    | `I am late. I will be there at␠` (30)              | `;oD`  |

  Lengths are the editor counters' complements (`content/templates-edit`: 58, 46, 46, 27, 40 of
  70; smileys 4 of 7).

- **The list:** rows from y 7, 10 apart, the rail and the indicator `2-5-n`, soft key `Read`.
  Template rows carry the template icon left of the band (x 1); the band runs x 8-77 and the
  text starts at x 10, cut with the `...` mark when it does not fit. Smiley rows have no icon
  (band from x 0, text from x 2).
- **Read:** the text in the small face from x 0, top 0, 9 rows apart; `(empty)` for an empty slot;
  ▼ does nothing; soft key `Options` → `Edit`, `Erase` (`Select`, indicator `2-5-n-k`). C goes
  back to the list.
- **Edit:** plan 18's editor on the text, the count counter (characters left of **70** for a
  template, **7** for a smiley), small face (the SMS layout), multi-tap or T9 as the Dictionary.
  Options with text: templates `Send`, `Dictionary`, `Save`, `Erase`, `Exit`; smileys `Save`,
  `Dictionary`, `Erase`, `Exit`. With no text `Save` is not listed. `Save` → `Template saved` /
  `Smiley saved` (≈1.5 s), then the editor; `Exit` → standby (the 83 ms standby draw);
  `Erase` empties the editor.
- **Erase** (Read › Options): no query; `Template erased` (≈3 s, animated) / `Smiley erased`
  (≈2.9 s), then the list on the slot. A slot stores what the user saved: Erase of a default slot
  (even an edited one) brings its default back; Erase of slots 6-8 shows `(empty)` again.
- **Restore** over edited slots puts every slot back to its default
  (`content/restore-edited-*`).
- **Insertion** (Write messages › Options › Template / Insert smiley; Chat): the same list with
  `Select` (indicator `<option>-<slot>`); Select inserts the slot's text at the cursor exactly
  (no space added: `Hi:-)`), committing a pending character first; an `(empty)` slot inserts
  nothing; C returns to Options (`content/editor-*`).

## Chat (menu 3; Inbox › Options › Chat)

- `Phone number:` (number entry, `Search`; on the virgin phone book `No phone numbers`), OK →
  `Chat name:` (a text input, Abc, empty on the first chat; the name of the last chat
  afterwards, `chat/reentry`) → the chat editor. C on the empty name returns to the number.
- **The editor:** plan 18's editor with the counter `140/1` (**140** characters; the name does
  not count), T9 or multi-tap as the shared `messages/dictionary` (Dictionary off in Chat turns
  Write messages multi-tap too).
- **Options:** `Send`, `Template`, `Insert smiley`, (`Matches` while a T9 word composes),
  (`Insert word`, `Insert number`, `Insert symbol` in T9), `Dictionary`, (`Chat history` once a
  line was sent), `Chat name`, `Erase`, `Exit` (`chat/options*`). Held C on Options: standby.
- **Send:** plan 18's `Sending message` and `Message sent`, then the history. On the air the
  text is `<name>: <text>` (`Bo: Hi`; `: Yo` with no name).
- **The history:** newest line on top, own lines `<name: text`, the partner's `>text`, wrapped
  in the small face, four lines a screen; ▼ pages to the end, ▲ back to the top; `OK` and C →
  the editor (empty).
- **The partner** (an SMS from the chat's number) shows at once on the history, whatever Chat
  shows (editor, Options); it is not stored in Inbox (`chat/inbox-after`). An SMS from another
  number does not interrupt: it goes to Inbox and its notice waits for standby
  (`chat/other-after-exit`).
- `Chat name` edits the name; `Erase` empties the editor; `Exit` returns to Chat on the carousel;
  C on the empty editor too. The number and the history are not kept between chats.
- Persistence of the name over a power cycle: UNVERIFIED (session state).

## Info service › Topics (2-8-4)

- **Virgin:** five junk topics: names of six U+E000 boxes, numbers empty but topic 4's `p9`,
  topic 1 marked; the level shows `Select`, `Edit`, `Erase`.
- **Factory** (Restore): no topics, the level is `Add topic` alone (`content/restore-topics`).
- The level lists `Select`, `Add topic` (while fewer than **5** topics), `Edit`, `Erase`; with no
  topics only `Add topic`.
- **Add topic:** `Topic number:` (three digits at most; OK on the empty number does nothing),
  then `Topic name:` (ABC; an empty name is accepted), `Topic added`, the level.
- **Edit:** the topic's number then name, `Saved`, the level on Edit.
- **Erase:** no query; `Topic erased`, the level.
- **Select:** plan 14's multi-select over the topics; C asks `Save changes?`.

## Service command editor (2-10)

The editor with the pen and the counter `182`, soft key `Back` while empty, `Send` with text.
Send shows `Requesting` with `Quit` for ≈14.9 s, then `Not done` (≈2.9 s), then standby: the
emulator answers no USSD (Task 0 X).

## Unresolved (blocked)

- **Picture messages (2-4), Screen saver › Screen saver (5-9-4, 12-n-2-9-4):** v6.39 opens no
  picture folder (virgin or factory) and stalls on Save; Task 0 R (a repaired picture directory)
  was not established, so the folder, the gallery and the stored and built-in pictures stay
  plan 18c placeholders (D4). v5.79's folder is comparative evidence only.
- **Incoming and outgoing picture messages, business cards:** the network port's picture and
  card kinds (D6) await the owner's contract reconciliation (VISION); card Save needs plan 19.
- **Chat Search with names, card Save:** plan 19.
