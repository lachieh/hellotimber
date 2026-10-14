// Plan 18 Task 9: the host network port (D9), the synthetic network and the phone's messaging
// service (D10): link times on the kernel clock, outcomes from sync and async ports, power-off.
import { describe, expect, it } from "vite-plus/test";
import { StockEeprom } from "../src/firmware/eeprom";
import { StockMessaging } from "../src/messages/service";
import { StockMessages } from "../src/messages/store";
import { RECEIVE_LINK_MS, SEND_LINK_MS } from "../src/resources";
import {
  createMemoryStorage,
  createStockPhone,
  createSyntheticNetwork,
  type StockIncomingSms,
  type StockNetworkPort,
  type StockSendOutcome,
} from "../src/index";
import { standbyRig } from "./support/rig.ts";

const STAMP = { year: 2026, month: 10, day: 13, hour: 10, minute: 11, second: 20 };
const HELLO: StockIncomingSms = { number: "0400000001", text: "Hello", sentAt: STAMP };

function messaging(network: StockNetworkPort = createSyntheticNetwork()) {
  const store = new StockMessages(new StockEeprom(createMemoryStorage()), "sim-1");
  const service = new StockMessaging(store, network, () => "+1234567890");
  return { store, service };
}

/** Ticks `service` every millisecond from `from` to `to`, letting promises settle each tick. */
async function run(service: StockMessaging, from: number, to: number): Promise<void> {
  for (let t = from; t <= to; t++) {
    service.tick(t);
    if (t % 100 === 0) await Promise.resolve();
  }
}

describe("createSyntheticNetwork", () => {
  it("accepts every send and records it; delivers to every subscriber", () => {
    const network = createSyntheticNetwork();
    expect(network.send({ number: "0412345678", text: "Hi" })).toBe("sent");
    expect(network.sent).toEqual([{ number: "0412345678", text: "Hi" }]);
    const got: StockIncomingSms[] = [];
    const other: StockIncomingSms[] = [];
    network.subscribe((sms) => got.push(sms));
    const unsubscribe = network.subscribe((sms) => other.push(sms));
    network.deliver(HELLO);
    unsubscribe();
    network.deliver(HELLO);
    expect(got).toHaveLength(2);
    expect(other).toHaveLength(1);
  });

  it("names the malformed field of a delivery", () => {
    const network = createSyntheticNetwork();
    expect(() => network.deliver({ ...HELLO, number: 5 as never })).toThrow(/number/);
    expect(() => network.deliver({ ...HELLO, text: undefined as never })).toThrow(/text/);
    expect(() => network.deliver({ ...HELLO, sentAt: { ...STAMP, month: 13 } })).toThrow(
      /sentAt\.month/,
    );
    expect(() => network.deliver({ ...HELLO, sentAt: undefined as never })).toThrow(/sentAt/);
  });
});

