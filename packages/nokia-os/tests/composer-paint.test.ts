// Plan 27 Task 7: the Composer painter against the editor stills. Each still's model is its case's
// keys through the engine (Task 3) and the layout, the cursor in its shown phase (Task 0 aligned
// every editor still on it).
import { Framebuffer } from "@hellotimber/phone-screen";
import { describe, expect, it } from "vite-plus/test";
import {
  COMPOSER_CASES,
  COMPOSER_SETUPS,
  stillFixtureOf,
} from "../scripts/capture-sets/27-composer.ts";
import { EMPTY_COMPOSER } from "../src/composer/editor";
import { paintWidget } from "../src/display/widgets";
import { composerModel, replayComposerView } from "./support/composer";
import { expectLcd } from "./support/golden.ts";
import { goldenImage } from "./support/goldens.ts";

/** Editor keys of a setup that opens slot 1 (`limit`: fifty notes). */
const editorSetup = (setup: string | undefined): string => {
  if (setup === undefined) return "";
  const keys = COMPOSER_SETUPS[setup]!;
  return keys.slice(keys.lastIndexOf("menu~60 +1440") + "menu~60 +1440".length);
};

/** Editor stills: cases that stay on the editor (no Options, lists or prompts). */
const EDITOR = COMPOSER_CASES.filter(
  (c) =>
    c.from === "editor" &&
    (c.setup === undefined || c.setup === "limit") &&
    /^(entry|limit|cursor|layout)\//.test(c.name),
);

describe("composer painter", () => {
  it("paints every editor still of entry, limit, cursor and layout exactly", () => {
    expect(EDITOR).toHaveLength(225);
    for (const c of EDITOR) {
      const keys = `${editorSetup(c.setup)} ${c.keys}`;
      const { state, top } = replayComposerView(EMPTY_COMPOSER, keys);
      const fb = new Framebuffer();
      paintWidget(fb, composerModel(state, top));
      const { id, image } = stillFixtureOf(c.name);
      expectLcd(fb, goldenImage(id, image), `${c.name}: ${keys}`);
    }
  });

  it("hides the cursor in its other phase and throws on a fourth line", () => {
    const { state, top } = replayComposerView(EMPTY_COMPOSER, "1 2 3");
    const fb = new Framebuffer();
    paintWidget(fb, { ...composerModel(state, top), cursor: null });
    expect(fb.pixels.filter((p, i) => p === 1 && i % 84 === 59 && i > 84 * 7).length).toBe(0);
    expect(() =>
      paintWidget(new Framebuffer(), { ...composerModel(state, top), lines: ["a", "b", "c", "d"] }),
    ).toThrow(/3 lines/);
  });
});
