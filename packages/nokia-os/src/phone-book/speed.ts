// The phone book's Speed dials and Voice tags (plan 19 Task 9) over the inserted SIM's
// `StockPhoneBook`. Every screen and timing is a Task 0 capture's (`phone-book/speed-*`,
// `voice-*`).
import type { PhoneKey } from "@hellotimber/phone-core";
import type { StockServices } from "../firmware/features/feature";
import { timelineByName } from "@hellotimber/nokia-kit/ui/timelines";
import type { WidgetModel } from "@hellotimber/nokia-kit/ui/display/widgets";
import { STOCK_FONTS } from "@hellotimber/nokia-kit/ui/resources";
import { textWidth } from "@hellotimber/phone-screen";
import type { Flow, Widget } from "@hellotimber/nokia-kit/ui/widgets/flow";
import { note } from "@hellotimber/nokia-kit/ui/widgets/note";
import { HeldC } from "@hellotimber/nokia-kit/ui/widgets/held-c";
import { Playback } from "@hellotimber/nokia-kit/ui/widgets/playback";
import { shownName } from "@hellotimber/phone-services/phone-book/entries";
import { emptyNote, nameQueryWidget, names, phoneBookNote } from "./flows";
import { VOICE_ERROR_BEEPS, VOICE_START_BEEP } from "./timings";

/** The first speed dial key (1 dials the voice mailbox, plan 22). */
const FIRST_KEY = 2;
const LAST_KEY = 9;
/** The LCD's width: a name wider than this drops to the small face (UNVERIFIED: none captured). */
const LINE_WIDTH = 84;

/** A screen of rows with a soft key and no indicator (plan 14's rows and rail). */
function rows(
  items: readonly string[],
  softkey: string,
  choose: (index: number, flow: Flow) => void,
): Widget {
  let selected = 0;
  const heldC = new HeldC();
  return {
    render: (): WidgetModel => ({ kind: "service-list", items, selected, windowTop: 0, softkey }),
    ...heldCKeys(heldC),
    onKey(key, flow) {
      if (key === "down") selected = (selected + 1) % items.length;
      else if (key === "up") selected = (selected + items.length - 1) % items.length;
      else if (key === "navi") choose(selected, flow);
      else if (key === "c") heldC.up(flow);
    },
  };
}

/**
 * 1-9 Speed dials (K, S13): `Key n:` and the key's entry (its assignment, else SIM location n;
 * `(empty)`), keys 2-9 up to the SIM's last location, ▲/▼ wrapping. `Assign` (unassigned) → the
 * name list with `Select` → `Speed dial key n saved` → the key with `Options`: View number (the
 * number large, `Back`), Change (the list again), Erase (`Erase?` → `Speed dial key n erased` → the
 * key's fallback). Assign with no names: `No phone numbers`.
 */
export function speedDials(services: StockServices): Widget {
  const book = services.phoneBook;
  const last = Math.min(LAST_KEY, book.used() + book.free());
  const count = Math.max(1, last - FIRST_KEY + 1);
  let key = FIRST_KEY;
  // C goes back as it comes up; held, standby (plan 18's held C: the captures' `hold c` from a
  // key page, its Options and View number).
  const heldC = new HeldC();

  /** Back to the key page (`above` screens over it), under `lines`' note. */
  const toKey = (flow: Flow, above: number, lines: readonly string[], timeline: string) => {
    flow.back(above);
    flow.push(phoneBookNote(services, lines, timeline));
  };
  const pick = (flow: Flow) => {
    flow.push(
      names(services, {
        softkey: "Select",
        choose(entry, inner) {
          book.assign(key, entry.location);
          toKey(inner, 1, ["Speed dial", `key ${key}`, "saved"], "speed-dial-saved");
        },
      }),
    );
  };
  const options = (flow: Flow) => {
    flow.push(
      rows(["View number", "Change", "Erase"], "Select", (index, inner) => {
        const entry = book.speedDial(key);
        if (entry === undefined) return;
        if (index === 0) inner.replace(numberView(entry.number));
        else if (index === 1) {
          inner.back();
          pick(inner);
        } else {
          inner.replace(
            nameQueryWidget({
              query: "Erase?",
              entries: [entry],
              confirm(_entry, query) {
                book.unassign(key);
                query.replace(
                  phoneBookNote(
                    services,
                    ["Speed dial", `key ${key}`, "erased"],
                    "speed-dial-erased",
                  ),
                );
              },
            }),
          );
        }
      }),
    );
  };
  return {
    render(): WidgetModel {
      const entry = book.speedDial(key);
      const text = entry === undefined ? "(empty)" : shownName(entry);
      const small = textWidth(STOCK_FONTS.large, text) > LINE_WIDTH;
      return {
        kind: "prompt",
        icons: ["prompt/phone-book"],
        label: [`Key ${key}:`],
        entry: { kind: "value", text, ...(small ? { font: "small" as const } : {}) },
        cursor: false,
        softkey: book.isAssigned(key) ? "Options" : "Assign",
      };
    },
    ...heldCKeys(heldC),
    onKey(pressed: PhoneKey, flow: Flow) {
      if (pressed === "down") key = FIRST_KEY + ((key - FIRST_KEY + 1) % count);
      else if (pressed === "up") key = FIRST_KEY + ((key - FIRST_KEY + count - 1) % count);
      else if (pressed === "c") heldC.up(flow);
      else if (pressed === "navi" && book.isAssigned(key)) options(flow);
      else if (pressed === "navi" && book.entries().length === 0) {
        flow.push(emptyNote(services));
      } else if (pressed === "navi") pick(flow);
    },
  };
}

