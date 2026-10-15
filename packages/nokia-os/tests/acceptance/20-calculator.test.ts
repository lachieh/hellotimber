// Plan 20's acceptance (docs/plans/20-calculator.md Task 8): every asserted calculator golden.
// Stills replay their Task 0 case (CALCULATOR_CASES) from a fresh phone; timelines replay their
// recording's keys; sound goldens are Task 7's scenarios. The D9 escape fixtures (Options'
// digits, `*` and `#`) wait on plan 22 (`pending:22`).
import type { PhoneKey } from "@hellotimber/phone-core";
import { CALCULATOR_STILLS } from "../../scripts/capture-sets/20-calculator.ts";
import { acceptancePlan, type Scenario } from "../support/acceptance.ts";
import {
  CALCULATOR_SOUND_SCENARIOS,
  calculatorCase,
  caseRig,
  DOMESTIC,
  FOREIGN,
  keyAlignedScenario,
  openCalculator,
  play,
  recordingScenario,
  soundCalculator,
  stillScenario,
} from "../support/calculator.ts";
import { standbyRig, type Rig } from "../support/rig.ts";

/** The calculator's first screen on a virgin phone, then `keys`. */
function calculatorAt(keys = ""): Rig {
  const rig = standbyRig();
  openCalculator(rig);
  play(rig, keys);
  return rig;
}

const NOTE_SETUPS = {
  "divide-by-zero": "7 * * * * 0",
  "out-of-range": "9 9 9 9 9 * * * 9 9 9 9 9",
} as const;

/** The restored phone's calculator after Restore factory settings (`persist/restore*-first`). */
const restored = (prefix: "restore" | "restore-foreign"): Rig =>
  caseRig(calculatorCase(`persist/${prefix}-first`));

/** On the Restore factory settings prompt with 12345 typed, a rate saved in `direction`. */
function restorePrompt(prefix: "restore" | "restore-foreign"): Rig {
  const rig = standbyRig();
  openCalculator(rig);
  const [rate, prompt] =
    prefix === "restore"
      ? ["menu up menu down menu +500 2", DOMESTIC]
      : [`${FOREIGN} 1 # 5`, FOREIGN];
  play(rig, `${rate} menu +3500 ${prompt} menu +3500 c +1000 c +1000`);
  play(rig, "menu +300 down down down down down +1000 menu down down down menu +2000 1 2 3 4 5");
  return rig;
}

const key = (k: PhoneKey, at: number | { ms: number } = 0, holdMs?: number) => ({
  key: k,
  at,
  ...(holdMs === undefined ? {} : { holdMs }),
});

