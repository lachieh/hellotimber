import { describe, expect, it } from "vite-plus/test";
import {
  CYCLE_LENGTHS,
  glyphEntries,
  MESSAGES_STATUS,
  manifestNote,
  messagesCaptureSet,
  MessagesCaptureError,
  parseManifestNote,
  recordingEntry,
  type GlyphFace,
  type GlyphShot,
  type MessagesCaptureIo,
} from "../scripts/messages-capture-set.ts";
import type { RecordingFrame } from "../scripts/tree-capture-set.ts";

/** Frames showing `images` in order, 100 ms each. */
function frames(...images: string[]): RecordingFrame[] {
  return images.map((image, i) => ({ image, startMs: i * 100, durationMs: 100 }));
}

const SMALL: GlyphShot[] = [
  { file: "001.png", face: "small", char: ".", source: "multitap", mode: "upper", key: "1" },
  { file: "002.png", face: "small", char: "A", source: "multitap", mode: "upper", key: "2" },
  { file: "003.png", face: "small", char: ".", source: "multitap", mode: "lower", key: "1" },
  { file: "004.png", face: "small", char: ".", source: "symbols", dup_of: "001.png" },
  { file: "005.png", face: "small", char: "¥", source: "symbols" },
  { file: "006.png", face: "small", char: "$", source: "symbols" },
  { file: "007.png", face: "small", char: "$", source: "multitap", mode: "upper", key: "7" },
];

/** A capture corpus where every recording changes at frame 2 and every directory has 3 shots. */
function io(overrides: Partial<MessagesCaptureIo> = {}): MessagesCaptureIo {
  return {
    recording: () => frames("parent", "parent", "next", "next", "end"),
    scrollImages(dir) {
      const key = /text\/keys\/(\d)\/(upper|lower)$/.exec(dir);
      const count = key
        ? 2 * CYCLE_LENGTHS[key[2] as "upper" | "lower"][key[1]!]! + 1
        : dir.endsWith("symbols/up")
          ? 31
          : 3;
      return Array.from({ length: count }, (_, i) => String(i + 1).padStart(2, "0"));
    },
    manifest(face: GlyphFace) {
      if (face === "digits") return [{ file: "001.png", face, char: "Abc" }];
      return SMALL.map((shot) => ({ ...shot, face }));
    },
    ...overrides,
  };
}

describe("messagesCaptureSet", () => {
  const entries = messagesCaptureSet(io());
  const byId = new Map(entries.map((entry) => [entry.id, entry]));

  it("lists every fixture once, pending on plan 18 until its scenario exists", () => {
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
    expect(entries.every((e) => e.status === MESSAGES_STATUS)).toBe(true);
    expect(MESSAGES_STATUS).toBe("pending:18");
    for (const e of entries) expect(e.id).toMatch(/^(text|welcome|sms|glyphs)\/[a-z0-9-]+$/);
  });

  it("keeps the first cycle of every key in ABC and abc and omits the repeat", () => {
    for (const mode of ["upper", "lower"] as const) {
      for (const key of "1234567890") {
        const entry = byId.get(`text/key-${key}-${mode}`)!;
        const length = CYCLE_LENGTHS[mode][key]!;
        expect(entry.kind).toBe("still");
        const pad = (n: number) => String(n).padStart(2, "0");
        expect(entry.prefer.source).toEqual({
          kind: "shots",
          files: Array.from(
            { length },
            (_, i) => `plan18/text/keys/${key}/${mode}/${pad(i + 1)}.png`,
          ),
        });
        expect(Object.keys(entry.prefer.omitted!)).toEqual([
          `${pad(length + 1)}-${pad(2 * length + 1)}`,
        ]);
      }
    }
    expect(CYCLE_LENGTHS.lower["7"]).toBe(CYCLE_LENGTHS.upper["7"]! + 1); // ß
    expect(CYCLE_LENGTHS.lower["1"]).toBe(8); // . , ' ? ! - & 1
  });

  it("triggers every timeline on its recording's first changed frame (plan 14 D8)", () => {
    const timelines = entries.filter((e) => e.kind === "timeline");
    expect(timelines.length).toBeGreaterThan(50);
    for (const e of timelines) expect(e.prefer.triggerFrame, e.id).toBe(2);
    expect(byId.get("text/dictionary-off")!.prefer.source).toEqual({
      kind: "recording",
      dir: "plan18/text/dictionary-off",
    });
    expect(byId.get("welcome/plan15-erase")!.prefer.source).toEqual({
      kind: "recording",
      dir: "plan15/welcome/erase",
    });
  });

  it("names stills after their shots and keeps a single symbols-up shot (the wrap)", () => {
    const editor = byId.get("text/editor")!;
    expect(editor.prefer.source).toEqual({
      kind: "shots",
      files: [
        "plan18/text/editor-multitap.png",
        "plan18/text/editor-reopened.png",
        "plan18/text/dictionary-list-off.png",
      ],
    });
    expect(byId.get("text/symbols-up")!.prefer.omitted).toEqual({
      "02-31": "the cells of text/symbols-down in reverse order: identical pixels as verified",
    });
    expect(byId.get("text/options")!.prefer.source).toEqual({
      kind: "scroll",
      dir: "plan18/text/options-empty",
    });
  });

  it("fails clearly when a recording is missing", () => {
    expect(() => messagesCaptureSet(io({ recording: () => undefined }))).toThrow(
      /missing capture plan18\//,
    );
  });
});

