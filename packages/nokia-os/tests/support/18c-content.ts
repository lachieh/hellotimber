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
import { captureStamp, RECEIVE_LINK_SPREAD_MS, SEND_LINK_SPREAD_MS, SETUP_MS } from "./messages.ts";
import { PROBE_TOLERANCE_MS } from "./golden.ts";
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

/**
 * A note whose timeline another recording of it gave (`template-saved` is `content/templates-save`,
 * `template-erased` `content/templates-erase-default`, ...): the firmware's steps drift by up to
 * PROBE_TOLERANCE_MS between recordings (plan 14 D8).
 */
const OTHER_RECORDING: TimelineOptions = { toleranceMs: PROBE_TOLERANCE_MS };

/** Scenario options of the goldens that are not the default comparison, by id. */
export const CONTENT_OPTIONS: Readonly<Record<string, TimelineOptions>> = {
  "content/templates-fill-save": OTHER_RECORDING,
  "content/smileys-fill-save": OTHER_RECORDING,
  "content/templates-erase-edited": OTHER_RECORDING,
  "content/smileys-erase-edited": OTHER_RECORDING,
  "content/smileys-erase-user": OTHER_RECORDING,
  // The bin's lid steps run 6-29 ms later here than in `content/templates-erase-default` (its
  // fourth step 29 ms): the widest drift between the three Erase recordings.
  "content/templates-erase-user": { toleranceMs: 30 },
  // Chat. The carousel's Chat icon animates: its phase when the recording starts depends on key
  // latencies the replay does not reproduce (D8); compared from the prompt on.
  "chat/open": { fromRow: 1 },
  // The T9 editor draws 122 ms after OK, first in part (27 ms), then its cursor: rows the
  // replay's key placement skips, so the key goes down on that first draw.
  "chat/name-ok": { keyAt: { 0: 122 } },
  "chat/dictionary-off": OTHER_RECORDING,
  "chat/search-empty": OTHER_RECORDING,
  // Sends (plan 18 D10): the bar's steps (7-6's), `Message sent` within the synthetic cell's
  // spread, then its envelope's steps up to 37 ms off `sms/send`'s (the timeline's recording).
  "chat/send": { toleranceMs: 40, anchors: { 11: SEND_LINK_SPREAD_MS } },
  "chat/send-no-name": { toleranceMs: 40, anchors: { 11: SEND_LINK_SPREAD_MS } },
  // The partner's line lands RECEIVE_LINK_MS after the delivery, within the cell's spread.
  "chat/reply": { anchors: { 1: RECEIVE_LINK_SPREAD_MS } },
  "chat/arrive-editor": { anchors: { 6: RECEIVE_LINK_SPREAD_MS } },
  "chat/arrive-options": { anchors: { 1: RECEIVE_LINK_SPREAD_MS } },
  // Opening lasts 35-78 ms between recordings (plan 18's OPENING).
  "chat/inbox-after": { toleranceMs: 45 },
  // The carousel's icon steps after Exit run from the return (D8 key latency).
  "chat/exit": { toleranceMs: 15 },
  // Topics' notes play their timelines from `topics/add-name-ok`, `topics/erase-1`.
  "topics/erase-last": OTHER_RECORDING,
  "topics/factory-add-ok": OTHER_RECORDING,
  "topics/factory-name-empty-ok": OTHER_RECORDING,
  // `Topic name:` draws 72 ms after OK, in part first (18 ms): the rows key placement skips.
  "topics/factory-number-1000-ok": { keyAt: { 0: 72 } },
  // Requesting's bar is 7-6's (plan 14), its steps 5-12 ms later in this recording.
  "service-command/send": OTHER_RECORDING,
};

/** Every asserted plan 18c golden's scenario: its capture replayed. */
export const CONTENT_SCENARIOS: Readonly<Record<string, (id: string) => void>> = Object.fromEntries(
  readPlanIndex(GOLDENS, "18c")
    .filter((entry) => entry.status === "asserted")
    .map(({ id }) => [id, contentScenario(CONTENT_OPTIONS[id])]),
);

/** The tree nodes plan 18c's features bind, by a golden that shows each (the coverage guard). */
export const CONTENT_COVERS: Readonly<Record<string, readonly string[]>> = {
  "chat/open": ["3"],
};

/** Asserted plan 18c goldens whose scenario cannot pass, with the reason. */
export const CONTENT_KNOWN_GAPS: Readonly<Record<string, string>> = {
  "content/restore-virgin":
    "Menu 2 5 (and 2 6) on the virgin EEPROM: the firmware opens nothing and the shortcut " +
    "window's Messages carousel stays; nokia-os's kernel enters the Messages level before it " +
    "opens the leaf (phone-core's shortcut), so the leaf's no response leaves that level on " +
    "screen (Select on Templates in the level, `tree/02-messages/2-5.leaf`, matches)",
  "chat/factory-send":
    "this send's link took ≈2.99 s (Message sent at 2992 ms, the bar first drawn full), past " +
    "the synthetic cell's measured spread (2574-2790 ms, plan 18 D10) that nokia-os settles " +
    "within; chat/send and chat/send-no-name match",
  "chat/options-held-c":
    "C held on Options: the firmware closes Options on the key's down and reaches standby " +
    "561 ms after it; plan 18's option list closes on the key's up and phone-core's long " +
    "press is 800 ms",
  "chat/other-after-exit":
    "another number's SMS during Chat: the firmware announces it once standby is reached after " +
    "the chat (and first draws standby without its operator for 88 ms, as plan 18's " +
    "sms/notice-c); nokia-os follows plan 18 D12, where a key after an arrival away from " +
    "standby leaves only the envelope",
};
