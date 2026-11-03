// The phone book's flows (plan 19 Tasks 7-10) over the inserted SIM's `StockPhoneBook`: the
// standby name list, Search, Service Nos., Add name and Memory status (Task 7). Every screen and
// timing is a Task 0 capture's; the goldens are cited per flow.
import type { StockServices } from "../firmware/features/feature";
import { placeCall } from "../firmware/features/dialling";
import { nodeTimeline, timelineByName } from "../kit/ui/timelines";
import { nameQuery, type PhoneBookQueryModel } from "../kit/ui/display/widgets/name-list";
import type { WidgetModel } from "../kit/ui/display/widgets";
import type { Flow, Widget } from "../kit/ui/widgets/flow";
import { BLANK, interlude } from "../kit/ui/widgets/interlude";
import { infoScreen } from "../kit/ui/widgets/info-screen";
import {
  nameList,
  TYPE_OF_VIEW,
  TYPE_OF_VIEW_KEY,
  type NameListControl,
  type NameListOptions,
  type NameListView,
} from "../widgets/name-list";
import { note } from "../kit/ui/widgets/note";
import { noPhoneNumbers, numberEntry } from "../kit/ui/widgets/number-entry";
import { textInput } from "../kit/ui/widgets/text-input";
import { searchIndex, type PhoneBookEntry } from "../services/phone-book/entries";
import { SIM_NUMBER_DIGITS, simNameLength, simNumberProblem, type StockContact } from "./sim-card";

/**
 * C in the standby list draws standby without its operator line this long before standby
 * (`phone-book/standby-list-c`: 86 ms; `-down-number-c` 85, `-down-list-c` 80).
 */
export const STANDBY_LIST_EXIT_DRAW_MS = 85;

/**
 * Service Nos. opens through a blank LCD (69 ms) and its first row alone (34 ms)
 * (`phone-book/service-open` frames 1, 2).
 */
export const SERVICE_BLANK_MS = 69;
export const SERVICE_FIRST_ROW_MS = 34;

/** Type of view's choice (virgin: Large font, the list's opening 2). */
export function typeOfView(services: StockServices): NameListView {
  return TYPE_OF_VIEW[services.settings.choice(TYPE_OF_VIEW_KEY) ?? 2] ?? "large";
}

/** The list's view for `typeOfView`: Name, number is the page layout with the number. */
function listView(view: NameListView): NameListOptions["view"] {
  return view === "number" ? "page" : view;
}

/** The SIM's names in the view Type of view selects, on `start`, with the flow's soft key. */
export function names(
  services: StockServices,
  options: Omit<NameListOptions, "entries" | "view">,
): Widget & NameListControl {
  return nameList({
    entries: () => services.phoneBook.entries(),
    view: listView(typeOfView(services)),
    ...options,
  });
}

/** The list on `location`, if it is there. */
function indexOf(services: StockServices, location: number): number {
  return Math.max(
    0,
    services.phoneBook.entries().findIndex((entry) => entry.location === location),
  );
}

/** A note by its generated timeline, with its warning tone. */
export function phoneBookNote(
  services: StockServices,
  lines: readonly string[],
  timeline: string,
): Widget {
  return note({ lines, timeline: timelineByName(timeline), sound: services.noteSound });
}

/**
 * Standby ▼ (D5, S1): the list with `Call` (C: standby through its operator-less draw), or with
 * an empty SIM `No phone numbers`, then standby (`phone-book/standby-down-*`).
 */
export function standbyList(services: StockServices): Widget {
  if (services.phoneBook.entries().length === 0) return emptyNote(services);
  return names(services, {
    softkey: "Call",
    choose: (entry, flow) => placeCall(services, flow, entry.number),
    back: (flow) =>
      flow.replace(
        interlude(standbyDraw(services), STANDBY_LIST_EXIT_DRAW_MS, (inner) => inner.back()),
      ),
  });
}

/** Standby's first draw on the way back to it, without the operator (plan 18's `standby-draw`). */
function standbyDraw({ ports }: StockServices): WidgetModel {
  const clock = ports.clock?.();
  return { kind: "standby-draw", ...(clock === undefined ? {} : { clock }) };
}

/**
 * The empty SIM's `No phone numbers` (plan 14's note), as a flow's first screen: with the timeline
 * of tree node `number`'s own recording (plan 14's golden), else plan 18's.
 */
