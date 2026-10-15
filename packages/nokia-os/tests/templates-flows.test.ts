// Plan 18c Task 5: Templates (2-5), Smileys (2-6) and the editors' insertion through the stock
// phone's keys, on a phone without a T9 dictionary (multi-tap). Pixels are the acceptance
// replays' (tests/acceptance/18c-*); these pin the stored state each flow leaves.
import { describe, expect, it } from "vite-plus/test";
import { StockTextSlots, STOCK_SMILEYS, STOCK_TEMPLATES } from "../src/content/slots";
import { rowText } from "../src/display/widgets/content-list";
import { StockEeprom } from "../src/firmware/eeprom";
import { createMemoryStorage, createSyntheticNetwork, type StockStorage } from "../src/index";
import { keys } from "./support/probes.ts";
import { factoryStorage } from "./support/18c-content.ts";
import { standbyRig, type Rig } from "./support/rig.ts";

const MULTITAP = { t9: {} } as const;

function slots(storage: StockStorage, kind: "templates" | "smileys") {
  return new StockTextSlots(new StockEeprom(storage), kind);
}

/** Menu, ▼ to Messages, Select, ▼ `downs`, Select. */
const messages = (downs: number) =>
  `navi wait:300 down navi wait:500 ${downs > 0 ? `down*${downs}` : ""} wait:300 navi wait:500`;

function screenKind(rig: Rig): string {
  const screen = rig.phone.screen;
  return screen.kind;
}

describe("Templates and Smileys", () => {
  it("open nothing on the virgin EEPROM (no response)", () => {
    const rig = standbyRig(MULTITAP);
    keys(rig, messages(4));
    expect(rig.phone.path).toBe("menu/messages");
    expect(screenKind(rig)).not.toBe("custom");
  });

  it("save an edit, then Erase brings the default back", () => {
    const storage = factoryStorage(createMemoryStorage());
    const rig = standbyRig({ ...MULTITAP, storage });
    // Read slot 1, Options, Edit; type `a`, Options, Save.
    keys(rig, `${messages(4)} navi wait:500 navi wait:500 navi wait:500 2 wait:1500`);
    keys(rig, "navi wait:500 down*2 navi wait:3000");
    expect(slots(storage, "templates").text(0)).toBe(`${STOCK_TEMPLATES[0]}a`);
    // Options › Exit (standby); the list again, Read, Options, Erase.
    keys(rig, "navi wait:500 down*4 navi wait:1000");
    keys(rig, `${messages(4)} navi wait:500 navi wait:500 down navi wait:4000`);
    expect(slots(storage, "templates").text(0)).toBe(STOCK_TEMPLATES[0]);
  });

  it("fill an empty smiley slot", () => {
    const storage = factoryStorage(createMemoryStorage());
    const rig = standbyRig({ ...MULTITAP, storage });
    keys(rig, `${messages(5)} down*5 navi wait:500 navi wait:500 navi wait:500`);
    keys(rig, "6 6 6 wait:1500 5 5 wait:1500 navi wait:500 navi wait:3000");
    expect(slots(storage, "smileys").list()).toEqual([...STOCK_SMILEYS, "Ok", null, null]);
  });

  it("insert a slot's text into Write messages, which sends it", () => {
    const network = createSyntheticNetwork();
    const storage = factoryStorage(createMemoryStorage());
    const rig = standbyRig({ ...MULTITAP, storage, network });
    // Write messages, Options › Template, ▼, Select; Options › Insert smiley, Select; Send.
    keys(rig, `${messages(0)} navi wait:500 down*2 navi wait:500 down navi wait:500`);
    keys(rig, "navi wait:500 down*3 navi wait:500 navi wait:500");
    keys(rig, "navi wait:500 navi wait:500 1 2 navi wait:4000");
    expect(network.sent).toEqual([{ number: "12", text: `${STOCK_TEMPLATES[1]}:-)` }]);
  });
});

describe("a list row", () => {
  it("cuts a text too wide before the `...` mark", () => {
    expect(rowText("Please call ", 10)).toEqual({ text: "Please call ", more: false });
    expect(rowText("I'm at home. Please call", 10)).toEqual({ text: "I'm at home", more: true });
    expect(rowText("I'm at work. Please call", 10)).toEqual({ text: "I'm at work.", more: true });
  });
});
