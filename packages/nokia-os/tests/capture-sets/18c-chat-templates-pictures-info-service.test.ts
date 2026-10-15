// Plan 18c Task 2: the content capture set on synthetic recordings (no REF).
import { describe, expect, it } from "vite-plus/test";
import { shotImages } from "../../scripts/capture-set.ts";
import { captureSets } from "../../scripts/capture-registry.ts";
import {
  chatAndContent,
  CONTENT_TABLE,
  contentCaptureSet,
  ContentCaptureError,
  PENDING,
  statusOf,
  type ContentRow,
} from "../../scripts/capture-sets/18c-chat-templates-pictures-info-service.ts";
import type { RecordingFrame, TreeCaptureIo } from "../../scripts/tree-capture-set.ts";

/** A recording of `images` (one frame each, 100 ms apart). */
const recording = (...images: string[]): RecordingFrame[] =>
  images.map((image, i) => ({ image, startMs: 1 + 100 * i, durationMs: 100 }));

function io(
  recordings: Readonly<Record<string, RecordingFrame[]>> = {},
  scrolls: Readonly<Record<string, string[]>> = {},
): TreeCaptureIo {
  return {
    recording: (dir) => recordings[dir] ?? recording("a", "a", "b", "c"),
    scrollImages: (dir) => scrolls[dir] ?? ["01", "02", "03"],
  };
}

describe("plan 18c capture set", () => {
  it("registers as plan 18c with its resources", () => {
    expect(captureSets().filter((set) => set.plan === "18c")).toEqual([chatAndContent]);
    expect(chatAndContent.resources).toBeDefined();
  });

  it("lists every row once, each under plan18c/", () => {
    const entries = contentCaptureSet(io());
    const ids = entries.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(CONTENT_TABLE.length);
    for (const entry of entries) {
      const source = entry.prefer.source;
      const paths =
        source.kind === "shots"
          ? shotImages(source.files).map((shot) => shot.file)
          : "dir" in source
            ? [source.dir]
            : [];
      for (const path of paths) expect(path.startsWith("plan18c/"), entry.id).toBe(true);
    }
  });

  it("covers each flow the plan names, and no picture, saver or card golden", () => {
    const ids = contentCaptureSet(io()).map((entry) => entry.id);
    for (const id of [
      "content/templates-list",
      "content/smileys-erase-user",
      "content/editor-template-select",
      "content/restore-templates",
      "chat/send",
      "chat/reply",
      "topics/erase-last",
      "topics/factory-add-ok",
      "service-command/send",
    ]) {
      expect(ids, id).toContain(id);
    }
    expect(ids.filter((id) => /picture|saver|bcard/.test(id))).toEqual([]);
  });

  it("triggers a timeline at its first changed frame", () => {
    const rows: ContentRow[] = [{ kind: "recording", id: "t/one", dir: "x/one", note: "n" }];
    const [entry] = contentCaptureSet(io({ "plan18c/x/one": recording("a", "a", "a", "b") }), rows);
    expect(entry!.kind).toBe("timeline");
    expect(entry!.prefer.triggerFrame).toBe(3);
    expect(entry!.prefer.source).toEqual({ kind: "recording", dir: "plan18c/x/one" });
  });

  it("names shots by the table, and keeps a scroll's screens before its wrap", () => {
    const rows: ContentRow[] = [
      { kind: "shots", id: "s/one", shots: [["x/a", "first"]], note: "n" },
      { kind: "scroll", id: "s/two", dir: "x/list", keep: 2, note: "n" },
    ];
    const [shot, scroll] = contentCaptureSet(
      io({}, { "plan18c/x/list": ["01", "02", "03", "04"] }),
      rows,
    );
    expect(shot!.prefer.source).toEqual({
      kind: "shots",
      files: [{ file: "plan18c/x/a.png", name: "first" }],
    });
    expect(scroll!.prefer.source).toEqual({
      kind: "shots",
      files: ["plan18c/x/list/01.png", "plan18c/x/list/02.png"],
    });
    expect(scroll!.prefer.omitted).toEqual({ "03-04": "past the wrap" });
  });

  it("throws naming the row whose capture is missing or listed twice", () => {
    const missing: TreeCaptureIo = { recording: () => undefined, scrollImages: () => undefined };
    expect(() =>
      contentCaptureSet(missing, [{ kind: "recording", id: "t/x", dir: "x", note: "n" }]),
    ).toThrow(new ContentCaptureError("t/x", "missing capture plan18c/x"));
    const row: ContentRow = { kind: "scroll", id: "t/y", dir: "y", note: "n" };
    expect(() => contentCaptureSet(io(), [row, row])).toThrow(/t\/y: listed twice/);
  });

  it("keeps a golden pending until its scenario is promoted, or on its owner plan", () => {
    for (const [id, plan] of Object.entries(PENDING)) expect(statusOf(id)).toBe(`pending:${plan}`);
    expect(statusOf("not/a-promoted-golden")).toBe("pending:18c");
  });
});