const SCENARIOS: Record<string, Scenario> = {
  ...Object.fromEntries(CALCULATOR_STILLS.map(({ id }) => [id, stillScenario])),

  "calculator/open": (id) =>
    recordingScenario(
      id,
      (() => {
        const rig = standbyRig();
        play(rig, "menu +300 up up up up +2000");
        return rig;
      })(),
      key("navi"),
    ),
  // The carousel's Calculator icon plays plan 13's recording of it (menu/09-calculator.anim);
  // this recording's steps run within 16 ms of it.
  "calculator/exit": (id) => recordingScenario(id, calculatorAt(), key("c"), []),
  // 5 6 7, C held 2 s, 1, * and # held 1.2 s, C held 2 s on `1 + 0.` and on `0`; each key on the
  // row its effect starts. The clear follows C's deletion by CALCULATOR_HOLD_MS (the capture:
  // 471 and 478 ms).
  "calculator/clear-held": (id) =>
    recordingScenario(id, calculatorAt(), key("5"), [
      key("6", 2),
      key("7", 3),
      key("c", 4, 2000),
      key("1", 6, 1200),
      key("*", 7, 1200),
      key("#", 8, 1200),
      key("c", 9, 2000),
      key("c", 11, 2000),
    ]),
  "calculator/operator-slow": (id) =>
    recordingScenario(id, calculatorAt("1 2"), key("*"), [key("*", 2), key("*", 3)]),
  ...Object.fromEntries(
    (["divide-by-zero", "out-of-range"] as const).flatMap((kind) => [
      [
        `calculator/${kind}`,
        (id: string) =>
          recordingScenario(id, calculatorAt(`${NOTE_SETUPS[kind]} menu`), key("navi")),
      ],
      [
        `calculator/${kind}-add`,
        (id: string) =>
          recordingScenario(id, calculatorAt(`${NOTE_SETUPS[kind]} menu down`), key("navi")),
      ],
      ...(
        [
          ["c", key("c", 2)],
          ["digit", key("5", 2)],
          ["down", key("down", 2)],
          ["c-held", key("c", 2, 1500)],
        ] as const
      ).map(([slug, later]) => [
        `calculator/note-keys-${kind}-${slug}`,
        (id: string) =>
          recordingScenario(id, calculatorAt(`${NOTE_SETUPS[kind]} menu`), key("navi"), [later]),
      ]),
    ]),
  ),
  // Dividing by zero not allowed plays calculator/divide-by-zero's timeline (2890 ms; 2875 ms
  // in this recording).
  "calculator/in-foreign-rate-0": (id) =>
    recordingScenario(id, calculatorAt("1 0 menu down down down down down down"), key("navi"), []),
  // The cursor's blink is the representative prompt cursor (2-9), within the fidelity standard
  // of these recordings (their steps vary 477-494 ms).
  "calculator/rate-prompt-foreign": (id) =>
    recordingScenario(id, calculatorAt("menu up menu"), key("navi"), []),
  "calculator/rate-prompt-domestic": (id) =>
    recordingScenario(id, calculatorAt("menu up menu down"), key("navi"), []),
  "calculator/rate-blink-keys": (id) =>
    recordingScenario(id, calculatorAt("menu up menu"), key("navi"), [key("5", 3), key("6", 6)]),
  // The entry's blink phase before OK follows the harness's tap timing (see stillScenario):
  // 100 ms more puts nokia-os's blink in the captured phase (the cursor shown).
  "calculator/rate-saved": (id) =>
    recordingScenario(id, calculatorAt(`${FOREIGN} 1 # 5 +100`), key("navi")),
  ...Object.fromEntries(
    (["restore", "restore-foreign"] as const).flatMap((prefix) => [
      // Settings restored plays plan 15's `settings-restored` timeline (probe/accept-c7-restore).
      [
        `calculator/persist-${prefix}-run`,
        (id: string) => recordingScenario(id, restorePrompt(prefix), key("navi"), []),
      ],
      [
        `calculator/persist-${prefix}-prompt-foreign`,
        (id: string) => {
          const rig = restored(prefix);
          play(rig, "menu up menu");
          recordingScenario(id, rig, key("navi"), []);
        },
      ],
      [
        `calculator/persist-${prefix}-prompt-domestic`,
        (id: string) => {
          const rig = restored(prefix);
          play(rig, "menu up menu down");
          recordingScenario(id, rig, key("navi"), []);
        },
      ],
    ]),
  ),
  // OK on the entry: Rate saved plays calculator/rate-saved's timeline (694/232/523 ms; here
  // 700/248/513 ms).
  "calculator/keys-rate-menu": (id) =>
    recordingScenario(id, soundCalculator("factory", `${FOREIGN} 1`), key("navi"), []),
  ...Object.fromEntries(
    [..."0123456789".split(""), "star", "hash", "up", "down", "c"].map((slug) => {
      const pressed =
        ({ star: "*", hash: "#" } as Record<string, PhoneKey>)[slug] ?? (slug as PhoneKey);
      return [
        `calculator/keys-rate-${slug}`,
        (id: string) => keyAlignedScenario(id, soundCalculator("factory", `${FOREIGN} 1`), pressed),
      ];
    }),
  ),
  ...Object.fromEntries(
    ["up", "down", "c", "menu"].map((slug) => [
      `calculator/keys-options-${slug}`,
      (id: string) =>
        recordingScenario(
          id,
          soundCalculator("factory", "menu"),
          key(slug === "menu" ? "navi" : (slug as PhoneKey)),
        ),
    ]),
  ),
  ...CALCULATOR_SOUND_SCENARIOS,
};

/** C held on `0` exits to the carousel at its down; the firmware goes on to standby. */
const HELD_ACROSS_EXIT =
  "C held on 0 leaves for the carousel at its down, then the firmware goes on to standby (540 " +
  "ms after the down, an 84 ms partial draw first) while C stays held; nokia-os's kernel " +
  "swallows a key held across an application's exit, so its long press never fires " +
  "(phone-core, as plan 23's game/snake/keys-c-hold); every earlier row matches";
const HELD_AFTER_NOTE =
  "C held after dismissing the note goes to standby 475 ms after its down (the capture: 491 " +
  "ms) through the firmware's 84 ms partial draw of standby's edges; nokia-os's flow switches " +
  "to standby at once (no partial-draw timeline exists for it)";
const RESTORED_BLINK =
  "after Restore factory settings with Domestic 2 saved this prompt opens with its cursor " +
  "hidden (both directions; after Foreign 1.5 and in the virgin recordings it opens shown, " +
  "as nokia-os's every prompt): the firmware's initial blink phase is UNVERIFIED";

acceptancePlan({
  plan: "20",
  scenarios: SCENARIOS,
  knownGaps: {
    "calculator/clear-held": HELD_ACROSS_EXIT,
    "calculator/note-keys-divide-by-zero-c-held": HELD_AFTER_NOTE,
    "calculator/note-keys-out-of-range-c-held": HELD_AFTER_NOTE,
    "calculator/persist-restore-prompt-foreign": RESTORED_BLINK,
    "calculator/persist-restore-prompt-domestic": RESTORED_BLINK,
  },
  // Every still fixture boots a fresh phone per image (`results`: 102).
  timeoutsMs: Object.fromEntries(CALCULATOR_STILLS.map(({ id }) => [id, 30_000])),
});
