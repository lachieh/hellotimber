import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import {
  framePeriod,
  numberTicks,
  PERIOD_LEVELS,
  type PlayedFrame,
} from "../scripts/game-capture-set.ts";
import { PLACEHOLDER_OWNERS as IMPORTER_PLACEHOLDER_OWNERS } from "../scripts/tree-capture-set.ts";
import { PLACEHOLDER_OWNERS } from "../src/firmware/stock";
import {
  LCD_HEIGHT,
  LCD_WIDTH,
  parseGolden,
  parseTickGolden,
  type Golden,
} from "../scripts/golden-format.ts";
import * as CAPTURE_SETS from "../scripts/capture-sets/index.ts";
import {
  indexedPlans,
  PLAN_NUMBER,
  readGoldenIndex,
  readPlanIndex,
  type GoldenIndexEntry,
} from "../scripts/golden-index.ts";
import { parseSoundGolden } from "../scripts/sound-format.ts";

const GOLDENS = join(import.meta.dirname, "../goldens");

type IndexEntry = GoldenIndexEntry;

const index: readonly IndexEntry[] = readGoldenIndex(GOLDENS);

function fixtureFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return fixtureFiles(path);
    return /\.(lcd|ticks|sound)\.txt$/.test(entry.name) ? [relative(GOLDENS, path)] : [];
  });
}

describe("committed goldens", () => {
  it("has an index sorted by unique id", () => {
    const ids = index.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([...ids].sort());
  });

  it("has one index file per registered capture set (goldens/index/<plan>.json)", () => {
    const plans = Object.values(CAPTURE_SETS).map((set) => set.plan);
    expect(indexedPlans(GOLDENS)).toEqual([...plans].sort());
    for (const plan of plans) {
      const ids = readPlanIndex(GOLDENS, plan).map((entry) => entry.id);
      expect(ids, plan).toEqual([...ids].sort());
    }
  });

  it("indexes every fixture file", () => {
    expect(fixtureFiles(GOLDENS).sort()).toEqual(index.map((entry) => entry.file).sort());
  });

  for (const entry of index.filter((e) => e.kind !== "ticks" && e.kind !== "sound")) {
    it(`${entry.id} parses, is 84x48 and matches its index entry`, () => {
      const golden = parseGolden(readFileSync(join(GOLDENS, entry.file), "utf8"), entry.file);
      expect(golden.id).toBe(entry.id);
      expect(entry.file).toBe(`${entry.id}.lcd.txt`);
      expect(golden.status).toBe(entry.status);
      expect(golden.images).toHaveLength(entry.images!);
      for (const image of golden.images) expect(image.pixels).toHaveLength(LCD_WIDTH * LCD_HEIGHT);
      expect(entry.covers).toEqual(golden.covers);
      expect(entry.input === true).toBe(golden.input !== undefined);
      if (golden.scenario !== undefined) {
        expect(entry.id).toMatch(/^tree\/\d\d-[a-z-]+\/[0-9-]+\.(sub|options|open|leaf|choose)$/);
        expect(golden.covers!.length).toBeGreaterThan(0);
      }
      if (golden.scenario === "leaf" || golden.scenario === "choose") {
        expect(golden.timeline).toBeDefined();
        expect(typeof golden.triggerFrame).toBe("number");
      }
      if (entry.kind === "timeline") {
        expect(golden.timeline).toHaveLength(entry.frames!);
        if (golden.status === "asserted") expect(golden.triggerFrame).toBeDefined();
      } else {
        expect(golden.timeline).toBeUndefined();
        expect(entry.frames).toBe(entry.images);
      }
    });
  }

  it("covers no tree node twice with asserted goldens of the same scenario", () => {
    const seen = new Map<string, string>();
    const twice: string[] = [];
    for (const entry of index) {
      if (entry.status !== "asserted" || entry.kind === "ticks" || entry.kind === "sound") continue;
      const golden = parseGolden(readFileSync(join(GOLDENS, entry.file), "utf8"), entry.file);
      for (const number of golden.covers ?? []) {
        const key = `${golden.scenario} ${number}`;
        const other = seen.get(key);
        if (other !== undefined) twice.push(`${key}: ${other} and ${entry.id}`);
        seen.set(key, entry.id);
      }
    }
    expect(twice).toEqual([]);
  });

  it("names a later plan for every pending fixture", () => {
    const pending = index.filter((entry) => entry.status !== "asserted");
    for (const entry of pending) {
      const plan = entry.status.slice("pending:".length);
      expect(
        entry.status.startsWith("pending:") && PLAN_NUMBER.test(plan),
        `${entry.id}: ${entry.status}`,
      ).toBe(true);
      expect(Number.parseInt(plan, 10)).toBeGreaterThan(13);
    }
  });
});

