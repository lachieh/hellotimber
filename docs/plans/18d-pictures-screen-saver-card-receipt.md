# Plan 18d - Picture messages, screen saver and card receipt

> **Fidelity standard:** follow `AGENTS.md`; settled pixels are exact and shared timing rules apply.

**Status:** closed as known gaps (Lachlan, 2026-10-30). The emulator cannot produce the
evidence below; reopen only with new captures. Pending goldens keep their `pending:` owner.
**Depends on:** [plan 18c](18c-chat-templates-pictures-info-service.md), done; plans 18/18b,
19 (phone book store/picker) and 17 (profile aliases) are landed prerequisites.
**Parent decision (Lachlan's delegate, 2026-10-29):** split all remaining picture messages
(Messages 2-4), Screen saver picture (5-9-4 and `12-*-2-9-4`), picture/gallery and
business-card receipt work from 18c into 18d. No verified repaired v6.39 picture directory
exists and picture Save freezes. Close 18c with its delivered content and Composer Send.
This split changes ownership and completion scope; it supplies no missing capture evidence.

## Scope and evidence gate

Own the folder, stored/built-in pictures, viewer, editing/erasing, receipt, Save/Forward,
screen-saver gallery/selection and business-card receipt/View/Save. The standby saver after
its timeout remains outside this plan. Preserve virgin no-response and pending goldens until
verified repaired-state captures exist. Never compose v6.39 flows from v5.79 or extracted art.
The incoming card probe is preliminary, not canonical acceptance evidence.

`REF=/Volumes/SSD/Projects/lachieh/hellotimber/nokia-3310` is local and gitignored.
Retain scratch and canonical path names under `plan18c` as historical evidence; future captures
belong under `captures/6.39/plan18d/`. Tests read only committed importer outputs.
No new network contract is authorized by this documentation split. Reconcile the proposed
picture/card delivery contract with VISION before implementation; `sendRingtone` is already
implemented independently by 18c.

## Ownership

Seven existing fixtures stay in their original indexes with status `pending:18d`:

| Index | Fixture                              |
| ----- | ------------------------------------ |
| 14    | `tree/02-messages/2-4.leaf`          |
| 16    | `sound/note/2-4`, `sound/note/5-9-4` |
| 16    | `sound/note/12-{1,2,5,6}-2-9-4`      |

Importer and firmware placeholders own `2-4`, `5-9-4`, `12-*-2-9-4` as 18d.
Pending owners need no acceptance file without their own golden index. When captures land,
register an 18d capture set and one matching acceptance file using `acceptancePlan`.
Do not add scenarios for another index; assert these seven through their original owners.

## Decisions transferred from 18c

D4-D7 keep their original numbers for research cross-references. D2's provenance rule from
18c also applies: capture-visible art only; extraction-only work requires a separate clean-room
specification and own/open content, and cannot claim pixel-exact stock fidelity.

**D4 - Preserve virgin no-response; gate picture-folder work on v6.39 evidence.** The scratch
Save stall suggests unusable picture storage, but does not establish a particular directory fault.
Task 0 R tries a firmware-driven reset on disposable image copies, then a documented EEPROM
repair. Accept a repair only when the folder, Save, reboot persistence and neighbouring features
work. The repaired image is a separate test state, never the default virgin state.

If R fails, retain the virgin no-response goldens and `18d` placeholders for unverified picture
folder, Save/Forward and screen-saver flows. Record them as a capture dependency. Implement the
verified incoming notice/view independently where possible. Do not compose a folder from v5.79,
firmware strings or template layouts; do not claim 18d complete while those tasks remain blocked.
If only extraction yields content, use D2's clean-room branch and record the fidelity limitation.

**D5 - Pictures are 72×28 1-bit art; the EEPROM slots hold received and saved pictures (new).** The
`pictures` record (v1) holds the slots (capacity from Task 0 P; eight is a v5.79 hypothesis until verified on v6.39) with the picture,
its text, the sender, the time stamp and the name rule Task 0 records (the sender or
`Picture %N`). The built-in pictures are not stored (ROM): they cannot be erased (C7); Task 0 must establish whether Edit text on a built-in stores a slot copy or an overlay;
do not choose a persistence rule from the v5.79 first screen alone. `No space for
new pictures`, `Old picture replaced` and `Save picture message first?` follow Task 0 P.

**D6 - Picture messages and business cards travel through plan 18's network port (contract change,
additive).** `deliver` accepts a picture message (`kind: "picture"`) and a business card
(`kind: "business-card"`) besides plan 18's SMS (no `kind`); `StockNetworkPort` gains an optional
`sendPicture`, settled like plan 19's `sendBusinessCard` (absent = `"sent"` after the phone's link
time). The phone shows each arrival with the captured notice and link time (`PICTURE_LINK_MS`,
`BCARD_RECEIVE_LINK_MS`: Task 0 medians; a picture is 3 concatenated SMS on the air, C9). Pictures
from hosts are validated (28 rows of 72 `#`/`.`; text within the limit Task 0 measures); a bad one
throws from `deliver`, naming the field. The port still carries no protocol detail: no ports, no
OTA bytes, no vCard text. A received business card's Save goes to plan 19's
`StockPhoneBook.add` (`Saved`, `Memory full` as plan 19 captured).

