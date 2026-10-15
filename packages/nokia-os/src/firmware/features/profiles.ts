// Profiles (menu 12; plan 17): a profile is its Personalise settings plus a name. The active
// profile is the stored choice `profiles/active` (D1), and Tones are its Personalise settings, so
// every effect of a profile (keypad tones, warning tones, previews, the vibrator, game shakes)
// follows it with no plan 16 change (D11). Names are the Rename texts (D2). Each profile's
// Personalise is General's subtree; Screen saver's setter level; the factory values.
import {
  Timeline,
  type Phone,
  type PhoneApplication,
  type PhoneKey,
  type ScreenModel,
} from "@hellotimber/phone-core";
import type { WidgetModel } from "../../display/widgets";
import type { StandbyFrameModel } from "../../display/profiles";
import {
  WIDGET_TIMELINE_BY_NODE,
  type StockWidgetTimeline,
  type WidgetFrame,
} from "../../resources";
import { StockFlowApplication, type Flow, type Widget } from "../../widgets/flow";
import { note } from "../../widgets/note";
import { OptionListWidget } from "../../widgets/option-list";
import type { StockSettings } from "../settings";
import { timelineById, timelineByName } from "../timelines";
import type { FactoryDefault, StockFeature, StockServices } from "./feature";

/** The six v6.39 slots in order (P11: no Meeting, Outdoor or Pager profile). */
export const PROFILE_SLUGS = ["general", "silent", "discreet", "loud", "empty", "empty-2"] as const;
export type ProfileSlug = (typeof PROFILE_SLUGS)[number];

/** The active profile: a single choice over PROFILE_SLUGS; never written = General (P7). */
export const ACTIVE_PROFILE_KEY = "profiles/active";

/** A profile's name has at most this many characters (P6: the Rename counter starts at 10). */
export const PROFILE_NAME_LIMIT = 10;

/** The name an empty Rename restores: the slot's factory name (P6; slot 6: R5). */
const DEFAULT_NAMES: Readonly<Record<Exclude<ProfileSlug, "general">, string>> = {
  silent: "Silent",
  discreet: "Discreet",
  loud: "Loud",
  empty: "(empty)",
  "empty-2": "(empty)",
};

const TONES = "tones/";

/**
 * Standby draws the active profile's name this long after standby is entered (D5): the median of
 * `profiles/activate-*` and `tree/12-profiles/12-n-1.leaf` (1898-1913 ms after a note's end; every
 * entry, a key's return included, lies within 1898-1930 ms of standby's own frame, Task 0).
 */
export const PROFILE_LINE_DELAY_MS = 1912;

/** The active profile (D1). */
export function activeProfile(settings: StockSettings): ProfileSlug {
  return PROFILE_SLUGS[settings.choice(ACTIVE_PROFILE_KEY) ?? 0]!;
}

/** Makes `slug` the active profile; stored at once. */
export function activateProfile(settings: StockSettings, slug: ProfileSlug): void {
  settings.choose(ACTIVE_PROFILE_KEY, PROFILE_SLUGS.indexOf(slug));
}

/** The Rename text of a profile (General has none, P11). */
function renameKey(slug: Exclude<ProfileSlug, "general">): string {
  return `profiles/${slug}/personalise/rename`;
}

/** A profile's name, wherever one is drawn (D2): General's is constant, the others' stored. */
export function profileName(settings: StockSettings, slug: ProfileSlug): string {
  if (slug === "general") return "General";
  return settings.text(renameKey(slug)) ?? DEFAULT_NAMES[slug];
}

/** Renames a profile (P6); an empty name restores the slot's factory name. */
export function renameProfile(settings: StockSettings, slug: ProfileSlug, name: string): void {
  if (slug === "general") throw new Error("General has no Rename (P11).");
  if (Array.from(name).length > PROFILE_NAME_LIMIT) {
    throw new Error(`A profile name has at most ${PROFILE_NAME_LIMIT} characters: "${name}".`);
  }
  settings.setText(renameKey(slug), name === "" ? DEFAULT_NAMES[slug] : name);
}

/** A profile's node number (`12-<n>`). */
function slotNumber(slug: ProfileSlug): string {
  return `12-${PROFILE_SLUGS.indexOf(slug) + 1}`;
}

function isProfile(slug: string): slug is ProfileSlug {
  return (PROFILE_SLUGS as readonly string[]).includes(slug);
}

