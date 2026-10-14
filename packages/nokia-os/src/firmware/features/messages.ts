// Messages (menu 2; plan 18 implements the editor and SMS): Message settings' and the voice
// mailbox's prompts and virgin values, Info service's setter level and topics, and the leaves
// plans 18 and 18c own (placeholders until then).
import type { PromptLayout } from "../../widgets/prompt";
import type { StockFeature } from "./feature";

const PEN_BOX_END: PromptLayout = { icons: ["pen"], entry: "end" };

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
  widgets: {
    promptLayouts: {
      "2-7-1-1": {
        icons: ["pen"],
        counter: "20",
        label: ["Centre number:"],
        value: "+1234567890",
        entry: "end",
        font: "small",
        softkey: "OK",
      },
      "2-7-2-1": {
        icons: ["pen"],
        counter: "30",
        label: ["Centre number:"],
        entry: "end",
        softkey: "Search",
      },
      "2-9": PEN_BOX_END,
    },
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
      { key: "messages/message-settings/set-1/message-centre-number", text: "+1234567890" },
      // The SIM's voice mailbox (2-9 `Phone number:`).
      { key: "messages/voice-mailbox-number", number: "2-9", line: 1 },
    ],
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
