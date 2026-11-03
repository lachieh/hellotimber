// Call register (menu 4; plan 22 Task 9, docs/specs/stock/calls.md "Call register"): the lists
// 4-1…4-3 and their Options, standby ▲'s dialled list, Erase recent call lists (4-4), Show call
// duration's pages (4-5) and Clear timers behind the security code, and Prepaid credit's page
// results. Call costs and Call divert are plan 22b's.
import { PhoneApplication } from "@hellotimber/phone-core";
import type { CallEntry, CallList } from "../../calls/log";
import { durationText } from "../../calls/log";
import { callDate, callTime } from "../../calls/timestamp";
import { callEntry } from "../../widgets/call-entry";
import { confirmQuery } from "../../kit/ui/widgets/confirm";
import { StockFlowApplication, type Flow, type Widget } from "../../kit/ui/widgets/flow";
import { infoPages } from "../../kit/ui/widgets/info-pages";
import { infoScreen } from "../../kit/ui/widgets/info-screen";
import { note } from "../../kit/ui/widgets/note";
import { numberEntry as phoneNumberEntry } from "../../kit/ui/widgets/number-entry";
import { OptionListWidget } from "../../widgets/option-list";
import { savePhoneNumber } from "./phone-book";
import { smsEditor } from "../../messages/write";
import { nodeTimeline, timelineByName } from "../../kit/ui/timelines";
import { numberEntry, placeCall, telephoneOf } from "./dialling";
import type { StockPage, StockResult } from "../generated/stock-tree";
import type { ScreenBinding, ScreenPlace, StockFeature, StockServices } from "./feature";
import { TIME_FORMAT } from "./clock";
import { securityCodeScreen } from "./security";

/** The register's lists by tree node. */
const LIST_NODES: Readonly<Record<CallList, string>> = {
  missed: "4-1",
  received: "4-2",
  dialled: "4-3",
};

/** An entry's Options (`register/dialled-options`), opening on Call. */
export const CALL_ENTRY_OPTIONS = [
  "Call",
  "Send SMS",
  "Time of call",
  "Edit number",
  "Save",
  "Erase",
] as const;

function logOf(services: StockServices) {
  return telephoneOf(services)?.log;
}

function entriesOf(services: StockServices, list: CallList): readonly CallEntry[] {
  return logOf(services)?.entries(list) ?? [];
}

/** `No numbers` (plan 14's empty register note, its node's own timeline). */
function noNumbers(services: StockServices, list: CallList): Widget {
  const number = LIST_NODES[list];
  const timeline = nodeTimeline(number);
  return note({
    lines: ["No", "numbers"],
    ...(timeline === undefined ? {} : { timeline }),
    sound: services.noteSound,
    handover: true,
  });
}

/** Time of call (`register/time-of-call`): the date and time, Back. */
function timeOfCall(services: StockServices, entry: CallEntry): Widget {
  // Clock › Clock settings › Time format 12-hour: `10:10:00 am` (`register/time-of-call-12h`).
  const twelve = services.settings.choice(TIME_FORMAT.key) === TIME_FORMAT.twelveHour;
  const at = entry.at;
  return infoScreen({
    lines: () => (at === undefined ? [] : [callDate(at), callTime(at, twelve)]),
    softkey: "Back",
    large: true,
  });
}

/** `Erase?` and the number below it (`register/erase` b). */
const ERASE_TOPS = [4, 15] as const;

/** Erase? (`register/erase`): OK erases, `Erased`, then the list; C back to Options. */
function eraseQuery(
  services: StockServices,
  list: CallList,
  index: number,
  entry: CallEntry,
): Widget {
  return confirmQuery({
    lines: ["Erase?", entry.name ?? entry.number],
    tops: ERASE_TOPS,
    softkey: "OK",
    confirm: (flow) => {
      logOf(services)?.erase(list, index);
      flow.replace(
        note({
          lines: ["Erased"],
          timeline: timelineByName("call-erased"),
          sound: services.noteSound,
        }),
      );
    },
  });
}

/** An entry's Options. */
function entryOptions(
  services: StockServices,
  list: CallList,
  index: number,
  entry: CallEntry,
): Widget {
  const actions: Readonly<Record<string, (flow: Flow) => void>> = {
    Call: (flow) => placeCall(services, flow, entry.number, false, "list"),
    // Send SMS: plan 18's editor, the number the Send prompt's (`register/send-sms`).
    "Send SMS": (flow) => flow.replace(smsEditor(services, { number: entry.number })),
    "Time of call": (flow) => flow.replace(timeOfCall(services, entry)),
    // Edit number: plan 18's number prompt; OK opens the standby entry with it.
    "Edit number": (flow) =>
      flow.replace(
        phoneNumberEntry({
          label: ["Phone number:"],
          number: entry.number,
          done: (typed, inner) => inner.replace(numberEntry(services, typed)),
        }),
      ),
    // Save asks for a name for this number (`register/save`: Name:).
    Save: (flow) => flow.replace(savePhoneNumber(services, entry.number)),
    Erase: (flow) => flow.replace(eraseQuery(services, list, index, entry)),
  };
  return new OptionListWidget({
    labels: CALL_ENTRY_OPTIONS,
    opening: 0,
    softkey: "Select",
    numbering: "none",
    choose: (choice, flow) => actions[CALL_ENTRY_OPTIONS[choice]!]!(flow),
  });
}

/** A list's entry view from the menu (Options) or standby ▲ (Call). */
export function callList(
  services: StockServices,
  list: CallList,
  from: "menu" | "standby",
): Widget {
  return callEntry({
    list,
    entries: () => entriesOf(services, list),
    softkey: from === "menu" ? "Options" : "Call",
    ...(from === "standby" ? { standby: { clock: () => services.ports.clock?.() } } : {}),
    act: (index, entry, flow) =>
      from === "menu"
        ? flow.push(entryOptions(services, list, index, entry))
        : placeCall(services, flow, entry.number, false, "list"),
  });
}

