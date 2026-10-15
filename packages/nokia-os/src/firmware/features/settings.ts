// Settings (menu 6; plans 15 and 18): the welcome note's stored text and its editor, and Own
// number sending's factory value. Security settings and Restore factory settings are the
// security feature's.
import { editor } from "../../widgets/editor";
import type { Flow, Widget } from "../../widgets/flow";
import { note } from "../../widgets/note";
import { OptionListWidget } from "../../widgets/option-list";
import { nodeTimeline, timelineByName } from "../timelines";
import type { StockFeature, StockServices } from "./feature";

/** The stored welcome note (a typed text; absent = no note). Plan 18's editor writes it. */
export const WELCOME_NOTE_KEY = "settings/phone-settings/welcome-note";

/** The welcome note holds 36 characters (`welcome/editor` 36: the counter at 0, a 37th ignored). */
export const WELCOME_NOTE_LIMIT = 36;

/**
 * Welcome note (6-2-3, plan 18 Task 8): the editor on the stored note (`welcome/editor`
 * reopened), counting down from 36, its text large while two lines fit (`welcome/face`).
 * Options › Save stores the text (`Welcome note saved`); Save on an empty text and Erase remove
 * the note (`Welcome note erased`, `welcome/save-empty`, `welcome/erase-empty`). Either note
 * returns to the page (`welcome/save-hi`).
 */
function welcomeNoteEditor({ settings, noteSound }: StockServices, number: string): () => Widget {
  // The cursor blinks as the node's own recording (`tree/06-settings/6-2-3.leaf`).
  const blink = nodeTimeline(number);
  const saved = timelineByName("welcome-note-saved");
  const erased = timelineByName("welcome-note-erased");
  const store = (flow: Flow, text: string): void => {
    settings.setText(WELCOME_NOTE_KEY, text === "" ? undefined : text);
    flow.replace(
      note({
        lines: ["Welcome", "note", text === "" ? "erased" : "saved"],
        timeline: text === "" ? erased : saved,
        // The note replaces Options; it closes the editor too, back to the page.
        end: { levels: 2 },
        sound: noteSound,
      }),
    );
  };
  return () =>
    editor({
      counter: "count",
      limit: WELCOME_NOTE_LIMIT,
      layout: "welcome",
      softkey: "Options",
      text: settings.text(WELCOME_NOTE_KEY) ?? "",
      ...(blink === undefined ? {} : { blink }),
      options: (flow, entry) =>
        flow.push(
          // `welcome/options`: Save, Erase; the indicator shows the option's number.
          new OptionListWidget({
            labels: ["Save", "Erase"],
            opening: 0,
            softkey: "OK",
            numbering: "option",
            choose: (index, inner) => store(inner, index === 0 ? entry.text : ""),
          }),
        ),
    });
}

export const settingsFeature: StockFeature = {
  name: "settings",
  screens: {
    "6-2-3": (services, { number }) => welcomeNoteEditor(services, number),
  },
  settings: {
    typedTexts: [WELCOME_NOTE_KEY],
    // Restore keeps the welcome note (v6.39 `plan15/accept/c4-*` then `factory/boot` shows `Hi`).
    restoreKeeps: [WELCOME_NOTE_KEY],
    factoryDefaults: [
      {
        key: "settings/call-settings/own-number-sending",
        label: "Set by network",
        evidence: "v6.39",
        capture: "plan15/factory/scroll/6-1-4/01.png",
      },
    ],
  },
};
