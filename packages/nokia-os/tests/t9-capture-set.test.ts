import { describe, expect, it } from "vite-plus/test";
import {
  describeCommand,
  T9_BASE,
  T9_NOT_IMPORTED,
  T9_PROMOTED,
  T9_SCENARIOS,
  t9CaptureSet,
  T9CaptureError,
  type T9CaptureIo,
  type T9Manifest,
  type T9ManifestStep,
} from "../scripts/t9-capture-set.ts";
import type { RecordingFrame } from "../scripts/tree-capture-set.ts";

/** Frames showing `images` in order, 100 ms each. */
function frames(...images: string[]): RecordingFrame[] {
  return images.map((image, i) => ({ image, startMs: i * 100, durationMs: 100 }));
}

/** A synthetic manifest: shots `NN-step`, a recording at step 3 and a two-shot step 4. */
function manifest(scenario: string, count = 5): T9Manifest {
  const steps: T9ManifestStep[] = Array.from({ length: count }, (_, i) => {
    const nn = String(i + 1).padStart(2, "0");
    if (i === 2) return { step: 3, cmd: "rec idle 3000", record: `${scenario}/${nn}-idle` };
    if (i === 3) {
      return {
        step: 4,
        cmd: "kk down",
        shot: `${scenario}/${nn}-Step.png`,
        shot_a: `${scenario}/${nn}-Step-a.png`,
      };
    }
    if (i === 1) return { step: 2, cmd: "run 1600" };
    return { step: i + 1, cmd: "k 4 6", shot: `${scenario}/${nn}-step.png` };
  });
  return { scenario, base: scenario === "first" ? "page" : "editor", steps };
}

function io(overrides: Partial<T9CaptureIo> = {}): T9CaptureIo {
  return {
    manifest: (scenario) => manifest(scenario),
    recording: () => frames("editor", "editor", "blink", "editor"),
    ...overrides,
  };
}

