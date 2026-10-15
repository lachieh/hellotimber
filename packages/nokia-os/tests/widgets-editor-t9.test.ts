// Plan 18b Task 6: the SMS editor in T9 mode against the T9 goldens that stay in the editor,
// driven key by key from each golden's note (tests/support/t9.ts) with the shipped English
// dictionary (the goldens' key sequences are ones the open list shares with the firmware, D9).
// Stills compare either cursor-blink phase; the idle recording compares its blink (±2 ms).
import { describe, expect, it } from "vite-plus/test";
import { readPlanIndex } from "../scripts/golden-index.ts";
import { englishT9 } from "../src/text/t9/english";
import type { T9Context } from "../src/text/t9/editing";
import { editor } from "../src/widgets/editor";
import { GOLDENS } from "./support/acceptance.ts";
import { flowRig } from "./support/flow-rig.ts";
import { loadGolden } from "./support/goldens.ts";
import {
  expectT9Still,
  expectT9Timeline,
  parseT9Note,
  playT9,
  T9_KNOWN_GAPS,
  T9_TOLERANCES,
  type T9Recording,
  type T9Target,
} from "./support/t9.ts";

const CONTEXT: T9Context = { dictionary: englishT9, user: [] };

/** The scenarios that never leave the editor (Options, prompts and the menu are Task 7's). */
const EDITOR_SCENARIOS = [
  "g-compose",
  "single",
  "punct-alone",
  "g-punct-word",
  "apostrophe",
  "g-nomatch3",
  "g-nomatch2",
  "g-nomatch1",
  "g-nomatch-keys",
  "g-case",
  "g-case-upper",
  "case-word",
  "digits",
  "g-delete",
  "g-delete-across",
  "g-cursor-down",
  "g-cursor-up",
  "g-cursor-reenter",
  "g-cursor-insert",
  "g-star-free",
];

/** The last C of `g-delete` leaves the editor for the Messages list (the phone's, Task 8). */
const LEAVES_THE_EDITOR = new Set(["t9/g-delete/06-c5"]);

function editorTarget(): T9Target {
  const rig = flowRig(() =>
    editor({
      counter: "sms",
      limit: 459,
      layout: "sms",
      softkey: "Options",
      options: () => {},
      t9: () => CONTEXT,
    }),
  );
  return {
    down: (key) => rig.session.onKey({ type: "down", key }),
    up: (key) => rig.session.onKey({ type: "up", key }),
    advance: (ms) => rig.advance(ms),
    frame: () => rig.frame(),
  };
}

const IDS = readPlanIndex(GOLDENS, "18b")
  .map((entry) => entry.id)
  .filter((id) => EDITOR_SCENARIOS.includes(id.split("/")[1]!) && !LEAVES_THE_EDITOR.has(id));

describe("the T9 editor against its goldens", () => {
  it("covers every editor scenario", () => {
    expect(new Set(IDS.map((id) => id.split("/")[1]))).toEqual(new Set(EDITOR_SCENARIOS));
  });

  for (const id of IDS) {
    const gap = T9_KNOWN_GAPS[id];
    (gap === undefined ? it : it.fails)(
      gap === undefined ? id : `${id} (known gap: ${gap})`,
      () => {
        const golden = loadGolden(id);
        const { base, steps } = parseT9Note(golden.note ?? "");
        expect(base).toBe("editor");
        const target = editorTarget();
        let recording: T9Recording | undefined;
        let keyed = false;
        playT9(target, steps, (recorded, step) => {
          recording = recorded;
          keyed = step.kind === "record" && step.key !== undefined;
        });
        const context = `${id}: ${golden.note}`;
        if (golden.timeline === undefined) expectT9Still(target, golden, context);
        else
          expectT9Timeline(recording!, golden, context, { keyed, toleranceMs: T9_TOLERANCES[id] });
      },
    );
  }
});
