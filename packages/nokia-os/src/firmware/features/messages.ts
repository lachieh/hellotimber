// Messages (menu 2; plan 18 implements the editor and SMS): the message centre and voice mailbox
// numbers, Message settings' virgin values, Info service's setter level and topics, and the
// leaves plans 18 and 18c own (placeholders until then).
import type { Widget } from "../../widgets/flow";
import { note } from "../../widgets/note";
import { numberEntry } from "../../widgets/number-entry";
import { nodeTimeline, timelineByName } from "../timelines";
import type { ScreenBinding, StockFeature } from "./feature";

/** The SIM's message centre of Set 1 (an emulator artefact, `sms/centre-1` 00). */
const SET_1_CENTRE = "+1234567890";
const SET_2_CENTRE_KEY = "messages/message-settings/set-2/message-centre-number";

/**
 * Before `Centre number saved` the firmware draws the page's soft key alone for 128 ms
 * (`sms/centre-1-ok` and `sms/centre-2-ok` frame 1: 128 and 127 ms).
 */
export const CENTRE_SAVE_SOFTKEY_MS = 128;

/** The page's soft key alone on a blank screen for `ms`, then `next`. */
function softkeyFirst(ms: number, next: () => Widget): Widget {
  let left = ms;
  return {
    render: () => ({ kind: "info-screen", lines: [], softkey: "Select" }),
    tick(dtMs, flow) {
      left -= dtMs;
      if (left <= 0) flow.replace(next());
    },
  };
}

/**
 * Message centre number (2-7-1-1, 2-7-2-1, plan 18 Task 8): number entry on the stored number
 * (`sms/centre-1` 00: Set 1's SIM centre; Set 2 none). OK stores it and shows `Centre number
 * saved`, then the page (`sms/centre-1-ok`); Search on the empty entry is the phone book's
 * (`sms/centre-1-ok-empty`: `No phone numbers`, then the prompt).
 */
const centreNumber: ScreenBinding = ({ settings, noteSound }, { key, number }) => {
  const saved = timelineByName("centre-number-saved");
  const blink = nodeTimeline(number);
  return () =>
    numberEntry({
      label: ["Centre number:"],
      ...(blink === undefined ? {} : { blink }),
      number: settings.text(key) ?? "",
      done(number, flow) {
        settings.setText(key, number);
        flow.replace(
          softkeyFirst(CENTRE_SAVE_SOFTKEY_MS, () =>
            note({ lines: ["Centre", "number", "saved"], timeline: saved, sound: noteSound }),
          ),
        );
      },
    });
};

/**
 * Voice mailbox number (2-9, plan 18 Task 8): number entry on the stored number, without a
 * counter (`sms/voice-mailbox`); OK stores it and shows `Saved`, then the page
 * (`sms/voice-mailbox-ok`). Its limit is the Send prompt's 30 digits (UNVERIFIED: the capture
 * types 19).
 */
const voiceMailbox: ScreenBinding = ({ settings, noteSound }, { key, number }) => {
  const saved = timelineByName("voice-mailbox-saved");
  const blink = nodeTimeline(number);
  return () =>
    numberEntry({
      label: ["Phone number:"],
      ...(blink === undefined ? {} : { blink }),
      counter: false,
      number: settings.text(key) ?? "",
      done(number, flow) {
        settings.setText(key, number);
        flow.replace(note({ lines: ["Saved"], timeline: saved, sound: noteSound }));
      },
    });
};

export const messagesFeature: StockFeature = {
  name: "messages",
  placeholders: {
    "2-1": "18", // Write messages: text editor
    "2-4": "18c", // Picture messages: nothing in the virgin EEPROM
    "2-5": "18c", // Templates
    "2-6": "18c", // Smileys
    "2-8-4-1-**": "18c", // Topics: lists of box-glyph names (virgin EEPROM)
    "2-8-4-2-**": "18c",
    "2-8-4-3-**": "18c",
    "2-10": "18c", // Service command editor
  },
  screens: {
    "2-7-1-1": centreNumber,
    "2-7-2-1": centreNumber,
    "2-9": voiceMailbox,
  },
  widgets: {
    // The lists of Message settings › Set n show only the option's number
    // (`tree/02-messages/2-7-1-3.options`: `6`).
    optionListNumbering: { "2-7-": "option" },
    // Info service On/Off/Topic index: Topic index also sets the page value
    // (`tree/02-messages/2-8-3.leaf` image f: `Topic index`). The level opens on the stored value
    // (Off virgin, `tree/02-messages/2-8.sub`).
    setterLevels: { "2-8": ["on", "off", "topic-index"] },
    // The setters return to their page (`tree/02-messages/2-8-1.leaf` image f).
    noteEnds: { "2-8-1": { levels: 2 }, "2-8-2": { levels: 2 }, "2-8-3": { levels: 2 } },
  },
  settings: {
    virginTexts: [
      // tree/02-messages/2-7-1-1.leaf "c": the SIM's message centre (an emulator artefact). The
      // tree has no lines for this prompt.
      { key: "messages/message-settings/set-1/message-centre-number", text: SET_1_CENTRE },
      // The SIM's voice mailbox (2-9 `Phone number:`).
      { key: "messages/voice-mailbox-number", number: "2-9", line: 1 },
    ],
    // Set 2 has no centre in the virgin SIM (`sms/centre-2` 00: Search).
    typedTexts: [SET_2_CENTRE_KEY],
    // Info service › Languages after Restore (`plan15/factory/scroll/2-8-5`). Info service ›
    // Topics also shrinks to `Add topic` (plan 18c owns the topics).
    factoryDefaults: [
      {
        key: "messages/info-service/language",
        marked: ["All"],
        evidence: "v6.39",
        capture: "plan15/factory/scroll/2-8-5/01.png",
      },
    ],
  },
};