/** View number: the number large and right-aligned with `Back` (C too: the key). */
function numberView(number: string): Widget {
  const heldC = new HeldC();
  return {
    render: (): WidgetModel => ({ kind: "phone-book-number", number, softkey: "Back" }),
    ...heldCKeys(heldC),
    onKey(key, flow) {
      if (key === "navi") flow.back();
      else if (key === "c") heldC.up(flow);
    },
  };
}

/** C's down and the long press's timer for a screen that C leaves (held: standby). */
function heldCKeys(heldC: HeldC): Pick<Widget, "onKeyDown" | "tick"> {
  return {
    onKeyDown(key) {
      if (key === "c") heldC.down();
    },
    tick(dtMs, flow) {
      heldC.tick(dtMs, flow);
    },
  };
}

// ------------------------------------------------------------------ Voice tags (1-10)

/** Two small lines at tops 2 and 12 with a soft key (`Press Start, then`, `Please speak now`). */
function voiceScreen(lines: readonly string[], softkey: string, sprite?: string): WidgetModel {
  return {
    kind: "phone-book-query",
    lines,
    tops: [2, 12],
    ...(sprite === undefined ? {} : { sprite }),
    softkey,
  };
}

/**
 * `Please speak now` (its face animating, `Quit`), then — the emulator has no voice DSP —
 * `Voice system error` with its 675 Hz beeps, then the list (D9).
 */
function pleaseSpeak(services: StockServices): Widget {
  const face = new Playback(timelineByName("please-speak"));
  return {
    render() {
      const frame = face.frame;
      if (frame.kind !== "sprite") throw new Error(`Please speak cannot show "${frame.kind}".`);
      return voiceScreen(["Please", "speak now"], "Quit", frame.sprite);
    },
    tick(dtMs, flow) {
      face.advance(dtMs);
      if (!face.ended) return;
      services.sounder.play(VOICE_ERROR_BEEPS);
      flow.replace(
        note({
          lines: ["Voice", "system", "error"],
          timeline: timelineByName("voice-system-error"),
          sound: services.noteSound,
        }),
      );
    },
    onKey(key, flow) {
      if (key === "navi" || key === "c") flow.back();
    },
  };
}

/**
 * 1-10-1 Add voice tag (G): the list with `Add voice tag` → `Press Start, then` / `speak after
 * tone` (`Start`; C: the list) → `Please speak now` (D9). An empty SIM: plan 14's note.
 */
export function addVoiceTag(services: StockServices): Widget {
  if (services.phoneBook.entries().length === 0) return emptyNote(services, "1-10-1");
  return names(services, {
    softkey: "Add voice tag",
    choose(_entry, flow) {
      flow.push({
        render: () => voiceScreen(["Press Start, then", "speak after tone"], "Start"),
        onKeyDown(key) {
          if (key === "navi") services.sounder.keyBeepProgram(VOICE_START_BEEP);
        },
        onKey(key, inner) {
          if (key === "navi") inner.replace(pleaseSpeak(services));
          else if (key === "c") inner.back();
        },
      });
    },
  });
}
