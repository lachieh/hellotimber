// Dialling (plan 22 D2, D6, D8; docs/specs/stock/calls.md): standby number entry as phone-core's
// standby entry application, what Call does with the characters, the codes `#` answers, and the
// call screens a call shows (incoming ones through phone-core's interruption seam).
import { PhoneApplication, type PhoneKey } from "@hellotimber/phone-core";
import { CalculatorRate } from "../../calculator/rate";
import { dialOutcome, immediateCode } from "../../calls/dial-string";
import { CALLS_RECORD } from "../../calls/log";
import type { StockCall, StockTelephone } from "../../calls/telephone";
import {
  afterDown,
  CALLING,
  CallWidget,
  type CallExit,
  type CallWidgetOptions,
} from "../../widgets/call";
import { dialEntry, type DialEntryWidget, type EntrySoftkey } from "../../widgets/dial-entry";
import { StockFlowApplication, type Flow, type Widget } from "../../widgets/flow";
import { note } from "../../widgets/note";
import { serviceRequest } from "../../widgets/service-request";
import { placeholderWidget } from "../../widgets/placeholder";
import type { EepromRecord, StockEeprom } from "../eeprom";
import { timelineByName } from "../timelines";
import type { StockFeature, StockServices } from "./feature";
import { pickNumber, standbyList } from "../../phone-book/flows";
import { inCallPhoneBook, savePhoneNumber } from "./phone-book";
import { powerListWidget, type PowerListState } from "./profiles";

/** The keys that start standby's number entry (D2: digits, `*`, `#`). */
export const DIAL_KEYS: readonly PhoneKey[] = [
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "*",
  "#",
];

/** Messages › Voice mailbox number (plan 18's setting; virgin: the SIM's `793000333`). */
const VOICE_MAILBOX_KEY = "messages/voice-mailbox-number";

/** The SIM's phone book locations (the emulator SIM: 50; plan 19's SIM port replaces this). */
const SIM_LOCATIONS = 50;

/** `*#06#`: the IMEI page (the virgin EEPROM has none: `?` glyphs, `code/imei-after`). */
const IMEI_LINES = ["Serial No.", "????????????", "??4"] as const;
/** `*#0000#`: the firmware's version page (`code/version-after`). */
const VERSION_LINES = ["V 06.39", "23-12-04", "NHM-5"] as const;

// ---------------------------------------------------------------- the phone's telephone

const telephones = new WeakMap<StockEeprom, StockTelephone>();
const powerStates = new WeakMap<StockEeprom, PowerListState>();
const entries = new WeakMap<StockTelephone, DialEntryWidget>();

/** The phone's telephone, registered by createStockPhone (D5). */
export function registerTelephone(
  eeprom: StockEeprom,
  telephone: StockTelephone,
  power?: PowerListState,
): void {
  telephones.set(eeprom, telephone);
  if (power !== undefined) powerStates.set(eeprom, power);
}

/** Plan 17's power key list over the entry or a call, when the phone registered its state. */
function powerListOf(services: StockServices): (() => Widget) | undefined {
  const state = powerStates.get(services.eeprom);
  return state === undefined ? undefined : () => powerListWidget(services, state);
}

export function telephoneOf(services: Pick<StockServices, "eeprom">): StockTelephone | undefined {
  return telephones.get(services.eeprom);
}

/** The number entry shown now (a ring answered over it keeps its characters), if any. */
export function shownEntry(telephone: StockTelephone): DialEntryWidget | undefined {
  return entries.get(telephone);
}

// ---------------------------------------------------------------- call screens

/** The call widget of `call`, leaving to standby (or below, for an incoming call's own exits). */
export function callScreen(
  services: StockServices,
  telephone: StockTelephone,
  call: StockCall,
  extra: Partial<CallWidgetOptions> = {},
): CallWidget {
  const powerList = powerListOf(services);
  return new CallWidget({
    ...(powerList === undefined ? {} : { powerList }),
    telephone,
    call,
    phoneBook: () => inCallPhoneBook(services),
    pickNumber: (flow, done) => pickNumber(services, flow, done),
    newCall: (number, flow) => {
      telephone.hold(call);
      placeCall(services, flow, number);
    },
    sounder: services.sounder,
    now: () => services.games.now(),
    clock: () => services.ports.clock?.(),
    done: (exit: CallExit, flow: Flow) => (exit === "standby" ? flow.standby() : flow.back()),
    ...extra,
  });
}

/** Places a call from a flow (the entry, a list): its screen replaces the current one. */
export function placeCall(
  services: StockServices,
  flow: Flow,
  number: string,
  emergency = false,
  from: "entry" | "list" = "entry",
): void {
  const telephone = telephoneOf(services);
  if (telephone === undefined) {
    flow.replace(placeholderWidget("Call", "22"));
    return;
  }
  const call = telephone.dial(number, emergency);
  flow.replace(
    callScreen(
      services,
      telephone,
      call,
      from === "list" ? { numberMs: CALLING.listNumberMs } : {},
    ),
  );
}

/**
 * The incoming call's screen as phone-core's interruption (D4): the ringing screen over whatever
 * shows; `below` is what it interrupted.
 */
export function incomingCallApplication(
  services: StockServices,
  telephone: StockTelephone,
  call: StockCall,
  below: CallWidgetOptions["below"],
): PhoneApplication {
  return new StockFlowApplication("stock:call", () =>
    callScreen(services, telephone, call, below === undefined ? {} : { below }),
  );
}

