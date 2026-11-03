// Templates (2-5) and Smileys (2-6), plan 18c Task 5, as the factory image shows them
// (`content/*`): the list, Read, Options (Edit, Erase), the slot's editor and its Options.
import type { MessagePageModel } from "../kit/ui/display/widgets";
import type { StockServices } from "../firmware/features/feature";
import { timelineByName } from "../kit/ui/timelines";
import { messagePages } from "../messages/read";
import {
  dictionary,
  EXIT_STANDBY_DRAW_MS,
  phoneNumber,
  standbyDraw,
  t9Context,
} from "../messages/write";
import { contentList } from "../kit/ui/widgets/content-list";
import { editor, type EditorControl } from "../kit/ui/widgets/editor";
import type { Flow, Widget } from "../kit/ui/widgets/flow";
import { HeldC } from "../kit/ui/widgets/held-c";
import { interlude } from "../kit/ui/widgets/interlude";
import { note } from "../kit/ui/widgets/note";
import { OptionListWidget } from "../widgets/option-list";
import { EMPTY_SLOT, ROW_ICONS, slotRows } from "./insertion";
import { StockTextSlots, type TextSlotsKind } from "./slots";

/** Each list's look and words (`content/templates-*`, `content/smileys-*`). */
const KINDS: Readonly<
  Record<
    TextSlotsKind,
    {
      /** The noun of its notes (`Template saved`, `Smiley erased`). */
      readonly noun: string;
      /** The editor's Options with text; without text Save is not listed. */
      readonly editOptions: readonly string[];
    }
  >
> = {
  templates: {
    noun: "Template",
    editOptions: ["Send", "Dictionary", "Save", "Erase", "Exit"],
  },
  smileys: { noun: "Smiley", editOptions: ["Save", "Dictionary", "Erase", "Exit"] },
};

/** Read (`content/*-read`): the text in the small face from the top, `Options`. */
function read(
  services: StockServices,
  slots: StockTextSlots,
  index: number,
  prefix: readonly number[],
): Widget {
  const c = new HeldC();
  return {
    render(): MessagePageModel {
      const text = slots.text(index) ?? EMPTY_SLOT;
      const lines = messagePages({ text, read: true })[0] ?? [];
      return { kind: "message-page", lines, softkey: "Options" };
    },
    onKeyDown(key) {
      if (key === "c") c.down();
    },
    onKey(key, flow) {
      if (key === "navi") flow.push(slotOptions(services, slots, index, prefix));
      else if (key === "c") c.up(flow);
    },
    tick(dtMs, flow) {
      c.tick(dtMs, flow);
    },
  };
}

/** Read's Options (`content/*-options-*`): Edit, Erase; indicator `<list>-<slot>-<option>`. */
function slotOptions(
  services: StockServices,
  slots: StockTextSlots,
  index: number,
  prefix: readonly number[],
): Widget {
  const { noun } = KINDS[slots.kind];
  return new OptionListWidget({
    labels: ["Edit", "Erase"],
    opening: 0,
    softkey: "Select",
    indicatorPrefix: [...prefix, index + 1],
    choose(option, flow) {
      if (option === 0) {
        flow.replace(slotEditor(services, slots, index));
        return;
      }
      // No query: the note, then the list on the slot (`content/*-erase-*`).
      slots.erase(index);
      flow.replace(
        note({
          lines: [noun, "erased"],
          timeline: timelineByName(`${noun.toLowerCase()}-erased`),
          end: { levels: 2 },
          sound: services.noteSound,
        }),
      );
    },
  });
}

/** Edit: plan 18's editor on the slot's text, the characters left of its limit (`content/*-edit`). */
function slotEditor(services: StockServices, slots: StockTextSlots, index: number): Widget {
  const text = slots.text(index) ?? "";
  return editor({
    counter: "count",
    limit: slots.limit,
    layout: "sms",
    softkey: "Options",
    text,
    options: (flow, entry) => flow.push(editOptions(services, slots, index, entry)),
    t9: () => t9Context(services),
  });
}

/** The slot editor's Options (`content/*-edit-options-*`): Save only while there is text. */
function editOptions(
  services: StockServices,
  slots: StockTextSlots,
  index: number,
  entry: EditorControl,
): Widget {
  const { noun, editOptions: all } = KINDS[slots.kind];
  const labels = entry.text === "" ? all.filter((label) => label !== "Save") : all;
  const actions: Readonly<Record<string, (flow: Flow) => void>> = {
    // Plan 18's number prompt and send (UNVERIFIED here: not captured from a template).
    Send: (flow) => flow.replace(phoneNumber(services, entry.text, "", 1, false)),
    Dictionary: (flow) => flow.push(dictionary(services)),
    Save: (flow) => {
      slots.save(index, entry.text);
      flow.replace(
        note({
          lines: [noun, "saved"],
          timeline: timelineByName(`${noun.toLowerCase()}-saved`),
          sound: services.noteSound,
        }),
      );
    },
    Erase: (flow) => {
      entry.clear();
      flow.back();
    },
    Exit: (flow) =>
      flow.replace(
        interlude(standbyDraw(services), EXIT_STANDBY_DRAW_MS, (inner) => inner.standby()),
      ),
  };
  return new OptionListWidget({
    labels,
    opening: 0,
    softkey: "OK",
    numbering: "option",
    choose: (option, flow) => actions[labels[option]!]!(flow),
  });
}

/**
 * Templates (2-5) or Smileys (2-6): the list, or nothing on the virgin EEPROM (no response,
 * `content/restore-virgin`).
 */
export function contentScreen(services: StockServices, kind: TextSlotsKind): Widget | undefined {
  const slots = new StockTextSlots(services.eeprom, kind);
  if (!slots.provisioned) return undefined;
  const icon = ROW_ICONS[kind];
  return contentList({
    rows: slotRows(slots),
    ...(icon === undefined ? {} : { icon }),
    opening: 0,
    softkey: "Read",
    choose(index, flow) {
      flow.push(read(services, slots, index, flow.indicator().segments));
    },
  });
}
