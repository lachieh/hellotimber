// Plan 18c test support: its capture logs (scripts/generated/content-scripts.ts, transcribed from
// `$REF/captures/scripts/v639-plan18c-<section>.cap`) replayed on a stock phone in each log's
// state, and the scenario options of the goldens that need more than the default comparison.
import {
  CONTENT_CAPTURE_SCRIPTS,
  CONTENT_CAPTURE_STATES,
} from "../../scripts/generated/content-scripts.ts";
import { readPlanIndex } from "../../scripts/golden-index.ts";
import { StockEeprom } from "../../src/firmware/eeprom";
import { createStockSettings } from "../../src/firmware/settings";
import { DICTIONARY_KEY } from "../../src/messages/bindings";
import { createSyntheticNetwork, type StockStorage, type SyntheticNetwork } from "../../src/index";
import { GOLDENS } from "./acceptance.ts";
import { captureStamp, SETUP_MS } from "./messages.ts";
import { replayScenario, type ReplayContext, type TimelineOptions } from "./replay.ts";
import { standbyRig, type Rig } from "./rig.ts";

/**
 * The factory setup (`v639-factory-setup.inc`): plan 15's restored image boots without the code,
 * then the time, the date and C held. 47.0 s of emulated time.
 */
export const FACTORY_SETUP_MS = 12000 + 5 * 592 + 4000 + 9 * 592 + 20000 + 1500 + 250 + 1000;

/**
 * Plan 15's factory-restored image: Restore factory settings over the virgin EEPROM, with the
 * Dictionary off (its editors are multi-tap: `templates/edit/01`, `insert/template/01`; Restore
 * keeps the Dictionary, plan 18b).
 */
export function factoryStorage(storage: StockStorage): StockStorage {
  const settings = createStockSettings(new StockEeprom(storage));
  settings.restoreFactory();
  settings.choose(DICTIONARY_KEY, 0);
  return storage;
}

const NETWORKS = new WeakMap<Rig, SyntheticNetwork>();

/** Plan 18c's capture logs on a stock phone in each log's state. */
export const CONTENT_REPLAY: ReplayContext = {
  scripts: CONTENT_CAPTURE_SCRIPTS,
  setup(storage, script) {
    const state = CONTENT_CAPTURE_STATES[script];
    if (state === undefined) throw new Error(`No state for capture log ${script}.`);
    if (state === "factory") factoryStorage(storage);
    const network = createSyntheticNetwork();
    const rig = standbyRig({ storage, network });
    NETWORKS.set(rig, network);
    return rig;
  },
  // Only the SMS time stamps count it (Chat shows none): the virgin setup's.
  setupMs: SETUP_MS,
  sms(rig, from, text, capMs, epochMs) {
    const network = NETWORKS.get(rig);
    if (network === undefined) throw new Error("No network for this phone.");
    network.deliver({ number: from, text, sentAt: captureStamp(epochMs, capMs) });
  },
};

/** What the synthetic network of a replayed phone sent (the on-air Chat texts). */
export function sentBy(rig: Rig): readonly { readonly number: string; readonly text: string }[] {
  return NETWORKS.get(rig)?.sent ?? [];
}

/** The scenario of plan 18c golden `id`: its capture replayed (tests/support/replay.ts). */
export function contentScenario(options: TimelineOptions = {}): (id: string) => void {
  return (id) => replayScenario(CONTENT_REPLAY, id, options);
}

/** Scenario options of the goldens that are not the default comparison, by id. */
export const CONTENT_OPTIONS: Readonly<Record<string, TimelineOptions>> = {};

/** Every asserted plan 18c golden's scenario: its capture replayed. */
export const CONTENT_SCENARIOS: Readonly<Record<string, (id: string) => void>> = Object.fromEntries(
  readPlanIndex(GOLDENS, "18c")
    .filter((entry) => entry.status === "asserted")
    .map(({ id }) => [id, contentScenario(CONTENT_OPTIONS[id])]),
);

/** The tree nodes plan 18c's features bind, by a golden that shows each (the coverage guard). */
export const CONTENT_COVERS: Readonly<Record<string, readonly string[]>> = {};

/** Asserted plan 18c goldens whose scenario cannot pass, with the reason. */
export const CONTENT_KNOWN_GAPS: Readonly<Record<string, string>> = {};
