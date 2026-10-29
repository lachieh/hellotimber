import { Framebuffer } from "@hellotimber/phone-screen";
import { describe, expect, it } from "vite-plus/test";
import {
  expireSpaceImpactShield,
  newSpaceImpactGame,
  spaceImpactKey,
  spaceImpactRender,
  stepSpaceImpact,
} from "../src/games/space-impact/engine";
import { paintSpaceImpact } from "../src/display/widgets/space-impact";
import { SPACE_IMPACT_LEVEL_OBSERVATIONS } from "../src/resources/generated/space-impact-levels";
import { goldenImage, loadGolden } from "./support/goldens";

describe("Space impact engine pixels before the first wave", () => {
  it("replays the initial settled ship/shot frames from real key input", () => {
    let state = newSpaceImpactGame();
    const paint = () => {
      const fb = new Framebuffer();
      paintSpaceImpact(fb, { kind: "space-impact", board: spaceImpactRender(state) });
      return fb.pixels;
    };
    expect(paint()).toEqual(goldenImage("game/space-impact/level-0", "b").image.pixels);
    for (const [tick, image] of [
      [1, "d"],
      [2, "e"],
      [3, "f"],
      [4, "h"],
      [5, "i"],
      [6, "j"],
      [7, "l"],
      [8, "m"],
      [9, "n"],
      [10, "p"],
      [11, "q"],
      [12, "r"],
      [13, "t"],
    ] as const) {
      state = stepSpaceImpact(state).state;
      if ((tick - 1) % 3 === 0) {
        state = spaceImpactKey(state, "1").state;
        state = spaceImpactKey(state, "1", "up").state;
      }
      expect(paint(), `level-0 ${image}`).toEqual(
        goldenImage("game/space-impact/level-0", image).image.pixels,
      );
    }
  });
});

describe("Space impact movement before a shot redraw", () => {
  it("replays the first move/fire redraw and the following tick from the full level-0 input", () => {
    const golden = loadGolden("game/space-impact/level-0");
    let state = newSpaceImpactGame();
    for (let tick = 0; tick <= 22; tick++) {
      if (tick > 0) state = stepSpaceImpact(state).state;
      for (const input of golden.input ?? []) {
        if (input.tick !== tick) continue;
        if (input.key !== "8" && input.key !== "1") throw new Error("Changed opening input");
        state = spaceImpactKey(state, input.key).state;
        state = spaceImpactKey(state, input.key, "up").state;
      }
    }
    const paint = () => {
      const fb = new Framebuffer();
      paintSpaceImpact(fb, { kind: "space-impact", board: spaceImpactRender(state) });
      return fb.pixels;
    };
    expect(paint(), "level-0 af: the shot redraw includes the preceding move").toEqual(
      goldenImage(golden.id, "af").image.pixels,
    );
    state = stepSpaceImpact(state).state;
    expect(paint(), "level-0 ag: the move is not applied again on the next tick").toEqual(
      goldenImage(golden.id, "ag").image.pixels,
    );
  });
});

describe("Space impact observed level-0 data pixels", () => {
  it("paints every retained alternative exactly and keeps the unresolved boss redraw explicit", () => {
    const data = SPACE_IMPACT_LEVEL_OBSERVATIONS;
    const golden = loadGolden(data.source);
    expect(data.sourceSha256).toBe(golden.sourceSha256);
    const images = new Map(golden.images.map((image) => [image.name, image.pixels]));
    const unique = [...new Map(data.frames.map((frame) => [frame.image, frame])).values()];
    const decoded = unique.filter((frame) => frame.kind === "decoded");
    const unresolved = unique.filter((frame) => frame.kind === "unresolved");
    expect(unique).toHaveLength(856);
    expect(decoded).toHaveLength(855);
    expect(decoded.filter((frame) => frame.candidates.length > 1)).toHaveLength(398);
    expect(unresolved.map((frame) => frame.image)).toEqual(["ala"]);
    let alternatives = 0;
    for (const frame of decoded) {
      const expected = images.get(frame.image)!;
      for (const [index, candidate] of frame.candidates.entries()) {
        const fb = new Framebuffer();
        const sprites = [
          ...(candidate.ship === null ? [] : [data.objects[candidate.ship]!]),
          ...candidate.objects.map((index) => data.objects[index]!),
        ];
        paintSpaceImpact(fb, {
          kind: "space-impact",
          board: { level: data.level, scroll: 0, hud: frame.hud, sprites },
        });
        expect(
          fb.pixels.every((pixel, i) => pixel === expected[i]),
          `${frame.image} alternative ${index}`,
        ).toBe(true);
        alternatives++;
      }
    }
    expect(alternatives).toBe(8055);
  });
});

describe("Space impact opening-wave engine replay", () => {
  it.each([
    ["8", "8"],
    ["0", "0"],
    ["*", "star"],
    ["#", "hash"],
    ["2", "2"],
    ["5", "5"],
    ["7", "7"],
    ["9", "9"],
    ["up", "up"],
    ["down", "down"],
    ["1", "1"],
    ["3", "3"],
  ] as const)(
    "replays the complete tap-%s tick stills without reading decoded candidates",
    (key, suffix) => {
      const golden = loadGolden(`game/space-impact/keys-tap-${suffix}`);
      let state = newSpaceImpactGame();
      for (let tick = 0; tick < 40; tick++) state = stepSpaceImpact(state).state;
      state = expireSpaceImpactShield(state).state;
      state = spaceImpactKey(state, key).state;
      state = spaceImpactKey(state, key, "up").state;
      for (const image of golden.images) {
        const tick = Number(image.name.slice(1));
        while (state.tick < tick) state = stepSpaceImpact(state).state;
        const fb = new Framebuffer();
        paintSpaceImpact(fb, { kind: "space-impact", board: spaceImpactRender(state) });
        expect(fb.pixels, `${golden.id} ${image.name}`).toEqual(image.pixels);
      }
    },
  );
});
