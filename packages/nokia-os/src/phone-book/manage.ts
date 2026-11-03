// The phone book's flows that change entries (plan 19 Task 8): Erase (one by one, all), Edit and
// Assign tone, over the inserted SIM's `StockPhoneBook`. Every screen and timing is a Task 0
// capture's (`phone-book/erase-*`, `edit-*`, `tone-*`).
import type { StockServices } from "../firmware/features/feature";
import { timelineByName } from "@hellotimber/nokia-kit/ui/timelines";
import type { WidgetModel } from "@hellotimber/nokia-kit/ui/display/widgets";
import { codeEntry } from "@hellotimber/nokia-kit/system/code-entry";
import type { Flow, Widget } from "@hellotimber/nokia-kit/ui/widgets/flow";
import type { NameListControl } from "../widgets/name-list";
import { nameList } from "../widgets/name-list";
import { note } from "@hellotimber/nokia-kit/ui/widgets/note";
import { OptionListWidget } from "../widgets/option-list";
import { Playback } from "@hellotimber/nokia-kit/ui/widgets/playback";
import type { PhoneBookEntry } from "@hellotimber/phone-services/phone-book/entries";
import {
  emptyNote,
  nameQueryWidget,
  namePrompt,
  names,
  phoneBookNote,
  phoneNumberPrompt,
} from "./flows";
import type { StockContact } from "./sim-card";
import { NO_TONE_PREVIEW } from "./timings";

/**
 * Back from the screens above the flow's list to it (`above` of them, the top one included), on
 * `location`, under `lines`' note (`Saved`).
 */
function backToList(
  services: StockServices,
  flow: Flow,
  list: NameListControl,
  above: number,
  location: number,
  lines: readonly string[],
  timeline: string,
): void {
  flow.back(above);
  list.select(location);
  flow.push(phoneBookNote(services, lines, timeline));
}

// ------------------------------------------------------------------ Erase (1-4)

/**
 * 1-4-1 One by one (E): the list with `Erase` → `Erase?` / the name (C: the list) → `Erased` (the
 * bin) and the list on the next name, the first after the last; the last name: `Memory erased`
 * (the bin), then the Erase level. An empty SIM: plan 14's `No phone numbers`.
 */
export function eraseOneByOne(services: StockServices): Widget {
  if (services.phoneBook.entries().length === 0) return emptyNote(services, "1-4-1");
  return names(services, {
    softkey: "Erase",
    choose(entry, flow, list) {
      flow.push(
        nameQueryWidget({
          query: "Erase?",
          entries: [entry],
          confirm(erased, inner) {
            services.phoneBook.erase(erased.location);
            if (services.phoneBook.entries().length === 0) {
              inner.replace(
                note({
                  lines: ["Memory", "erased"],
                  timeline: timelineByName("last-name-erased"),
                  sound: services.noteSound,
                  end: { levels: 2 },
                }),
              );
              return;
            }
            list.select();
            inner.replace(phoneBookNote(services, ["Erased"], "erased"));
          },
        }),
      );
    },
  });
}

/** `Erasing memory`'s bar (plan 14's hatched bar, stepping once through), then `Memory erased`. */
function erasingMemory(services: StockServices): Widget {
  const bar = new Playback(timelineByName("erasing-memory"));
  return {
    render(): WidgetModel {
      const frame = bar.frame;
      if (frame.kind !== "sprite") throw new Error(`Erasing memory cannot show "${frame.kind}".`);
      return { kind: "progress", text: ["Erasing", "memory"], bar: frame.sprite, softkey: "" };
    },
    tick(dtMs, flow) {
      bar.advance(dtMs);
      if (!bar.ended) return;
      flow.replace(phoneBookNote(services, ["Memory", "erased"], "memory-erased"));
    },
  };
}

/**
 * 1-4-2 Erase all (E): `Are you sure?` (C: the level) → plan 15's `Security code:` (a wrong code:
 * `Code error`, then the prompt) → `Erasing memory` → `Memory erased` → the level. An empty SIM:
 * plan 14's `No phone numbers`.
 */
export function eraseAll(services: StockServices): Widget {
  if (services.phoneBook.entries().length === 0) return emptyNote(services, "1-4-2");
  return areYouSure((flow) =>
    flow.replace(
      codeEntry({
        lines: ["Security", "code:"],
        softkey: "OK",
        security: services.security,
        sound: services.noteSound,
        accepted(inner) {
          services.phoneBook.eraseAll();
          inner.replace(erasingMemory(services));
        },
      }),
    ),
  );
}

/**
 * Erase all's `Are you sure?` (tops 2/12, not plan 14's confirm query's 4/13:
 * `phone-book/erase-all`): OK runs `confirm`, C goes back.
 */
function areYouSure(confirm: (flow: Flow) => void): Widget {
  return {
    render: (): WidgetModel => ({
      kind: "phone-book-query",
      lines: ["Are you", "sure?"],
      tops: [2, 12],
      softkey: "OK",
    }),
    onKey(key, flow) {
      if (key === "navi") confirm(flow);
      else if (key === "c") flow.back();
    },
  };
}

// ------------------------------------------------------------------ Edit (1-5)