/**
 * Activate (D3): the choice is stored when the note opens, so its beep (D4) and its standby
 * follow it; `Selected` / `profile:` / the name with the slot's own tick timeline, the edges
 * step, standby. The power key's down leaves for standby, where it opens the power list (B6).
 */
export function activateLeaf(services: StockServices, slug: ProfileSlug): () => Widget {
  const number = `${slotNumber(slug)}-1`;
  const id = WIDGET_TIMELINE_BY_NODE[number];
  if (id === undefined) throw new Error(`No widget timeline for Activate ${number}.`);
  const timeline = timelineById(id, `Activate ${number}`);
  return () => {
    activateProfile(services.settings, slug);
    return note({
      lines: ["Selected", "profile:", profileName(services.settings, slug)],
      timeline,
      end: "standby",
      sound: services.noteSound,
      powerLeaves: true,
    });
  };
}

/** Option indices of the Tones lists the standby rules read (the tree's option order). */
const ALERT_OFF = 4; // Ringing, Ascending, Ring once, Beep once, Off
const NO_TONE = 0; // No tone, Standard, Special, Beep once, Ascending
const KEYPAD_OFF = 0; // Off, Level 1, Level 2, Level 3
const WARNING_OFF = 1; // On, Off

/** The active profile's Incoming call alert is Off: standby's icon (D6, Task 0 A3). */
export function standbySilent(settings: StockSettings): boolean {
  return settings.choice("tones/incoming-call-alert") === ALERT_OFF;
}

/**
 * The text of standby's profile line: the active profile's name; for General none, unless its
 * alert, message tone, keypad tones and warning tones are all off, when the firmware writes
 * `Silent` (Task 0 A3: not Silent's stored name).
 */
export function standbyProfileText(settings: StockSettings): string | undefined {
  const active = activeProfile(settings);
  if (active !== "general") return profileName(settings, active);
  const silent =
    standbySilent(settings) &&
    settings.choice("tones/message-alert-tone") === NO_TONE &&
    settings.choice("tones/keypad-tones") === KEYPAD_OFF &&
    settings.choice("tones/warning-tones") === WARNING_OFF;
  return silent ? "Silent" : undefined;
}

/** phone-core's `standbyLine` (D5): the profile line once standby has shown for the delay. */
export function standbyProfileLine(
  settings: StockSettings,
): (shownMs: number) => string | undefined {
  return (shownMs) => (shownMs < PROFILE_LINE_DELAY_MS ? undefined : standbyProfileText(settings));
}

/** The profile a key-down activates: Navi on Activate, or a menu-number digit onto it. */
function activatedBy(phone: Phone, key: PhoneKey): ProfileSlug | undefined {
  const screen = phone.screen;
  if (screen.kind !== "list") return undefined;
  const segments = screen.menuIndicator?.segments ?? [];
  // Menu 1 2 n, then 1 (D4, Task 0 A6): the digit selects Activate in profile n's level, while
  // the typed profile is still opening (the Profiles level, `opening`) or once it has opened
  // with the shortcut window still awaiting a digit.
  if (key === "1") {
    if (phone.path === "menu/profiles" && screen.opening === true) {
      return PROFILE_SLUGS[screen.selected];
    }
    const awaiting = screen.menuIndicator?.typed === "" && segments.length === 2;
    return awaiting && segments[0] === 12 ? PROFILE_SLUGS[segments[1]! - 1] : undefined;
  }
  const match = /^menu\/profiles\/([a-z0-9-]+)$/.exec(phone.path);
  if (key !== "navi" || match === null || !isProfile(match[1]!)) return undefined;
  return screen.selected === 0 ? match[1] : undefined;
}

/**
 * The Keypad tones option the key going down beeps at when it activates a profile (D4: the
 * firmware switches before the beep): that profile's; undefined when the key activates none.
 */
export function activationBeep(
  phone: Phone,
  key: PhoneKey,
  settings: StockSettings,
  power?: PowerListState,
): number | null | undefined {
  const entry = power === undefined ? undefined : chosenEntry(power, key);
  const slug =
    entry === undefined || entry === 0 ? activatedBy(phone, key) : PROFILE_SLUGS[entry - 1];
  return slug === undefined
    ? undefined
    : settings.choice(`profiles/${slug}/personalise/keypad-tones`);
}

// ---------------------------------------------------------------- the power key's list (D7)

