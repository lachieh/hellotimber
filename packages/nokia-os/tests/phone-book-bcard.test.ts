// Plan 19 Task 10 (D10): Send b'card through the network port, and the phone book's pickers in
// plan 18's Write messages (`phone-book/bcard-*`, `pick-*` are the replays).
import { describe, expect, it } from "vite-plus/test";
import { PHONE_BOOK_SIMS } from "../scripts/capture-sets/19-phone-book.ts";
import { StockEeprom } from "../src/firmware/eeprom";
import { STOCK_MESSAGE_LINKS } from "../src/firmware/menu";
import { StockMessaging } from "@hellotimber/phone-services/messaging/service";
import { StockMessages } from "@hellotimber/phone-services/messaging/store";
import {
  createMemoryStorage,
  createSyntheticNetwork,
  type StockBusinessCard,
  type StockNetworkPort,
  type StockSendOutcome,
  type StockSimCard,
} from "../src/index";
import { BCARD_LINK_MS } from "../src/phone-book/timings";
import { standbyRig, type Rig } from "./support/rig.ts";

const CONTENT = PHONE_BOOK_SIMS.content as StockSimCard;
const CARD: StockBusinessCard = { to: "0412", card: { name: "Ann", number: "0400" } };

function messaging(network: StockNetworkPort) {
  const store = new StockMessages(new StockEeprom(createMemoryStorage()), "sim-1");
  return new StockMessaging(store, network, { links: STOCK_MESSAGE_LINKS });
}

describe("the network port's business cards (D10)", () => {
  it("records the cards phones send through the synthetic network", () => {
    const network = createSyntheticNetwork();
    expect(network.sendBusinessCard!(CARD)).toBe("sent");
    expect(network.cards).toEqual([CARD]);
  });

  it("settles a card no sooner than the link time; a port without the method: sent", () => {
    const port: StockNetworkPort = { send: () => "sent", subscribe: () => () => {} };
    const service = messaging(port);
    const outcomes: StockSendOutcome[] = [];
    service.sendBusinessCard(CARD, BCARD_LINK_MS, (outcome) => outcomes.push(outcome));
    service.tick(BCARD_LINK_MS - 1);
    expect(outcomes).toEqual([]);
    service.tick(BCARD_LINK_MS);
    expect(outcomes).toEqual(["sent"]);
  });

  it("settles a port's failure or throw as failed", () => {
    const failing = messaging({
      send: () => "sent",
      subscribe: () => () => {},
      sendBusinessCard: () => {
        throw new Error("no cell");
      },
    });
    const outcomes: StockSendOutcome[] = [];
    failing.sendBusinessCard(CARD, BCARD_LINK_MS, (outcome) => outcomes.push(outcome));
    failing.tick(BCARD_LINK_MS);
    expect(outcomes).toEqual(["failed"]);
  });
});

/** Menu, Phone book, Send b'card: the list with Send. */
function sendBcard(rig: Rig): void {
  rig.press("navi");
  rig.advance(1500);
  rig.press("navi");
  rig.advance(1500);
  for (let i = 1; i < 7; i++) rig.press("down");
  rig.press("navi");
  rig.advance(1500);
}

describe("Send b'card (S12)", () => {
  it("sends the highlighted name's card to the typed number", () => {
    const network = createSyntheticNetwork();
    const rig = standbyRig({ sim: CONTENT, network });
    sendBcard(rig);
    rig.press("navi"); // Send on the first name
    rig.advance(500);
    for (const digit of "0412") rig.press(digit as never);
    rig.press("navi");
    rig.advance(BCARD_LINK_MS + 3000);
    expect(network.cards).toEqual([
      { to: "0412", card: { name: "Abcdefghijklmnop", number: "12345678901234567890" } },
    ]);
  });

  it("fills the number from Search's list", () => {
    const network = createSyntheticNetwork();
    const rig = standbyRig({ sim: CONTENT, network });
    sendBcard(rig);
    rig.press("navi");
    rig.advance(500);
    rig.press("navi"); // Search: the list with OK
    rig.advance(500);
    rig.press("down"); // anna
    rig.press("navi"); // OK: Phone number: with anna's number
    rig.advance(500);
    rig.press("navi");
    rig.advance(BCARD_LINK_MS + 3000);
    expect(network.cards.map((card) => card.to)).toEqual(["0400000001"]);
  });
});

describe("Write messages › Send to many with names", () => {
  it("sends the text to the name chosen with Send", () => {
    const network = createSyntheticNetwork();
    const rig = standbyRig({ sim: CONTENT, network });
    rig.press("navi"); // Menu
    rig.advance(1500);
    rig.press("down"); // Messages
    rig.press("navi");
    rig.advance(1500);
    rig.press("navi"); // Write messages
    rig.advance(1500);
    rig.press("4"); // g
    rig.advance(1500);
    rig.press("navi"); // Options
    rig.advance(500);
    rig.press("down"); // Send to many
    rig.press("navi");
    rig.advance(1000);
    rig.press("down"); // anna
    rig.press("navi"); // Send
    rig.advance(6000);
    expect(network.sent).toHaveLength(1);
    expect(network.sent[0]!.number).toBe("0400000001");
  });
});
