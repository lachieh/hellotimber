import { describe, expect, it } from "vite-plus/test";
import {
  GameScreen,
  MAX_STORAGE_BYTES,
  encodeBase64,
  encodeFrame,
  validateManifest,
  type GameManifest,
} from "../src/index";

const BLANK = encodeFrame(new GameScreen());

type Json = Record<string, unknown>;

function manifest(overrides: Json = {}): Json {
  return {
    sdk: 1,
    id: "test-game",
    name: "Test game",
    splash: { frames: [BLANK], steps: [{ frame: 0, ms: 250 }] },
    menu: [
      { kind: "play", slug: "new-game", label: "New game" },
      { kind: "level" },
      { kind: "choice", slug: "board", label: "Board", options: ["4x4", "3x3"], initial: 1 },
      { kind: "top-score" },
      { kind: "instructions", pages: ["Slide the tiles."] },
    ],
    level: { max: 9, initial: 3 },
    suspend: true,
    scores: true,
    storageBytes: 64,
    ...overrides,
  };
}

function menu(...items: Json[]): Json {
  return manifest({
    menu: [{ kind: "play", slug: "new-game", label: "New game" }, ...items],
  });
}

describe("validateManifest", () => {
  it("returns a frozen copy of a full manifest", () => {
    const input = manifest();
    const result: GameManifest = validateManifest(input);
    expect(result).toEqual(input);
    expect(result).not.toBe(input);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.menu)).toBe(true);
    expect(Object.isFrozen(result.menu[2])).toBe(true);
    expect(Object.isFrozen(result.splash.steps[0])).toBe(true);
    expect(Object.isFrozen(result.level)).toBe(true);
  });

  it("accepts the smallest manifest and adds no defaults", () => {
    const input = {
      sdk: 1,
      id: "g",
      name: "G",
      splash: { frames: [BLANK], steps: [{ frame: 0, ms: 1 }] },
      menu: [{ kind: "play", slug: "new-game", label: "New game" }],
    };
    expect(validateManifest(input)).toEqual(input);
    expect(Object.keys(validateManifest(input))).toEqual(Object.keys(input));
  });

  describe("keeps the game's own choices uncapped (D19)", () => {
    it("a thousand levels", () => {
      const input = manifest({ level: { max: 1000, initial: 1000 } });
      expect(validateManifest(input).level).toEqual({ max: 1000, initial: 1000 });
    });

    it("a 20-option choice", () => {
      const options = Array.from({ length: 20 }, (_, i) => `Option ${i + 1}`);
      const input = menu({ kind: "choice", slug: "pick", label: "Pick", options, initial: 19 });
      expect(validateManifest(input)).toEqual(input);
    });

    it("a 40-frame, 20 s splash", () => {
      const frames = Array.from({ length: 40 }, () => BLANK);
      const steps = frames.map((_, frame) => ({ frame, ms: 500 }));
      const input = manifest({ splash: { frames, steps } });
      expect(validateManifest(input).splash.steps.reduce((ms, step) => ms + step.ms, 0)).toBe(
        20_000,
      );
    });

    it("a single 60 s splash step", () => {
      const input = manifest({ splash: { frames: [BLANK], steps: [{ frame: 0, ms: 60_000 }] } });
      expect(validateManifest(input)).toEqual(input);
    });

    it("a ten-line instructions page that is wider than the screen", () => {
      const page = Array.from({ length: 10 }, (_, i) => `Line ${i + 1} ${"wide ".repeat(12)}`);
      const input = menu({ kind: "instructions", pages: [page.join("\n"), "More"] });
      expect(validateManifest(input)).toEqual(input);
    });

    it("an id and a name of any length", () => {
      const input = manifest({ id: `a${"-long".repeat(20)}`, name: "N".repeat(60) });
      expect(validateManifest(input)).toEqual(input);
    });

    it("several play items, with and without modes", () => {
      const input = menu(
        { kind: "play", slug: "timed", label: "Timed", mode: "timed" },
        { kind: "play", slug: "endless", label: "Endless", mode: "" },
      );
      expect(validateManifest(input)).toEqual(input);
    });

    it("the whole storage quota", () => {
      expect(validateManifest(manifest({ storageBytes: MAX_STORAGE_BYTES })).storageBytes).toBe(
        1024,
      );
      expect(validateManifest(manifest({ storageBytes: 0 })).storageBytes).toBe(0);
    });
  });

  describe("names the field of a malformed manifest", () => {
    const frameOf = (length: number) => encodeBase64(new Uint8Array(length));
    const cases: readonly (readonly [string, unknown, string])[] = [
      ["not an object", "2048", "manifest:"],
      ["an array", [], "manifest:"],
      ["null", null, "manifest:"],
      ["an unknown field", manifest({ tickMs: 100 }), "tickMs:"],
      ["sdk", manifest({ sdk: 2 }), "sdk:"],
      ["a missing id", manifest({ id: undefined }), "id:"],
      ["a capitalised id", manifest({ id: "Test" }), "id:"],
      ["an id with a space", manifest({ id: "test game" }), "id:"],
      ["an id ending in a dash", manifest({ id: "test-" }), "id:"],
      ["an empty id", manifest({ id: "" }), "id:"],
      ["a missing name", manifest({ name: undefined }), "name:"],
      ["an empty name", manifest({ name: "" }), "name:"],
      ["a missing splash", manifest({ splash: undefined }), "splash:"],
      ["no splash frames", manifest({ splash: { frames: [], steps: [] } }), "splash.frames:"],
      [
        "a splash frame that is not base64",
        manifest({ splash: { frames: [BLANK, "****"], steps: [{ frame: 0, ms: 1 }] } }),
        "splash.frames[1]:",
      ],
      [
        "a short splash frame",
        manifest({ splash: { frames: [frameOf(503)], steps: [{ frame: 0, ms: 1 }] } }),
        "splash.frames[0]:",
      ],
      [
        "a long splash frame",
        manifest({ splash: { frames: [frameOf(505)], steps: [{ frame: 0, ms: 1 }] } }),
        "splash.frames[0]:",
      ],
      ["no splash steps", manifest({ splash: { frames: [BLANK], steps: [] } }), "splash.steps:"],
      [
        "a step past the frames",
        manifest({ splash: { frames: [BLANK], steps: [{ frame: 1, ms: 1 }] } }),
        "splash.steps[0].frame:",
      ],
      [
        "a negative step frame",
        manifest({
          splash: {
            frames: [BLANK],
            steps: [
              { frame: 0, ms: 1 },
              { frame: -1, ms: 1 },
            ],
          },
        }),
        "splash.steps[1].frame:",
      ],
      [
        "a zero step",
        manifest({ splash: { frames: [BLANK], steps: [{ frame: 0, ms: 0 }] } }),
        "splash.steps[0].ms:",
      ],
      [
        "a fractional step",
        manifest({ splash: { frames: [BLANK], steps: [{ frame: 0, ms: 12.5 }] } }),
        "splash.steps[0].ms:",
      ],
      [
        "an unknown splash field",
        manifest({ splash: { frames: [BLANK], steps: [{ frame: 0, ms: 1 }], loop: true } }),
        "splash.loop:",
      ],
      ["a missing menu", manifest({ menu: undefined }), "menu:"],
      ["an empty menu", manifest({ menu: [] }), "menu:"],
      ["a first item that is not play", manifest({ menu: [{ kind: "top-score" }] }), "menu[0]"],
      ["an unknown item kind", menu({ kind: "shop" }), "menu[1].kind:"],
      ["a play item without a slug", menu({ kind: "play", label: "Again" }), "menu[1].slug:"],
      [
        "a play slug that is not kebab-case",
        menu({ kind: "play", slug: "New", label: "New" }),
        "menu[1].slug:",
      ],
      [
        "a play item without a label",
        menu({ kind: "play", slug: "again", label: "" }),
        "menu[1].label:",
      ],
      [
        "a play mode that is not text",
        menu({ kind: "play", slug: "again", label: "Again", mode: 2 }),
        "menu[1].mode:",
      ],
      [
        "a repeated play slug",
        menu({ kind: "play", slug: "new-game", label: "Again" }),
        "menu[1].slug:",
      ],
      [
        "a choice sharing a play slug",
        menu({ kind: "choice", slug: "new-game", label: "X", options: ["a"], initial: 0 }),
        "menu[1].slug:",
      ],
      [
        "a slug the shell's own entries use",
        menu({ kind: "choice", slug: "top-score", label: "X", options: ["a"], initial: 0 }),
        "menu[1].slug:",
      ],
      [
        "a choice without options",
        menu({ kind: "choice", slug: "c", label: "C", options: [], initial: 0 }),
        "menu[1].options:",
      ],
      [
        "an option that is not text",
        menu({ kind: "choice", slug: "c", label: "C", options: ["a", 2], initial: 0 }),
        "menu[1].options[1]:",
      ],
      [
        "a choice initial past its options",
        menu({ kind: "choice", slug: "c", label: "C", options: ["a", "b"], initial: 2 }),
        "menu[1].initial:",
      ],
      [
        "a fractional choice initial",
        menu({ kind: "choice", slug: "c", label: "C", options: ["a", "b"], initial: 0.5 }),
        "menu[1].initial:",
      ],
      ["an unknown item field", menu({ kind: "top-score", label: "Best" }), "menu[1].label:"],
      ["a second level item", menu({ kind: "level" }, { kind: "level" }), "menu[2].kind:"],
      [
        "a second top-score item",
        menu({ kind: "top-score" }, { kind: "top-score" }),
        "menu[2].kind:",
      ],
      [
        "a second instructions item",
        menu({ kind: "instructions", pages: ["a"] }, { kind: "instructions", pages: ["b"] }),
        "menu[2].kind:",
      ],
      [
        "a level item without levels",
        { ...menu({ kind: "level" }), level: undefined },
        "menu[1].kind:",
      ],
      [
        "a top-score item without scores",
        { ...menu({ kind: "top-score" }), scores: false },
        "menu[1].kind:",
      ],
      ["instructions without pages", menu({ kind: "instructions", pages: [] }), "menu[1].pages:"],
      [
        "an instructions page that is not text",
        menu({ kind: "instructions", pages: ["a", null] }),
        "menu[1].pages[1]:",
      ],
      ["a level that is not an object", manifest({ level: 9 }), "level:"],
      ["a level without max", manifest({ level: { initial: 1 } }), "level.max:"],
      ["a zero level max", manifest({ level: { max: 0, initial: 0 } }), "level.max:"],
      ["a fractional level max", manifest({ level: { max: 2.5, initial: 1 } }), "level.max:"],
      ["a zero initial level", manifest({ level: { max: 9, initial: 0 } }), "level.initial:"],
      ["an initial level past max", manifest({ level: { max: 9, initial: 10 } }), "level.initial:"],
      ["suspend that is not a boolean", manifest({ suspend: 1 }), "suspend:"],
      ["scores that is not a boolean", manifest({ scores: "no" }), "scores:"],
      ["storage over the quota", manifest({ storageBytes: 1025 }), "storageBytes:"],
      ["negative storage", manifest({ storageBytes: -1 }), "storageBytes:"],
      ["fractional storage", manifest({ storageBytes: 0.5 }), "storageBytes:"],
    ];

    it.each(cases)("%s", (_name, value, path) => {
      expect(() => validateManifest(value)).toThrow(`Invalid game manifest: ${path}`);
    });
  });

  it("reads each field once, so a changing object cannot pass and then differ", () => {
    let reads = 0;
    const input = manifest();
    Object.defineProperty(input, "id", {
      enumerable: true,
      get: () => (reads++ === 0 ? "first" : "Second Read"),
    });
    expect(validateManifest(input).id).toBe("first");
  });
});
