// Plan 18c Task 9: Info service › Topics and the Service command editor through the stock
// phone's keys. Pixels are the acceptance replays' (`topics/*`, `service-command/*`, plan 14's
// `tree/02-messages/2-8-4-*`); these pin the record each flow leaves and the level it shows.
import { describe, expect, it } from "vite-plus/test";
import { SERVICE_REQUEST_MS } from "../src/content/info-service";
import { StockTopics, VIRGIN_TOPICS } from "../src/content/topics";
import { StockEeprom } from "../src/firmware/eeprom";
import { createMemoryStorage, type StockStorage } from "../src/index";
import { factoryStorage } from "./support/18c-content.ts";
import { keys } from "./support/probes.ts";
import { standbyRig, type Rig } from "./support/rig.ts";

const MULTITAP = { t9: {} } as const;
/** Menu 2 8 4 (the shortcut) and its opening delay. */
const TOPICS = "navi wait:300 2 8 4 wait:3000";

function topics(storage: StockStorage) {
  return new StockTopics(new StockEeprom(storage)).list();
}

/** The labels of the level the phone shows, if it shows one. */
function level(rig: Rig): readonly string[] | undefined {
  const screen = rig.phone.screen;
  return screen.kind === "list" ? screen.items : undefined;
}

describe("Info service › Topics (2-8-4)", () => {
  it("lists Select, Edit and Erase over the virgin topics, Add topic once one is erased", () => {
    const storage = createMemoryStorage();
    const rig = standbyRig({ ...MULTITAP, storage });
    keys(rig, TOPICS);
    expect(level(rig)).toEqual(["Select", "Edit", "Erase"]);
    // Erase, OK on the first topic, the note.
    keys(rig, "down*2 navi wait:500 navi wait:4000");
    expect(topics(storage)).toEqual(VIRGIN_TOPICS.slice(1));
    expect(level(rig)).toEqual(["Select", "Add topic", "Edit", "Erase"]);
  });

  it("is Add topic alone after Restore; a topic added is marked", () => {
    const storage = factoryStorage(createMemoryStorage());
    const rig = standbyRig({ ...MULTITAP, storage });
    keys(rig, TOPICS);
    expect(level(rig)).toEqual(["Add topic"]);
    // Add topic, 100, OK, ONE (ABC: 666 66 33), OK, the note.
    keys(rig, "navi wait:500 1 0 0 navi wait:500 6 6 6 wait:1500 6 6 wait:1500 3 3 wait:1500");
    keys(rig, "navi wait:4000");
    expect(topics(storage)).toEqual([{ number: "100", name: "ONE", marked: true }]);
    expect(level(rig)).toEqual(["Select", "Add topic", "Edit", "Erase"]);
  });

  it("edits a topic's number and name, its mark kept", () => {
    const storage = createMemoryStorage();
    const rig = standbyRig({ ...MULTITAP, storage });
    // Edit, OK on topic 1: 12, OK; C×6 clears the name, NEWS, OK.
    keys(rig, `${TOPICS} down navi wait:500 navi wait:500 1 2 navi wait:500 c*6`);
    keys(rig, "6 6 wait:1500 3 3 wait:1500 9 wait:1500 7 7 7 7 wait:1500 navi wait:4000");
    expect(topics(storage)[0]).toEqual({ number: "12", name: "NEWS", marked: true });
  });
});

describe("Service command editor (2-10)", () => {
  it("sends: Requesting, then `Not done` and standby", () => {
    const rig = standbyRig(MULTITAP);
    keys(rig, "navi wait:300 2 wait:2500 down*9 wait:500 navi wait:500 * 1 0 0 # wait:1500");
    keys(rig, "navi");
    keys(rig, `wait:${SERVICE_REQUEST_MS - 1000}`);
    expect(rig.phone.screen.kind).toBe("custom");
    keys(rig, "wait:5000");
    expect(rig.phone.screen.kind).toBe("standby");
  });
});