// ---------------------------------------------------------------- number entry

function noteOf(lines: readonly string[], timeline: string, services: StockServices) {
  return note({
    lines,
    timeline: timelineByName(timeline),
    sound: services.noteSound,
    handover: true,
    end: "standby",
  });
}

/** What Call does with the typed characters (S9). */
function call(services: StockServices, text: string, flow: Flow): void {
  const outcome = dialOutcome(text);
  switch (outcome.kind) {
    case "invalid":
      flow.push(
        note({
          lines: ["Invalid", "phone", "number"],
          timeline: timelineByName("invalid-phone-number"),
          sound: services.noteSound,
        }),
      );
      return;
    case "speed-dial":
      const entry = services.phoneBook.speedDial(outcome.key);
      if (entry !== undefined) {
        placeCall(services, flow, entry.number);
        return;
      }
      flow.push(noteOf(["Speed dial", "number", "not saved"], "speed-dial-not-saved", services));
      return;
    case "voice-mailbox":
      placeCall(services, flow, services.settings.text(VOICE_MAILBOX_KEY) ?? "");
      return;
    case "service":
      flow.push(afterDown("navi", serviceRequest(services, text, true)));
      return;
    case "emergency":
      placeCall(services, flow, outcome.number, true);
      return;
    case "call":
      placeCall(services, flow, text);
  }
}

/** Convert: the Calculator's rate (plan 20); the virgin rate 0 divides by zero (`entry/convert`). */
function convert(services: StockServices, text: string, flow: Flow): void {
  const result = new CalculatorRate(services.eeprom).convert(text, "foreign");
  if ("ok" in result) {
    // The conversion's page was not captured (UNVERIFIED): plan 20's.
    flow.push(placeholderWidget("Convert", "20"));
    return;
  }
  flow.push(
    note({
      lines: ["Dividing", "by zero", "not allowed"],
      timeline: timelineByName("calculator-divide-by-zero"),
      sound: services.noteSound,
    }),
  );
}

/** `#` after digits or a code (S8): its note or page, then standby. */
function code(services: StockServices, text: string, flow: Flow): void {
  const found = immediateCode(text);
  if (found === undefined) return;
  if (found.kind === "imei" || found.kind === "version") {
    // Plan 30 D9: the host's IMEI (checked) as `stockImeiLines` splits it, else the virgin `?`s.
    const { imei } = services;
    const imeiLines =
      imei === undefined ? IMEI_LINES : ["Serial No.", imei.slice(0, 10), imei.slice(10)];
    const lines = found.kind === "imei" ? imeiLines : VERSION_LINES;
    const page = note({ lines, end: "standby", handover: true, endOnDown: true });
    flow.push({
      render: (inner) => page.render(inner),
      onKeyDown(key, inner) {
        if (key === "down") inner.replace(standbyList(services));
        else page.onKeyDown?.(key, inner);
      },
      onKey: (key, inner) => page.onKey?.(key, inner),
    });
    return;
  }
  const valid = found.location >= 1 && found.location <= SIM_LOCATIONS;
  flow.push(
    valid
      ? noteOf(["No phone", "numbers"], "recall-no-phone-numbers", services)
      : noteOf(["Invalid", "location"], "invalid-location", services),
  );
}

/** Standby's number entry as a widget (the first key goes down on it next). */
export function numberEntry(services: StockServices, text?: string): Widget {
  const telephone = telephoneOf(services);
  const powerList = powerListOf(services);
  return dialEntry({
    ...(powerList === undefined ? {} : { powerList }),
    sounder: services.sounder,
    clock: () => services.ports.clock?.(),
    ...(text === undefined ? {} : { text }),
    register: (shown) => {
      if (telephone === undefined) return;
      if (shown === undefined) entries.delete(telephone);
      else entries.set(telephone, shown);
    },
    act: (softkey: EntrySoftkey, typed: string, flow: Flow) => {
      if (softkey === "Call") call(services, typed, flow);
      else if (softkey === "Save") flow.push(afterDown("navi", savePhoneNumber(services, typed)));
      else convert(services, typed, flow);
    },
    speedDial: (key, flow) => {
      if (services.settings.choice("settings/call-settings/speed-dialling") !== 0) return;
      const entry = services.phoneBook.speedDial(Number(key));
      if (entry === undefined) return;
      flow.replace({
        render: () => ({
          kind: "call",
          body: { kind: "digits", text: entry.number },
          softkey: "End",
          handset: false,
          ladders: false,
          ...(services.ports.clock === undefined ? {} : { clock: services.ports.clock() }),
        }),
        onKey(released, inner) {
          if (released === key) placeCall(services, inner, entry.number);
        },
      });
    },
    voiceMailbox: (flow) =>
      placeCall(services, flow, services.settings.text(VOICE_MAILBOX_KEY) ?? ""),
    code: (typed, flow) => code(services, typed, flow),
  });
}

/** phone-core's `standbyEntry` (D2): the dial keys open the number entry with themselves. */
export function stockStandbyEntry(services: StockServices): {
  readonly keys: readonly PhoneKey[];
  open(key: PhoneKey): PhoneApplication;
} {
  return {
    keys: DIAL_KEYS,
    open: () => new StockFlowApplication("stock:number-entry", () => numberEntry(services)),
  };
}

export const diallingFeature: StockFeature = {
  name: "dialling",
  records: [CALLS_RECORD as EepromRecord<unknown>],
};
