import { Framebuffer } from "@hellotimber/phone-screen";
import type { PhoneKey } from "@hellotimber/phone-core";
import { describe, expect, it } from "vite-plus/test";
import { paintWidget } from "../src/display/widgets";
import { TEXT_TIMINGS } from "../src/resources";
import { editor, editorModel, smsCounter, type EditorControl } from "../src/widgets/editor";
import { expectLcd } from "./support/golden";
import { flowRig, recordFlow, expectFlowTimeline, type FlowRig } from "./support/flow-rig";
import { loadGolden } from "./support/goldens";
import {
  replayTrace,
  TEXT_TRACES,
  WELCOME_LIMIT,
  WELCOME_TRACES,
  type TextTrace,
} from "./support/messages";

const SMS = { counter: "sms", limit: 459, layout: "sms", softkey: "Options" } as const;
const WELCOME = {
  counter: "count",
  limit: WELCOME_LIMIT,
  layout: "welcome",
  softkey: "Options",
} as const;

/** The golden shows a cursor: a lit bar on a text line's first row and on the row below it. */
function cursorLit(pixels: Uint8Array): boolean {
  for (const [top, height] of [
    [7, 10],
    [17, 10],
    [27, 10],
    [21, 15],
    [16, 10],
    [25, 10],
  ] as const) {
    for (let x = 0; x < 84; x++) {
      let bar = true;
      for (let y = top; y < top + height && bar; y++) bar = pixels[y * 84 + x] === 1;
      if (bar && pixels[(top - 1) * 84 + x] === 0) return true;
    }
  }
  return false;
}

function byGolden(traces: Readonly<Record<string, TextTrace>>): Map<string, TextTrace[]> {
  const out = new Map<string, TextTrace[]>();
  for (const [id, trace] of Object.entries(traces)) {
    const golden = id.split("#")[0]!;
    out.set(golden, [...(out.get(golden) ?? []), trace]);
  }
  return out;
}

describe("paintEditor: every traced editor still, header to soft key", () => {
  for (const [traces, spec, limit] of [
    [TEXT_TRACES, SMS, 459],
    [WELCOME_TRACES, WELCOME, WELCOME_LIMIT],
  ] as const) {
    for (const [id, list] of byGolden(traces)) {
      it(id, () => {
        const golden = loadGolden(id);
        const seen = new Set<string>();
        for (const trace of list) {
          let top = 0;
          for (const shot of replayTrace(trace, limit)) {
            const image = golden.images.find((i) => i.name === shot.image);
            const shown = editorModel(
              shot.state,
              spec,
              top,
              image ? cursorLit(image.pixels) : true,
            );
            top = shown.top;
            if (image === undefined) continue;
            seen.add(image.name);
            const fb = new Framebuffer();
            paintWidget(fb, shown.model);
            expectLcd(fb, { id, image }, `${id} ${image.name} "${shot.state.text}"`);
          }
        }
        expect([...seen].sort()).toEqual(golden.images.map((i) => i.name).sort());
      });
    }
  }
});

describe("smsCounter", () => {
  it("counts characters left and parts: 160 in one, then 153 per part (text/counter)", () => {
    expect(smsCounter(0, 459)).toBe("459/1");
    expect([155, 160, 161, 306, 307, 459].map((n) => smsCounter(n, 459))).toEqual([
      "304/1",
      "299/1",
      "298/2",
      "153/2",
      "152/3",
      "0/3",
    ]);
  });
});

/** Key down at the rig's time; key up after `holdMs` of ticks. */
function hold(rig: FlowRig, key: PhoneKey, holdMs: number): void {
  rig.session.onKey({ type: "down", key });
  rig.advance(holdMs);
  rig.session.onKey({ type: "up", key });
}

function smsEditor(options: Partial<Parameters<typeof editor>[0]> = {}) {
  return () => editor({ ...SMS, options: () => {}, ...options });
}

describe("the editor widget against its timeline goldens (±2 ms, aligned on the blink)", () => {
  it("text/commit: the pending A, its commit 1452 ms later, then the blink", () => {
    const rig = flowRig(smsEditor());
    // The capture's blink turns 12 ms after the key's redraw (its commit is a turn later).
    rig.advance(468);
    rig.press("2");
    expectFlowTimeline(recordFlow(rig, 3000), loadGolden("text/commit"), { returns: false });
  });

  it("text/delete-hold: C deletes, then clears 478 ms after the deletion", () => {
    const rig = flowRig(smsEditor({ text: "Hello" }));
    rig.advance(184);
    rig.session.onKey({ type: "down", key: "c" });
    const recording = recordFlow(rig, 3800);
    expectFlowTimeline(recording, loadGolden("text/delete-hold"), { returns: false });
  });

  it("text/blink: Hi's cursor every 480 ms", () => {
    const rig = flowRig(smsEditor({ text: "Hi" }));
    rig.advance(480);
    expectFlowTimeline(recordFlow(rig, 4500), loadGolden("text/blink"), { returns: false });
  });
});

describe("the editor widget's keys", () => {
  /** The text the Options see. */
  const text = (rig: FlowRig): string => {
    rig.press("navi");
    return captured.pop()!.text;
  };
  const captured: EditorControl[] = [];
  const spy = () => smsEditor({ options: (_flow, control) => void captured.push(control) });

  it("opens the Options with the text, its pending character committed", () => {
    const rig = flowRig(spy());
    rig.press("4");
    rig.press("4");
    expect(text(rig)).toBe("H");
  });

  it("goes back on C when the text is empty", () => {
    const rig = flowRig(smsEditor());
    rig.session.onKey({ type: "down", key: "c" });
    expect(rig.exits).toHaveLength(1);
  });

  it("changes the case on a tapped # (on release) and enters 123 on a held one", () => {
    const tapped = flowRig(spy());
    tapped.press("#");
    tapped.press("2");
    expect(text(tapped)).toBe("A");
    const held = flowRig(spy());
    hold(held, "#", TEXT_TIMINGS.numberModeHoldMs + 10);
    held.press("2");
    held.press("3");
    expect(text(held)).toBe("23");
  });

  it("types a held digit's digit at the commit, a shorter hold's letter", () => {
    const long = flowRig(spy());
    hold(long, "2", TEXT_TIMINGS.digitHoldMs);
    long.advance(TEXT_TIMINGS.commitMs);
    expect(text(long)).toBe("2");
    const short = flowRig(spy());
    hold(short, "2", TEXT_TIMINGS.digitHoldMs - 25);
    short.advance(TEXT_TIMINGS.commitMs);
    expect(text(short)).toBe("A");
  });

  it("moves with ▲/▼ and deletes left of the cursor", () => {
    const rig = flowRig(spy());
    for (const key of ["4", "4"] as const) rig.press(key);
    rig.advance(TEXT_TIMINGS.commitMs);
    rig.press("3");
    rig.press("3");
    rig.press("down");
    rig.session.onKey({ type: "down", key: "c" });
    rig.session.onKey({ type: "up", key: "c" });
    expect(text(rig)).toBe("e");
  });

  it("calls the symbol table on *, which may insert", () => {
    const rig = flowRig(
      smsEditor({
        symbols: (_flow, control) => control.insert("€"),
        options: (_flow, control) => void captured.push(control),
      }),
    );
    rig.press("*");
    expect(text(rig)).toBe("€");
  });
});
