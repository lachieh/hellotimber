// Plan 30 Task 7: SIM services' sessions (D3, D6). The captured screens (Menu 14, the level, text
// pages, lists, Wait) are the acceptance replays' (tests/acceptance/30-sim-content.test.ts); this
// file pins what no capture shows: the composed call confirm and D6's rule that a confirmed call
// is dialled inside the confirming key's `send()`, plus the session's bookkeeping.
import { describe, expect, it } from "vite-plus/test";
import type { ScreenModel } from "@hellotimber/phone-core";
import { SIM_CONTENT_TOOLKITS } from "../scripts/capture-sets/30-sim-content.ts";
import { ALLOW_CALL, callConfirmLines, type StockSimToolkit } from "../src/sim/toolkit";
import { fetchMs, toolkitSession, type ToolkitDial } from "../src/sim/session";
import { StockFlowApplication } from "../src/widgets/flow";
import { flowRig } from "./support/flow-rig.ts";
import { standbyRig } from "./support/rig.ts";
import { createSyntheticNetwork, describeStockScreen, type StockOutgoingCall } from "../src/index";

const MAIN = SIM_CONTENT_TOOLKITS.main as StockSimToolkit;
const item = (id: string) => MAIN.items.find((i) => i.id === id)!;

/** The widget model the flow paints now (its custom frame's model). */
function shown(rig: ReturnType<typeof flowRig>): ScreenModel {
  return rig.session.render();
}

describe("the composed call confirm (D4, D6: SET UP CALL never completes in the emulator)", () => {
  it("asks with the step's alpha identifier, or Allow SIM card to call?", () => {
    expect(callConfirmLines("Call Lachlan?")).toEqual(["Call Lachlan?"]);
    expect(callConfirmLines(undefined)).toEqual(["Allow SIM card", "to call?"]);
    expect(ALLOW_CALL).toBe("Allow SIM card to call?");
  });

  it("dials the step's number on OK, inside the confirming key's send() (D6)", () => {
    const dialled: { number: string; during: string }[] = [];
    let during = "outside";
    const dial: ToolkitDial = (number, flow) => {
      dialled.push({ number, during });
      flow.back();
    };
    const rig = flowRig(() => toolkitSession(item("call-alpha"), { dial }));
    rig.advance(fetchMs(item("call-alpha").steps[0]!) + 1);
    expect(dialled).toEqual([]);
    during = "send";
    rig.session.onKey({ type: "down", key: "navi" });
    rig.session.onKey({ type: "up", key: "navi" });
    during = "after";
    expect(dialled).toEqual([{ number: "0412345678", during: "send" }]);
  });

  it("answers C with Wait, then back, without dialling", () => {
    const dialled: string[] = [];
    const rig = flowRig(() =>
      toolkitSession(item("call-plain"), { dial: (number) => void dialled.push(number) }),
    );
    rig.advance(100);
    rig.press("c");
    rig.advance(100);
    expect(dialled).toEqual([]);
    expect(rig.exits).toHaveLength(1);
  });

  it("reaches the call after the text before it (Text then call)", () => {
    const dialled: string[] = [];
    const rig = flowRig(() =>
      toolkitSession(item("text-call"), { dial: (number) => void dialled.push(number) }),
    );
    rig.advance(100);
    rig.press("navi");
    rig.press("navi");
    expect(dialled).toEqual(["0298765432"]);
  });

  it("hands a confirmed toolkit link to the network inside send(), then uses the call flow", () => {
    const dialled: { call: StockOutgoingCall; duringSend: boolean }[] = [];
    let duringSend = false;
    const rig = standbyRig({
      sim: { id: "toolkit-call", toolkit: MAIN },
      network: {
        ...createSyntheticNetwork(),
        dial(call, control) {
          dialled.push({ call, duringSend });
          control.released();
          return { answer() {}, hangUp() {} };
        },
      },
    });
    rig.phone.navigate("menu/sim-services/call-alpha");
    rig.advance(200);
    expect(describeStockScreen(rig.phone.screen)).toContain("Call Lachlan?");
    expect(dialled).toEqual([]);
    duringSend = true;
    rig.phone.send({ type: "down", key: "navi" });
    rig.phone.send({ type: "up", key: "navi" });
    duringSend = false;
    expect(dialled).toEqual([
      { call: { number: "0412345678", emergency: false }, duringSend: true },
    ]);
    expect(describeStockScreen(rig.phone.screen)).toContain("Calling");
    expect(describeStockScreen(rig.phone.screen)).not.toContain("not implemented");
    rig.advance(5000);
    expect(rig.phone.screen.kind).toBe("standby");
  });
});

describe("a toolkit session", () => {
  it("fetches each command behind Wait for 20 ms plus 1.2 ms a character (Task 0 K)", () => {
    expect(fetchMs({ kind: "text", text: "Hello from the SIM" })).toBe(42);
    expect(fetchMs(item("text-240").steps[0]!)).toBe(308);
    expect(fetchMs(item("list").steps[0]!)).toBe(37);
  });

  it("ends after an item's last step, from any depth of lists (stk/select/*-ok)", () => {
    const rig = flowRig(() => toolkitSession(item("nested"), { dial: () => {} }));
    rig.advance(100);
    rig.press("navi"); // Deeper
    rig.advance(100);
    rig.press("navi"); // Leaf
    rig.advance(100);
    rig.press("navi"); // OK on Leaf text
    // Every widget closes at once (the lists and the text): the flow exits to the level.
    expect(rig.exits).toEqual([{ atMs: rig.now, options: undefined }]);
  });

  it("pages a long text with ▼ and ▲ and stops at its ends", () => {
    const rig = flowRig(() => toolkitSession(item("text-160"), { dial: () => {} }));
    rig.advance(400);
    const page = () => JSON.stringify(shown(rig));
    const first = page();
    rig.press("up");
    expect(page()).toBe(first);
    rig.press("down");
    rig.press("down");
    const last = page();
    rig.press("down");
    expect(page()).toBe(last);
    rig.press("up");
    rig.press("up");
    expect(page()).toBe(first);
  });

  it("is a stock flow per SET UP MENU item", () => {
    const app = new StockFlowApplication("stock:sim-services/short", () =>
      toolkitSession(item("short"), { dial: () => {} }),
    );
    expect(app.id).toBe("stock:sim-services/short");
  });
});
