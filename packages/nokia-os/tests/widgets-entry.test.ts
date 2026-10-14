import { Framebuffer } from "@hellotimber/phone-screen";
import type { PhoneKey } from "@hellotimber/phone-core";
import { describe, expect, it } from "vite-plus/test";
import { paintWidget, type PromptModel, type WidgetModel } from "../src/display/widgets";
import { TEXT_TIMINGS } from "../src/resources";
import { SYMBOLS } from "../src/text/keys";
import { editor } from "../src/widgets/editor";
import { numberEntry, DIAL_CYCLE } from "../src/widgets/number-entry";
import { symbolTable } from "../src/widgets/symbol-table";
import { textInput } from "../src/widgets/text-input";
import { flowRig, type FlowRig } from "./support/flow-rig";
import { lcdMismatch } from "./support/golden";
import { loadGolden } from "./support/goldens";

function paint(model: WidgetModel): Uint8Array {
  const fb = new Framebuffer();
  paintWidget(fb, model);
  return fb.pixels;
}

/** `models` (the cursor shown and hidden, say) paint the golden image, one of them exactly. */
function expectOneOf(id: string, image: string, models: readonly WidgetModel[]): void {
  const golden = loadGolden(id).images.find((i) => i.name === image);
  if (golden === undefined) throw new Error(`${id} has no image ${image}`);
  const ref = { id, image: golden };
  const mismatches = models.map((model) => lcdMismatch(paint(model), ref, `${id} ${image}`));
  if (mismatches.every((m) => m !== undefined)) throw new Error(mismatches[0]);
}

/** Key down and up, with `holdMs` of ticks between. */
function tap(rig: FlowRig, key: PhoneKey, holdMs = 0): void {
  rig.session.onKey({ type: "down", key });
  rig.advance(holdMs);
  rig.session.onKey({ type: "up", key });
}

describe("symbol table", () => {
  it("paints every cell selected (text/symbols-down: ▼ retreats from the first cell)", () => {
    for (let i = 1; i <= 31; i++) {
      expectOneOf("text/symbols-down", String(i).padStart(2, "0"), [
        { kind: "symbols", selected: (31 - i) % 31 },
      ]);
    }
    expectOneOf("text/symbols-up", "01", [{ kind: "symbols", selected: 1 }]);
  });

  it("opens on the first cell, also from a pending character (text/symbols)", () => {
    for (const image of ["00", "after-pending", "use-first-before"])
      expectOneOf("text/symbols", image, [{ kind: "symbols", selected: 0 }]);
    expectOneOf("text/symbols", "use-middle-before", [{ kind: "symbols", selected: 16 }]);
    expectOneOf("text/symbols", "use-last-before", [{ kind: "symbols", selected: 30 }]);
  });

  it("moves with ▲/▼ and wraps; Use inserts the symbol and closes; C closes", () => {
    const inserted: string[] = [];
    const rig = flowRig(() => symbolTable((symbol) => inserted.push(symbol)));
    const selected = (): number => {
      const screen = rig.session.render();
      const fb = new Framebuffer();
      for (let k = 0; k < SYMBOLS.length; k++) {
        fb.pixels.set(paint({ kind: "symbols", selected: k }));
        if (screen.kind === "custom" && fb.pixels.every((p, i) => p === screen.frame.pixels[i]))
          return k;
      }
      return -1;
    };
    expect(selected()).toBe(0);
    rig.press("down");
    expect(selected()).toBe(30);
    rig.press("up");
    rig.press("up");
    expect(selected()).toBe(1);
    rig.press("navi");
    expect(inserted).toEqual([","]);
    expect(rig.exits).toHaveLength(1);
    const cancelled = flowRig(() => symbolTable((symbol) => inserted.push(symbol)));
    cancelled.press("c");
    expect(cancelled.exits).toHaveLength(1);
    expect(inserted).toEqual([","]);
  });

  it("opens from the editor's *, and Use inserts at its cursor", () => {
    const texts: string[] = [];
    const rig = flowRig(() =>
      editor({
        counter: "sms",
        limit: 459,
        layout: "sms",
        softkey: "Options",
        text: "Hi",
        options: (_flow, control) => void texts.push(control.text),
      }),
    );
    tap(rig, "*");
    rig.press("down");
    rig.press("navi"); // Use: ¥, back to the editor
    rig.press("navi"); // the editor's Options
    expect(texts).toEqual(["Hi¥"]);
  });
});

