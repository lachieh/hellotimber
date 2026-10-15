// Plan 25's acceptance (docs/plans/25-keyguard-and-backlight.md Task 10): one scenario per
// asserted golden: the keyguard's LCD goldens (their `leds` too, D10), the lights goldens and the
// keyguard's sound goldens. The goldens pending on plan 22 (call screens) are todos; known gaps
// name their cause.
import { readPlanIndex } from "../../scripts/golden-index.ts";
import { acceptancePlan, GOLDENS, type Scenario } from "../support/acceptance.ts";
import { expectLcd } from "../support/golden.ts";
import { goldenImage } from "../support/goldens.ts";
import {
  keyguardArrival,
  keyguardSound,
  keyguardTimeline,
  lockedRig,
  lockedWithMessage,
  type KeyguardCase,
} from "../support/keyguard.ts";
import { arrivalLights, lightsScenario } from "../support/lights.ts";
import { standbyRig } from "../support/rig.ts";

/**
 * Task 7: the keyguard's LCD goldens, by the keys of their captures (`tests/support/keyguard.ts`):
 * a later key on the golden row its effect starts, or `ms` after the trigger.
 */
const DIGITS_112 = [[{ ms: 500 }, "1"] as const, [3, "2"] as const];
const KEYGUARD: Readonly<Record<string, KeyguardCase>> = {
  "keyguard/lock": { from: "standby", trigger: ["navi"], later: [[3, "*"]], jitter: false },
  "keyguard/lock-star-held": { from: "standby", trigger: ["navi"], later: [[3, "*", 600]] },
  "keyguard/lock-gap/2000": { from: "standby", trigger: ["navi"], later: [[8, "*"]] },
  // The `*` pre-empts a carousel step the kernel draws 8 ms before the note: its own time.
  "keyguard/lock-gap/2500": { from: "standby", trigger: ["navi"], later: [[{ ms: 2500 }, "*"]] },
  "keyguard/lock-gap/2800": { from: "standby", trigger: ["navi"], later: [[11, "*"]] },
  "keyguard/lock-gap/2900": { from: "standby", trigger: ["navi"], later: [[11, "*"]] },
  "keyguard/lock-gap/2910": { from: "standby", trigger: ["navi"], later: [[11, "*"]] },
  // The window is what this golden pins: `*` 2920 ms after Menu, drawn 18 ms later.
  "keyguard/lock-gap/2920": { from: "standby", trigger: ["navi"], later: [[{ ms: 2920 }, "*"]] },
  // `1` opens the shortcut entry; the `*` 300 ms later changes nothing (no lock).
  "keyguard/lock-cancel/digit": {
    from: "standby",
    trigger: ["navi"],
    later: [
      [3, "1"],
      [{ ms: 577 }, "*"],
    ],
  },
  "keyguard/hint": { from: "dark", trigger: ["5"] },
  "keyguard/hint/up": { from: "dark", trigger: ["up"] },
  "keyguard/hint/pwr": { from: "dark", trigger: ["power", 100] },
  "keyguard/hint-during": { from: "dark", trigger: ["5"], later: [[4, "6"]] },
  // `6` restarts the hint on its first image (row 9): its step ends at row 10.
  "keyguard/hint-late": { from: "dark", trigger: ["5"], later: [[{ ms: 2746 }, "6"]] },
  // Another recording of the power key's hint: it times as the digits' (8 ms later steps, the
  // 9 ms closing partial) where keyguard/hint/pwr times as C's, ▲'s and ▼'s.
  "keyguard/power-key-held": { from: "lit", trigger: ["power", 10_000], jitter: true },
  "keyguard/unlock-alone": { from: "dark", trigger: ["navi"] },
  "keyguard/unlock-held": { from: "dark", trigger: ["navi", 800] },
  "keyguard/unlock": { from: "dark", trigger: ["navi"], later: [[2, "*"]], jitter: false },
  "keyguard/unlock-star-held": { from: "dark", trigger: ["navi"], later: [[2, "*", 600]] },
  "keyguard/unlock-digit": { from: "dark", trigger: ["navi"], later: [[2, "5"]] },
  "keyguard/unlock-c": { from: "dark", trigger: ["navi"], later: [[2, "c"]] },
  // The second Unlock restarts `Now press *` (no new frame): its end, row 2, less 1448 ms.
  "keyguard/unlock-twice": { from: "dark", trigger: ["navi"], later: [[{ ms: 726 }, "navi"]] },
  "keyguard/unlock-twice-star": {
    from: "dark",
    trigger: ["navi"],
    later: [
      [{ ms: 700 }, "navi"],
      [2, "*"],
    ],
  },
  ...Object.fromEntries(
    [1300, 1350, 1400, 1410, 1420, 1430, 1440, 1450, 1500, 1550].map((ms) => [
      `keyguard/unlock-gap/${ms}`,
      { from: "dark", trigger: ["navi"], later: [[ms <= 1440 ? 2 : 3, "*"]] },
    ]),
  ),
  "keyguard/emergency/112": { from: "dark", trigger: ["1"], later: DIGITS_112 },
  "keyguard/emergency/112-held": {
    from: "dark",
    trigger: ["1"],
    later: [
      [{ ms: 500 }, "1"],
      [3, "2", 600],
    ],
  },
  "keyguard/emergency/112-c": { from: "dark", trigger: ["1"], later: [...DIGITS_112, [4, "c"]] },
  "keyguard/emergency/112-digit": {
    from: "dark",
    trigger: ["1"],
    later: [...DIGITS_112, [4, "5"]],
  },
  "keyguard/emergency/112-unlock-after": {
    from: "dark",
    trigger: ["1"],
    later: [...DIGITS_112, [5, "navi"], [6, "*"]],
  },
  "keyguard/emergency/1122": { from: "dark", trigger: ["1"], later: [...DIGITS_112, [4, "2"]] },
  ...Object.fromEntries(
    ["2112", "0112"].map((digits) => [
      `keyguard/emergency/${digits}`,
      {
        from: "dark",
        trigger: [digits[0]],
        later: [
          [{ ms: 500 }, digits[1]],
          [{ ms: 1000 }, digits[2]],
          [3, digits[3]],
        ],
      },
    ]),
  ),
  // The third digit restarts the hint on its first image: its step ends at row 3.
  ...Object.fromEntries(
    ["000", "110", "113", "911", "999"].map((digits) => [
      `keyguard/emergency/${digits}`,
      {
        from: "dark",
        trigger: [digits[0]],
        later: [
          [{ ms: 500 }, digits[1]],
          [{ ms: 1026 }, digits[2]],
        ],
      },
    ]),
  ),
  "keyguard/emergency/08": { from: "dark", trigger: ["0"], later: [[{ ms: 530 }, "8"]] },
  // Another recording of the hint (lit): its steps spread up to 22 ms from keyguard/hint's.
  "keyguard/lit/hint-5": { from: "lit", trigger: ["5"], jitter: true },
  "keyguard/lit/unlock-alone": { from: "lit", trigger: ["navi"] },
  "keyguard/lit/unlock": { from: "lit", trigger: ["navi"], later: [[2, "*"]] },
  "keyguard/lit/emergency-112": { from: "lit", trigger: ["1"], later: DIGITS_112 },
} as Readonly<Record<string, KeyguardCase>>;

