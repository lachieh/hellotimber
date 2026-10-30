import { callRig, play } from "./support/calls";
import { createSyntheticNetwork, describeStockScreen } from "../src/index";
import { standbyRig } from "./support/rig";
import { expect, it } from "vite-plus/test";
import { ServiceRequest, type StockServiceControl } from "../src/calls/services";

it("waits for an explicit host outcome and applies it on a tick", () => {
  let control: StockServiceControl | undefined;
  const request = new ServiceRequest("*#21#", (_text, host) => {
    control = host;
  });
  request.tick(3000);
  expect(request.result).toBeUndefined();
  control?.completed({ kind: "active", scope: "all", number: "+123" });
  expect(request.result).toBeUndefined();
  request.tick(1);
  expect(request.result).toEqual({ kind: "active", scope: "all", number: "+123" });
});
it("times out unanswered requests without inventing success", () => {
  const request = new ServiceRequest("04", undefined);
  request.tick(14866);
  expect(request.result).toBeUndefined();
  request.tick(1);
  expect(request.result).toEqual({ kind: "failed" });
});
it("aborts cancellation and ignores late or duplicate host outcomes", () => {
  let control: StockServiceControl | undefined;
  let signal: AbortSignal | undefined;
  const request = new ServiceRequest("04", (_text, host, abort) => {
    control = host;
    signal = abort;
  });
  request.cancel();
  expect(signal?.aborted).toBe(true);
  control?.completed({ kind: "active", scope: "voice", number: "123" });
  request.tick(20000);
  expect(request.result).toBeUndefined();
});
it("turns host exceptions into failures at the next tick", () => {
  const request = new ServiceRequest("04", () => {
    throw Error("offline");
  });
  expect(request.result).toBeUndefined();
  request.tick(1);
  expect(request.result).toEqual({ kind: "failed" });
});

it("keeps the first host completion and ignores a later success", () => {
  let control: StockServiceControl | undefined;
  const request = new ServiceRequest("04", (_text, host) => {
    control = host;
  });
  control?.completed({ kind: "failed" });
  control?.completed({ kind: "active", scope: "voice", number: "123" });
  request.tick(1);
  expect(request.result).toEqual({ kind: "failed" });
});

it("cancels a real phone's pending request on power-off", () => {
  let signal: AbortSignal | undefined;
  let control: StockServiceControl | undefined;
  const rig = standbyRig({
    network: {
      ...createSyntheticNetwork(),
      requestService(_text, host, abort) {
        control = host;
        signal = abort;
      },
    },
  });
  rig.press("0");
  rig.press("4");
  rig.press("navi");
  rig.advance(100);
  expect(describeStockScreen(rig.phone.screen)).toContain("Requesting");
  rig.press("power", 1000);
  expect(signal?.aborted).toBe(true);
  control?.completed({ kind: "active", scope: "voice", number: "123" });
  rig.advance(20000);
  expect(rig.phone.screen.kind).toBe("off");
});

it("shows divert only after the host confirms unconditional forwarding", () => {
  let control: StockServiceControl | undefined;
  const rig = callRig("virgin", false, false, (network) => ({
    ...network,
    requestService(_text, host) {
      control = host;
    },
  }));
  play(rig, "* 2 1 * 0 4 1 2 3 4 5 6 7 8 #");
  rig.press("navi");
  rig.advance(100);
  control?.completed({ kind: "active", scope: "voice", number: "0412345678" });
  rig.advance(1);
  rig.press("c");
  rig.advance(100);
  expect(rig.phone.screen).toMatchObject({ kind: "standby", indicators: { divert: true } });
});

it("clears confirmed divert when the host confirms cancellation", () => {
  const rig = callRig("virgin", false, false, (network) => ({
    ...network,
    requestService(text, host) {
      host.completed(
        text.startsWith("*21*")
          ? { kind: "active", scope: "voice", number: "123" }
          : { kind: "inactive", scope: "voice" },
      );
    },
  }));
  play(rig, "* 2 1 * 1 2 3 # menu +100");
  rig.press("c");
  rig.advance(100);
  expect(rig.phone.screen).toMatchObject({ kind: "standby", indicators: { divert: true } });
  play(rig, "# 2 1 # menu +100");
  rig.press("c");
  rig.advance(100);
  expect(rig.phone.screen).toMatchObject({ kind: "standby" });
  expect(rig.phone.screen.kind === "standby" && rig.phone.screen.indicators?.divert).not.toBe(true);
});

it("passes the chosen no-answer delay and voice qualifier to the host", () => {
  const requests: string[] = [];
  const rig = callRig("virgin", false, false, (network) => ({
    ...network,
    requestService(text) {
      requests.push(text);
    },
  }));
  play(rig, "menu 7 3 +1200 menu menu +1200");
  expect(requests).toEqual(["**61*793000333*11*30#"]);
});
