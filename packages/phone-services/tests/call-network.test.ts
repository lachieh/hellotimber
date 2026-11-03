// Plan 22 Task 6: the network port's call half (D5) and the synthetic cell.
import { describe, expect, it } from "vite-plus/test";
import { createSyntheticNetwork } from "../src/messaging/network";
import type { StockCallControl } from "../src/calls/network";

function control() {
  const seen: string[] = [];
  const c: StockCallControl = {
    alerting: () => seen.push("alerting"),
    connected: () => seen.push("connected"),
    released: () => seen.push("released"),
  };
  return { c, seen };
}

describe("createSyntheticNetwork's calls", () => {
  it("alerts and connects a dialled call at once and remembers it", () => {
    const net = createSyntheticNetwork();
    const { c, seen } = control();
    net.dial({ number: "0412345678", name: "GitHub", emergency: false }, c);
    expect(seen).toEqual(["alerting", "connected"]);
    expect(net.dialled).toEqual([{ number: "0412345678", name: "GitHub", emergency: false }]);
  });

  it("leaves an emergency call at Attempting", () => {
    const net = createSyntheticNetwork();
    const { c, seen } = control();
    net.dial({ number: "112", emergency: true }, c);
    expect(seen).toEqual([]);
  });

  it("rings every subscribed phone; the far end's hangup releases it once", () => {
    const net = createSyntheticNetwork();
    const { c, seen } = control();
    const links: { answer(): void; hangUp(): void }[] = [];
    const unsubscribe = net.subscribeCalls((call, link) => {
      expect(call).toEqual({ number: "0412345678" });
      links.push(link);
      return c;
    });
    const ring = net.ring("0412345678");
    expect(ring.state).toBe("ringing");
    links[0]!.answer();
    expect(ring.state).toBe("connected");
    links[0]!.answer();
    expect(seen).toEqual(["connected"]);
    ring.hangUp();
    ring.hangUp();
    expect(seen).toEqual(["connected", "released"]);
    expect(ring.state).toBe("ended");
    unsubscribe();
    net.ring("1");
    expect(links).toHaveLength(1);
  });

  it("does not release a call the phone hung up", () => {
    const net = createSyntheticNetwork();
    const { c, seen } = control();
    net.subscribeCalls((_call, link) => {
      link.hangUp();
      return c;
    });
    const ring = net.ring("1");
    ring.hangUp();
    expect(seen).toEqual([]);
  });
});
