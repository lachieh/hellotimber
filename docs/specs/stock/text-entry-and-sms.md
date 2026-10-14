# Text entry and SMS (plan 18, in progress)

Source: plan 18 Task 0's v6.39 emulator captures under
`$REF/captures/6.39/plan18/`, documented in
[plan 18](../../plans/18-messages-and-chat.md#task-0---canonical-ref-captures-no-repository-changes).
The parent independently reran the generator check: 194 recordings, zero problems, two
no-response notes (Template and Insert smiley). Task 2 has not imported these captures into
committed goldens. These are measured firmware facts and planned contracts, not shipped SMS
behaviour. Existing plan 14 tree goldens still describe first screens.

## Multi-tap entry

Virgin Write messages opens in T9. Plan 18 provisionally starts with Dictionary off until
18b supplies T9. Selecting Dictionary off shows the tick note `T9 dictionary deactivated`
(≈1.39 s), then the editor. The T9 first-screen golden belongs to 18b. Multi-tap Options
contains nine entries and excludes Insert word, Insert number and Insert symbol. The two
insertion probes in `text/insert-number-t9` and `text/insert-symbol-t9` are 18b evidence.

Complete key cycles, in press order (`␠` is space). Sentence-start matches upper:

| Key | Upper                   | Lower                   |
| --- | ----------------------- | ----------------------- |
| 1   | `. , ' ? ! - & 1 @ \ /` | `. , ' ? ! - & 1`       |
| 2   | `A B C 2 Ä À Á Â Ã Æ Ç` | `a b c 2 ä à á â ã æ ç` |
| 3   | `D E F 3 È É Ë Ê`       | `d e f 3 è é ë ê`       |
| 4   | `G H I 4 Î Ï Ì Í İ Ğ`   | `g h i 4 î ï ì í ı ğ`   |
| 5   | `J K L 5 £`             | `j k l 5 £`             |
| 6   | `M N O 6 Ö Ô Ò Ó Ø Ñ`   | `m n o 6 ö ô ò ó ø ñ`   |
| 7   | `P Q R S 7 $`           | `p q r s 7 $ ß`         |
| 8   | `T U V 8 Ü Ù Û Ú`       | `t u v 8 ü ù û ú`       |
| 9   | `W X Y Z 9`             | `w x y z 9`             |
| 0   | `␠ 0`                   | `␠ 0`                   |

The union of these cycles and the symbol grid has **149 distinct typeable characters**.
Small and large manifests verify them, including pixel-identical glyph classes. The five
bold six-row mode/counter header shots are whole specimens; ordinary OCR cannot verify
individual header glyphs. Crop those sprites, including `/`, from captures. Cursor-obscured
OCR runs must not stand in for complete stored text.

- Commit occurs **1452.2 ms from the pending character's first redraw** (`text/commit`).
  Blink intervals are 479.1-481.1 ms (nominal 480). Key scan/redraw latency is not reproduced.
- Held C deletes once, then clears 478.1 ms after that deletion's first redraw. C on empty
  returns to the parent.
- Held `#` enters `123` at 1010.1 ms from key-down. Tap `#` stays numeric. Another hold returns
  to letters (ABC retained; lower returns to sentence-start Abc in the empty probe).
- Held digits first show a letter, commit, then replace it at the next blink, about 1.93 s
  after its first redraw. The hold sweep brackets eligibility: 1450 ms leaves A, 1475 ms gives 2. Eligibility and visible replacement are separate events. Numeric mode inserts once.
- Tap `#` cycles Abc → ABC → abc → Abc at empty/sentence start and after `. `, `? `, `! `.
  Mid-word and after an ordinary space it alternates abc ↔ ABC.
- **▲ moves right, ▼ left**, wrapping at either end. Mid-text insertion/deletion and
  three-line cursor movement are captured. Tap or hold `*` opens symbols.

Symbols have 31 cells, in rows of 11/11/9:

```text
. , ? ! : ; - + # * (
) \ ' " _ @ & $ £ % /
< > ¿ ¡ § = ¤ € ¥
```

▲ advances, ▼ retreats, both wrap. Use inserts the selected symbol; C cancels.

SMS uses small text at x 1, tops 8/18/28, wraps at spaces, breaks long words, and follows the
cursor. Its limit is 459. Counter part changes occur at 161 and 307 (`298/2`, `152/3`), ending
at `0/3`. At the limit a pending last character can still cycle; a committed full message
ignores further characters. Welcome has limit 36 and adaptive layout: large at tops 8/22
while two lines fit, then small at 8/17/26. The probe changes at character 24 because of
width, not a fixed character-count rule. Empty Welcome Save and Erase both show
`Welcome note erased`; Save Hi retains Hi and reopens it. Plan 15 owns the boot-note gate.

## Prompts

Number entry cycles `* → + → p → w → *`, committing after a pause. `+` does not consume
the 30-digit counter. `#` inserts itself; ▲/▼ move right/left and wrap; C/held C delete/clear;
C on empty returns. Digits beyond the 30th do not extend the value. Search on empty shows
`No phone numbers` and returns. Routing address is large text input; OK sends using that
address. Centre 1/2 save notes are `Centre number saved`; voice mailbox is `Saved`.
Empty centre OK invokes Search, so the capture cannot establish persistence of an empty centre.

## Sending, saving and reading

Five Sending durations are 2646.4, 2790.4, 2662.4, 2574.3 and 2754.4 ms:
**median 2662.4 ms, range 2574.3-2790.4 ms**. Message sent lasts 1400.2-1420.2 ms.
Protocol logs show CP/RP ACK with no loopback. Send keeps editor text and leaves Outbox empty;
Save (including empty) shows `Saving message`, `Message saved`, and retains it. Erase clears
immediately; Exit returns to standby. Send by set offers Numeric/Alphanumeric for both sets;
Set 2 asks for a message centre first. Send to many shows `No phone numbers`. Template and
Insert smiley do not respond in the captured state; later content is 18c's scope.

Inbox Options are Erase, Reply, Chat, Edit, Use number, Forward, Details. **Reply starts empty**
and prefills the sender at Send. Edit/Forward keep text. Reading turns **whole text pages**
(up to four lines, 9 px pitch), then Sender and Sent, and wraps. Details pages are Sender,
Message centre, Time. Sent remains 24-hour after selecting 12-hour Time format. Outbox saved
rows are labelled `Message`; Options are Erase, Edit, Use number, Forward. Erase asks
`Erase message?`, then `Erasing message`, then `Erased` or `No more messages in inbox/outbox`.

## Arrivals and storage

Five standby latencies are 2425.4, 2281.3, 2141.3, 2464.4 and 2324.3 ms:
**median 2324.3 ms, range 2141.3-2464.4 ms**. Notices count 1/2/3. Read opens Inbox with
indicator `1`; Menu 2 2 gives `2-2-1`. C dismisses the notice while keeping the envelope;
a menu round trip does not restore it. On the notice ▲ opens last dialled numbers, ▼ Phone
book, digits/`#` number entry, Navi Read. These routes differ from existing normal-standby
configuration. Arrivals do not interrupt menu, editor, moving game or Sending message;
return to standby shows the envelope without a deferred notice. Invalid shortcut finishes
before the received notice appears.

The moving-game evidence is `sms/elsewhere/snake-level-1`. The older `sms/elsewhere/snake`
is one frame at invalid virgin level 175; retain it as an artefact, exclude live-play acceptance.

Ten incoming plus five saved messages fill **15 shared slots**. All fifteen survive cold reboot
within one process with zero pixel differences in the list rows. Extra arrival shows
`No space for new messages` with OK; Save shows `Message memory full`. Reboot within one process
and Restore retain mixed Inbox/Outbox. A new process loses them even with the same SIM fixture:
saveflash saves phone flash, not the in-memory SIM overlay. Second-SIM ownership is therefore
**inconclusive**, and does not prove phone-wide storage. The planned messages record remains
provisionally per SIM with no factory reset function; this is host-storage policy.

## Host policy and unverified behaviour

The planned public network contract is in [VISION](../../../VISION.md#hellotimbernokia-os).
The default synthetic network accepts all sends without loopback. Hosts deliver text and local
service-centre timestamps; outgoing recipient fields preserve typed numbers/routing addresses.
Additional host latency extends Sending beyond the median minimum. These synthetic-cell
end-to-end delays do not isolate a firmware-only timer and are UNVERIFIED on a live network.
Preserve each captured timeline's durations; cross-recording spread exceeds ±2 ms.

Full 160-character delivery, faithful Unicode reception and alphanumeric senders are UNVERIFIED.
The helper truncates the requested 160-character attempt to 120 septets, uses ASCII packing
for é/ü/~, and substitutes sender `12345` for `Nokia`. A 115-character view and truncation
attempts are evidence, not proof of complete 160-character delivery. The host text interface
can carry more than this helper faithfully encodes; rendering uses available stock glyphs.

No failing send was captured. Empty centre OK is Search; Set 2 requests a centre; the boot
sequence cannot send within 1 s of standby and normal setup already waits for registration.
Do not describe these as three proven failures or as successful empty-centre sends. The proposed
`Message\nsending\nfailed` error note and ≈2.9 s duration are an **UNVERIFIED composition**.
Host rejection mapping and queuing deliveries while powered off until standby are contract
policies, not observed emulator behaviour. Other SIM capacities and persisted SIM ownership
remain UNVERIFIED. T9 and content extensions belong to 18b/18c; Task 1 adds no runtime code.
