# Plan 22b — Calls II: services and costs

**Status:** in progress — plan authored; Task 0 not started.
**Prerequisites:** plans 22, 25, 30 and 31 done.
**Ground truth:** `docs/specs/stock/calls.md`, plan 22's S9, S15, S22 and S27,
`$REF/captures/scratch-plan22/` and `$REF/captures/6.39/plan22/`, where
`REF=/Volumes/SSD/Projects/lachieh/hellotimber/nokia-3310`.

Execute tasks in order, test first, verify and commit each completed task. AGENTS.md's
shared fidelity rules supersede any older timing requirements. No generated fixture is
edited by hand. No capture or extracted firmware is committed.

## Goal

Complete the stock telephone's supplementary services and in-call actions, using the host
network for outcomes and real-firmware captures for screens, sounds and timing.

## Scope

Call divert (7), Call waiting (6-1-3), SS/USSD at standby, Automatic redial (6-1-1),
Own number sending (6-1-4), Show call costs / Call cost settings / Prepaid credit (4-6…4-8),
Hold, New call, Send DTMF, post-connect `p`/`w` strings, and all three plan 22 goldens
`calls/in-call-options-select-1` through `-3`. Games, languages and website message providers
are outside scope. Conference behavior is included only where captures establish it as
necessary for the scoped two-call flows.

## Decisions

**D1 — Missing source plan.** At b7eccc2 there is no 22b file in the checkout, main checkout
or local history. Plan 22 explicitly says it will be written when scheduled. The user
on 2026-10-29 authorized this plan to be authored from the deferred scope and evidence.

**D2 — Network ownership.** Extend the existing `StockNetworkPort`; do not introduce a
second network or couple packages to website routes. The host supplies supplementary
service outcomes, hold/retrieve outcomes, call progress and charging information. No real
network operation succeeds merely because a timer elapsed. The explicit synthetic network
may implement deterministic emulator behavior. The website must keep its plan 31 link-call
policy and must not simulate a real remote party answering.

**D3 — Fidelity and uncertainty.** Settled pixels are exact and timing uses only the shared
rules. Plan 22 S27 establishes Requesting/Quit, approximately 15 s to Not done without a
response, Request not confirmed on Quit, active/inactive results and the divert icon.
Precise result layout, cancellation behavior, timeout anchor, persistence, wait/call actions,
redial eligibility and intervals, charging protocols and post-connect DTMF are UNVERIFIED
until Task 0. Never represent a local guess as measured firmware behavior.

**D4 — Capture harness.** Promote the scratch SS responder into a build-copy harness patch,
leaving emulator sources untouched. Compare a baseline clock script with and without the
extension. Use virgin firmware for LCDs and restored factory firmware for sounds, following
plan 22. Record commands, inputs and findings. Never import scratch captures or extracted data.

**D5 — Boundaries.** Put pure request/string/charging models in `src/calls/`, call behavior
in `telephone.ts`, and presentation in feature/widget modules. Extend the existing
`call-divert.ts`, `dialling.ts` and `call-register.ts` owners. Settings retain one authority.
A request cancelled, superseded or left by power-off cannot subsequently change the screen.

**D6 — Evidence blockers.** Attempt the missing captures before declaring a blocker.
If an essential result cannot be produced by the real firmware with the harness, record the
exact failure and evidence, split only that behavior into a named follow-up plan, and transfer
its pending goldens explicitly. Do not turn unimplemented goldens into asserted coverage.

## Golden pipeline additions

- Add `scripts/capture-sets/22b-calls-services.ts`, exported once from the capture-set index;
  import canonical `6.39/plan22b/` LCD/tick/sound captures to `goldens/index/22b.json`.
- Register dedicated resource extractors through `resources.generatedModules`; export each
  generated module once from `src/resources/index.ts`. Regenerate instead of editing outputs.
- Add `tests/acceptance/22b-calls-services.test.ts` with one `acceptancePlan` registration,
  scenarios and precise known gaps. Run the shared coverage guard.
- In plan 22's capture table, flip the three in-call selections to asserted only after their
  actual actions reproduce their frames; reimport index 22. Leave their fixtures owned by 22.
- Existing asserted tree/widget goldens remain covered. Update placeholder owners only when
  their behavior has actually been implemented. No per-test tolerance changes.

## Task 0 — Establish canonical captures

**Files:** `$REF/captures/6.39/plan22b/`, its capture generator/scripts and build-copy harness;
this plan's outcome and `docs/specs/stock/calls-services.md`.

