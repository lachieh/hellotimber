// Plan 15 Task 6: the masked code entry (D7, Task 0 A2/A5) and the stock code-entry widget.
import { Framebuffer } from "@hellotimber/phone-screen";
import { describe, expect, it } from "vite-plus/test";
import { paintWidget, type PromptModel } from "../src/display/widgets";
import { StockEeprom } from "../src/firmware/eeprom";
import { StockSecurity } from "../src/firmware/security";
import { createStockSettings } from "../src/firmware/settings";
import { createMemoryStorage } from "../src/index";
import type { Flow } from "../src/widgets/flow";
import { codeEntry } from "../src/widgets/code-entry";
import { expectLcd } from "./support/golden.ts";
import { expectFlowTimeline, flowRig, recordFlow, type FlowRig } from "./support/flow-rig.ts";
import { goldenImage, loadGolden } from "./support/goldens.ts";

const LINES = ["Security", "code:"] as const;

function masked(digits: number): PromptModel {
  return {
    kind: "prompt",
    icons: ["prompt/pen"],
    label: LINES,
    entry: { kind: "mask", digits },
    cursor: false,
    softkey: "OK",
  };
}

describe("the prompt painter's mask entry", () => {
  const cases: readonly (readonly [string, string, number])[] = [
    ["probe/code-keys-6-4", "01-prompt", 0],
    ["probe/code-keys-6-4", "02-after-12", 2],
    ["probe/code-keys-6-4", "03-after-c", 1],
    ["probe/code-keys-6-4", "09-typed-123", 3],
    ...([5, 6, 7, 8, 9, 10] as const).map(
      (n) =>
        ["probe/code-keys-6-4", `${11 + n - 4}-digits-${String(n).padStart(2, "0")}`, n] as const,
    ),
    ["probe/code-keys-6-4", "18-digits-11", 10],
    ["boot/security-gate-keys", "00-prompt", 0],
    ["boot/security-gate-keys", "01-after-1", 1],
    ["boot/security-gate-keys", "02-after-2", 2],
    ...([5, 6, 7, 8, 9, 10] as const).map(
      (n) =>
        [
          "boot/security-gate-keys",
          `${String(n + 2).padStart(2, "0")}-digits-${String(n).padStart(2, "0")}`,
          n,
        ] as const,
    ),
    ["boot/security-gate-keys", "15-typed-123", 3],
  ];
  for (const [id, image, digits] of cases) {
    it(`${id} ${image}: ${digits} digits`, () => {
      const fb = new Framebuffer();
      paintWidget(fb, masked(digits));
      expectLcd(fb, goldenImage(id, image), `${digits} masked digits`);
    });
  }
});

function security(): StockSecurity {
  const eeprom = new StockEeprom(createMemoryStorage());
  return new StockSecurity(eeprom, createStockSettings(eeprom));
}

function entryRig(options: { onEmptyC?: "back" | "inert"; accepted?: (flow: Flow) => void } = {}) {
  return flowRig(() =>
    codeEntry({
      lines: LINES,
      softkey: "OK",
      security: security(),
      accepted: options.accepted ?? (() => {}),
      ...(options.onEmptyC === undefined ? {} : { onEmptyC: options.onEmptyC }),
    }),
  );
}

function type(rig: FlowRig, digits: string): void {
  for (const digit of digits) rig.press(digit as "0");
}

const KEYS = "probe/code-keys-6-4";
const shows = (rig: FlowRig, image: string) =>
  expectLcd({ pixels: rig.frame() }, goldenImage(KEYS, image), image);

describe("codeEntry (D7)", () => {
  it("masks each digit, C deletes the last, C on the empty entry goes back (menus)", () => {
    const rig = entryRig();
    shows(rig, "01-prompt");
    type(rig, "12");
    shows(rig, "02-after-12");
    rig.press("c");
    shows(rig, "03-after-c");
    rig.press("c");
    shows(rig, "04-after-c-to-empty");
    expect(rig.exits).toEqual([]);
    rig.press("c");
    expect(rig.exits).toEqual([{ atMs: 0, options: undefined }]);
  });

  it("does nothing for C on the empty entry at the boot gate (A2)", () => {
    const rig = entryRig({ onEmptyC: "inert" });
    rig.press("c");
    rig.advance(2000);
    expect(rig.exits).toEqual([]);
    expectLcd(
      { pixels: rig.frame() },
      goldenImage("boot/security-gate-keys", "06-after-c-on-empty-2s"),
      "C",
    );
  });

  it("takes 10 digits at most: the 11th key is ignored", () => {
    const rig = entryRig();
    type(rig, "12345678901");
    shows(rig, "18-digits-11");
  });

  it("clears the entry when C is held 1 s, and the release does nothing more", () => {
    const rig = entryRig();
    type(rig, "1234567890");
    rig.session.onKey({ type: "down", key: "c" });
    rig.advance(999);
    shows(rig, "17-digits-10");
    rig.advance(1);
    shows(rig, "19-after-hold-c-1s");
    rig.session.onKey({ type: "up", key: "c" });
    expect(rig.exits).toEqual([]);
    shows(rig, "19-after-hold-c-1s");
  });

  it("C released before 1 s deletes one digit", () => {
    const rig = entryRig();
    type(rig, "12");
    rig.session.onKey({ type: "down", key: "c" });
    rig.advance(500);
    rig.session.onKey({ type: "up", key: "c" });
    shows(rig, "03-after-c");
  });

  it("OK on the empty entry: Code error, then the empty prompt (probe/code-keys-6-4-ok-empty)", () => {
    const rig = entryRig();
    rig.press("navi");
    const golden = loadGolden("probe/code-keys-6-4-ok-empty");
    expectFlowTimeline(recordFlow(rig, 4000), golden, { returns: false });
  });

  it("OK with too few digits: Code error, then the empty prompt (probe/code-keys-6-4-ok-123)", () => {
    const rig = entryRig();
    type(rig, "123");
    rig.press("navi");
    const golden = loadGolden("probe/code-keys-6-4-ok-123");
    expectFlowTimeline(recordFlow(rig, 4000), golden, { returns: false });
  });

  it("calls accepted with the flow on the stored code, and shows no Code error", () => {
    const accepted: Flow[] = [];
    const rig = entryRig({ accepted: (flow) => void accepted.push(flow) });
    type(rig, "12345");
    rig.press("navi");
    expect(accepted).toHaveLength(1);
    shows(rig, "12-digits-05");
  });
});
