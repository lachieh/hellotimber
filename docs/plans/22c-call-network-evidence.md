# Plan 22c — Call network evidence

**Status:** blocked on captures.
**Prerequisite:** plan 22b supported single-call services.

## Scope and blocker (2026-10-29)

Capture true waiting-call and multi-call release/retrieve lifecycles, automatic-redial
eligibility/interval/attempt limits beyond cause 17, and nonzero advice of charge,
cost-limit enforcement and prepaid responses. These remain UNVERIFIED.

The existing build-copy network has one `callState`, `callTiPd` and `remoteNumber`.
`plan22b/closure-multicall/network.log` proves HOLD acknowledgement and a second
SETUP on TI 0x13, but its global call state is replaced: it cannot independently
release the two transactions. `in-call-ack/second-call` stays on a single frame;
`callin` while connected does not deliver a waiting SETUP. These are network
limitations, not evidence for handset behavior. The network supplies no advice
of charge or prepaid input. Cause 17 On/Off probes show no retries over 90 s;
other eligible causes and intervals are not established.

## Ownership

`calls-services/in-call-ack-second-call` stays in index 22b, re-owned by its capture
set as `pending:22c`. The three inherited plan 22 option selections stay owned
by 22b; opening their single-call actions does not require this split.

## Tasks

- [ ] Extend only a build-directory copy to retain independent call transactions.
- [ ] Prove disabled-extension baseline equivalence.
- [ ] Capture waiting, swap, End active/all and release of either remote party.
- [ ] Obtain supported redial and charging protocol input, or record exact blockers.
- [ ] Register canonical evidence, TDD implementation, assert transferred golden.
- [ ] Run check, full uncached tests, website build and status-mirror QA.

No guessed network outcome or per-test tolerance is authorized.

## Additional evidence blockers confirmed during 22b implementation

- Factory sound: `plan22b/factory-sound/{divert-status,waiting-status,dtmf}.events.csv`
  and WAVs exist, but none of the three recording directories contains `keys.csv`.
  `buildSoundGolden` requires those edges and rejects a missing file. Obtain actual
  key-edge recordings; do not synthesize them from expected output timing. Relative
  DTMF pair durations/cadence are measurable, but key-to-sound alignment is not.
- Divert persistence: `persist/reboot` ends at a security gate; the bounded
  `persist-unlock/reboot-after-code` reaches Time. Neither reaches settled standby
  after registration, so retaining/resetting the divert indicator across a true
  cold boot and Restore is not established. The existing reboot LCD fixture stays
  22b's boot-path comparison; no new golden is re-owned for these absent captures.
