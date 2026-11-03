import { stockMenuFor } from "@hellotimber/nokia-os";
import { describe, expect, it } from "vite-plus/test";
import {
  appendLog,
  formatElapsed,
  keyText,
  logAsText,
  type LogEntry,
} from "../src/exp/nokia-emulator/event-log";
import { ancestorPaths, countNodes, menuTree } from "../src/exp/nokia-emulator/menu-tree";
import { INITIAL_PANEL, panelReducer } from "../src/exp/nokia-emulator/panel-state";
import {
  batteryBars,
  formatOffset,
  memoryStorage,
  scopedStorage,
  shiftedDate,
  signalBars,
} from "../src/exp/nokia-emulator/world";

describe("panel state", () => {
  it("toggles open and closed, keeping the tab", () => {
    const closed = panelReducer({ open: true, tab: "world" }, { type: "toggle" });
    expect(closed).toEqual({ open: false, tab: "world" });
    expect(panelReducer(closed, { type: "toggle" })).toEqual({ open: true, tab: "world" });
  });

  it("opens a closed panel on the tab chosen", () => {
    const closed = { open: false, tab: "inspector" } as const;
    expect(panelReducer(closed, { type: "tab", tab: "stage" })).toEqual({
      open: true,
      tab: "stage",
    });
  });

  it("steps through the tabs with wrap-around", () => {
    expect(panelReducer(INITIAL_PANEL, { type: "step", by: -1 }).tab).toBe("stage");
    expect(panelReducer({ open: true, tab: "stage" }, { type: "step", by: 1 }).tab).toBe(
      "inspector",
    );
  });

  it("returns the same state when nothing changes", () => {
    const state = { open: true, tab: "world" } as const;
    expect(panelReducer(state, { type: "tab", tab: "world" })).toBe(state);
    const closed = { open: false, tab: "world" } as const;
    expect(panelReducer(closed, { type: "close" })).toBe(closed);
  });
});

describe("event log", () => {
  it("formats elapsed time as mm:ss.mmm", () => {
    expect(formatElapsed(0)).toBe("00:00.000");
    expect(formatElapsed(12_345)).toBe("00:12.345");
    expect(formatElapsed(61_007.9)).toBe("01:01.007");
    expect(formatElapsed(-5)).toBe("00:00.000");
  });

  it("names keys and their hold times", () => {
    expect(keyText("navi", "down")).toBe("NAVI down");
    expect(keyText("c", "up", 1503.6)).toBe("C up after 1504 ms");
    expect(keyText("7", "up")).toBe("7 up");
  });

  it("numbers entries and drops the oldest past its limit", () => {
    let log: readonly LogEntry[] = [];
    for (let i = 0; i < 5; i++) log = appendLog(log, { at: i, kind: "key", text: `k${i}` }, 3);
    expect(log.map((entry) => [entry.id, entry.text])).toEqual([
      [3, "k2"],
      [4, "k3"],
      [5, "k4"],
    ]);
  });

  it("copies as aligned plain text", () => {
    const log = appendLog([], { at: 1500, kind: "net", text: "SMS from 555" });
    expect(logAsText(log)).toBe("00:01.500  net     SMS from 555");
  });
});

describe("world", () => {
  it("maps signal strength to ladder bars", () => {
    expect([-113, -106, -105, -95, -85, -75, -51].map(signalBars)).toEqual([0, 0, 1, 2, 3, 4, 4]);
  });

  it("maps battery charge to ladder bars", () => {
    expect([0, 9, 10, 30, 55, 79, 80, 100].map(batteryBars)).toEqual([0, 0, 1, 2, 3, 3, 4, 4]);
  });

  it("formats and applies the clock offset", () => {
    expect(formatOffset(0)).toBe("±00:00");
    expect(formatOffset(150)).toBe("+02:30");
    expect(formatOffset(-45)).toBe("-00:45");
    expect(shiftedDate(90, 0).getTime()).toBe(90 * 60_000);
  });

  it("scopes storage under a prefix and clears only its own keys", () => {
    const base = memoryStorage();
    base.setItem("hellotimber.settings", "{}");
    const scoped = scopedStorage(base, "exp/");
    scoped.setItem("nokia-os/settings", "a");
    scoped.setItem("nokia-os/sms", "b");
    expect(base.getItem("exp/nokia-os/settings")).toBe("a");
    expect(scoped.getItem("nokia-os/sms")).toBe("b");
    expect(scoped.clear()).toBe(2);
    expect(scoped.getItem("nokia-os/settings")).toBeNull();
    expect(base.getItem("hellotimber.settings")).toBe("{}");
  });
});

describe("menu tree", () => {
  const tree = menuTree(stockMenuFor("sim-1"));

  it("numbers the stock menu as the phone does and gives every path", () => {
    const menu = stockMenuFor("sim-1");
    expect(countNodes(tree)).toBe(menu.paths().length - 1);
    const first = tree[0]!;
    expect(first).toMatchObject({ number: "1", label: "Phone book" });
    expect(first.children[0]!.number).toBe("1-1");
    expect(menu.resolve(first.children[0]!.path)).not.toBeNull();
  });

  it("lists a path's ancestors, nearest last", () => {
    expect(ancestorPaths("menu/settings/call-settings/automatic-redial")).toEqual([
      "menu/settings",
      "menu/settings/call-settings",
    ]);
    expect(ancestorPaths("menu/settings")).toEqual([]);
  });
});
