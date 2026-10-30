# Calls II: supplementary services and in-call actions (plan 22b)

Calls II implementation completed 2026-10-30 within the evidence-bounded 22b scope.
The dated investigation below records its evidence history; the implementation
and explicit known-gap sections at the end define current behavior.
Firmware: v6.39 PPM E virgin EEPROM. Corpus root:
`$REF/captures/6.39/plan22b/`; no firmware or extracted resources are copied into this repo.

## Reproduction

`capture.py`, `in-call.py`, `settings.py`, `verified-services.py`, `details.py` and
`redial.py` in that directory drive the existing `tools/menutree/emu.py` protocol.
Each writes its exact command transcript (`commands.cap`), network trace, 84×48 PNGs,
recording timelines and audio. The baseline script is `captures/scripts/v639-plan13-clock.cap`.

The separate `tools/harness-p22b/` is copied from `harness-p22`, with a
`rom6-services.patch` applied after its existing call patch to the build-directory copy of
`dsp_rom6.c`. It promotes the scratch SS responder as `CAP_SS=ok|error|off`, accepting service
8 and answering SS REGISTER/FACILITY with RELEASE COMPLETE containing returnResult/returnError.
The emulator's source tree is unchanged. `CAP_TCH=1` is used for connected speech calls.

The first build accidentally omitted the service-8 acceptance branch because the canonical
harness source differs from the scratch source. Its `ok/` and `error/` recordings are invalid
as successful/error evidence and must not be imported. The corrected build's recordings are
under `verified/ok/` and `verified/error/`. Its network trace proves operation 14 / SS 0x21
was answered with returnResult. `none/` records unanswered requests and remains valid.
`baseline/comparison.json` records the clock-capture hashes; repeat the baseline check after
any harness change. The initial SS build, corrected SS build and opt-in CC build each produced the same 44 PNGs as harness-p22 with their extensions disabled.

## Confirmed observations

- Divert Status sends SS interrogation (operation 14, SS 0x21 for unconditional forwarding).
  A successful response without a basic-service qualifier shows `Active:` / `All` / `services`
  with `Number`. The responder supplies forwarding digits; these are fixture input, not a
  real network lookup.
- Activate via Voice mailbox or Other number shows `Active:` / `Voice` / `calls` with `Number`
  for the responder's successful returnResult.
- Cancel shows `Inactive:` / `Voice` / `calls` with `Back`; Cancel all diverts shows
  `Inactive:` / `All` / `services` with `Back`.
- Without an SS responder, divert and service-string requests end in `Not done`.
  Precise timeout timing and return target still require timeline analysis.
- Hold with the existing call network returns to `Call 1` / `End`. This is not evidence that
  the network successfully held the call. The harness does not yet acknowledge HOLD.
- New call opens an empty `Phone number:` with `Search`, a blinking number cursor and no
  ordinary Send-SMS counter. Typing digits changes the softkey to `Call`.
- Send DTMF opens `Phone number:` with `Search`; entering `123` and confirming shows `Sending`
  and `123` with `Exit`. It stays there through the recorded five-second tail. This is not
  proof of a successful remote DTMF transmission; the existing harness lacks START/STOP DTMF
  acknowledgements.
- Automatic redial remains the stock On/Off list. Call cost settings has `Call cost limit`
  (`Off`) and `Show costs in` (`Units`). Those views already have stock tree coverage.

## UNVERIFIED / remaining capture work

- Analyze all recorded transition times and sound events using the shared fidelity rules;
  obtain factory-image sound recordings before importing sound goldens.
- Hold/retrieve acknowledgements, two concurrent calls and waiting-call handling; extend the
  network harness rather than treating its one-call limitation as firmware behavior.
- START/STOP DTMF acknowledgements and exact per-digit rhythm, cancellation, `p`/`w` continuation.
- Redial eligibility/retries and limits: compare On/Off failure recordings; the existing
  emulator maps release causes to the same visible end, which alone proves no retry policy.
- Own number sending's outgoing SETUP policy, nonzero advice of charge, cost-limit enforcement
  and prepaid credit responses; the existing network supplies none of these charging inputs.
- Divert icon pixels, persistence across a cold boot, Restore, result-number details, Quit/C,
  and Call waiting result timelines. Additional recordings are being captured for these.

Unproven behavior must not become a successful local network simulation. These are capture
requirements still owned by 22b; no follow-up split has yet been justified.

## Supplemental call-control responder

