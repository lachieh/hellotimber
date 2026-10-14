import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { LCD_HEIGHT, LCD_WIDTH, parseGolden } from "../scripts/golden-format.ts";

const GOLDENS = join(import.meta.dirname, "../goldens");

interface IndexEntry {
  id: string;
  file: string;
  status: string;
  kind: "still" | "timeline";
  images: number;
  frames: number;
  covers?: string[];
}

const index = JSON.parse(readFileSync(join(GOLDENS, "index.json"), "utf8")) as IndexEntry[];

function fixtureFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return fixtureFiles(path);
    return entry.name.endsWith(".lcd.txt") ? [relative(GOLDENS, path)] : [];
  });
}

describe("committed goldens", () => {
  it("has an index sorted by unique id", () => {
    const ids = index.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([...ids].sort());
  });

  it("indexes every fixture file", () => {
    expect(fixtureFiles(GOLDENS).sort()).toEqual(index.map((entry) => entry.file).sort());
  });

  for (const entry of index) {
    it(`${entry.id} parses, is 84x48 and matches its index entry`, () => {
      const golden = parseGolden(readFileSync(join(GOLDENS, entry.file), "utf8"), entry.file);
      expect(golden.id).toBe(entry.id);
      expect(entry.file).toBe(`${entry.id}.lcd.txt`);
      expect(golden.status).toBe(entry.status);
      expect(golden.images).toHaveLength(entry.images);
      for (const image of golden.images) expect(image.pixels).toHaveLength(LCD_WIDTH * LCD_HEIGHT);
      expect(entry.covers).toEqual(golden.covers);
      if (golden.scenario !== undefined) {
        expect(entry.id).toMatch(/^tree\/\d\d-[a-z-]+\/[0-9-]+\.(sub|options|open|leaf|choose)$/);
        expect(golden.covers!.length).toBeGreaterThan(0);
      }
      if (golden.scenario === "leaf" || golden.scenario === "choose") {
        expect(golden.timeline).toBeDefined();
        expect(typeof golden.triggerFrame).toBe("number");
      }
      if (entry.kind === "timeline") {
        expect(golden.timeline).toHaveLength(entry.frames);
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
      if (entry.status !== "asserted") continue;
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
      const plan = /^pending:(\d+)$/.exec(entry.status);
      expect(plan, `${entry.id}: ${entry.status}`).not.toBeNull();
      expect(Number(plan![1])).toBeGreaterThan(13);
    }
  });
});