**D7 - Screen saver › Screen saver is the gallery over the folder; the standby saver is not this
plan's (new; Open question 5).** The gallery shows the folder's pictures one per screen with the
indicator (`n`), ▲/▼ and `Use` → the note Task 0 S verifies (`Screen saver selected` is a research target) and stores
the choice under the profile's screen-saver keys (plan 14's aliases). `Screen saver missing`
(before the gallery when the profile's saver is On and no picture is chosen, C10) keeps plan 16's
warning tone. Displaying the saver at standby after the timeout is out of scope.

Arrivals use the measured interruption/notice policy (18c D10); new glyphs, note art, timings
and sounds must derive from their own captures (18c D13-D14). Card Options now has preliminary
Show / Save / Discard evidence; the earlier View hypothesis below must be resolved by captures.

## Repair research and blocker history (transferred)

## Planning investigation (2026-10-14)

Scratch probes in `$REF/captures/scratch-plan18c/` (scripts `tools/p1.py`…`p8.py`, outputs
`out-*`). The scratch harness copy adds `smsbin <from> <destPort> <srcPort> <hex>` over the
emulator's own `dct3_web_incoming_sms_bin` (it keeps plan 18's `sms` and `callin`). Images: the
virgin image (`v639-setup.inc`), plan 15's factory-restored image
(`firmware/work/v639-plan15-restored.fls`), the virgin image with PPM B, and the v5.79 used-phone
image (native, not the graft plan 18 S13 used). Times are emulated. Task 0 recaptures everything
canonically.

