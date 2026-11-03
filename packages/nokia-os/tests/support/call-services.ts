import type {
  StockServiceControl,
  StockServiceResult,
} from "@hellotimber/phone-services/calls/services";
import { expectLcd, expectTimeline } from "./golden.ts";
import { goldenImage, loadGolden } from "./goldens.ts";
import { recordTimeline, type Scenario } from "./acceptance.ts";
import { callRig, callRecording, play, type CallScript } from "./calls.ts";
import { createRig, seededStorage } from "./rig.ts";
import { CALL_SCRIPTS } from "./call-scripts.ts";

const IN_CALL_SELECTIONS = [1, 2, 3] as const;

export const IN_CALL_SERVICE_SCENARIOS: Readonly<Record<string, Scenario>> = Object.fromEntries(
  IN_CALL_SELECTIONS.map((selection) => {
    const id = `calls/in-call-options-select-${selection}`;
    return [id, () => callRecording(id, CALL_SCRIPTS[id]!)];
  }),
);

export const SERVICE_SETUPS = {
  "divert-status": "menu 7 1 +1200 down down +300",
  "divert-cancel": "menu 7 1 +1200 down +300",
  "divert-mailbox": "menu 7 1 +1200 menu +1200",
  "divert-other": "menu 7 1 +1200 menu down menu +1200 0 4 1 2 3 4 5 6 7 8",
  "divert-all-cancel": "menu 7 +1200 down down down down",
  "waiting-activate": "menu 6 1 3 +1200",
  "waiting-cancel": "menu 6 1 3 +1200 down",
  "waiting-status": "menu 6 1 3 +1200 down down",
  "string-0": "0 4",
  "string-1": "#",
  "string-2": "* 1 2 3 #",
  "string-3": "* 2 1 * 0 4 1 2 3 4 5 6 7 8 #",
  "string-4": "# # 0 0 2 #",
  "string-5": "* # 2 1 #",
};

type ServiceReply = StockServiceResult;

function cellReplyMs(name: string, mode: "ok" | "error"): number {
  if (/^string-[012]$/.test(name)) return 2630;
  if (mode === "error") {
    if (name === "divert-all-cancel" || name === "string-4" || name === "waiting-status")
      return 2000;
    if (name === "waiting-activate" || name === "string-3") return 2775;
    return name.endsWith("status") || name === "string-5" ? 1800 : 2630;
  }
  if (name === "divert-all-cancel" || name === "string-4") return 2250;
  if (name.endsWith("status") || name === "string-5") return 2050;
  return 2900;
}

function serviceScenario(name: string, setup: string, mode: "none" | "ok" | "error"): Scenario {
  const id = `calls-services/${mode === "none" ? "none" : `verified-${mode}`}-${name}`;
  return () => {
    let host: StockServiceControl | undefined;
    let reply: ServiceReply | undefined;
    const rig = callRig("virgin", false, false, (network) => ({
      ...network,
      requestService(_text, control) {
        host = control;
        if (mode === "none") return;
        if (mode === "error" || /^string-[012]$/.test(name)) reply = { kind: "failed" };
        else if (name.startsWith("waiting"))
          reply = { kind: "waiting", active: name !== "waiting-cancel" };
        else {
          const scope =
            name.endsWith("status") || name === "divert-all-cancel" || /^string-[345]$/.test(name)
              ? "all"
              : "voice";
          reply =
            name.includes("cancel") || name === "string-4"
              ? { kind: "inactive", scope }
              : { kind: "active", scope, number: "+0412345678" };
        }
      },
    }));
    play(rig, setup);
    const golden = loadGolden(id);
    const rows = golden.timeline!;
    const trigger = rows[golden.triggerFrame as number]!;
    const last = rows.at(-1)!;
    const recording = rig.record(
      last.startMs + last.durationMs - trigger.startMs + 100,
      () => rig.press("navi"),
      mode === "none"
        ? []
        : [
            {
              atMs: cellReplyMs(name, mode),
              run: () => {
                if (reply !== undefined) host?.completed(reply);
              },
            },
          ],
    );
    expectTimeline(recording, golden, `${name}: ${mode} host request`);
  };
}