`rom6-cc.patch` adds opt-in `CAP_CC=1` acknowledgements for HOLD/RETRIEVE and START/STOP
DTMF. Constants are checked against [libosmocore's GSM 04.08 header](https://downloads.osmocom.org/api/latest/libosmocore/gsm/html/gsm__04__08_8h.html).
The network log records each request and acknowledgement. With this responder, `in-call-ack/`
shows Send DTMF completing `123` and returning to Call 1/End. New call reaches Calling with
`End call`. The hold result changes the handset icon. Analyze the pixels and transitions
before defining a held-call state contract. These observations supersede the original
unanswered-network probes only when the host explicitly supports those operations.

Quit and C while Requesting both show Request / not / confirmed for approximately
2.89 seconds, then standby. Number on an active result shows To number / +0412345678 / Back;
C returns to the result. Unanswered service requests reach Not done at approximately 15 s.
The exact request/link anchor remains to be fitted across the recorded scenarios.

Redial cause-17 probes, On and Off, both return to standby and remain there for the captured
90-second tail. This proves that particular failure path does not redial; it does not establish
all retry-eligible failures or their policy.

Own-number-policy probes and a clean reboot probe are also in `identity-persist/` and
`persist/`. Only `persist/` uses the harness's dedicated `hold pwr 2500ms` power API.
The first identity/persistence attempt used an invalid `power` token and was stopped;
the identity-policy cases were rerun with `pwr`. Do not use raw `press pwr` as proof of
power-off: the canonical harness has a separate power API. The explicit `persist/` probe
is the authoritative power-off input. Persistence interpretation remains pending.

## Bounded Task 0 continuation (2026-10-29)

`closure.py` records HOLD then RETRIEVE acknowledgements and factory-image sound
probes under `factory-sound/` using `v639-plan15-restored.fls`. Its initial second-call
sequence selected the wrong menu row; `closure-final.py` corrects the input and writes
`closure-multicall/`. That network log contains the second SETUP to 0298765432
on TI 0x13, but the network retains only one transaction's call state. Independent
release, waiting SETUP, swap and End all remain UNVERIFIED and move to plan 22c.
`persist-unlock/` continues the saved cold boot with security code 12345. Its result
still requires pixel analysis; no persistence policy is inferred from the login prompt.

Redial beyond the measured no-retry cause-17 path, advice of charge and prepaid
protocols move to 22c, blocked on captures. The existing network has no charging
input. The three plan 22 option selections remain owned by 22b. Factory sound was
captured successfully and stays owned by 22b pending event analysis.

## Implemented supplementary requests (2026-10-30)

The shared host port now owns service completion. Standby strings, Service command,
forwarding Activate/Cancel/Status/Cancel all and Call waiting all reach
`requestService(text, control, signal)`. Menu Activate/Cancel retain voice basic
service 0x10 through MMI code 11; typed strings retain their own qualifier.
MMI serialization follows [ETSI TS 122 030 §6.5.2 and Annex C](https://www.etsi.org/deliver/etsi_ts/122000_122099/122030/16.00.00_60/ts_122030v160000p.pdf).
No successful response is inferred from a timer. Unanswered requests use the
existing 14867 ms service timeout; Quit/C cancels and shows Request not confirmed.
Closing a flow aborts it and invalidates late host events.

Confirmed unconditional forwarding sets the arrow at x7..18, y0..5, extracted
from canonical `persist/active-standby.png`; its full standby golden matches.
The indicator is RAM-only pending the unproven persistence interpretation.
UNVERIFIED product choice: power cycles clear it until a new host confirmation.

The 42 service timelines are asserted: 31 pass directly and eleven retain exact
known-gap reasons in `tests/support/call-services-gaps.ts`. Eight miss a final
35–107 ms progress-bar frame before Not done; three later lose network registration
in the emulator, a state the host port does not yet supply. Shared tolerances are
unchanged. Existing five Call divert tree leaves still pass their original goldens.

Menu no-answer activation serializes the selected delay after the voice service
qualifier (`**61*number*11*T#`); virgin/factory fallback is 30 seconds. The canonical
network traces prove the voice basic-service qualifier on Activate/Cancel, while
Status requests no qualifier. The MMI field order is standards-based; exact
serialization is a host API design choice, not a claim about raw radio bytes.

## In-call host operations (2026-10-30)

`StockCallLink.hold/retrieve` return an explicit boolean outcome or promise. A
rejected/absent operation preserves the prior call state. `sendDtmf(text, signal)`
likewise needs host success; Exit, release and power-off cancel its pending UI.
New call and Send DTMF use the captured counterless prompt and saved-number picker.
The three inherited option selections now pass their complete original timelines.

Post-connect p waits 2500 ms after connection before sending the suffix; w waits
for Send. Their continued digit/progress redraws and the longer acknowledged Hold/
New call/DTMF recordings remain five explicit known gaps. These are presentation
differences, not local successful network outcomes. All links remain owned for
power-off cleanup. True two-call end/swap/waiting lifecycle is still plan 22c.

UNVERIFIED product choices: Sending remains visible through the local DTMF program after
host acceptance (264 ms lead + 295 ms between starts + 146 ms final pair);
the explicit synthetic network acknowledges hold/retrieve and DTMF deterministically. A missing host method never
acknowledges. Factory DTMF events establish 146 ms pairs roughly 295 ms apart at word 0x99B5.
The three factory recordings lack keys.csv, so complete sound-golden alignment is
blocked and moves to 22c. Transmission plays these relative intervals after host
acceptance; the 264 ms lead from acceptance is UNVERIFIED (the captured lead is
from the confirmation beep).

## Identity, redial and zero charging (2026-10-30)

Outgoing calls carry `ownNumberSending: network | show | hide` from the actual
stock setting, except emergency calls. A host release may carry a numeric GSM
cause; all causes retain the same captured release UI. Automatic redial On and
Off both make no further attempt on captured cause 17 for 90 seconds. Broader
eligibility/interval/attempt policy remains 22c.

Without advice of charge, existing stock cost and prepaid views remain zero.
No amount is inferred from duration. Nonzero charging, limits and prepaid
responses remain blocked on network evidence in 22c. The three identity captures
match their pixels; the Set by network case retains the test-cell connection
redraw gap. Cold reset retains the shared power-key boot-timeline gap; it is not
evidence of persisted forwarding state.

## Website host policy (2026-10-30)

Unknown non-emergency numbers receive host release cause 1 (unallocated number),
using plan 22 S14's captured checkered Call 1, three-beep and standby path. The
website reports no alerting or connection for these numbers. Configured contact
and toolkit URLs retain their existing telephone path. A supplied network port
without `dial` also reports no progress; only the explicit default synthetic
network supplies its documented emulator progress.
