// Phone book (menu 1; plan 19): the SIM's names behind standby ▼ and the Phone book's leaves,
// over the inserted SIM's `StockPhoneBook` (`services.phoneBook`). With an empty SIM the leaves
// keep plan 14's notes and first screens (D13).
import { addName, memoryStatus, search, serviceNumbers } from "../../phone-book/flows";
import { assignTone, edit, eraseAll, eraseOneByOne } from "../../phone-book/manage";
import { addVoiceTag, speedDials } from "../../phone-book/speed";
import { PHONE_BOOK_RECORD } from "../../phone-book/store";
import type { EepromRecord } from "../eeprom";
import type { StockFeature } from "./feature";

export const phoneBookFeature: StockFeature = {
  name: "phone-book",
  screens: {
    "1-1": (services) => () => search(services),
    // Plan 14's note while the SIM has no service numbers.
    "1-2": (services) => () => serviceNumbers(services),
    "1-3": (services) => () => addName(services),
    "1-4-1": (services) => () => eraseOneByOne(services),
    "1-4-2": (services) => () => eraseAll(services),
    "1-5": (services) => () => edit(services),
    "1-6": (services) => () => assignTone(services),
    "1-8-2": (services) => () => memoryStatus(services),
    "1-9": (services) => () => speedDials(services),
    "1-10-1": (services) => () => addVoiceTag(services),
  },
  // Plan 19 D3: the SIM's locations by SIM identity, speed dials and assigned tones.
  records: [PHONE_BOOK_RECORD as EepromRecord<unknown>],
  widgets: {
    promptLayouts: {
      "1-1": { icons: ["pen", "abc"], entry: "box" },
      "1-3": {
        icons: ["pen", "abc"],
        counter: "16",
        label: ["Name:"],
        entry: "text",
        softkey: "OK",
      },
    },
  },
};
