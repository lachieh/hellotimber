// Plan 22's scenarios for other plans' goldens that wait on the standby number entry (Task 7):
// plan 14's shortcut probes whose digit starts a number at standby. Each presses its keys on the
// golden rows their effects start (D8), as plan 14's own probe scenarios do.
import type { PhoneKey } from "@hellotimber/phone-core";
import { OPTIONS_ESCAPE_SLUGS } from "../../scripts/capture-sets/20-calculator.ts";
import { calculatorSound, recordingScenario, soundCalculator } from "./calculator.ts";
import { levelPage } from "./game.ts";
import { timeline } from "./probes.ts";
import { expectSound, soundRig } from "./sound-scenarios.ts";
import { standbyRig } from "./rig.ts";
import type { Scenario } from "./acceptance.ts";

const key = (k: Parameters<typeof recordingScenario>[2]["key"], at: number) => ({ key: k, at });

/** Plan 14's probes: Menu and a typed shortcut, then a digit (or C) at the note or standby. */
export const CALLS_PLAN14_SCENARIOS: Readonly<Record<string, Scenario>> = {
  "probe/shortcut-m1-8-1": (id) =>
    recordingScenario(id, standbyRig(), key("navi", 0), [key("1", 3), key("8", 5), key("1", 6)]),
  "probe/shortcut-m1-8-1-2": (id) =>
    recordingScenario(id, standbyRig(), key("navi", 0), [
      key("1", 3),
      key("8", 5),
      key("1", 6),
      key("2", 7),
    ]),
  "probe/shortcut-m1-9-c": (id) =>
    recordingScenario(id, standbyRig(), key("navi", 0), [key("1", 3), key("9", 5), key("c", 8)]),
  "probe/shortcut-m8-6-3-late-1": (id) =>
    recordingScenario(id, standbyRig(), key("navi", 0), [
      key("8", 3),
      key("6", 5),
      key("3", 6),
      key("1", 9),
    ]),
};

/** Plan 14's handover goldens whose scenario cannot pass, with the reason. */
export const CALLS_PLAN14_KNOWN_GAPS: Readonly<Record<string, string>> = {
  "probe/shortcut-m1-9-c":
    "C at standby: the firmware draws standby without its operator for 88 ms; phone-core leaves " +
    "standby as it is on C",
  "probe/shortcut-m8-6-3-late-1":
    "its frames before the digit are probe/shortcut-m8-6-3's, a known gap of plan 14 (Settings' " +
    "first page value drawn over the Games list while 8-6 opens)",
};

/** Plan 16's keypad goldens: the dial keys' DTMF pairs at standby (Task 5). */
export const CALLS_PLAN16_SCENARIOS: Readonly<Record<string, Scenario>> = {
  "sound/keypad/hold": (id) => expectSound(id, soundRig("factory")),
};

/** Plan 23's Level page: a digit leaves for standby number entry. */
export const CALLS_PLAN23_SCENARIOS: Readonly<Record<string, Scenario>> = {
  "game/snake/level-keys-digit-1": (id) => timeline(id, levelPage(5), "1"),
};

const pressedOf = (slug: string): PhoneKey =>
  (({ star: "*", hash: "#" }) as Record<string, PhoneKey>)[slug] ?? (slug as PhoneKey);

/**
 * Plan 20's Options escape (D9): on the calculator's Options (factory, on 0) a digit, `*` or `#`
 * leaves for standby number entry with its DTMF pair.
 */
export const CALLS_PLAN20_SCENARIOS: Readonly<Record<string, Scenario>> = {
  ...Object.fromEntries(
    OPTIONS_ESCAPE_SLUGS.flatMap((slug) => [
      [
        `calculator/keys-options-${slug}`,
        (id: string) =>
          recordingScenario(id, soundCalculator("factory", "menu"), {
            key: pressedOf(slug),
            at: 0,
          }),
      ],
      [`sound/calculator/keys-options-${slug}`, (id: string) => calculatorSound(id, "menu")],
    ]),
  ),
  ...Object.fromEntries(
    (["0", "1"] as const).flatMap((k) => [
      [
        `calculator/options-dtmf-confirm-${k}`,
        (id: string) =>
          recordingScenario(id, soundCalculator("factory", "menu"), { key: k, at: 0 }),
      ],
      [`sound/calculator/options-dtmf-confirm-${k}`, (id: string) => calculatorSound(id, "menu")],
    ]),
  ),
};
