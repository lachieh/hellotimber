// Phone book (menu 1; plan 19): the SIM's names behind standby ▼ and the Phone book's leaves,
// over the inserted SIM's `StockPhoneBook` (`services.phoneBook`). With an empty SIM the leaves
// keep plan 14's notes and first screens (D13).
import type { PhoneKey } from "@hellotimber/phone-core";
import { sendBusinessCard } from "../../phone-book/bcard";
import {
  addName,
  memoryStatus,
  namePrompt,
  saveNew,
  search,
  serviceNumbers,
} from "../../phone-book/flows";
import { assignTone, edit, eraseAll, eraseOneByOne } from "../../phone-book/manage";
import { addVoiceTag, speedDials } from "../../phone-book/speed";
import type { StockFeature, StockServices } from "./feature";
import type { Flow, Widget } from "../../kit/ui/widgets/flow";
import { OptionListWidget, settingOptionList } from "../../widgets/option-list";
import { settingKey } from "../tree";
import { note } from "../../kit/ui/widgets/note";

/** Save a number already entered or selected in the call register: ask only for its name. */
export function savePhoneNumber(services: StockServices, number: string, text = ""): Widget {
  return namePrompt(
    services,
    text,
    (name, flow) => {
      const retry = (inner: Flow) => inner.replace(savePhoneNumber(services, number, name));
      saveNew(services, flow, { name, number }, "Call", retry);
    },
    false,
  );
}

/** The Phone book level opened over a call, sharing the menu's tree and feature screens. */
export function inCallPhoneBook(services: StockServices, number = "1"): Widget {
  const path = services.firmware.treePath(number);
  const node = path[path.length - 1]!;
  const screen = node.opens;
  const key = settingKey(path);
  const bound = phoneBookFeature.screens?.[number]?.(services, {
    number,
    screen,
    key,
    numbering: "option",
  });
  const widget = bound?.();
  if (widget !== undefined) return widget;
  if (screen.kind === "submenu") {
    const children = node.children ?? [];
    const pressed = new Set<PhoneKey>();
    const list = new OptionListWidget({
      labels: children.map((child) => child.label.replace(/\n/g, " ")),
      opening: 0,
      softkey: screen.softkey,
      numbering: "option",
      choose: (index, flow) => flow.push(inCallPhoneBook(services, children[index]!.number)),
    });
    return {
      render: (flow) => list.render(flow),
      onKeyDown(key) {
        pressed.add(key);
        list.onKeyDown(key);
      },
      onKey(key, flow) {
        if (pressed.delete(key)) list.onKey(key, flow);
      },
    };
  }
  if (screen.kind === "option-list") {
    return settingOptionList({
      key,
      labels: screen.options.map((option) => option.label),
      softkey: screen.softkey,
      settings: services.settings,
      numbering: "option",
    });
  }
  if (screen.kind === "timed-note" || screen.kind === "static-note") {
    const timeline = services.firmware.nodeTimeline(number);
    return note({
      lines: screen.lines,
      ...(timeline === undefined ? {} : { timeline }),
      sound: services.noteSound,
    });
  }
  throw new Error(`No phone-book screen for ${number}.`);
}

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
    "1-7": (services) => () => sendBusinessCard(services),
    "1-8-2": (services) => () => memoryStatus(services),
    "1-9": (services) => () => speedDials(services),
    "1-10-1": (services) => () => addVoiceTag(services),
  },
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
