import { describe, expect, it } from "vite-plus/test";
import { StockEeprom } from "../src/firmware/eeprom";
import { STOCK_MESSAGE_LINKS } from "../src/firmware/menu";
import { StockMessaging } from "@hellotimber/phone-services/messaging/service";
import { StockMessages } from "@hellotimber/phone-services/messaging/store";
import { createMemoryStorage, type StockNetworkPort, type StockRingtone } from "../src/index";
import { createSyntheticNetwork } from "../src/index";
import { playComposer, setupKeys } from "./support/composer";
import { seededStorage, standbyRig } from "./support/rig";

describe("Composer transmission", () => {
  it("sends the named tone once over the port and returns to its unsaved editor", () => {
    const network = createSyntheticNetwork();
    const rig = standbyRig({ storage: seededStorage({ factory: true }), network });
    rig.press("c", 1500);
    rig.advance(1000);
    playComposer(rig, setupKeys({ from: "editor", slot: 1 }));
    playComposer(
      rig,
      "1 2 3 menu down down down menu +600 2 +1600 menu +1000 0 4 1 2 3 4 5 6 7 8 menu",
    );
    expect(network.tones).toEqual([
      {
        to: "0412345678",
        tone: {
          name: "A",
          tempo: 112,
          tokens: [
            { kind: "note", value: 4, pitch: "c", octave: 1, sharp: false, dotted: false },
            { kind: "note", value: 4, pitch: "d", octave: 1, sharp: false, dotted: false },
            { kind: "note", value: 4, pitch: "e", octave: 1, sharp: false, dotted: false },
          ],
        },
      },
    ]);
    rig.advance(5000);
    expect(network.tones).toHaveLength(1);
    expect(rig.phone.screen.kind).toBe("custom");
  });
});

const TONE: StockRingtone = {
  to: "0412345678",
  tone: { name: "A", tempo: 112, tokens: [{ kind: "rest", value: 4 }] },
};

function service(network: StockNetworkPort): StockMessaging {
  return new StockMessaging(
    new StockMessages(new StockEeprom(createMemoryStorage()), "sim-1"),
    network,
    { links: STOCK_MESSAGE_LINKS },
  );
}

it("keeps old ports working and waits for the captured link time", () => {
  const network: StockNetworkPort = { send: () => "sent", subscribe: () => () => {} };
  const phone = service(network);
  const outcomes: string[] = [];
  phone.sendRingtone(TONE, (outcome) => outcomes.push(outcome));
  phone.tick(3173);
  expect(outcomes).toEqual([]);
  phone.tick(3174);
  phone.tick(9000);
  expect(outcomes).toEqual(["sent"]);
});

it.each(["throw", "reject"] as const)("settles a port %s as failed", async (mode) => {
  const network = createSyntheticNetwork();
  network.sendRingtone = () => {
    if (mode === "throw") throw new Error("offline");
    return Promise.reject(new Error("offline"));
  };
  const phone = service(network);
  const outcomes: string[] = [];
  phone.sendRingtone(TONE, (outcome) => outcomes.push(outcome));
  await Promise.resolve();
  phone.tick(3174);
  expect(outcomes).toEqual(["failed"]);
});

it("ignores a late port outcome after power-off", async () => {
  let finish: ((outcome: "sent") => void) | undefined;
  const network = createSyntheticNetwork();
  network.sendRingtone = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  const phone = service(network);
  const outcomes: string[] = [];
  phone.sendRingtone(TONE, (outcome) => outcomes.push(outcome));
  phone.poweredOff();
  finish?.("sent");
  await Promise.resolve();
  phone.tick(10000);
  expect(outcomes).toEqual([]);
});

it("snapshots the draft at transmission", () => {
  const network = createSyntheticNetwork();
  const phone = service(network);
  const tokens = [{ kind: "rest", value: 4 } as const];
  phone.sendRingtone({ ...TONE, tone: { ...TONE.tone, tokens } }, () => {});
  tokens.length = 0;
  expect(network.tones).toEqual([TONE]);
});
