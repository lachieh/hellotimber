// Plan 22 Task 8: the telephone's contract with the host (D5, D10) through a stock phone: what
// `dial` receives when Calling shows, a host that refuses the call, and rings.
import type { PhoneKey } from "@hellotimber/phone-core";
import { describe, expect, it } from "vite-plus/test";
import type {
  StockCallControl,
  StockCallLink,
  StockOutgoingCall,
} from "../src/services/calls/network";
import { describeStockScreen } from "../src/index";
import { CALL_TIMINGS } from "../src/services/calls/telephone";
import { createSyntheticNetwork } from "../src/services/messaging/network";
import { standbyRig, type Rig } from "./support/rig.ts";

function typeNumber(rig: Rig, keys: string): void {
  for (const key of keys) {
    rig.press(key as PhoneKey, 40);
    rig.advance(300);
  }
}

/** A network whose `dial` the test answers. */
function hostNetwork(answer: (call: StockOutgoingCall, phone: StockCallControl) => void) {
  const base = createSyntheticNetwork();
  const dialled: { call: StockOutgoingCall; at: number }[] = [];
  const links: StockCallLink[] = [];
  let rig: Rig | undefined;
  const network = {
    ...base,
    dial(call: StockOutgoingCall, phone: StockCallControl): StockCallLink {
      dialled.push({ call, at: rig?.now ?? -1 });
      answer(call, phone);
      const link = { answer() {}, hangUp: () => void links.push(link) };
      return link;
    },
  };
  return {
    network,
    dialled,
    hungUp: links,
    attach: (r: Rig) => {
      rig = r;
    },
  };
}

describe("dialling through the host (D5)", () => {
  it("hands the host the number when Calling shows", () => {
    const host = hostNetwork(() => {});
    const rig = standbyRig({ network: host.network });
    host.attach(rig);
    typeNumber(rig, "0412345678");
    rig.press("navi");
    expect(host.dialled.map((d) => d.call)).toEqual([
      { number: "0412345678", emergency: false, ownNumberSending: "show" },
    ]);
    expect(host.dialled[0]!.at).toBe(rig.now);
  });

  it("cuts the number at p and w, and flags 112 as an emergency call", () => {
    const host = hostNetwork(() => {});
    const rig = standbyRig({ network: host.network });
    typeNumber(rig, "112");
    rig.press("navi");
    rig.advance(5000);
    rig.press("navi");
    rig.advance(5000);
    expect(host.dialled[0]!.call).toEqual({ number: "112", emergency: true });
  });

  it("ends a call the host refuses before it alerts with the network's end, then standby", () => {
    const host = hostNetwork((_call, phone) => phone.released(1));
    const rig = standbyRig({ network: host.network });
    typeNumber(rig, "0412345678");
    rig.press("navi");
    rig.advance(500);
    expect(rig.phone.screen).toMatchObject({ kind: "custom", appId: "stock:number-entry" });
    rig.advance(CALL_TIMINGS.netEndMs + 1000);
    expect(rig.phone.screen.kind).toBe("standby");
  });

  it("tells the host when the user ends the call", () => {
    const host = hostNetwork((_call, phone) => {
      phone.alerting();
      phone.connected();
    });
    const rig = standbyRig({ network: host.network });
    typeNumber(rig, "0412345678");
    rig.press("navi");
    rig.advance(4000);
    rig.press("navi");
    rig.advance(2000);
    expect(host.hungUp).toHaveLength(1);
    expect(rig.phone.screen.kind).toBe("standby");
  });
});

describe("rings (D4)", () => {
  it("shows the ringing screen after the link time and lists a missed call", () => {
    const network = createSyntheticNetwork();
    const rig = standbyRig({ network });
    const ring = network.ring("0412345678");
    rig.advance(CALL_TIMINGS.ringMs - 10);
    expect(rig.phone.screen.kind).toBe("standby");
    rig.advance(20);
    expect(rig.phone.screen).toMatchObject({ kind: "custom", appId: "stock:call" });
    ring.hangUp();
    rig.advance(3000);
    expect(rig.phone.screen).toMatchObject({ kind: "standby", notice: { softkey: "List" } });
  });

  it("answers with Navi and the host hears it", () => {
    const network = createSyntheticNetwork();
    const rig = standbyRig({ network });
    const ring = network.ring("0412345678");
    rig.advance(CALL_TIMINGS.ringMs + 100);
    rig.press("navi");
    expect(ring.state).toBe("connected");
  });
});

it("does not invent outgoing progress when a supplied host has no dial operation", () => {
  const rig = standbyRig({ network: { send: () => "sent", subscribe: () => () => {} } });
  typeNumber(rig, "0299999837");
  rig.press("navi");
  rig.advance(10000);
  expect(rig.phone.screen.kind).toBe("custom");
  expect(describeStockScreen(rig.phone.screen)).toContain("Calling");
});
