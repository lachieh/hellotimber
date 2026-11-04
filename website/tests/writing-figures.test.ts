import { englishT9 } from "@hellotimber/nokia-kit/t9-english";
import { Framebuffer } from "@hellotimber/phone-screen";
import { describe, expect, it } from "vite-plus/test";
import { createFigurePhone, pressFor } from "../src/writing/figures/figure-phone";
import {
  focusPath,
  machineTree,
  parseKeys,
  pathAndAncestors,
  replay,
  REPLAY_START,
} from "../src/writing/figures/machine";

describe("the StateMachine's tree", () => {
  const source = [
    { number: "1", slug: "about", label: "About" },
    {
      number: "2",
      slug: "work",
      label: "Work",
      children: [
        {
          number: "2-1",
          slug: "tambo",
          label: "tambo",
          children: [{ number: "2-1-1", slug: "x", label: "X" }],
        },
      ],
    },
    { number: "3", slug: "call-register", label: "Call\nregister" },
  ];

  it("is the firmware's tree as phone paths, cut to a depth", () => {
    const tree = machineTree(source, 2);
    expect(tree.map((n) => [n.path, n.label, n.number])).toEqual([
      ["menu/about", "About", "1"],
      ["menu/work", "Work", "2"],
      ["menu/call-register", "Call register", "3"],
    ]);
    expect(tree[1]!.children.map((n) => n.path)).toEqual(["menu/work/tambo"]);
    expect(tree[1]!.children[0]!.children).toEqual([]);
  });

  it("follows a real phone: standby, the carousel's item, a list's selected row, a screen", () => {
    const figure = createFigurePhone({ firmware: "home" });
    const tree = figure.tree(2);
    const focus = () => focusPath(figure.phone, tree);
    expect(focus()).toBe("standby");
    pressFor(figure, "navi", 100);
    expect(focus()).toBe("menu/about");
    pressFor(figure, "down", 100);
    expect(focus()).toBe("menu/work");
    pressFor(figure, "navi", 100);
    expect(focus()).toBe("menu/work/tambo");
    pressFor(figure, "down", 100);
    expect(focus()).toBe("menu/work/cosmonic");
    pressFor(figure, "navi", 100);
    expect(figure.phone.path).toBe("menu/work/cosmonic");
    expect(focus()).toBe("menu/work/cosmonic");
  });

  it("marks a path and the states above it", () => {
    expect(pathAndAncestors("menu/work/tambo")).toEqual(["menu", "menu/work", "menu/work/tambo"]);
  });
});

describe("figure phones", () => {
  it("open at their start path, switched on, and paint the real LCD", () => {
    const figure = createFigurePhone({ firmware: "home", start: "menu/writing" });
    expect(figure.phone.path).toBe("menu/writing");
    expect(figure.describe()).toContain("Building a 3310");
    const fb = new Framebuffer(84, 48);
    figure.paint(fb, figure.phone.screen);
    expect(fb.pixels.some((p) => p === 1)).toBe(true);
  });

  it("type with T9 on the stock firmware, as the post's replay does", () => {
    const figure = createFigurePhone({
      firmware: "stock",
      start: "menu/messages/write",
      english: englishT9,
    });
    for (const { key, holdMs } of parseKeys("4 3 5 5 6 0 9 6 7 5 3")) pressFor(figure, key, holdMs);
    expect(figure.describe()).toContain("Hello world");
  });
});

describe("KeyReplay", () => {
  it("parses a sequence, with long holds", () => {
    expect(parseKeys(" navi down  c:long ")).toEqual([
      { key: "navi", holdMs: 120 },
      { key: "down", holdMs: 120 },
      { key: "c", holdMs: 1200 },
    ]);
    expect(() => parseKeys("navi enter")).toThrow('"enter" isn\'t a phone key.');
    expect(() => parseKeys("c:short")).toThrow('only ":long" holds');
  });

  it("plays, pauses, steps and stops by itself at the end", () => {
    let state = replay(REPLAY_START, "play", 2);
    expect(state).toEqual({ next: 0, playing: true });
    state = replay(state, "step", 2);
    expect(state).toEqual({ next: 1, playing: true });
    state = replay(replay(state, "pause", 2), "step", 2);
    expect(state).toEqual({ next: 2, playing: false });
    expect(replay(state, "step", 2)).toEqual({ next: 2, playing: false });
    expect(replay(state, "play", 2)).toEqual({ next: 0, playing: true });
    expect(replay(state, "reset", 2)).toEqual(REPLAY_START);
    expect(replay(replay(REPLAY_START, "play", 1), "step", 1)).toEqual({ next: 1, playing: false });
  });
});