const scripts: Readonly<Record<string, CallScript>> = {
  ...Object.fromEntries(
    ["hold", "new-call", "send-dtmf"].map((name, i) => [
      `in-call-ack-${name}`,
      {
        setup: `0 4 1 2 3 4 5 6 7 8 menu +5000 c +1000 menu +1500 ${"down ".repeat(i + 1)}`,
        keys: "menu +3760 1 +292 2 +292 3 +292 menu +5000",
      },
    ]),
  ),
  ...Object.fromEntries(
    ["pause", "wait"].map((name, i) => [
      `in-call-ack-${name}`,
      {
        setup: `0 4 1 2 3 4 5 6 7 8 ${"* ".repeat(i + 3)} +1700 1 2 3`,
        keys: "menu +15292 menu +6000",
      },
    ]),
  ),
  ...Object.fromEntries(
    ["off", "on"].map((value) => [
      `redial-${value}`,
      {
        moHold: true as const,
        setup: `${value === "on" ? "menu 6 1 1 menu +4000 c@1500 +1000 " : ""}0 4 1 2 3 4 5 6 7 8 menu +5000`,
        keys: "!hangup:17 +90000",
      },
    ]),
  ),
  ...Object.fromEntries(
    [0, 1, 2].map((i) => [
      `identity-persist-identity-${i}`,
      {
        setup: `menu 6 1 4 +1200 ${"down ".repeat(i)}menu +3500 c@1500 +1000`,
        keys: "0 +320 4 +320 1 +320 2 +320 3 +320 4 +320 5 +320 6 +320 7 +320 8 +340 menu +5000",
      },
    ]),
  ),
};

export const CALL_SERVICE_SCENARIOS: Readonly<Record<string, Scenario>> = {
  "calls-services/divert-indicator": () => {
    const rig = callRig("virgin", false, false, (network) => ({
      ...network,
      requestService(_text, host) {
        host.completed({ kind: "active", scope: "voice", number: "0412345678" });
      },
    }));
    play(rig, "* 2 1 * 0 4 1 2 3 4 5 6 7 8 # menu +100");
    rig.press("c");
    rig.advance(100);
    expectLcd(
      rig.paint(),
      goldenImage("calls-services/divert-indicator", "active-standby"),
      "host-confirmed divert standby",
    );
  },
  "calls-services/persist-reboot": () => {
    const rig = createRig({ carrier: "Orange F", clock: () => "10:10", storage: seededStorage() });
    const golden = loadGolden("calls-services/persist-reboot");
    const recording = recordTimeline(rig, golden, () => rig.press("power", 800));
    expectTimeline(recording, golden, "reboot after divert; security gate remains visible");
  },
  ...Object.fromEntries(
    (["none", "ok", "error"] as const).flatMap((mode) =>
      Object.entries(SERVICE_SETUPS).map(([name, setup]) => [
        `calls-services/${mode === "none" ? "none" : `verified-${mode}`}-${name}`,
        serviceScenario(name, setup, mode),
      ]),
    ),
  ),
  ...Object.fromEntries(
    Object.entries(scripts).map(([name, script]) => [
      `calls-services/${name}`,
      () => {
        const rig = callRig(script.state ?? "virgin", script.moHold ?? false, false, (network) => ({
          ...network,
          dial(call, control) {
            const link = network.dial?.(call, control);
            if (link === undefined) throw Error("The capture network must support outgoing calls");
            return { ...link, hold: () => true, retrieve: () => true, sendDtmf: () => true };
          },
        }));
        play(rig, script.setup);
        callRecording(`calls-services/${name}`, script, rig);
      },
    ]),
  ),
};