/** `Replace` / `Add` (D): rows with `Select` and no stored choice; C runs `cancel`. */
function replaceOrAdd(
  choose: (add: boolean, flow: Flow) => void,
  cancel: (flow: Flow) => void,
): Widget {
  const items = ["Replace", "Add"];
  let selected = 0;
  return {
    render: (): WidgetModel => ({
      kind: "service-list",
      items,
      selected,
      windowTop: 0,
      softkey: "Select",
    }),
    onKey(key, flow) {
      if (key === "down" || key === "up") selected = 1 - selected;
      else if (key === "navi") choose(selected === 1, flow);
      else if (key === "c") cancel(flow);
    },
  };
}

/**
 * 1-5 Edit (D): the list with `Edit` → `Name:` with the name → `Phone number:` with the number.
 * An unchanged name saves at once (`Saved`, the list on it); a changed one asks `Replace` / `Add`
 * (C: `Name:` with the text); Add on a full SIM: `Memory full` → `Replace?` over the names (C:
 * `Name:` with the text). Both emptied: `Nothing to save`, then `Name:` with the old name.
 */
export function edit(services: StockServices): Widget {
  if (services.phoneBook.entries().length === 0) return emptyNote(services, "1-5");
  return names(services, {
    softkey: "Edit",
    choose: (entry, flow, list) => flow.push(editName(services, list, entry, entry.name)),
  });
}

function editName(
  services: StockServices,
  list: NameListControl,
  entry: PhoneBookEntry,
  text: string,
): Widget {
  const book = services.phoneBook;
  const saved = (flow: Flow, location: number) =>
    backToList(services, flow, list, 1, location, ["Saved"], "saved");
  const again = (name: string) => (flow: Flow) =>
    flow.replace(editName(services, list, entry, name));
  return namePrompt(services, text, (name, flow) =>
    flow.replace(
      phoneNumberPrompt(services, entry.number, (number, inner) => {
        const contact: StockContact = { name, number };
        if (name === "" && number === "") {
          inner.replace(editName(services, list, entry, entry.name));
          inner.push(phoneBookNote(services, ["Nothing to", "save"], "nothing-to-save"));
          return;
        }
        if (name === entry.name) {
          saved(inner, book.replace(entry.location, contact).location);
          return;
        }
        inner.replace(
          replaceOrAdd((add, query) => {
            if (!add) {
              saved(query, book.replace(entry.location, contact).location);
              return;
            }
            const added = book.add(contact);
            if (added !== "full") {
              saved(query, added.location);
              return;
            }
            query.replace(
              nameQueryWidget({
                query: "Replace?",
                entries: book.entries(),
                browse: true,
                confirm: (replaced, full) =>
                  saved(full, book.replace(replaced.location, contact).location),
                cancel: again(name),
              }),
            );
            query.push(phoneBookNote(services, ["Memory", "full"], "memory-full"));
          }, again(name)),
        );
      }),
    ),
  );
}

// ------------------------------------------------------------------ Assign tone (1-6)

/** Tones › Ringing tone's entries (5-1: the built-in tones, then the composer's slots). */
function ringingToneLabels(services: StockServices): readonly string[] {
  const opens = services.firmware.treePath("5-1").at(-1)?.opens;
  if (opens?.kind !== "option-list") throw new Error("5-1 is not the ringing tone list.");
  return opens.options.map((option) => option.label);
}

/** The tone list's entries: `No tone`, `Default`, then Tones › Ringing tone's (T). */
function toneLabels(services: StockServices): readonly string[] {
  return ["No tone", "Default", ...ringingToneLabels(services)];
}

/** A stored tone (0 No tone, k ringing tone k, null Default) as its index in the tone list. */
function toneIndex(tone: number | null): number {
  return tone === null ? 1 : tone === 0 ? 0 : tone + 1;
}

/**
 * 1-6 Assign tone (T): a page per name with its tone and `Assign` → the tone list on the name's
 * tone, ▲/▼ previewing the highlighted entry (D12: a tone as Tones › Ringing tone previews it,
 * `Default` the profile's ringing tone, `No tone` its 1750 Hz beep, an `(empty)` slot nothing) →
 * OK stores it and shows `Done`, then the page (C: the page, unchanged).
 */
export function assignTone(services: StockServices): Widget {
  const book = services.phoneBook;
  if (book.entries().length === 0) return emptyNote(services, "1-6");
  const labels = toneLabels(services);
  const { sounder, settings } = services;
  const preview = (index: number) => {
    if (index === 0) sounder.previewProgram(NO_TONE_PREVIEW);
    else if (index > 1) sounder.preview("ringing-tone", index - 2, "tones");
    else {
      const profile = settings.choice("tones/ringing-tone");
      if (profile === null) sounder.stopPreview();
      else sounder.preview("ringing-tone", profile, "tones");
    }
  };
  return nameList({
    entries: () => book.entries(),
    view: "page",
    value: (entry) => labels[toneIndex(book.tone(entry.location))]!,
    softkey: "Assign",
    choose(entry, flow) {
      flow.push(
        new OptionListWidget({
          labels,
          opening: toneIndex(book.tone(entry.location)),
          softkey: "OK",
          highlight: (index) => preview(index),
          close: () => sounder.stopPreview(),
          choose(index, inner) {
            book.setTone(entry.location, index === 1 ? null : index === 0 ? 0 : index - 1);
            inner.replace(phoneBookNote(services, ["Done"], "tone-done"));
          },
        }),
      );
    },
  });
}