/** The power list's leading frame, standby with the ladders erased (29-30 ms, Task 0 B). */
export const POWER_LIST_LEAD_MS = 29;
/** C on the list: standby without the operator for 84-88 ms before standby (Task 0 B). */
export const POWER_LIST_RETURN_MS = 86;
/**
 * `0` waits this long from its key-down, then `Invalid shortcut` (`power-general-digit-0`): its
 * warning tone sounds 2931 ms after the key and the note is drawn at 2979 ms; nokia-os opens the
 * note (both at once) between them.
 */
export const POWER_LIST_ZERO_MS = 2955;

/** The standby model the power key left (its leading and C frames draw it). */
export type StandbyScreen = Extract<ScreenModel, { kind: "standby" }>;

/**
 * What the wrapper and the power list share: the standby the power key went down on, and the
 * list's highlighted entry while it is open (the activation beep reads it, D4).
 */
export class PowerListState {
  /** The standby model when the power key went down. */
  standby: StandbyScreen | undefined;
  /** The highlighted entry (0 Switch off!, 1 General … 6 slot 6) while the list is open. */
  selected: number | undefined;
}

/** The entry a key-down chooses in the open power list: OK on the highlight, or a digit 1-7. */
function chosenEntry(state: PowerListState, key: PhoneKey): number | undefined {
  if (state.selected === undefined) return undefined;
  if (key === "navi") return state.selected;
  const digit = /^[1-7]$/.test(key) ? Number(key) : undefined;
  return digit === undefined ? undefined : digit - 1;
}

/**
 * `widget`, chosen on a key's down: that key's release is the choice's, not the widget's (a note
 * would end on it).
 */
function afterDown(key: PhoneKey, widget: Widget): Widget {
  let released = false;
  return {
    render: (flow) => widget.render(flow),
    onKeyDown: (k, flow) => widget.onKeyDown?.(k, flow),
    onKey(k, flow) {
      if (k === key && !released) {
        released = true;
        return;
      }
      widget.onKey?.(k, flow);
    },
    tick: (dtMs, flow) => widget.tick?.(dtMs, flow),
    close: () => widget.close?.(),
  };
}

/** A standby frame the list shows for `ms`, then `next`. */
class StandbyFrameWidget implements Widget {
  readonly #model: StandbyFrameModel;
  #left: number;
  readonly #next: (flow: Flow) => void;

  constructor(model: StandbyFrameModel, ms: number, next: (flow: Flow) => void) {
    this.#model = model;
    this.#left = ms;
    this.#next = next;
  }

  render(): WidgetModel {
    return this.#model;
  }

  tick(dtMs: number, flow: Flow): void {
    this.#left -= dtMs;
    if (this.#left <= 0) this.#next(flow);
  }
}

/**
 * The list (D7): `Switch off!` and the six names, opening on `Switch off!`, no indicator, the
 * circular rows window. ▲/▼ and the power key move on their release (the press that opened the
 * list is not one of them); OK and the digits choose on their key-down (1 Switch off!, 2-7 a
 * profile, 8 and 9 `Invalid shortcut`, 0 after POWER_LIST_ZERO_MS); C returns to standby.
 */
class PowerListWidget implements Widget {
  readonly #services: StockServices;
  readonly #state: PowerListState;
  readonly #list: OptionListWidget;
  readonly #invalid: StockWidgetTimeline;
  #powerDown = false;
  #zeroLeft: number | undefined;