export function emptyNote(services: StockServices, number?: string): Widget {
  const own = number === undefined ? undefined : nodeTimeline(number);
  return note({
    lines: ["No phone", "numbers"],
    timeline: own ?? timelineByName("no-phone-numbers"),
    sound: services.noteSound,
  });
}

/**
 * 1-1 Search (S4): `Name:` (no cursor); OK opens the list on the first name at or after the text
 * (the found name on the top row), `Call`; an empty SIM shows `No phone numbers`, then the level.
 */
export function search(services: StockServices): Widget {
  return textInput({
    label: ["Name:"],
    limit: services.phoneBook.nameLength,
    noCursor: true,
    typedCase: true,
    leaveAtDown: true,
    done(text, flow) {
      const entries = services.phoneBook.entries();
      if (entries.length === 0) {
        flow.replace(emptyNote(services));
        return;
      }
      flow.replace(
        names(services, {
          softkey: "Call",
          start: searchIndex(entries, text),
          choose: (entry, flow) => placeCall(services, flow, entry.number),
        }),
      );
    },
  });
}

/**
 * 1-2 Service Nos. (S6): the SIM's service numbers on plan 14's rows and rail with `Call`, after
 * a blank LCD and the first row alone (`phone-book/service-open`); none: plan 14's note.
 */
export function serviceNumbers(services: StockServices): Widget {
  const contacts = services.phoneBook.serviceNumbers();
  const items = contacts.map((contact) => contact.name);
  if (items.length === 0) return emptyNote(services, "1-2");
  let selected = 0;
  const model = (): WidgetModel => ({
    kind: "service-list",
    items,
    selected,
    windowTop: 0,
    softkey: "Call",
  });
  const list: Widget = {
    render: model,
    onKey(key, flow) {
      if (key === "down") selected = (selected + 1) % items.length;
      else if (key === "up") selected = (selected + items.length - 1) % items.length;
      else if (key === "navi") placeCall(services, flow, contacts[selected]!.number, false, "list");
      else if (key === "c") flow.back();
    },
  };
  const firstRow: WidgetModel = {
    kind: "service-list",
    items: items.slice(0, 1),
    selected: 0,
    windowTop: 0,
    softkey: "Call",
  };
  return interlude(BLANK, SERVICE_BLANK_MS, (flow) =>
    flow.replace(interlude(firstRow, SERVICE_FIRST_ROW_MS, (inner) => inner.replace(list))),
  );
}

/**
 * A query on a name with `OK` (`Replace?`, `Erase?`): OK runs `confirm`, C runs `cancel`;
 * `browse` lets ▲/▼ step through the names (Memory full's `Replace?`, sorted, wrapping).
 */
export function nameQueryWidget(options: {
  readonly query: string;
  readonly entries: readonly PhoneBookEntry[];
  readonly start?: number;
  readonly browse?: boolean;
  readonly confirm: (entry: PhoneBookEntry, flow: Flow) => void;
  readonly cancel?: (flow: Flow) => void;
}): Widget {
  let index = options.start ?? 0;
  const entry = (): PhoneBookEntry => options.entries[index]!;
  return {
    render: (): PhoneBookQueryModel => nameQuery(options.query, shown(entry())),
    onKey(key, flow) {
      const count = options.entries.length;
      if (options.browse && key === "down") index = (index + 1) % count;
      else if (options.browse && key === "up") index = (index + count - 1) % count;
      else if (key === "navi") options.confirm(entry(), flow);
      else if (key === "c") (options.cancel ?? ((inner: Flow) => inner.back()))(flow);
    },
  };
}

/** What a list or query shows for an entry: its name, or its number when it has none. */
function shown(entry: StockContact): string {
  return entry.name === "" ? entry.number : entry.name;
}

/**
 * Saves `contact` (Add name, Edit › Add): a full SIM shows `Memory full` (warning tone), then
 * `Replace?` over the sorted names (OK replaces the one shown, `Saved`; C: `retry`); else `Saved`
 * and the list on the new name. The screens replace the top one, the list keeps `softkey`.
 */
export function saveNew(
  services: StockServices,
  flow: Flow,
  contact: StockContact,
  softkey: string,
  retry: (flow: Flow) => void,
): void {
  const added = services.phoneBook.add(contact);
  if (added !== "full") {
    savedThenList(services, flow, added.location, softkey, "saved");
    return;
  }
  flow.replace(
    nameQueryWidget({
      query: "Replace?",
      entries: services.phoneBook.entries(),
      browse: true,
      confirm(entry, inner) {
        const replaced = services.phoneBook.replace(entry.location, contact);
        savedThenList(services, inner, replaced.location, softkey, "saved");
      },
      cancel: retry,
    }),
  );
  flow.push(phoneBookNote(services, ["Memory", "full"], "memory-full"));
}

