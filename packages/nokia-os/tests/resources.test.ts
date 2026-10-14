import { SubmenuEntry } from "@hellotimber/phone-core";
import { Framebuffer } from "@hellotimber/phone-screen";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { extractResources, inferLoop, toTimeline } from "../scripts/extract-resources.ts";
import { TREE_TEXT_RUNS } from "../scripts/generated/tree-text-runs.ts";
import { TEXT_RUNS } from "../scripts/text-runs.ts";
import { placeholderOwner } from "../scripts/tree-capture-set.ts";
import { WIDGET_SPRITES as CROPS } from "../scripts/widget-sprites.ts";
import { loadGolden } from "./support/goldens";
import { missingStockGlyphs, stockMenu } from "../src/index";
import {
  BOOT_FRAMES,
  BOOT_TIMELINE,
  STOCK_FONTS,
  STOCK_MENU_ICONS,
  stockMenuGraphic,
  WIDGET_SPRITES,
  WIDGET_TIMELINE_BY_NAME,
  WIDGET_TIMELINE_BY_NODE,
  WIDGET_TIMELINES,
  type StockFontName,
} from "../src/resources";
import { BOOT_DATA } from "../src/resources/generated/boot";
import { STOCK_FONT_DATA } from "../src/resources/generated/fonts";
import { MENU_ICON_DATA } from "../src/resources/generated/menu-icons";
import { SNAKE_DATA } from "../src/resources/generated/snake";
import { STATUS_DATA } from "../src/resources/generated/status";
import { WIDGET_DATA } from "../src/resources/generated/widgets";
import {
  STOCK_TREE,
  type StockResult,
  type StockScreenSpec,
  type StockTreeNode,
} from "../src/firmware/generated/stock-tree";

interface ShownText {
  readonly text: string;
  readonly font: StockFontName;
  readonly where: string;
}

/**
 * The faces a leaf screen draws its lines in (measured from the tree goldens): notes in large;
 * prompts' label lines (through the last one ending in ":") in small and their value in large;
 * the other widgets in small. Screens that show nothing of their own have no lines.
 */
function leafText(screen: StockScreenSpec | StockResult, where: string): ShownText[] {
  if (!("lines" in screen)) return [];
  const softkey =
    screen.softkey === undefined ? [] : [{ text: screen.softkey, font: "small" as const, where }];
  switch (screen.kind) {
    case "no-response":
    case "returns-immediately":
    case "standby":
      return softkey;
    case "timed-note":
    case "static-note":
      return [...screen.lines.map((text) => ({ text, font: "large" as const, where })), ...softkey];
    case "text-input":
    case "number-input":
    case "code-prompt": {
      const labels = screen.lines.reduce((last, line, i) => (line.endsWith(":") ? i : last), -1);
      return [
        ...screen.lines.map((text, i) => ({
          text,
          font: i <= labels ? ("small" as const) : ("large" as const),
          where,
        })),
        ...softkey,
      ];
    }
    default:
      return [...screen.lines.map((text) => ({ text, font: "small" as const, where })), ...softkey];
  }
}

/** Every string the stock tree shows, in its face, except text owned by placeholders. */
function stockTreeText(): ShownText[] {
  const out: ShownText[] = [];
  const shown = (number: string): boolean => placeholderOwner(number) === undefined;
  const visit = (node: StockTreeNode, parent: StockTreeNode | undefined): void => {
    const where = node.number;
    for (const text of node.label.split("\n"))
      out.push({ text, font: parent ? "small" : "large", where });
    if (node.valueHint !== undefined) out.push({ text: node.valueHint, font: "thin", where });
    const spec = node.opens;
    if (!shown(node.number)) return;
    switch (spec.kind) {
      case "submenu":
        out.push({ text: spec.softkey, font: "small", where });
        break;
      case "option-list":
        out.push({ text: spec.softkey, font: "small", where });
        spec.options.forEach((option, i) => {
          const number = `${node.number}-${i + 1}`;
          out.push({ text: option.label, font: "small", where: number });
          if (shown(number)) out.push(...leafText(option.result, number));
        });
        break;
      case "info-pages":
        spec.pages.forEach((page, i) => {
          const number = `${node.number}-${i + 1}`;
          for (const text of page.label.split("\n"))
            out.push({ text, font: "small", where: number });
          if (page.value !== undefined) out.push({ text: page.value, font: "thin", where: number });
          out.push({ text: page.softkey, font: "small", where: number });
          if (page.result) out.push(...leafText(page.result, number));
        });
        break;
      case "text-pages":
        for (const page of spec.pages)
          for (const text of page) out.push({ text, font: "thin", where });
        out.push({ text: "More", font: "small", where });
        break;
      default:
        out.push(...leafText(spec, where));
    }
    for (const child of node.children ?? []) visit(child, node);
  };
  for (const top of STOCK_TREE) visit(top, undefined);
  return out;
}