const scenarios: Record<string, Scenario> = {
  ...Object.fromEntries(
    readPlanIndex(GOLDENS, "25")
      .filter(
        (entry) =>
          entry.status === "asserted" &&
          entry.kind === "lights" &&
          !entry.id.startsWith("lights/arrival/"),
      )
      .map((entry) => [entry.id, lightsScenario]),
  ),
  // K7, L7: an SMS landing where the recording first changes (the unlocked recording's LED edge,
  // the locked one's notice, `keyguard/sms` frame 1).
  "lights/arrival/sms": (id) => arrivalLights(id, 2729),
  "lights/arrival/sms-locked": (id) => arrivalLights(id, 2477),
  "keyguard/sms": keyguardArrival,
  "keyguard/standby-message": lockedWithMessage,
  ...Object.fromEntries(
    Object.entries(KEYGUARD).map(([id, keyguardCase]) => [
      id,
      () => keyguardTimeline(id, keyguardCase),
    ]),
  ),
  // Task 9: the keyguard's sounds (D12).
  ...Object.fromEntries(
    readPlanIndex(GOLDENS, "25")
      .filter((entry) => entry.kind === "sound")
      .map((entry) => [entry.id, keyguardSound]),
  ),
  "keyguard/standby": (id) =>
    expectLcd(lockedRig().paint(), goldenImage(id, "standby"), "the locked standby"),
  // A cold power-on (the locked phone's flash, rebooted) is unlocked: the keyguard is RAM's.
  "keyguard/power-cycle": (id) =>
    expectLcd(standbyRig().paint(), goldenImage(id, "standby"), "after a cold power-on"),
};

acceptancePlan({
  plan: "25",
  scenarios,
  knownGaps: {
    "lights/timeout/virgin/tap-02":
      "the light tick's ±3 ms: this key-down lies 13631.1 ms before the fitted tick and the LEDs " +
      "stayed lit, while factory/tap-02 (13631.6 ms) and factory/fine-252 (13627.6 ms) went dark",
    ...Object.fromEntries(
      [
        "keyguard/hint-during",
        ...["000", "110", "113", "911", "999"].map((n) => `keyguard/emergency/${n}`),
      ].map((id) => [
        id,
        "partial draws caught at different points: this restarted hint closes with two (17 and " +
          "9 ms) where keyguard/hint, hint-late and emergency/08 show the one 8-9 ms draw",
      ]),
    ),
    ...Object.fromEntries(
      ["2500", "2900", "2910", "2920"].map((ms) => [
        `keyguard/lock-gap/${ms}`,
        "timer spread: this recording's Keypad locked runs 2901-2915 ms where keyguard/lock's " +
          "runs 2886 ms (2900: a 23 ms closing partial), so it ends more than " +
          "PROBE_TOLERANCE_MS after the replayed one",
      ]),
    ),
    ...Object.fromEntries(
      ["off", "on"].flatMap((lights) =>
        ["over", "top-score"].map((end) => [
          `lights/game/${lights}/${end}`,
          "the capture's bot steered live from its board (another seed, a game started 22 ms " +
            "earlier): its keys do not crash nokia-os's snake, so the death's end never lights " +
            "(tests/lights-rules.test.ts lights a crash of nokia-os's own)",
        ]),
      ),
    ),
    "keyguard/lock-cancel/digit":
      "`*` during the carousel's shortcut entry: the firmware ignores it and Phone book opens " +
      "when the entry's window ends; the kernel's shortcut entry (plan 14) ends at the `*`",
    "lights/boot/power-off":
      "the kernel switches the phone off 800 ms into the power key's hold, the firmware ≈1017 ms " +
      "(the power key's long press, plan 17)",
  },
});