/**
 * Opening a list (4-1…4-3): `No numbers`; Missed calls first shows `<n> new numbers` (or `No new
 * numbers`) and marks them read (`register/missed-open`, `-open-read`).
 */
export function openCallList(services: StockServices, list: CallList): Widget {
  if (entriesOf(services, list).length === 0) return noNumbers(services, list);
  const view = () => callList(services, list, "menu");
  if (list !== "missed") return view();
  const log = logOf(services)!;
  const unread = log.unreadMissed();
  log.markMissedRead();
  log.clearNotice();
  const lines =
    unread === 0
      ? ["No new", "numbers"]
      : [String(unread), "new", unread === 1 ? "number" : "numbers"];
  return note({
    lines,
    timeline: timelineByName(unread === 0 ? "no-new-numbers" : "new-numbers"),
    sound: services.noteSound,
    next: view,
  });
}

/** The missed-call notice's `List` (`ring/notice-list`). */
export function missedCallsList(services: StockServices): PhoneApplication {
  return new StockFlowApplication("stock:missed-calls", () => openCallList(services, "missed"));
}

/** Standby ▲ (D3): the dialled numbers with `Call`, or `No last dialled numbers`. */
export function dialledStandbyList(services: StockServices): PhoneApplication {
  return new StockFlowApplication("stock:dialled-numbers", () =>
    entriesOf(services, "dialled").length === 0
      ? note({
          lines: ["No last", "dialled", "numbers"],
          timeline: timelineByName("no-last-dialled-numbers"),
          sound: services.noteSound,
          handover: true,
        })
      : callList(services, "dialled", "standby"),
  );
}

/** Show call duration's Clear timers page result (the code prompt), from the 4-5 spec. */
function clearTimersPage(screen: ScreenPlace["screen"]): StockResult | undefined {
  const pages = (screen as { readonly pages?: readonly StockPage[] }).pages;
  return pages?.[4]?.result;
}

const listScreen =
  (list: CallList): ScreenBinding =>
  (services) =>
  () =>
    openCallList(services, list);

/** Erase recent call lists' options (4-4), in the tree's order. */
const ERASE_LISTS: readonly (CallList | "all")[] = ["all", "missed", "dialled", "received"];

/** Erase recent call lists' option `index`: the lists erased, then plan 14's note. */
function eraseLists(list: CallList | "all", index: number): ScreenBinding {
  return (services, { number, screen, key }) => {
    if (!("lines" in screen)) throw new Error(`${number}: Erase recent call lists without a note.`);
    const lines = screen.lines;
    const timeline = nodeTimeline(number);
    return () => {
      services.settings.choose(key, index);
      logOf(services)?.erase(list);
      return note({
        lines,
        ...(timeline === undefined ? {} : { timeline }),
        sound: services.noteSound,
      });
    };
  };
}

/** Clear timers (4-5-5): the security code, `Timers cleared`, the durations zeroed. */
const clearTimers = securityCodeScreen({
  kind: "note",
  note: { lines: ["Timers", "cleared"], timeline: "timers-cleared" },
  accept: (services) => logOf(services)?.clearDurations(),
});

export const callRegisterFeature: StockFeature = {
  name: "call-register",
  screens: {
    ...Object.fromEntries(ERASE_LISTS.map((list, i) => [`4-4-${i + 1}`, eraseLists(list, i)])),
    "4-5-5": clearTimers,
    "4-1": listScreen("missed"),
    "4-2": listScreen("received"),
    "4-3": listScreen("dialled"),
    // Show call duration's pages read the register's totals.
    "4-5": (services, place) => {
      const pages = [
        { label: "Last call\nduration", value: (s: number[]) => s[0]! },
        { label: "All calls'\nduration", value: (s: number[]) => s[1]! },
        { label: "Received calls'\nduration", value: (s: number[]) => s[2]! },
        { label: "Dialled calls'\nduration", value: (s: number[]) => s[3]! },
      ];
      const seconds = (): number[] => {
        const d = logOf(services)?.durations();
        return d === undefined ? [0, 0, 0, 0] : [d.last, d.all, d.received, d.dialled];
      };
      const clear = clearTimers(services, {
        ...place,
        number: "4-5-5",
        key: `${place.key}/clear-timers`,
        screen: clearTimersPage(place.screen) ?? place.screen,
      });
      return () =>
        infoPages({
          pages: [
            ...pages.map(({ label, value }) => ({
              label,
              softkey: "Back",
              value: () => durationText(value(seconds())),
            })),
            { label: "Clear\ntimers", softkey: "OK" },
          ],
          open: (index) => (index === 4 ? clear() : undefined),
        });
    },
    // Prepaid credit › Credit info display opens an On/Off list on its page value (P15). Whether
    // a choice changes the page is UNVERIFIED (the probe only scrolled it), so OK goes back
    // without storing.
    "4-8-1": ({ settings }, { key }) => {
      const labels = ["On", "Off"];
      return () => {
        const value = settings.text(key);
        const opening = labels.findIndex((label) => label === value);
        return new OptionListWidget({
          labels,
          softkey: "OK",
          opening: opening < 0 ? null : opening,
          choose: (_index, flow) => flow.back(),
        });
      };
    },
    // Prepaid credit › Recharge status: two info pages (P15).
    "4-8-4": () => {
      const pages = [
        { label: "Last recharge:", value: () => "0", softkey: "Back" },
        { label: "Expiry date:", value: () => "0", softkey: "Back" },
      ];
      return () => infoPages({ pages });
    },
  },
};
