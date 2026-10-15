// Plan 18c Task 8: Chat over the network port, through the stock phone's keys (multi-tap: a
// phone without a T9 dictionary). Pixels are the acceptance replays' (`chat/*`); these pin what
// goes on the air, what Inbox keeps and what the chat keeps.
import { describe, expect, it } from "vite-plus/test";
import { PHONE_BOOK_SIMS } from "../scripts/capture-sets/19-phone-book.ts";
import { StockEeprom } from "../src/firmware/eeprom";
import { StockMessages } from "../src/messages/store";
import {
  createMemoryStorage,
  createSyntheticNetwork,
  type StockSimCard,
  type StockStorage,
  type StockTimestamp,
} from "../src/index";
import { keys } from "./support/probes.ts";
import { standbyRig } from "./support/rig.ts";

const MULTITAP = { t9: {} } as const;
const PARTNER = "0400000002";
const AT: StockTimestamp = { year: 2026, month: 10, day: 13, hour: 10, minute: 11, second: 0 };

/** Menu, ▼▼ (Chat), Select, the number, OK, the name (multi-tap keys), OK. */
const open = (name: string) =>
  `navi wait:300 down*2 wait:1000 navi wait:500 ${PARTNER.split("").join(" ")} navi wait:500 ${name} wait:1500 navi wait:500`;
/** Hi, Options, Send, its link time and notes. */
const SEND_HI = "4 4 wait:1500 4 4 4 wait:1500 navi wait:500 navi wait:6000";

function inbox(storage: StockStorage) {
  return new StockMessages(new StockEeprom(storage), "sim-1").inbox();
}

function chat(name = "2 2 6 6 6") {
  const network = createSyntheticNetwork();
  const storage = createMemoryStorage();
  const rig = standbyRig({ ...MULTITAP, storage, network });
  keys(rig, open(name));
  return { network, storage, rig };
}

describe("Chat (menu 3)", () => {
  it("sends `<name>: <text>` to the number (`chat/send`)", () => {
    const { network, rig } = chat();
    keys(rig, SEND_HI);
    expect(network.sent).toEqual([{ number: PARTNER, text: "Bo: Hi" }]);
  });

  it("sends `: <text>` with no name (`chat/send-no-name`)", () => {
    const { network, rig } = chat("");
    keys(rig, SEND_HI);
    expect(network.sent).toEqual([{ number: PARTNER, text: ": Hi" }]);
  });

  it("keeps the partner's lines out of Inbox, and another number's in it", () => {
    const { network, storage, rig } = chat();
    keys(rig, SEND_HI);
    network.deliver({ number: PARTNER, text: "Hey back", sentAt: AT });
    network.deliver({ number: "0400000009", text: "Not the partner", sentAt: AT });
    keys(rig, "wait:3000");
    expect(inbox(storage).map((m) => m.text)).toEqual(["Not the partner"]);
  });

  it("keeps the line it sends when the partner answers before `Message sent`", async () => {
    // A host that settles its send late and answers at once: the answer lands while `Sending
    // message` shows. Once sent, the history is as if it had answered later: `>Hey back` on top
    // of `<Bo: Hi` (the order of the firmware's history; this race is UNVERIFIED).
    const later = chat();
    keys(later.rig, SEND_HI);
    later.network.deliver({ number: PARTNER, text: "Hey back", sentAt: AT });
    keys(later.rig, "wait:6000");

    const synthetic = createSyntheticNetwork();
    let settle: (outcome: "sent") => void = () => {};
    const network = {
      ...synthetic,
      send: (sms: { number: string; text: string }) => {
        void synthetic.send(sms);
        return new Promise<"sent">((resolve) => (settle = resolve));
      },
    };
    const early = standbyRig({ ...MULTITAP, storage: createMemoryStorage(), network });
    keys(early, open("2 2 6 6 6"));
    keys(early, SEND_HI.replace("navi wait:6000", "navi wait:100"));
    synthetic.deliver({ number: PARTNER, text: "Hey back", sentAt: AT });
    keys(early, "wait:4000");
    settle("sent");
    await Promise.resolve();
    keys(early, "wait:6000");
    expect(synthetic.sent).toEqual([{ number: PARTNER, text: "Bo: Hi" }]);
    expect(Array.from(early.paint().pixels)).toEqual(Array.from(later.rig.paint().pixels));
  });

  it("lets the partner's SMS reach Inbox once the chat has ended", () => {
    const { network, storage, rig } = chat();
    // Options, ▲ (Exit), OK: Chat on the carousel; then standby.
    keys(rig, "navi wait:500 up navi wait:1500 c wait:1000");
    network.deliver({ number: PARTNER, text: "Too late", sentAt: AT });
    keys(rig, "wait:3000");
    expect(inbox(storage).map((m) => m.text)).toEqual(["Too late"]);
  });

  it("offers the last chat's name to the next one", () => {
    const { network, rig } = chat();
    keys(rig, "navi wait:500 up navi wait:1500 c wait:1000");
    // The next chat: the name prompt keeps Bo; OK, Hi, Send.
    keys(rig, open(""));
    keys(rig, SEND_HI);
    expect(network.sent).toEqual([{ number: PARTNER, text: "Bo: Hi" }]);
  });
});

describe("Chat's Search (plan 19's phone book)", () => {
  it("chats with the number of the name Search picks", () => {
    const network = createSyntheticNetwork();
    const sim = PHONE_BOOK_SIMS.content as StockSimCard;
    const rig = standbyRig({ ...MULTITAP, sim, network });
    // Chat, Search on the empty number: the list with OK, ▼ (anna), OK, OK, no name, OK.
    keys(rig, "navi wait:300 down*2 wait:1000 navi wait:500 navi wait:500 down navi wait:500");
    keys(rig, "navi wait:500 wait:1500 navi wait:500");
    keys(rig, SEND_HI);
    expect(network.sent).toEqual([{ number: "0400000001", text: ": Hi" }]);
  });
});