describe("recordingEntry", () => {
  const corpus = io({ recording: () => frames("a", "b", "b", "c", "d", "e") });

  it("cuts a recording at `to`, omitting the rest with the reason", () => {
    const entry = recordingEntry(corpus, {
      id: "sms/x",
      dir: "sms/x",
      to: 3,
      cutReason: "after the note",
      note: "n",
    });
    expect(entry.prefer.source).toEqual({
      kind: "composite",
      parts: [{ dir: "plan18/sms/x", from: 0, to: 3 }],
    });
    expect(entry.prefer.omitted).toEqual({ "004-005": "after the note" });
    expect(entry.prefer.triggerFrame).toBe(1);
  });

  it("rejects a cut outside the recording or without its reason", () => {
    expect(() =>
      recordingEntry(corpus, { id: "sms/x", dir: "sms/x", to: 5, cutReason: "r", note: "n" }),
    ).toThrow(MessagesCaptureError);
    expect(() => recordingEntry(corpus, { id: "sms/x", dir: "sms/x", to: 2, note: "n" })).toThrow(
      /needs both/,
    );
    expect(() =>
      recordingEntry(corpus, { id: "sms/x", dir: "sms/x", to: 2, cutReason: "a (b)", note: "n" }),
    ).toThrow(/comma or parenthesis/);
  });

  it("uses frame 0 as the trigger of a recording that never changes", () => {
    const still = io({ recording: () => frames("a", "a") });
    expect(
      recordingEntry(still, { id: "sms/x", dir: "sms/x", note: "n" }).prefer.triggerFrame,
    ).toBe(0);
  });
});

describe("glyph sheets", () => {
  const sheets = new Map(glyphEntries(io()).map((entry) => [entry.id, entry]));
  const files = (id: string): readonly string[] => {
    const source = sheets.get(id)!.prefer.source;
    if (source.kind !== "shots") throw new Error(`${id} is not shots`);
    return source.files;
  };

  it("keeps one large shot per character, the first", () => {
    expect(files("glyphs/large")).toEqual([
      "plan18/glyphs/large/001.png",
      "plan18/glyphs/large/002.png",
      "plan18/glyphs/large/005.png",
      "plan18/glyphs/large/006.png",
    ]);
    expect(parseManifestNote(sheets.get("glyphs/large")!.prefer.note)).toEqual([
      ".",
      "A",
      "¥",
      "$",
    ]);
  });

  it("keeps the small shots only the symbol table types (multi-tap ones are text/key-*)", () => {
    expect(files("glyphs/small")).toEqual(["plan18/glyphs/small/005.png"]);
    expect(parseManifestNote(sheets.get("glyphs/small")!.prefer.note)).toEqual(["¥"]);
  });

  it("keeps every header specimen with its label", () => {
    expect(files("glyphs/digits")).toEqual(["plan18/glyphs/digits/001.png"]);
    expect(parseManifestNote(sheets.get("glyphs/digits")!.prefer.note)).toEqual(["Abc"]);
  });

  it("rejects a missing manifest or a shot of another face", () => {
    expect(() => glyphEntries(io({ manifest: () => undefined }))).toThrow(/manifest\.json/);
    expect(() =>
      glyphEntries(io({ manifest: () => [{ file: "001.png", face: "large", char: "A" }] })),
    ).toThrow(/bad manifest entry/);
  });
});

describe("manifest notes", () => {
  it("round-trips characters, including the space and quotes", () => {
    const chars = [" ", '"', "'", "\\", "€"];
    expect(parseManifestNote(manifestNote("Glyph sheet", chars))).toEqual(chars);
    expect(manifestNote("x", ["a"])).not.toContain("\n");
  });

  it("reads no manifest from a note without one", () => {
    expect(parseManifestNote("A note.")).toBeUndefined();
    expect(parseManifestNote(undefined)).toBeUndefined();
  });
});