describe("StockMessaging", () => {
  it("settles a synchronous send after SEND_LINK_MS (D10)", () => {
    const { service } = messaging();
    const outcomes: StockSendOutcome[] = [];
    service.tick(1000);
    service.send({ number: "0412345678", text: "Hi" }, (o) => outcomes.push(o));
    service.tick(1000 + SEND_LINK_MS - 1);
    expect(outcomes).toEqual([]);
    service.tick(1000 + SEND_LINK_MS);
    expect(outcomes).toEqual(["sent"]);
    expect(SEND_LINK_MS).toBe(2662);
  });

  it("settles at the later of the link time and the host's answer; rejections fail", async () => {
    let resolve!: (o: StockSendOutcome) => void;
    let reject!: (e: unknown) => void;
    const answers = [
      new Promise<StockSendOutcome>((r) => (resolve = r)),
      new Promise<StockSendOutcome>((_, r) => (reject = r)),
    ];
    const network: StockNetworkPort = {
      send: () => answers.shift()!,
      subscribe: () => () => {},
    };
    const { service } = messaging(network);
    const outcomes: [string, StockSendOutcome][] = [];
    service.send({ number: "1", text: "late" }, (o) => outcomes.push(["late", o]));
    service.send({ number: "2", text: "rejected" }, (o) => outcomes.push(["rejected", o]));
    reject(new Error("no route"));
    await run(service, 0, SEND_LINK_MS + 500);
    expect(outcomes).toEqual([["rejected", "failed"]]);
    resolve("sent");
    await run(service, SEND_LINK_MS + 501, SEND_LINK_MS + 600);
    expect(outcomes).toEqual([
      ["rejected", "failed"],
      ["late", "sent"],
    ]);
  });

  it("counts a port that throws or answers something else as failed", () => {
    const throwing: StockNetworkPort = {
      send: () => {
        throw new Error("down");
      },
      subscribe: () => () => {},
    };
    const odd: StockNetworkPort = { send: () => "ok" as never, subscribe: () => () => {} };
    for (const network of [throwing, odd]) {
      const { service } = messaging(network);
      const outcomes: StockSendOutcome[] = [];
      service.send({ number: "1", text: "x" }, (o) => outcomes.push(o));
      service.tick(SEND_LINK_MS);
      expect(outcomes).toEqual(["failed"]);
    }
  });

  it("ignores an outcome settled after power-off", async () => {
    let resolve!: (o: StockSendOutcome) => void;
    const network: StockNetworkPort = {
      send: () => new Promise((r) => (resolve = r)),
      subscribe: () => () => {},
    };
    const { service } = messaging(network);
    const outcomes: StockSendOutcome[] = [];
    service.send({ number: "1", text: "x" }, (o) => outcomes.push(o));
    service.poweredOff();
    resolve("sent");
    await run(service, 0, SEND_LINK_MS + 100);
    expect(outcomes).toEqual([]);
    expect(service.sending).toBe(false);
  });

  it("lands an arrival RECEIVE_LINK_MS after delivery, with Set 1's centre (D10)", () => {
    const network = createSyntheticNetwork();
    const { store, service } = messaging(network);
    service.connect();
    service.atStandby();
    const landed: string[] = [];
    service.onArrival((sms, result) => landed.push(`${sms.text}:${result}`));
    service.tick(500);
    network.deliver(HELLO);
    service.tick(500 + RECEIVE_LINK_MS - 1);
    expect(landed).toEqual([]);
    service.tick(500 + RECEIVE_LINK_MS);
    expect(landed).toEqual(["Hello:stored"]);
    expect(store.inbox()[0]).toMatchObject({ text: "Hello", centre: "+1234567890", read: false });
    expect(RECEIVE_LINK_MS).toBe(2324);
  });

  it("holds deliveries while the phone is off until power-on reaches standby", () => {
    const network = createSyntheticNetwork();
    const { store, service } = messaging(network);
    service.connect();
    network.deliver(HELLO);
    service.tick(10_000);
    expect(store.inbox()).toEqual([]);
    service.atStandby();
    service.tick(10_000 + RECEIVE_LINK_MS);
    expect(store.inbox()).toHaveLength(1);
    // A message on its way when the phone goes off waits for the next standby.
    network.deliver({ ...HELLO, text: "second" });
    service.poweredOff();
    service.tick(30_000);
    expect(store.inbox()).toHaveLength(1);
    service.atStandby();
    service.tick(30_000 + RECEIVE_LINK_MS);
    expect(store.inbox().map((m) => m.text)).toEqual(["Hello", "second"]);
  });

  it("refuses a second connection", () => {
    const { service } = messaging();
    service.connect();
    expect(() => service.connect()).toThrow(/already connected/);
  });
});

describe("createStockPhone's network", () => {
  it("subscribes the phone once and stores what arrives at standby", () => {
    const network = createSyntheticNetwork();
    let subscriptions = 0;
    const port: StockNetworkPort = {
      send: (sms) => network.send(sms),
      subscribe(deliver) {
        subscriptions++;
        return network.subscribe(deliver);
      },
    };
    const storage = createMemoryStorage();
    const rig = standbyRig({ storage, network: port });
    expect(subscriptions).toBe(1);
    network.deliver(HELLO);
    rig.advance(RECEIVE_LINK_MS + 10);
    const store = new StockMessages(new StockEeprom(storage), "sim-1");
    expect(store.inbox().map((m) => m.text)).toEqual(["Hello"]);
  });

  it("throws from deliver for a malformed SMS a host port passes on", () => {
    let deliver!: (sms: StockIncomingSms) => void;
    createStockPhone({
      carrier: "Orange F",
      network: { send: () => "sent", subscribe: (d) => ((deliver = d), () => {}) },
    });
    expect(() => deliver({ ...HELLO, sentAt: { ...STAMP, second: 60 } })).toThrow(/sentAt\.second/);
  });
});
