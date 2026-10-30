# Calls II: supplementary services and in-call actions (plan 22b)

Task 0 investigation, 2026-10-29. This is evidence in progress, not an implementation
completion claim. Firmware: v6.39 PPM E virgin EEPROM. Corpus root:
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