  constructor(services: StockServices, state: PowerListState, invalid: StockWidgetTimeline) {
    this.#services = services;
    this.#state = state;
    this.#invalid = invalid;
    const labels = [
      "Switch off!",
      ...PROFILE_SLUGS.map((slug) => profileName(services.settings, slug)),
    ];
    this.#list = new OptionListWidget({
      labels,
      opening: 0,
      softkey: "OK",
      numbering: "none",
      choose: () => {},
      highlight: (index) => {
        state.selected = index;
      },
    });
    state.selected = 0;
  }

  render(flow: Flow): WidgetModel {
    return this.#list.render(flow);
  }

  onKeyDown(key: PhoneKey, flow: Flow): void {
    if (key === "power") {
      this.#powerDown = true;
      return;
    }
    if (key === "c") {
      flow.replace(this.#returning());
      return;
    }
    if (key === "8" || key === "9") {
      flow.replace(afterDown(key, this.#invalidNote()));
      return;
    }
    if (key === "0") {
      this.#zeroLeft = POWER_LIST_ZERO_MS;
      return;
    }
    const entry = chosenEntry(this.#state, key);
    if (entry === undefined) return;
    if (entry === 0) flow.powerOff?.();
    else flow.replace(afterDown(key, activateLeaf(this.#services, PROFILE_SLUGS[entry - 1]!)()));
  }

  onKey(key: PhoneKey, flow: Flow): void {
    if (key === "up" || key === "down") this.#list.onKey(key, flow);
    else if (key === "power" && this.#powerDown) {
      this.#powerDown = false;
      this.#list.onKey("down", flow);
    }
  }

  tick(dtMs: number, flow: Flow): void {
    if (this.#zeroLeft === undefined) return;
    this.#zeroLeft -= dtMs;
    if (this.#zeroLeft <= 0) {
      this.#zeroLeft = undefined;
      // After the window it is the menus' `Invalid shortcut` (no second partial draw).
      flow.replace(this.#invalidNote(timelineByName("invalid-shortcut")));
    }
  }

  close(): void {
    this.#state.selected = undefined;
  }

  /** C: standby without the operator for POWER_LIST_RETURN_MS, then standby. */
  #returning(): Widget {
    const screen = this.#state.standby;
    if (screen === undefined)
      return new StandbyFrameWidget(BLANK_STANDBY, 0, (flow) => flow.back());
    return new StandbyFrameWidget(
      { kind: "standby-frame", screen, frame: "returning" },
      POWER_LIST_RETURN_MS,
      (flow) => flow.back(),
    );
  }

  #invalidNote(timeline: StockWidgetTimeline = this.#invalid): Widget {
    return note({
      lines: ["Invalid", "shortcut"],
      timeline,
      end: "standby",
      sound: this.#services.noteSound,
    });
  }
}

const BLANK_STANDBY: StandbyFrameModel = {
  kind: "standby-frame",
  screen: { kind: "standby", carrier: "", signal: 4, battery: 4 },
  frame: "returning",
};

/**
 * `Invalid shortcut` as the power list shows it: the note (2886 ms), the edges step toward
 * standby (8 ms), then its first 31 LCD bytes (15 ms), standby (`profiles/power-general-digit-8`;
 * the step durations of the generated `power-invalid-shortcut`, whose frames the extractor split
 * against their neighbours, Task 3).
 */
function powerInvalidTimeline(): StockWidgetTimeline {
  const steps = timelineByName("power-invalid-shortcut").timeline.steps;
  const frames: WidgetFrame[] = [
    { kind: "sprite", sprite: "note/error" },
    { kind: "edges", x0: 5, x1: 78 },
    { kind: "cut", bytes: 31 },
  ] as WidgetFrame[];
  return {
    frames,
    timeline: new Timeline(steps.map((step, i) => ({ frame: i, durationMs: step.durationMs }))),
  };
}

/**
 * phone-core's `standbyPower` (D7): the power key's list as a standby application. It opens on
 * the key-down with standby's ladders erased for POWER_LIST_LEAD_MS (`state.standby`, the model
 * the wrapper saw), then the list.
 */
export function powerList(services: StockServices, state: PowerListState): PhoneApplication {
  const invalid = powerInvalidTimeline();
  return new StockFlowApplication("stock:power-list", () => {
    const list = (): Widget => new PowerListWidget(services, state, invalid);
    const screen = state.standby;
    if (screen === undefined) return list();
    return new StandbyFrameWidget(
      { kind: "standby-frame", screen, frame: "leaving" },
      POWER_LIST_LEAD_MS,
      (flow) => flow.replace(list()),
    );
  });
}

/** Tones' alias target with `active` the active profile (D1): `tones/x` → its Personalise `x`. */
export function profileAlias(key: string, active: ProfileSlug): string {
  return key.startsWith(TONES) ? `profiles/${active}/personalise/${key.slice(TONES.length)}` : key;
}

function scroll(number: string): string {
  return `plan15/factory/scroll/${number}/01.png`;
}

/** The Personalise lists in their order (12-n-2-1…8, 9 Screen saver, 9-3 Timeout). */
const PERSONALISE = [
  ["ringing-tone", "1"],
  ["ringing-volume", "2"],
  ["incoming-call-alert", "3"],
  ["message-alert-tone", "5"],
  ["keypad-tones", "6"],
  ["warning-tones", "7"],
  ["vibrating-alert", "8"],
  ["screen-saver", "9"],
] as const;

/** One profile's factory Personalise values (the README "v6.39 factory values" table). */
function profile(slug: string, n: number, labels: readonly string[]): FactoryDefault[] {
  return [
    ...PERSONALISE.map(
      ([setting, k], i): FactoryDefault => ({
        key: `profiles/${slug}/personalise/${setting}`,
        label: labels[i]!,
        evidence: "v6.39",
        capture: scroll(`12-${n}-2-${k}`),
      }),
    ),
    {
      key: `profiles/${slug}/personalise/screen-saver/timeout`,
      label: "5 seconds",
      evidence: "v6.39",
      capture: scroll(`12-${n}-2-9-3`),
    },
  ];
}

export const profilesFeature: StockFeature = {
  name: "profiles",
  // Every profile's Personalise is General's (plan 14 S6).
  sameAs: { "12-3-2": "12-2-2", "12-4-2": "12-2-2", "12-5-2": "12-2-2", "12-6-2": "12-2-2" },
  placeholders: {
    "12-*-2-9-4": "18c", // Personalise › Screen saver › Screen saver: nothing in the virgin EEPROM
  },
  // Activate (D3).
  screens: Object.fromEntries(
    PROFILE_SLUGS.map((slug) => [
      `${slotNumber(slug)}-1`,
      (services: StockServices) => activateLeaf(services, slug),
    ]),
  ),
  // The Profiles level lists the stored names and opens on the active profile (D8, Task 0 A5).
  levels: {
    "12": ({ settings }) => ({
      label: (slug) => (isProfile(slug) ? profileName(settings, slug) : undefined),
      opening: () => activeProfile(settings),
    }),
  },
  widgets: {
    promptLayouts: {
      // The name being edited is the profile's (Silent: 10 - 6 characters left).
      "12-2-2-10": {
        icons: ["pen", "abc-lower"],
        counter: "4",
        label: ["New name:"],
        value: "Silent",
        entry: "text",
        softkey: "OK",
      },
    },
    // Personalise › Screen saver sets its value like Tones' (`tree/12-profiles/12-1-2-9.sub`
    // image 01: the profile's own path in the entry indicator).
    setterLevels: { "12-*-2-9": ["off", "on"] },
    entryIndicatorLevels: ["12-*-2-9"],
    noteEnds: { "12-*-2-9-1": { levels: 2 }, "12-*-2-9-2": { levels: 2 } },
  },
  settings: {
    // Settings one menu shares with another (plan 14 D9, P11): Tones are the active profile's
    // Personalise settings (D1); the virgin EEPROM's active profile is General. Composer has no
    // Personalise counterpart, so it keeps its own.
    aliases: [
      {
        prefix: TONES,
        target: (choice) => profileAlias(TONES, PROFILE_SLUGS[choice(ACTIVE_PROFILE_KEY) ?? 0]!),
      },
    ],
    choices: [{ key: ACTIVE_PROFILE_KEY, options: PROFILE_SLUGS.length }],
    // Restore gives slot 6 the name (empty), not the virgin boxes (plan 15 Task 0c).
    factoryTexts: [
      {
        key: renameKey("empty-2"),
        text: "(empty)",
        evidence: "v6.39",
        capture: "plan17/persist/after-restore/profiles-6.png",
      },
    ],
    // What Restore factory settings writes (plan 15 D5): v6.39's own factory scrolls after
    // `accept/6-4-restore` (`$REF/captures/6.39/plan15/factory/scroll/`, README "v6.39 factory
    // values"). Tones are the General profile's (the alias above). Every list not named keeps its
    // virgin opening; every other text and number returns to virgin, profile names included
    // (`Silenth` became `Silent`).
    factoryDefaults: [
      ...profile("general", 1, [
        "Nokia tune",
        "Level 4",
        "Ringing",
        "Standard",
        "Level 2",
        "On",
        "On",
        "Off",
      ]),
      ...profile("silent", 2, [
        "Nokia tune",
        "Level 1",
        "Off",
        "No tone",
        "Off",
        "Off",
        "Off",
        "On",
      ]),
      ...profile("discreet", 3, [
        "Nokia tune",
        "Level 1",
        "Beep once",
        "Beep once",
        "Level 1",
        "Off",
        "On",
        "On",
      ]),
      ...profile("loud", 4, [
        "Nokia tune",
        "Level 5",
        "Ringing",
        "Special",
        "Level 3",
        "On",
        "On",
        "On",
      ]),
      ...profile("empty", 5, [
        "Get cool",
        "Level 3",
        "Ringing",
        "Standard",
        "Level 2",
        "On",
        "On",
        "On",
      ]),
      ...profile("empty-2", 6, [
        "Nokia tune",
        "Level 3",
        "Ringing",
        "Standard",
        "Level 2",
        "On",
        "On",
        "Off",
      ]),
    ],
  },
};
