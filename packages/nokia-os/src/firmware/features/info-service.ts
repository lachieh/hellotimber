// Info service (2-8), plan 18c Task 9: Topics (2-8-4: Select, Add topic while there is room,
// Edit, Erase over the `info-topics` record) and the Service command editor (2-10). Info service's
// setter levels, notes and Languages stay in features/messages.ts (Deviation: no split-owner
// transfer was made).
import {
  addTopic,
  editTopics,
  eraseTopics,
  selectTopics,
  serviceCommandEditor,
  topicsHaveRoom,
  topicsListed,
} from "../../content/info-service";
import { INFO_TOPICS_RECORD } from "../../content/topics";
import type { EepromRecord } from "../eeprom";
import type { StockFeature } from "./feature";

export const infoServiceFeature: StockFeature = {
  name: "info-service",
  screens: {
    "2-8-4-1": (services) => () => selectTopics(services),
    "2-8-4-2": (services) => () => editTopics(services),
    "2-8-4-3": (services) => () => eraseTopics(services),
    "2-10": (services) => () => serviceCommandEditor(services),
  },
  // Add topic follows Select while fewer than five topics (`topics/level-after-erase`).
  leads: {
    "2-8-4": {
      slug: "add-topic",
      label: "Add topic",
      after: "select",
      shown: topicsHaveRoom,
      open: (services) => () => addTopic(services),
    },
  },
  // With no topics only Add topic (`content/restore-topics`); the level opens on Select.
  levels: {
    "2-8-4": (services) => ({
      shown: () => topicsListed(services),
      opening: () => (topicsListed(services) ? "select" : "add-topic"),
    }),
  },
  records: [INFO_TOPICS_RECORD as EepromRecord<unknown>],
};