describe("number entry: the Phone number prompt (text/number)", () => {
  const LABEL = ["Phone number:"];

  /** The prompt with `text`, the cursor before `cursor` (undefined while pending), both blinks. */
  function models(text: string, cursor: number | undefined, counter: number): PromptModel[] {
    return [true, false].map((shown) => ({
      kind: "prompt",
      icons: ["prompt/pen"],
      counter: String(counter),
      label: LABEL,
      entry: { kind: "number", text, ...(cursor === undefined ? {} : { cursor }) },
      cursor: shown,
      softkey: text === "" ? "Search" : "OK",
    }));
  }
  const digits = (n: number): string =>
    Array.from({ length: n }, (_, i) => String((i + 1) % 10)).join("");

  it("paints the empty prompt and one to ten digits in large", () => {
    expectOneOf("text/number", "00", models("", 0, 30));
    for (let n = 1; n <= 10; n++) {
      expectOneOf(
        "text/number",
        `digits-${String(n).padStart(2, "0")}`,
        models(digits(n), n, 30 - n),
      );
    }
    expectOneOf("sms/send-prompt", "1-prompt", models("", 0, 30));
  });

  it("paints longer numbers in small rows from the end, the label going at three rows", () => {
    for (const n of [11, 12, 13, 14, 19, 20, 21, 22, 26, 27, 28, 29, 30]) {
      expectOneOf("text/number", `len-${n}`, models(digits(n), n, 30 - n));
    }
    expectOneOf("text/number", "len-31", models(digits(30), 30, 0));
    expectOneOf("text/number", "len-32", models(digits(30), 30, 0));
  });

  it("paints the cursor where ▲ and ▼ put it, wrapping (12345, up-1..6, down-1, -2)", () => {
    expectOneOf("text/number", "12345", models("12345", 5, 25));
    [0, 1, 2, 3, 4, 5].forEach((cursor, i) =>
      expectOneOf("text/number", `up-${i + 1}`, models("12345", cursor, 25)),
    );
    expectOneOf("text/number", "down-1", models("12345", 4, 25));
    expectOneOf("text/number", "down-2", models("12345", 3, 25));
    expectOneOf("text/number", "after-moves-9", models("123459", 6, 24));
    expectOneOf("text/number", "c", models("12345", 5, 25));
  });

  it("paints * + p w pending, + taking no digit, and # (star-1..4, hash)", () => {
    DIAL_CYCLE.forEach((char, i) =>
      expectOneOf("text/number", `star-${i + 1}`, models(char, undefined, char === "+" ? 30 : 29)),
    );
    expectOneOf("text/number", "star-after-settle", models("w*", undefined, 28));
    expectOneOf("text/number", "hash", models("1#", 2, 28));
    expectOneOf("text/number", "hash-2", models("1##", 3, 27));
  });

  function entryRig(done: string[] = []) {
    return flowRig(() => numberEntry({ label: LABEL, done: (number) => void done.push(number) }));
  }
  it("types digits and #, cycles * and commits it, and stops at 30 digits", () => {
    const done: string[] = [];
    const rig = entryRig(done);
    for (const key of ["0", "4", "#"] as const) tap(rig, key);
    tap(rig, "*");
    tap(rig, "*");
    rig.advance(TEXT_TIMINGS.commitMs);
    tap(rig, "*");
    tap(rig, "navi");
    expect(done).toEqual(["04#+*"]);
    const full = entryRig(done);
    for (let i = 0; i < 31; i++) tap(full, "1");
    tap(full, "navi");
    expect(done.at(-1)).toBe("1".repeat(30));
  });

  it("moves with ▲/▼ (wrapping), deletes with C, clears with held C, goes back on empty C", () => {
    const done: string[] = [];
    const rig = entryRig(done);
    for (const key of ["1", "2", "3"] as const) tap(rig, key);
    tap(rig, "up"); // to the start
    tap(rig, "9");
    tap(rig, "down"); // 9|123 → |9123
    tap(rig, "down"); // wraps to the end
    tap(rig, "c");
    tap(rig, "navi");
    expect(done).toEqual(["912"]);
    tap(rig, "c", TEXT_TIMINGS.clearAfterDeleteMs + 10);
    expect(rig.exits).toHaveLength(0);
    tap(rig, "c");
    expect(rig.exits).toHaveLength(1);
  });

  it("answers Search on the empty entry with No phone numbers, then the prompt", () => {
    const rig = entryRig();
    const empty = rig.frame().slice();
    tap(rig, "navi");
    const note = rig.frame();
    expect(note.every((p, i) => p === empty[i])).toBe(false);
    rig.advance(3000);
    expect(rig.exits).toHaveLength(0);
    const after = loadGolden("text/number-search-empty");
    const mismatch = lcdMismatch(
      note,
      { id: after.id, image: after.images.find((i) => i.name === "b")! },
      "the note",
    );
    expect(mismatch).toBeUndefined();
  });
});

describe("text input: Routing address (text/input)", () => {
  const LABEL = ["Routing address:"];

  function models(text: string, cursor: number | undefined, mode: string): PromptModel[] {
    return [true, false].map((shown) => ({
      kind: "prompt",
      icons: ["prompt/pen", mode],
      label: LABEL,
      entry: { kind: "text", text, ...(cursor === undefined ? {} : { cursor }) },
      cursor: shown,
      softkey: "OK",
    }));
  }

  it("paints the empty prompt in ABC, a pending A, AEI, and AEIj after # (routing-*)", () => {
    expectOneOf("text/input", "routing-00", models("", 0, "editor/mode-upper"));
    expectOneOf("text/input", "routing-01", models("A", undefined, "editor/mode-upper"));
    expectOneOf("text/input", "routing-typed", models("AEI", 3, "editor/mode-upper"));
    expectOneOf("text/input", "routing-case", models("AEIj", 4, "prompt/abc-lower"));
  });

  it("types with multi-tap in its mode, OK giving the text, C on empty going back", () => {
    const done: string[] = [];
    const rig = flowRig(() =>
      textInput({ label: LABEL, limit: 20, mode: "ABC", done: (text) => void done.push(text) }),
    );
    tap(rig, "2");
    rig.advance(TEXT_TIMINGS.commitMs);
    tap(rig, "3");
    tap(rig, "3");
    tap(rig, "#");
    tap(rig, "5");
    tap(rig, "navi");
    expect(done).toEqual(["AEj"]);
    const back = flowRig(() => textInput({ label: LABEL, limit: 20, done: () => {} }));
    tap(back, "c");
    expect(back.exits).toHaveLength(1);
  });
});
