// Plan 30 test support: the SIM content scenarios replay Task 0's own command logs
// (tests/support/replay.ts over scripts/generated/sim-content-scripts.ts) on a phone with the
// log's SIM fixture and applet script (`simContentCard`) in its virgin or factory state, and
// compare every shot and recording a golden holds. The power-on stills are driven by hand: their
// logs type the virgin image's date prompt, which a skip boot does not show.
import {
  SIM_CONTENT_CAPTURE_SCRIPTS,
  SIM_CONTENT_SCRIPT_SETUPS,
} from "../../scripts/generated/sim-content-scripts.ts";
import {
  simContentCard,
  SIM_CONTENT_GOLDEN_SIMS,
  type SimContentSimName,
  type SimContentToolkitName,
} from "../../scripts/capture-sets/30-sim-content.ts";
import { StockEeprom } from "../../src/firmware/eeprom";
import { createStockSettings } from "../../src/firmware/settings";
import {
  createMemoryStorage,
  createSyntheticNetwork,
  type StockSimCard,
  type SyntheticNetwork,
} from "../../src/index";
import {
  expectLcdAnyBlink,
  replayScenario,
  type ReplayContext,
  type TimelineOptions,
} from "./replay.ts";
import { captureStamp, messagesRewrite, SETUP_MS } from "./messages.ts";
import { goldenImage, loadGolden } from "./goldens.ts";
import { standbyRig, type Rig } from "./rig.ts";

/** Each replayed phone's synthetic network, which the logs' `sms` commands deliver through. */
const NETWORKS = new WeakMap<Rig, SyntheticNetwork>();

/**
 * A block's commands as a stock phone replays them: plan 18's rewrite, and a bare `reboot` (a
 * power cycle of the same emulator process, `sms/erase`) as an image the replay saved just before:
 * the phone's memory survives it.
 */
function simContentRewrite(lines: readonly string[]): string[] {
  return messagesRewrite(lines).flatMap((line) =>
    line.trim() === "reboot"
      ? ["saveflash plan30-power-cycle", "reboot plan30-power-cycle"]
      : [line],
  );
}

/** A phone with `sim` (and `toolkit`) at standby over `storage`, factory-restored first if asked. */
export function simContentRig(
  sim: SimContentSimName,
  toolkit: SimContentToolkitName | undefined,
  options: {
    readonly factory?: boolean;
    readonly storage?: ReturnType<typeof createMemoryStorage>;
  } = {},
): Rig {
  const storage = options.storage ?? createMemoryStorage();
  if (options.factory) createStockSettings(new StockEeprom(storage)).restoreFactory();
  const network = createSyntheticNetwork();
  const rig = standbyRig({
    storage,
    network,
    sim: simContentCard(sim, toolkit) as StockSimCard,
  });
  NETWORKS.set(rig, network);
  return rig;
}

/** Plan 30's capture logs on a stock phone with each log's SIM (`standbyRig` stands for the setup). */
export const SIM_CONTENT_REPLAY: ReplayContext = {
  scripts: SIM_CONTENT_CAPTURE_SCRIPTS,
  rewrite: simContentRewrite,
  setup(storage, script) {
    const setup = SIM_CONTENT_SCRIPT_SETUPS[script];
    if (setup === undefined) throw new Error(`No setup for capture log ${script}.`);
    return simContentRig(
      setup.sim as SimContentSimName,
      setup.toolkit as SimContentToolkitName | undefined,
      { factory: setup.setup === "factory", storage },
    );
  },
  setupMs: SETUP_MS,
  sms(rig, from, text, capMs, epochMs) {
    const network = NETWORKS.get(rig);
    if (network === undefined) throw new Error("No network for this phone.");
    // The harness's `sms` takes digits only: a network originator loses its `+` (Task 0 N).
    network.deliver({
      number: from.replace(/^\+/, ""),
      text,
      sentAt: captureStamp(epochMs, capMs),
    });
  },
};

/** The scenario of plan 30 golden `id`: its capture replayed. */
export function simContentScenario(options: TimelineOptions = {}): (id: string) => void {
  return (id) => replayScenario(SIM_CONTENT_REPLAY, id, options);
}