- [ ] Inspect the scratch SS responder and current harness; establish baseline equivalence.
- [ ] Capture divert Activate (mailbox/other), Cancel, Status, Set delay, Cancel all, success,
      error, no answer, Quit/C, number details and standby indicator; cold boot and Restore.
- [ ] Capture Call waiting Activate/Cancel/Status and a second incoming call during a call.
- [ ] Capture Hold/retrieve, New call, End active/all, Send DTMF (empty, digits, saved string,
      cancel), `p`/`w` sequences after connect, and release/power-off during pending operations.
- [ ] Capture standby service strings (`04`, `#`, `*123#`, `*21*…#`, `##002#`, `*#21#`),
      service-command entry, result scrolling, rejection and unanswered requests.
- [ ] Capture redial On/Off with network failures and cancellation; own-number choices;
      costs/settings/prepaid with zero and supported nonzero advice-of-charge evidence.
- [ ] Record measured facts, exact inputs and reproducibility; identify genuine blockers.

**Verification:** rerun capture scripts, compare repeated settled frames, validate all files
and baseline hashes. Record unsupported network/harness paths as UNVERIFIED with precise causes.
Commit only the specification and plan evidence, never the external corpus.

## Task 1 — Import evidence and build acceptance scenarios

**Files:** capture set, resource inputs/modules, acceptance file and scenario support above.

- [ ] Register and import Task 0 captures; regenerate resources deterministically.
- [ ] Write failing acceptance scenarios for all supported flows and each inherited selection.
- [ ] Prove failures identify missing behavior; keep pending ownership explicit until fixed.

**TDD/verification:** focused acceptance and resource tests, coverage guard; `vp check --fix`
and the full uncached suite before commit (pending cases stay accounted for by the guard).

## Task 2 — Supplementary service requests and divert

**Files:** `src/calls/services.ts`, `src/messages/network.ts`, public exports,
`src/firmware/features/{call-divert,dialling}.ts`, request/result widgets, unit tests.

- [ ] Test host request/outcome, cancellation, late completion and power-off first.
- [ ] Implement standby SS/USSD and service-command requests through the shared network port.
- [ ] Implement divert inputs, results, timeout, Quit and indicator/persistence per captures.
- [ ] Assert corresponding goldens and document the public contract and synthetic behavior.

**Verification:** focused request/unit/acceptance tests; `vp check --fix`; full uncached suite.

## Task 3 — In-call services and DTMF

**Files:** `src/calls/{network,telephone,dial-string}.ts`, `src/widgets/call.ts`, call features,
focused tests and plan 22's capture set/scenarios.

- [ ] Test Hold/retrieve, New call, waiting-call transitions and End active/all with real ports.
- [ ] Implement captured call-waiting options and in-call actions with host-owned outcomes.
- [ ] Test and implement Send DTMF and post-connect `p`/`w`, including cancellation/release.
- [ ] Flip all three inherited plan 22 selections to asserted through the importer.

**Verification:** focused telephone/string/acceptance tests; `vp check --fix`; full uncached suite.

## Task 4 — Redial, identity and charging

**Files:** call models, network port, call-register/settings feature owners and focused tests.

- [ ] Test then implement automatic redial eligibility, timer, attempt limit and cancellation
      from captures; never synthesize successful remote call progress.
- [ ] Pass Own number sending policy to the host and retain stock setting behavior.
- [ ] Implement charging records/views/settings/prepaid to the extent proven by captures;
      preserve zero values without network advice and make unsupported charging explicit.
- [ ] Assert remaining supported goldens, document known gaps and standalone usage.

**Verification:** focused tests; `vp check --fix`; full uncached suite.

## Task 5 — Website integration and closure

**Files:** website call/network adapter only if needed (avoid `website/src/messages/` and
`website/src/routes/api/sms.ts`); plan, README, calls specification and package README.

- [ ] Verify the website's link calls still use the telephone path and services cannot invent
      network progress. Drive the actual website headlessly using
      `mise exec npm:agent-browser@0.34.0 -- agent-browser` and inspect `[role=status]`.
- [ ] All scoped goldens asserted, with any evidence-blocked split explicitly re-owned.
- [ ] Update the firmware spec index, task checkboxes, status and plans README row.

## Remaining gates

- [ ] `mise exec -- vp check`.
- [ ] `mise exec -- vp run -r --no-cache test` (record totals).
- [ ] `mise exec -- vp run website#build`.
- [ ] Website status-mirror evidence recorded.
- [ ] Per-task commits contain only owned paths; never stage TODOS.md.
- [ ] Final report: branch, SHA, tasks, goldens, known gaps, decisions, QA, totals, status.