| #   | Finding                                                                                                                                                                                                                                                                                                                                                                                                    | Evidence                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| C1  | **Virgin:** 2-4, 2-5, 2-6 and 5-9-4 do nothing, with PPM E and with PPM B (German UI). Changing PPM alone did not populate these lists.                                                                                                                                                                                                                                                                    | `out-p2-virgin/`, `out-p2-ppm-B/`               |
| C7  | **v5.79 used phone, Picture messages:** 14 entries. Entries 1-8 are EEPROM slots (one named by its sender, the rest `Imagine 2`…`Imagine 8`, i.e. `Picture %N` by position; Options Edit text, Erase, Use number, Forward, Details, Exit). Entries 9-14 are the **six built-in pictures** (`Imagine 9`…`14`; Options Edit text and Forward only). View: the 72×28 picture at x 6, y 0, soft key `Options`. | `out-p6-v579/l*`, `v*`, `o*`                    |
| C8  | The prior worker reports six MCU 72×28 OTA bitmaps matching the v5.79 views, the same six in v6.39 and copies in virgin PMM 0x100-byte slots (comparison manifest still needed). Yet v6.39 opens no folder (virgin or factory), and saving an incoming picture **hangs the UI**: a picture-directory or emulator fault is a hypothesis (D4), not a proven cause.                                           | `out-p6-v579/`, `out-p4-*/b*`                   |
| C9  | **Incoming picture message** (`smsbin … 5514`, 3 concatenated parts): ≈16.2 s later standby shows `Picture` / `message` / `received` with `View`; View: the picture at x 6, y 0, its text below in the small face, ▼ scrolls, soft key `Save` (which hangs, C8).                                                                                                                                           | `out-p4-factory/b-arrive`, `b02-view`           |
| C10 | **Screen saver › Screen saver:** factory opens a gallery on `7` with `Use` over junk slots and the emulator soon stops following keys (plan 15's `GU_FAULT_NOTE_DISPATCH` note); profiles whose saver is On first show `Screen saver missing` (large, the 1750 Hz warning tone, plan 16); virgin: no response.                                                                                             | `out-p2-factory/1*-screensaver*`, plan 16 notes |

### Provenance and repair constraints

Native v5.79 has eight stored slots and six 72×28 built-in pictures. Reports of matching
v6.39 bitmaps and PMM copies have no retained comparison/hash manifest and remain research
leads. No valid v6.39 directory or successful Save is established. Canonical LCD captures,
not firmware tables or extracted bytes, must feed repository resource generators.

Task 0 diagnostics are retained under `$REF/captures/6.39/plan18c/research-resume/`, with exact
command scripts and logs. Picture-first and text-first payloads both stall on Save for 30 s;
held C cannot exit. A v6.39 image with a donor v5.79 PMM still does not open the picture folder.
This is negative research evidence, not a repaired image, and is not imported. Card receipt
now has preliminary evidence: Options → Show / Save / Discard; Save opens Name. Completion,
capacity and persistence remain uncaptured. See the spec's resume research for exact inputs.

The remaining work and all seven pending fixtures now belong to 18d. No repaired image,
new known gap or wider tolerance resulted from the resume probes. See the exact inputs and
native-v5.79 comparison in [the stock spec](../specs/stock/chat-and-content.md#resume-research-2026-10-29).

## Remaining prerequisite tasks (from 18c Tasks 0, 3 and 4)

- [ ] R: bounded repair research (maximum 3 hours), firmware reset on disposable copies followed
      by documented EEPROM repair. Verify folder, Save, reboot persistence and neighbours.
- [ ] P/A/S/B: canonical picture folder, arrivals, send/gallery and card receipt captures,
      including Save completion/full/replacement/cancel, sound and persistence. Keep failed
      research separate from canonical evidence. Plan 19 is now present; its old blocker is stale.
- [ ] Generate each 72×28 picture from its independent v6.39 viewer crop; measure arrival/send
      timings and sound with sample counts/spread. Give every asserted resource a real driver.
- [ ] Model picture storage only after captures establish capacity, order, naming, built-in text
      overlays/copies, retention and selection after erase; test independent expected states.
- [ ] Register records/resources through the existing feature and capture-set APIs; no new
      dependencies or website/phone-core changes.

## Proposed contracts and internal APIs (unimplemented)

These are the transferred design, subject to captures and current API reconciliation.

### `@hellotimber/nokia-os` (additive)

```ts
/** Plan 18d: a picture message's picture: 28 rows of 72 characters, `#` = ink, `.` = blank. */
export interface StockPicture {
  readonly rows: readonly string[];
}

/** Plan 18d: a picture message as the phone sends or receives it. */
export interface StockPictureMessage {
  readonly number: string;
  readonly text: string; // may be empty; within the limit Task 0 measures
  readonly picture: StockPicture;
}

export interface StockIncomingPictureMessage extends StockPictureMessage {
  readonly kind: "picture";
  readonly sentAt: StockTimestamp;
}

/** Plan 18d: a business card arriving over SMS (plan 19's `StockContact`). */
export interface StockIncomingBusinessCard {
  readonly kind: "business-card";
  readonly number: string;
  readonly card: StockContact;
  readonly sentAt: StockTimestamp;
}

/** Plan 18d: what a host may deliver. Plan 18's `StockIncomingSms` (no `kind`) is a text SMS. */
export type StockIncoming =
  | StockIncomingSms
  | StockIncomingPictureMessage
  | StockIncomingBusinessCard;

export interface StockNetworkPort {
  // ...plan 18 and 19 members unchanged, except:
  /** Called once by `createStockPhone`; the host calls `deliver` for each incoming message. */
  subscribe(deliver: (message: StockIncoming) => void): () => void;
  /** Plan 18d: a picture message (Forward). Absent = settled "sent" after the link time. */
  sendPicture?(message: StockPictureMessage): StockSendOutcome | Promise<StockSendOutcome>;
}

// createSyntheticNetwork(): `deliver` takes a `StockIncoming`; gains
// `readonly pictures: readonly StockPictureMessage[]` (what phones sent with `sendPicture`).
```

Rules (Task 7 pins each with a test): a host calling plan 18's `deliver(sms)` is unchanged; a
picture with the wrong row count, row width or characters, or a card failing plan 19's contact
rules, throws from `deliver` naming the field; `sendPicture` follows plan 18's `send` rules (a
rejected promise is `"failed"`, outcomes after power-off are ignored); deliveries while off wait
for standby (plan 18's rule).

## Internal API

Signatures are fixed by Tasks 4-9; a change is a Deviation recorded here.

```ts
// src/content/pictures.ts
export interface PictureEntry {
  readonly picture: StockPicture;
  readonly text: string;
  readonly name: string; // the sender or `Picture N`, per Task 0
  readonly builtIn: boolean;
  readonly sender?: string;
  readonly sentAt?: StockTimestamp;
}
export const PICTURES_RECORD: EepromRecord<PictureSlotsState>;
export class StockPictures {
  constructor(eeprom: StockEeprom);
  list(): readonly PictureEntry[]; // slots in use, then ROM_PICTURES (order per Task 0, D4/D5)
  save(message: StockIncomingPictureMessage): "saved" | "replaced" | "full";
  erase(index: number): void; // throws for a built-in picture
  setText(index: number, text: string): void;
}
export function validatePicture(picture: StockPicture, field: string): void;

// src/widgets/picture-view.ts, gallery.ts
export function pictureView(options: PictureViewOptions): Widget;
export function pictureGallery(options: GalleryOptions): Widget;
```

Add the per-profile screen-saver picture choice under plan 14's aliases (key fixed by
Task 6) and a `pictures` record through the owning feature's `records`.

## Tasks transferred from 18c

Keep Task 6/7 numbers to preserve existing evidence references. Historical 2026-10-15
blocker notes describe the checkout at that time; 18c's 2026-10-29 resume supersedes the
missing plan 19 and Composer Send blockers.

### Task 6 - Picture folder and screen-saver gallery (TDD, R gate)

**Files:** `src/firmware/features/picture-messages.ts` (new),
`src/widgets/{picture-view,gallery}.ts`, `src/display/widgets/{picture,gallery}.ts` (new),
`tests/widgets-picture.test.ts`, `tests/picture-flows.test.ts` (new), plan acceptance/support;
one-line feature/widget/painter registrations and owned placeholder removals.

- [ ] Gate on R's verified v6.39 image. If missing, retain placeholders/pending covers and report
      the dependency; continue verified incoming view work in Task 7. No composed folder fallback.
      Outcome (2026-10-15): blocked. R was not attempted beyond the planning probes: the Save
      stall leaves no emulator fault in the log (`p4-factory.err`), so telling a directory fault
      from an emulator fault needs firmware tracing, a research task of its own. 2-4, 5-9-4 and
      12-n-2-9-4 keep their `18d` placeholders; `tree/02-messages/2-4.leaf` and the six
      `sound/note/{2-4,5-9-4,12-n-2-9-4}` goldens stay `pending:18d` in plans 14 and 16.
- [ ] Failing pixel tests use literal models and independent goldens for image origin, text
      wrapping/scroll, icon rows, counter and gallery. Key tests cover folder order/wrap, stored
      versus built-in Options, Edit text, Erase/cancel/full, Use number and Details/Exit.
- [ ] Gallery binds 5-9-4 and profile copies, shares alias policy with 17, saves choice and follows
      captured missing/selected notes. Virgin remains no-response. Standby saver is follow-up.
- [ ] Add `pictures/folder-*`, `view-*`, `rom-*`, `screen-saver/*` scenarios for captured state;
      one state must not satisfy another state's golden by changing its input behind the test.
- [ ] Verify package test and manual `vp check --fix`.
- [ ] Commit: `feat(nokia-os): implement the captured picture folder and saver gallery`.

### Task 7 - Picture and business-card network flows (TDD)

**Files:** `src/content/network.ts` (new), `src/firmware/features/picture-messages.ts`,
`tests/picture-network.test.ts`, `tests/picture-arrivals.test.ts` (new),
`tests/support/18d-fixtures.ts`, plan acceptance/support; one-line network/public-type registrations.

- [ ] Gate on plan 18's registered delivery/dispatch interface. Keep D6 payload types here;
      reuse plan 18 validation for number/timestamp and plan 19 validation for contacts.
      Outcome (2026-10-15): blocked. VISION keeps the port SMS-only and states that it does not
      authorize D6's picture/card extension, so `StockIncoming`, `sendPicture` and the binary
      kinds wait for an owner decision; no A or B captures exist; card Save needs plan 19 Task 5
      (unmerged, `t3/p19-phone-book`). Plan 27's `composer/send-ok` (a ringtone SMS) is pending
      on the same extension.
- [ ] Failing tests: unchanged text SMS, invalid art/timestamp/text, one send, missing optional
      sender, rejected Promise, late result after power-off, off-phone queue, two arrivals,
      cleanup and phone isolation. Tick sizes 1/16/1000 ms produce identical due event times.
- [ ] Notice/View/C at standby and interruptions elsewhere use captured A/B policy. Picture
      Save/Forward/full notes require P/S captures; do not implement or assert the captured stall
      as a successful Save. Reuse plan 16 message alert and plan 18 `setNotice({ open })`.
- [ ] Business-card View/Save/full/cancel requires B and plan 19 Task 5. If unavailable, keep
      that subtask pending and report it; do not fake a phone book. Add every verified arrival,
      save/send and sound scenario to the plan file.
- [ ] Verify package test and manual `vp check --fix`.
- [ ] Commit: `feat(nokia-os): deliver pictures and business cards through the network port`.

### Task 10 - Remaining acceptance and ownership closeout

- [ ] Add an 18d capture set/index and matching acceptance file only when canonical captures
      exist. Exactly one `acceptancePlan` call; every asserted fixture has a real driver.
- [ ] Register drivers in indexes 14/16 for their seven existing pending fixtures; remove the
      importer and matching feature placeholders only when all covered virgin behaviours pass.
- [ ] Apply shared pixel/timing/sound rules, preserve virgin/repaired state distinctions, and
      report pending counts and evidenced known gaps. Never widen per-test tolerances.
- [ ] Run package tests, workspace tests and `mise exec -- vp check --fix`; report totals.

### Task 11 - Remaining demo, documentation and verification

- [ ] Extend the existing demo panel with invented picture/card arrivals and sent-picture
      inspection after the port contract and implementation land.
- [ ] Drive receipt/View/Save/Forward and gallery/Use on the real demo surface; retain proof.
- [ ] Update standalone usage, provenance, limitations and stock specs for the captured flows.
- [ ] Run `mise exec -- vp check --fix`, `mise exec -- vp check`,
      `mise exec -- vp run -r --no-cache test`, and `mise exec -- vp run website#build`.
      Run import/generation twice to prove stability; stage explicit files, never TODOS.md.
- [ ] Mark 18d done only when all its capture and implementation gates pass; commit each
      completed task after checks with `git commit --no-verify`.

## Done means

All scoped flows match independently imported v6.39 captures, every asserted golden has its
owner driver, the seven pending fixtures are resolved, generators are fresh and checks pass.
Uncaptured repaired-state flows keep this plan blocked; the split itself resolves no fidelity gap.
