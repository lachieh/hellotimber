// Plan 19's acceptance (docs/plans/19-phone-book.md Task 11): the SIM phone book. Every scenario
// replays its capture's command log (tests/support/replay.ts over
// scripts/generated/phone-book-scripts.ts) on a phone with the log's SIM fixture and compares each
// shot, scroll, recording and sound; the table is PHONE_BOOK_SCENARIOS (tests/support/phone-book.ts).
// Goldens are pending until the task that implements them is done (plan 29 "Pending workflow").
import { acceptancePlan } from "../support/acceptance.ts";
import {
  PHONE_BOOK_COVERS,
  PHONE_BOOK_REPLAY,
  PHONE_BOOK_KNOWN_GAPS,
  PHONE_BOOK_SCENARIOS,
  PHONE_BOOK_TIMEOUTS_MS,
} from "../support/phone-book.ts";

import { PHONE_BOOK_SIMS } from "../../scripts/capture-sets/19-phone-book.ts";
import { createSyntheticNetwork } from "../../src/messages/network";
import type { StockCallControl } from "../../src/calls/network";
import { replayScenario, type ReplayContext } from "../support/replay.ts";
import { standbyRig, type Rig } from "../support/rig.ts";

// Plan 19's stock cell has no traffic channel (plan 22 D15): it alerts without connecting.
// Its long-number SETUP reaches alerting at 2933 - 60 ms (standby/list-call), the short at
// 2322 - 123 ms (service/call); network arrival times are supplied by this capture's host.
const CALL_REPLAY: ReplayContext = {
  ...PHONE_BOOK_REPLAY,
  setup(storage) {
    let rig: Rig;
    let alert: { at: number; phone: StockCallControl } | undefined;
    const network = {
      ...createSyntheticNetwork(),
      dial(call: { number: string }, phone: StockCallControl) {
        alert = { at: rig.now + (call.number.length > 14 ? 2873 : 0), phone };
        return {
          answer() {},
          hangUp() {
            alert = undefined;
          },
        };
      },
    };
    rig = standbyRig({ storage, sim: PHONE_BOOK_SIMS.content, network });
    const advance = rig.advance.bind(rig);
    rig.advance = (ms, stepMs) => {
      const end = rig.now + ms;
      if (alert !== undefined && alert.at <= end) {
        advance(Math.max(0, alert.at - rig.now), stepMs);
        const due = alert;
        alert = undefined;
        due.phone.alerting();
      }
      advance(end - rig.now, stepMs);
    };
    return rig;
  },
};

const CALL_SCENARIOS = Object.fromEntries(
  ["standby-list-call", "service-call", "hold-on-2"].map((name) => [
    `phone-book/${name}`,
    (id: string) => replayScenario(CALL_REPLAY, id),
  ]),
);

acceptancePlan({
  plan: "19",
  scenarios: { ...PHONE_BOOK_SCENARIOS, ...CALL_SCENARIOS },
  knownGaps: PHONE_BOOK_KNOWN_GAPS,
  timeoutsMs: PHONE_BOOK_TIMEOUTS_MS,
  covers: PHONE_BOOK_COVERS,
});