describe("generated resources", () => {
  it("equal a fresh extraction from the committed goldens", () => {
    expect({
      fonts: STOCK_FONT_DATA,
      menuIcons: MENU_ICON_DATA,
      boot: BOOT_DATA,
      status: STATUS_DATA,
      widgets: WIDGET_DATA,
      snake: SNAKE_DATA,
    }).toEqual(extractResources());
  });

  it("have binary glyphs of one height per font", () => {
    for (const [name, font] of Object.entries(STOCK_FONT_DATA)) {
      for (const [ch, rows] of Object.entries(font.glyphs)) {
        expect(rows, `${name} '${ch}'`).toHaveLength(font.height);
        for (const row of rows) {
          expect(row, `${name} '${ch}'`).toMatch(/^[#.]+$/);
          expect(row.length, `${name} '${ch}'`).toBe(rows[0]!.length);
        }
      }
    }
  });

  it("render every transcribed label, value and softkey", () => {
    for (const images of [...Object.values(TEXT_RUNS), ...Object.values(TREE_TEXT_RUNS)]) {
      for (const runs of Object.values(images)) {
        for (const run of runs)
          expect(missingStockGlyphs(run.text, run.font), run.text).toEqual([]);
      }
    }
    for (const softkey of ["Menu", "Select"])
      expect(missingStockGlyphs(softkey, "small")).toEqual([]);
  });

  it("render every string the stock tree shows in its face, except text owned by placeholders", () => {
    const missing = stockTreeText().flatMap(({ text, font, where }) => {
      const chars = missingStockGlyphs(text, font);
      return chars.length === 0 ? [] : [`${where}: ${font} "${text}" lacks ${chars.join(" ")}`];
    });
    expect(missing).toEqual([]);
  });

  it("render the stock widgets' soft keys", () => {
    for (const softkey of [
      "OK",
      "Quit",
      "Mark",
      "Unmark",
      "Back",
      "More",
      "Yes",
      "Search",
      "Assign",
      "Start",
    ])
      expect(missingStockGlyphs(softkey, "small"), softkey).toEqual([]);
  });

  it("render every stockMenu label: carousel titles in large, level-1 labels in small", () => {
    for (const { entry } of stockMenu.entries) {
      expect(missingStockGlyphs(entry.label, "large"), entry.label).toEqual([]);
      const children = entry instanceof SubmenuEntry ? entry.children.entries : [];
      for (const child of children)
        expect(missingStockGlyphs(child.label, "small"), child.label).toEqual([]);
    }
  });

  it("names missing characters once, in order, and ignores line breaks", () => {
    expect(missingStockGlyphs("Show call\nduration", "small")).toEqual([]);
    expect(missingStockGlyphs("jam & jazz@", "small")).toEqual(["j", "&", "@"]);
    expect(missingStockGlyphs("&@", "large" satisfies StockFontName)).toEqual(["&", "@"]);
  });

  it("renders any live time and date: every digit in the standby digits and thin page fonts", () => {
    // The 19:48 and 07:59 captures (Task 11) supply the digits that 10:10 and 13.10.2026 lack.
    expect(missingStockGlyphs("0123456789:", "digits")).toEqual([]);
    expect(missingStockGlyphs("0123456789:.", "thin")).toEqual([]);
  });

  it("has strict fonts: drawing a missing glyph throws", () => {
    const fb = new Framebuffer();
    expect(fb.drawText(STOCK_FONTS.digits, "10:10", 0, 0)).toBe(27);
    expect(() => fb.drawText(STOCK_FONTS.digits, "A", 0, 0)).toThrow(/unknown glyph 'A'/);
  });
});

describe("menu icons", () => {
  // Distinct frames per icon, as recorded by plan 13 Task 0 (menu-anim-long).
  const FRAME_COUNTS: Record<string, number> = {
    "phone-book": 4,
    messages: 14,
    chat: 12,
    "call-register": 12,
    tones: 17,
    settings: 8,
    "call-divert": 11,
    games: 4,
    calculator: 13,
    reminders: 14,
    clock: 8,
    profiles: 4,
  };

  it("has the captured frame count for each of the 12 carousel icons", () => {
    expect(
      Object.fromEntries(Object.entries(STOCK_MENU_ICONS).map(([id, i]) => [id, i.frames.length])),
    ).toEqual(FRAME_COUNTS);
  });

  it("keeps icon art inside x 0..79, y 20..39 and every timeline frame in range", () => {
    for (const [id, icon] of Object.entries(STOCK_MENU_ICONS)) {
      for (const frame of icon.frames) {
        expect(icon.x, id).toBeGreaterThanOrEqual(0);
        expect(icon.y, id).toBeGreaterThanOrEqual(20);
        expect(icon.x + frame.width - 1, id).toBeLessThanOrEqual(79);
        expect(icon.y + frame.height - 1, id).toBeLessThanOrEqual(39);
      }
      const graphic = stockMenuGraphic(id);
      for (const reveal of ["enter", "next", "previous", "return"] as const) {
        for (const step of graphic.timelineFor(reveal)!.steps) {
          expect(step.frame, `${id} ${reveal}`).toBeLessThan(icon.frames.length);
        }
      }
    }
  });

  it("settles every icon on a held frame (no loop) and starts on frame 0", () => {
    for (const [id, data] of Object.entries(MENU_ICON_DATA)) {
      expect(data.timeline.loopFrom, id).toBeUndefined();
      expect(data.timeline.steps[0]!.frame, id).toBe(0);
    }
  });

  it("gives per-reveal timelines to Clock (previous from ▲, return from C) and Reminders (return from View all)", () => {
    const withReveals = Object.entries(MENU_ICON_DATA)
      .filter(([, data]) => data.reveals)
      .map(([id, data]) => [id, Object.keys(data.reveals!).sort()] as const)
      .sort(([a], [b]) => a.localeCompare(b));
    expect(withReveals).toEqual([
      ["clock", ["previous", "return"]],
      ["reminders", ["return"]],
    ]);
    // tree/10-reminders/10-2.leaf: the icon holds 1382 ms after View all, then animates.
    expect(stockMenuGraphic("reminders").timelineFor("return")!.frameAt(1381)).toBe(0);
    expect(stockMenuGraphic("reminders").timelineFor("return")!.frameAt(1382)).not.toBe(0);
    const clock = stockMenuGraphic("clock");
    expect(clock.timelineFor("next")!.frameAt(1399)).toBe(0);
    expect(clock.timelineFor("next")!.frameAt(1400)).toBe(1);
    expect(clock.timelineFor("previous")!.frameAt(1385)).toBe(1);
    expect(clock.timelineFor("return")!.frameAt(1386)).toBe(1);
  });
});

describe("timeline extraction", () => {
  it("merges repeated frames and keeps a settled recording finite", () => {
    expect(
      toTimeline(
        [
          { frame: 0, durationMs: 100 },
          { frame: 1, durationMs: 50 },
          { frame: 1, durationMs: 50 },
          { frame: 0, durationMs: 2000 },
        ],
        true,
      ),
    ).toEqual({
      steps: [
        { frame: 0, durationMs: 100 },
        { frame: 1, durationMs: 100 },
        { frame: 0, durationMs: 2000 },
      ],
    });
  });

  it("infers a loop when the recording ends cycling", () => {
    expect(inferLoop([0, 1, 2, 1, 2, 1, 2])).toEqual({ loopFrom: 1, period: 2 });
    expect(inferLoop([0, 1, 2])).toBeUndefined();
    expect(
      toTimeline(
        [0, 1, 2, 1, 2].map((frame) => ({ frame, durationMs: 10 })),
        true,
      ),
    ).toEqual({
      steps: [
        { frame: 0, durationMs: 10 },
        { frame: 1, durationMs: 10 },
        { frame: 2, durationMs: 10 },
      ],
      loopFrom: 1,
      loopInferred: true,
    });
    expect(() =>
      toTimeline(
        [
          { frame: 0, durationMs: 10 },
          { frame: 1, durationMs: 10 },
        ],
        true,
      ),
    ).toThrow(/neither settles nor ends in a cycle/);
  });
});

describe("boot", () => {
  it("has ten full frames and the 9888 ms D12 timeline; frame 0 is blank", () => {
    expect(BOOT_FRAMES).toHaveLength(10);
    for (const frame of BOOT_FRAMES) expect([frame.width, frame.height]).toEqual([84, 48]);
    expect(BOOT_FRAMES[0]!.pixels.every((p) => p === 0)).toBe(true);
    expect(BOOT_TIMELINE.durationMs).toBe(9888);
    expect(BOOT_TIMELINE.steps.map((s) => s.frame)).toEqual([0, 1, 0, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(BOOT_TIMELINE.steps.at(-1)!.durationMs).toBe(4231);
  });
});

describe("widget sprites and timelines", () => {
  /** The frame names of a timeline's steps, e.g. `note/tick:541` or `cut90:15`. */
  function describeSteps(id: string): string[] {
    const { frames, timeline } = WIDGET_TIMELINES[id]!;
    return timeline.steps.map(({ frame, durationMs }) => {
      const f = frames[frame]!;
      const name =
        f.kind === "sprite"
          ? f.sprite
          : f.kind === "cut"
            ? `cut${f.bytes}`
            : f.kind === "edges"
              ? `edges${f.x0}-${f.x1}`
              : f.kind;
      return `${name}:${durationMs}`;
    });
  }

  it("crops every listed sprite from its golden: binary art with ink, lit only where the golden is", () => {
    for (const crop of CROPS) {
      const sprite = WIDGET_DATA.sprites[crop.id]!;
      expect([sprite.x, sprite.y], crop.id).toEqual([crop.x0, crop.y0]);
      expect(sprite.art, crop.id).toHaveLength(crop.y1 - crop.y0 + 1);
      expect(sprite.art.join(""), crop.id).toMatch(/^[#.]*#[#.]*$/);
      const { pixels } = loadGolden(crop.golden).images.find((image) => image.name === crop.image)!;
      sprite.art.forEach((row, dy) => {
        expect(row, crop.id).toHaveLength(crop.x1 - crop.x0 + 1);
        Array.from(row).forEach((ch, dx) => {
          expect(ch === "#", `${crop.id} (${dx}, ${dy})`).toBe(
            pixels[(crop.y0 + dy) * 84 + crop.x0 + dx] === 1,
          );
        });
      });
      expect(WIDGET_SPRITES[crop.id]!.bitmap.width, crop.id).toBe(crop.x1 - crop.x0 + 1);
    }
  });

  it("references only known sprites, and loops only progress bars and prompt cursors", () => {
    for (const [id, data] of Object.entries(WIDGET_DATA.timelines)) {
      for (const frame of data.frames) {
        if (frame.kind === "sprite" || frame.kind === "image")
          expect(WIDGET_DATA.sprites[frame.sprite], `${id} ${frame.sprite}`).toBeDefined();
      }
      const kinds = new Set(
        data.frames.map((frame) =>
          frame.kind === "sprite" ? frame.sprite.split("-")[0] : frame.kind,
        ),
      );
      const loops = kinds.has("progress") || kinds.has("cursor");
      expect(data.loopFrom !== undefined, id).toBe(loops);
      expect(Number.isFinite(WIDGET_TIMELINES[id]!.timeline.durationMs), id).toBe(!loops);
    }
  });

  it("gives every asserted in-scope note and progress note, and every game splash, a timeline", () => {
    const index = JSON.parse(
      readFileSync(join(import.meta.dirname, "../goldens/index.json"), "utf8"),
    ) as { id: string; status: string; kind: string; covers?: string[] }[];
    const kinds = new Map<string, string>();
    const visit = (node: StockTreeNode): void => {
      kinds.set(node.number, node.opens.kind);
      if (node.opens.kind === "option-list") {
        node.opens.options.forEach((o, i) => kinds.set(`${node.number}-${i + 1}`, o.result.kind));
      }
      if (node.opens.kind === "submenu" && node.opens.intro) kinds.set(node.number, "splash");
      for (const child of node.children ?? []) visit(child);
    };
    STOCK_TREE.forEach(visit);
    const expected: string[] = [];
    for (const entry of index) {
      if (entry.status !== "asserted" || entry.kind !== "timeline") continue;
      for (const number of entry.covers ?? []) {
        if (["timed-note", "progress-note"].includes(kinds.get(number)!)) expected.push(number);
      }
    }
    for (const [number, kind] of kinds) if (kind === "splash") expected.push(number);
    expect(expected.length).toBeGreaterThan(70);
    expect(expected.filter((number) => WIDGET_TIMELINE_BY_NODE[number] === undefined)).toEqual([]);
    expect(["8-1", "8-2", "8-3", "8-4"].every((n) => expected.includes(n))).toBe(true);
  });

  it("reproduces a confirmation: 15 ms partial draw, then the tick's three steps (D8)", () => {
    expect(describeSteps(WIDGET_TIMELINE_BY_NODE["1-8-1-1"]!)).toEqual([
      "cut90:15",
      "note/tick-box:674",
      "note/tick-half:240",
      "note/tick:541",
    ]);
    // Service Nos. starts with a 90 ms blank; Phone book › Erase › One by one does not.
    expect(describeSteps(WIDGET_TIMELINE_BY_NODE["1-2"]!)).toEqual(["blank:90", "note/info:2924"]);
    expect(describeSteps(WIDGET_TIMELINE_BY_NODE["4-6-3"]!)).toEqual(["note/error:2907"]);
    // Inbox: a 60 ms `Opening` screen kept as captured.
    expect(describeSteps(WIDGET_TIMELINE_BY_NODE["2-2"]!)[0]).toBe("image:60");
    // Settings › Restore… (6-2-4-1 Done): ends with a 9 ms draw of standby's edges.
    expect(describeSteps(WIDGET_TIMELINE_BY_NODE["6-2-4-1"]!).at(-1)).toBe("edges5-78:9");
  });

  it("plays progress bars and prompt cursors as captured, then loops their last cycle", () => {
    // Golden durations from the trigger, without the last row (cut short by the recording's end
    // or by a key).
    const captured = (id: string) => {
      const golden = loadGolden(id);
      return golden.timeline!.slice(golden.triggerFrame as number, -1).map((row) => row.durationMs);
    };
    const progressId = WIDGET_TIMELINE_BY_NODE["7-6"]!;
    const progress = WIDGET_TIMELINES[progressId]!;
    expect(progress.timeline.durationMs).toBe(Infinity);
    const bar = progress.timeline.steps;
    // The 10 s Quit probe continues the 7-6 leaf recording (the emulator is deterministic).
    // Without the bar step Quit cut short (62 ms), the note and the edges step.
    const barRows = captured("probe/progress-7-6-quit").slice(0, -3);
    expect(bar.map((step) => step.durationMs)).toEqual(barRows);
    const leaf = captured("tree/07-call-divert/7-6.leaf");
    expect(barRows.slice(0, leaf.length)).toEqual(leaf);
    expect(WIDGET_DATA.timelines[progressId]!.loopFrom).toBe(bar.length - 10);
    expect(describeSteps(progressId).map((s) => s.split(":")[0])).toEqual(
      bar.map((_, i) => `progress-${(i % 10) + 1}`),
    );
    const cursorId = WIDGET_TIMELINE_BY_NODE["11-5"]!;
    expect(describeSteps(cursorId)).toEqual(
      captured("tree/11-clock/11-5.leaf").map(
        (ms, i) => `${i % 2 === 0 ? "cursor" : "plain"}:${ms}`,
      ),
    );
    expect(WIDGET_DATA.timelines[cursorId]!.loopFrom).toBe(describeSteps(cursorId).length - 2);
    // Prompts that do not blink (Search, Speed dials, code prompts) have no timeline (P9).
    for (const number of ["1-1", "1-9", "6-4"])
      expect(WIDGET_TIMELINE_BY_NODE[number], number).toBeUndefined();
  });

  it("plays each splash to its game menu, and names the notes that follow a key in a probe", () => {
    expect(describeSteps(WIDGET_TIMELINE_BY_NODE["8-1"]!)).toEqual([
      "splash/8-1-1:248",
      "splash/8-1-2:240",
      "splash/8-1-3:240",
      "splash/8-1-4:239",
      "splash/8-1-5:201",
      "splash/8-1-1:1390",
    ]);
    expect(WIDGET_TIMELINES[WIDGET_TIMELINE_BY_NODE["8-4"]!]!.timeline.durationMs).toBe(3060);
    expect(Object.keys(WIDGET_TIMELINE_BY_NAME).sort()).toEqual([
      "game-over-fireworks",
      "game-over-note",
      "invalid-shortcut",
      "level-5-done",
      "reminder-memory-empty",
      "request-not-confirmed",
    ]);
    expect(describeSteps(WIDGET_TIMELINE_BY_NAME["invalid-shortcut"]!)).toEqual([
      "note/error:2903",
      "edges5-78:9",
    ]);
  });

  it("plays the game-over note, and the fireworks before TOP SCORE: as captured (plan 23 D13)", () => {
    // bot-short.death: Game over! / Your score: for 2939 ms, then the game menu.
    expect(describeSteps(WIDGET_TIMELINE_BY_NAME["game-over-note"]!)).toEqual([
      "game-over/title:2939",
    ]);
    // bot-long.death: six pictures twice, then Game over! / TOP SCORE: for 2935 ms.
    expect(describeSteps(WIDGET_TIMELINE_BY_NAME["game-over-fireworks"]!)).toEqual([
      "fireworks-1:231",
      "fireworks-2:234",
      "fireworks-3:232",
      "fireworks-4:241",
      "fireworks-5:217",
      "fireworks-6:233",
      "fireworks-1:216",
      "fireworks-2:217",
      "fireworks-3:217",
      "fireworks-4:217",
      "fireworks-5:231",
      "fireworks-6:386",
      "game-over/title:2935",
    ]);
  });
});
