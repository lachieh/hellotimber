// Templates (2-5) and Smileys (2-6), plan 18c Task 5: the lists Restore factory settings provides
// (the virgin EEPROM has none: no response), Read, Edit and Erase, and their records.
import { contentScreen } from "../../content/screens";
import { SMILEYS_RECORD, TEMPLATES_RECORD } from "../../content/slots";
import type { EepromRecord } from "../eeprom";
import type { StockFeature } from "./feature";

export const templatesFeature: StockFeature = {
  name: "templates",
  screens: {
    "2-5": (services) => () => contentScreen(services, "templates"),
    "2-6": (services) => () => contentScreen(services, "smileys"),
  },
  records: [TEMPLATES_RECORD as EepromRecord<unknown>, SMILEYS_RECORD as EepromRecord<unknown>],
};