/** `Saved` (or `Replaced`), then the list on `location` with `softkey` (C: the level). */
export function savedThenList(
  services: StockServices,
  flow: Flow,
  location: number,
  softkey: string,
  timeline: "saved" | "replaced",
): void {
  flow.replace(
    names(services, {
      softkey,
      start: indexOf(services, location),
      choose: (entry, flow) => placeCall(services, flow, entry.number),
    }),
  );
  flow.push(phoneBookNote(services, [timeline === "saved" ? "Saved" : "Replaced"], timeline));
}

/**
 * The `Phone number:` prompt of Add name and Edit (D7): 20 digits with `OK` even when empty;
 * a number the SIM cannot hold shows `Invalid char. for SIM card` over it (S7).
 */
export function phoneNumberPrompt(
  services: StockServices,
  number: string,
  done: (number: string, flow: Flow) => void,
): Widget {
  return numberEntry({
    label: ["Phone number:"],
    limit: SIM_NUMBER_DIGITS,
    number,
    emptyOk: true,
    done(typed, flow) {
      if (simNumberProblem(typed) !== undefined) {
        flow.push(
          phoneBookNote(services, ["Invalid", "char. for", "SIM card"], "invalid-sim-char"),
        );
      } else done(typed, flow);
    },
  });
}

/** `Name:` of Add name and Edit: the SIM's name length, counted down; wide names drop to small. */
export function namePrompt(
  services: StockServices,
  text: string,
  done: (name: string, flow: Flow) => void,
  typedCase = true,
): Widget {
  // The cursor blinks as Add name's own recording shows it (`tree/01-phone-book/1-3.leaf`).
  const blink = nodeTimeline("1-3");
  return textInput({
    label: ["Name:"],
    limit: services.phoneBook.nameLength,
    counter: true,
    counted: simNameLength,
    smallWhenWide: true,
    typedCase,
    leaveAtDown: true,
    text,
    ...(blink === undefined ? {} : { blink }),
    done,
  });
}

/**
 * 1-3 Add name (S7, S8): `Name:` → `Phone number:` → `Saved` and the list on the new name with
 * `Call`. Both empty: `Nothing to save`, then the level. A name already on the SIM asks
 * `Replace?` on it (OK: `Replaced`; C: `Name:` with the text). C on either empty prompt leaves for
 * the level.
 */
export function addName(services: StockServices, text = ""): Widget {
  return namePrompt(services, text, (name, flow) =>
    flow.replace(
      phoneNumberPrompt(services, "", (number, inner) => {
        const retry = (back: Flow) => back.replace(addName(services, name));
        if (name === "" && number === "") {
          inner.replace(phoneBookNote(services, ["Nothing to", "save"], "nothing-to-save"));
          return;
        }
        const same =
          name === "" ? undefined : services.phoneBook.entries().find((e) => e.name === name);
        if (same !== undefined) {
          inner.replace(
            nameQueryWidget({
              query: "Replace?",
              entries: [same],
              confirm(entry, query) {
                services.phoneBook.replace(entry.location, { name, number });
                savedThenList(services, query, entry.location, "Call", "replaced");
              },
              cancel: retry,
            }),
          );
          return;
        }
        saveNew(services, inner, { name, number }, "Call", retry);
      }),
    ),
  );
}

/** 1-8-2 Memory status (D14): the SIM's free and used locations. */
export function memoryStatus(services: StockServices): Widget {
  return infoScreen({
    lines: () => [
      "SIM card:",
      `${services.phoneBook.free()} free`,
      `${services.phoneBook.used()} in use`,
    ],
    softkey: "Back",
  });
}

/**
 * A number from the phone book (plan 18's number prompts' `Search`, Send b'card's): the name list
 * with `OK`; OK closes it and gives the entry's number to `done` on the prompt below. An empty
 * SIM: plan 18's `No phone numbers` (`text/number-search-empty`).
 */
export function pickNumber(
  services: StockServices,
  flow: Flow,
  done: (number: string, flow: Flow) => void,
): void {
  if (services.phoneBook.entries().length === 0) {
    noPhoneNumbers(flow);
    return;
  }
  flow.push(
    names(services, {
      softkey: "OK",
      choose(entry, inner) {
        inner.back();
        done(entry.number, inner);
      },
    }),
  );
}