describe("plan 15 goldens", () => {
  const PLAN15_IDS = [
    "boot/power-on",
    "boot/security-gate",
    "boot/security-gate-keys",
    "boot/security-gate-ok-123",
    "boot/security-gate-ok-empty",
    "boot/security-lockout",
    "boot/security-lockout-4",
    "boot/welcome-note",
    "boot/welcome-note-long",
    "boot/welcome-note-ungated",
    "probe/code-wrong-6-3-5",
    "probe/code-wrong-6-3-6-1",
    "probe/code-wrong-6-4",
    "probe/code-wrong-4-5-5",
    "probe/code-keys-6-4",
    "probe/code-keys-6-4-c-on-empty",
    "probe/code-keys-6-4-ok-empty",
    "probe/code-keys-6-4-ok-123",
    "probe/persist-reboot",
    "probe/accept-6-3-5-on",
    "probe/accept-6-3-5-off",
    "probe/accept-6-3-6-1-mismatch",
    "probe/accept-6-3-6-1-lengths",
    "probe/accept-6-3-6-1-match",
    "probe/accept-6-4-old-code",
    "probe/accept-6-4-new-code",
    "probe/accept-6-4-restore",
    "probe/accept-c7-restore",
    "probe/accept-restore-phone-security",
    "probe/accept-4-5-5",
  ];

  it("has every plan 15 golden, asserted", () => {
    const status = new Map(index.map((entry) => [entry.id, entry.status]));
    expect(PLAN15_IDS.filter((id) => status.get(id) !== "asserted")).toEqual([]);
  });

  it("imports the gate-free boot capture, cut before the clock wizard (D9)", () => {
    const entry = index.find((e) => e.id === "boot/power-on")!;
    const golden = parseGolden(readFileSync(join(GOLDENS, entry.file), "utf8"), entry.file);
    expect(golden.source).toBe("captures/6.39/boot-clean/power-on 000-011");
    expect(golden.timeline!.map((row) => row.durationMs)).toEqual([
      268, 970, 1172, 1684, 132, 360, 302, 292, 367, 287, 320, 3951,
    ]);
  });

  it("leaves no golden pending on plan 15", () => {
    expect(index.filter((entry) => entry.status === "pending:15").map((e) => e.id)).toEqual([]);
  });

  it("keeps the importer's and the firmware's placeholder owners equal", () => {
    expect(PLACEHOLDER_OWNERS).toEqual(IMPORTER_PLACEHOLDER_OWNERS);
    expect(Object.values(PLACEHOLDER_OWNERS)).not.toContain("15");
  });
});

describe("game goldens (plan 23)", () => {
  const games = index.filter((entry) => entry.id.startsWith("game/"));
  const load = (entry: IndexEntry): Golden =>
    parseGolden(readFileSync(join(GOLDENS, entry.file), "utf8"), entry.file);

  /** The engine ticks a timeline golden shows (numbered as the importer numbers them). */
  function timelineTicks(golden: Golden): number {
    const pixels = new Map(golden.images.map((image) => [image.name, image.pixels]));
    const frames: PlayedFrame[] = golden.timeline!.map((row, frame) => ({
      pixels: pixels.get(row.image)!,
      startMs: row.startMs,
      durationMs: row.durationMs,
      dir: golden.id,
      frame,
    }));
    return numberTicks(frames, framePeriod(frames)).at(-1)?.tick ?? -1;
  }

  for (const entry of games.filter((e) => e.kind !== "ticks")) {
    it(`${entry.id}: trigger frame, tick still names and input ticks`, () => {
      const golden = load(entry);
      if (golden.timeline) {
        expect(typeof golden.triggerFrame).toBe("number");
      } else if (golden.images.some((image) => /^t\d/.test(image.name))) {
        const ticks = golden.images.map((image) => {
          expect(image.name).toMatch(/^t\d{4}$/);
          return Number(image.name.slice(1));
        });
        expect(ticks).toEqual([...ticks].sort((a, b) => a - b));
        expect(new Set(ticks).size).toBe(ticks.length);
      }
      if (golden.input === undefined) return;
      const last = golden.timeline
        ? timelineTicks(golden)
        : Number(golden.images.at(-1)!.name.slice(1));
      for (const press of golden.input)
        expect(press.tick, `${press.tick}:${press.key}`).toBeLessThanOrEqual(last);
    });
  }

  it("has a period fixture covering every level 10..175", () => {
    const entry = games.find((e) => e.kind === "ticks")!;
    expect(entry.file).toBe("game/snake/periods.ticks.txt");
    const fixture = parseTickGolden(readFileSync(join(GOLDENS, entry.file), "utf8"), entry.file);
    expect(fixture.id).toBe(entry.id);
    expect(fixture.status).toBe(entry.status);
    expect(fixture.rows.map((row) => row.level)).toEqual(PERIOD_LEVELS);
    expect(entry.frames).toBe(fixture.rows.length);
  });
});

describe("sound goldens (plan 16)", () => {
  const sounds = index.filter((entry) => entry.kind === "sound");
  const STATES = /^(virgin|factory|v639-[a-z0-9-]+)$/;

  for (const entry of sounds) {
    it(`${entry.id} parses and matches its index entry`, () => {
      const golden = parseSoundGolden(readFileSync(join(GOLDENS, entry.file), "utf8"), entry.file);
      expect(golden.id).toBe(entry.id);
      expect(entry.file).toBe(`${entry.id}.sound.txt`);
      expect(golden.status).toBe(entry.status);
      expect(golden.rows).toHaveLength(entry.events!);
      expect(golden.state).toMatch(STATES);
      expect(golden.source).toMatch(/^captures\/6\.39\/plan\d+[a-z]?\//);
    });
  }

  it("has every tone's preview, Level 5, Ascending and volume-list golden", () => {
    for (const family of [
      "ringing-tone",
      "ringing-tone/level-5",
      "alert/ascending",
      "ringing-volume/tone",
    ]) {
      const ids = sounds.filter((e) => new RegExp(`^sound/${family}/\\d\\d-`).test(e.id));
      expect(ids, family).toHaveLength(35);
    }
  });

  it("leaves no golden pending on plan 16 (the Composer is plan 27's)", () => {
    expect(index.filter((entry) => entry.status === "pending:16").map((e) => e.id)).toEqual([]);
    expect(PLACEHOLDER_OWNERS["5-4-*"]).toBe("27");
  });
});