/** The logs' tap: ≈42 ms down, the emulator's 250 ms settle, the 300 ms key gap. */
function tap(rig: Rig, key: Parameters<Rig["press"]>[0], waitMs: number): void {
  rig.press(key, 42);
  rig.advance(250 + 300 + waitMs);
}

/**
 * A power-on still (`sim/sms-boot-*`): standby once the phone is on, then (with an `-inbox`
 * image) Messages › Inbox as the logs open it (Menu, 2, ▼, Select).
 */
export function simBootScenario(id: string): void {
  const golden = loadGolden(id);
  const { sim } = SIM_CONTENT_GOLDEN_SIMS[id]!;
  const rig = simContentRig(sim, undefined, { factory: id.endsWith("-factory") });
  for (const image of golden.images) {
    if (image.name.endsWith("-inbox")) {
      tap(rig, "navi", 400);
      tap(rig, "2", 2500);
      tap(rig, "down", 400);
      tap(rig, "navi", 3000);
    }
    expectLcdAnyBlink(rig.paint(), goldenImage(id, image.name), `${id} ${image.name}`);
  }
}

/**
 * An arrival's notice lands RECEIVE_LINK_MS (2324 ms) after its delivery. The synthetic cell's
 * link time spans 2141-2464 ms in plan 18's recordings and 2142-2798 ms in plan 30's (the same
 * path, so the spread is imperceptible by the fidelity standard's rule for recordings of one
 * path): the notice row is compared within it.
 */
export const RECEIVE_SPREAD_MS = 475;
export const ARRIVAL: TimelineOptions = { anchors: { 1: RECEIVE_SPREAD_MS } };

/**
 * Opening (the Inbox) and Opening message last 35-80 ms in plan 18's recordings (the emulator's
 * own SIM) and 270-625 ms in plan 30's (Task 0's swSIM fixture), for the same screens: the screen
 * after them is compared within that spread (the rule for recordings of one path); nokia-os keeps
 * plan 18's timing.
 */
export const SIM_READ_SPREAD_MS = 600;

/** A recording whose row `row` follows an Opening note. */
export const afterOpening = (row: number): TimelineOptions => ({
  anchors: { [row]: SIM_READ_SPREAD_MS },
});

/** The scenario options of plan 30's recordings that are not the default, by golden id. */
function optionsOf(id: string): TimelineOptions {
  if (/-arrive(-\d)?$/.test(id)) return ARRIVAL;
  // The Inbox opened (Select, or Read on the notice): the list after `Opening`.
  if (id === "sim/sms-inbox-open") return afterOpening(2);
  if (id === "sim/names-exact-notice-read") return afterOpening(3);
  // Read on a message: its first page after `Opening message`.
  if (/^sim\/sms-read-\d-open$/.test(id)) return afterOpening(2);
  return {};
}

/** The scenario of a plan 30 golden: a power-on still by hand, else its capture replayed. */
export function simContentScenarioOf(id: string): (id: string) => void {
  return id.startsWith("sim/sms-boot-") ? simBootScenario : simContentScenario(optionsOf(id));
}

/**
 * Asserted plan 30 goldens whose scenario cannot pass, with the reason (Task 0 N's shared 9-digit
 * suffix: Bob 0412345678 and Intl +61412345678 in one phone book).
 */
export const SIM_CONTENT_KNOWN_GAPS: Readonly<Record<string, string>> = Object.fromEntries(
  (
    [
      ["bob-9digits", "412345678"],
      ["bob-k10", "5412345678"],
      ["bob-plus", "61412345678"],
    ] as const
  ).map(([slug, number]) => [
    `sim/names-${slug}`,
    `the arrival from ${number} matches both Bob 0412345678 and Intl +61412345678 on their last 9 ` +
      "digits; v6.39 then names nobody (while 44412345678 names Bob and a SIM message from " +
      "+61412345678 names Intl: Task 0 N found no rule), nokia-os names the first match, Bob",
  ]),
);