describe("t9CaptureSet", () => {
  const entries = t9CaptureSet(io());
  const byId = new Map(entries.map((entry) => [entry.id, entry]));

  it("lists every kept step of every table scenario once, pending on 18b", () => {
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
    expect(T9_PROMOTED.size).toBe(0);
    for (const e of entries) {
      expect(e.id).toMatch(/^t9\/[a-z0-9-]+\/\d\d-[a-z0-9-]+$/);
      expect(e.status, e.id).toBe("pending:18b");
    }
    const scenarios = new Set(entries.map((e) => e.id.split("/")[1]));
    expect([...scenarios]).toEqual(T9_SCENARIOS.map((row) => row.scenario));
  });

  it("makes a shot step a still named after its file, in lower case", () => {
    const entry = byId.get("t9/g-compose/01-step")!;
    expect(entry.kind).toBe("still");
    expect(entry.prefer.source).toEqual({
      kind: "shots",
      files: [{ file: `${T9_BASE}/g-compose/01-step.png`, name: "01-step" }],
    });
  });

  it("imports both cursor-blink phases of a two-shot step as one still", () => {
    expect(byId.get("t9/g-cursor-down/04-step")!.prefer.source).toEqual({
      kind: "shots",
      files: [
        { file: `${T9_BASE}/g-cursor-down/04-Step.png`, name: "04-step" },
        { file: `${T9_BASE}/g-cursor-down/04-Step-a.png`, name: "04-step-a" },
      ],
    });
  });

  it("makes a recording step a timeline triggered on its first changed frame", () => {
    const entry = byId.get("t9/first/03-idle")!;
    expect(entry.kind).toBe("timeline");
    expect(entry.prefer.source).toEqual({ kind: "recording", dir: `${T9_BASE}/first/03-idle` });
    expect(entry.prefer.triggerFrame).toBe(2);
  });

  it("skips steps without a capture and keeps only a partial row's steps", () => {
    expect(byId.has("t9/g-compose/02-step")).toBe(false);
    for (const row of T9_SCENARIOS.filter((r) => r.through !== undefined)) {
      const kept = entries.filter((e) => e.id.startsWith(`t9/${row.scenario}/`));
      const steps = kept.map((e) => Number(/\/(\d\d)-/.exec(e.id)![1]));
      expect(Math.max(...steps), row.scenario).toBeLessThanOrEqual(row.through!.step);
      expect(Object.keys(T9_NOT_IMPORTED)).toContain(
        `plan18b/${row.scenario}/ steps after ${String(row.through!.step).padStart(2, "0")}`,
      );
    }
    expect(byId.has("t9/digits/04-step")).toBe(false);
    expect(byId.has("t9/digits/01-step")).toBe(true);
  });

  it("notes the row's description and every key pressed from the base", () => {
    expect(byId.get("t9/g-compose/04-step")!.prefer.note).toMatch(
      / From the empty T9 Write messages editor: 4 6 · wait 1600 ms · record 3000 ms · down\.$/,
    );
    expect(byId.get("t9/first/01-step")!.prefer.note).toMatch(
      / From the Write messages page: 4 6\.$/,
    );
  });

  it("imports none of the excluded scenarios", () => {
    for (const scenario of [
      "longword",
      "russian",
      "bulgarian",
      "g-audio",
      "compose",
      "g-persist",
    ]) {
      expect(
        entries.some((e) => e.id.startsWith(`t9/${scenario}/`)),
        scenario,
      ).toBe(false);
    }
  });

  it("fails on a missing manifest or recording, a renumbered step or an unknown command", () => {
    expect(() => t9CaptureSet(io({ manifest: () => undefined }))).toThrow(T9CaptureError);
    expect(() => t9CaptureSet(io({ recording: () => undefined }))).toThrow(/missing capture/);
    const renumbered = (scenario: string): T9Manifest => {
      const m = manifest(scenario);
      return { ...m, steps: m.steps.map((s, i) => (i === 0 ? { ...s, step: 7 } : s)) };
    };
    expect(() => t9CaptureSet(io({ manifest: renumbered }))).toThrow(/numbered 7/);
    const poked = (scenario: string): T9Manifest => {
      const m = manifest(scenario);
      return { ...m, steps: [{ step: 1, cmd: "poke 1234 5", shot: `${scenario}/01-x.png` }] };
    };
    expect(() => t9CaptureSet(io({ manifest: poked }))).toThrow(/unknown command/);
    const short = (scenario: string): T9Manifest => ({
      ...manifest(scenario),
      steps: manifest(scenario).steps.slice(0, 1),
    });
    expect(() => t9CaptureSet(io({ manifest: short }))).toThrow(/keeps steps/);
  });
});

describe("describeCommand", () => {
  it("renders the manifest's commands in the notes' key vocabulary", () => {
    expect(describeCommand("x", "page")).toBeUndefined();
    expect(describeCommand("x", "k 4 6 8 6 0")).toBe("4 6 8 6 0");
    expect(describeCommand("x", "kk * c # menu up down")).toBe("* c # menu up down");
    expect(describeCommand("x", "hold # 1500")).toBe("# held 1500 ms");
    expect(describeCommand("x", "run 1600")).toBe("wait 1600 ms");
    expect(describeCommand("x", "rec blink 3000")).toBe("record 3000 ms");
    expect(describeCommand("x", "reck off 4000 menu")).toBe("menu, recording 4000 ms");
    expect(describeCommand("x", "saveflash")).toBe("save flash");
    expect(describeCommand("x", "reboot")).toBe("cold boot");
  });

  it("rejects unknown keys and malformed durations", () => {
    expect(() => describeCommand("x", "k 4 left")).toThrow(/unknown key "left"/);
    expect(() => describeCommand("x", "k")).toThrow(/unknown key/);
    expect(() => describeCommand("x", "hold 5 soon")).toThrow(/bad duration/);
  });
});
