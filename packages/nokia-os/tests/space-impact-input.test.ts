import { describe, expect, it } from "vite-plus/test";
import { Framebuffer } from "@hellotimber/phone-screen";
import type { PhoneKey } from "@hellotimber/phone-core";
import type { SpaceImpactState } from "../src/games/space-impact/model";
import {
  expireSpaceImpactShield,
  newSpaceImpactGame,
  spaceImpactKey,
  spaceImpactRender,
  stepSpaceImpact,
} from "../src/games/space-impact/engine";
import { paintSpaceImpact } from "../src/display/widgets/space-impact";
import { normalized, shipAt } from "../scripts/space-impact-capture-set";
import { goldenImage, loadGolden } from "./support/goldens";
import { replaySpaceImpactLevel } from "./support/space-impact-replay";
import evidence from "./fixtures/space-impact-input.json";
import { observedSpaceImpactInput } from "../scripts/space-impact-delivery";

function recordedKey(key: string | undefined): PhoneKey {
  switch (key) {
    case "0":
    case "1":
    case "8":
      return key;
    default:
      throw new Error(`Unexpected recorded key: ${key}`);
  }
}

function deliver(state: SpaceImpactState, event: { kind: string; key?: string }): SpaceImpactState {
  switch (event.kind) {
    case "step":
      return stepSpaceImpact(state).state;
    case "shield":
      return expireSpaceImpactShield(state).state;
    case "down":
    case "repeat":
      return spaceImpactKey(state, recordedKey(event.key), event.kind).state;
    case "up":
      return spaceImpactKey(state, state.held?.key ?? "1", "up").state;
    default:
      throw new Error(`Unexpected delivered event: ${event.kind}`);
  }
}

function position(id: string, image: string) {
  const ship = shipAt(normalized(goldenImage(id, image).image.pixels));
  if (ship === undefined) throw new Error(`${id}/${image}: ambiguous recorded ship`);
  return ship;
}

describe("Space impact recorded input order", () => {
  it.each(evidence.cases)(
    "level $level: $before → $after follows its recorded key sequence",
    ({ level, before, after, events }) => {
      const id = `game/space-impact/level-${level}`;
      let state = { ...newSpaceImpactGame(), ship: position(id, before) };
      for (const event of events) state = deliver(state, event);
      expect(state.ship).toEqual(position(id, after));
    },
  );

  it("runs the complete imported delivered stream and matches every settled row through the first pickup and its pending return", () => {
    const replay = replaySpaceImpactLevel(loadGolden("game/space-impact/level-0"));
    expect(replay.events).toBe(1812);
    expect(replay.matched).toBeGreaterThanOrEqual(237);
    expect(replay.total).toBe(879);
  });
});

describe("Space impact first captured kill", () => {
  it("replays every settled level-0 row through the opening kills and the following wave", () => {
    const golden = loadGolden("game/space-impact/level-0");
    const expected = golden
      .timeline!.slice(1)
      .filter((row) => row.durationMs >= 34 && row.startMs < 6900);
    const images = new Map(golden.images.map((image) => [image.name, image.pixels]));
    let state = newSpaceImpactGame();
    let matched = 0;
    const compare = () => {
      const fb = new Framebuffer();
      paintSpaceImpact(fb, { kind: "space-impact", board: spaceImpactRender(state) });
      const row = expected[matched];
      if (row !== undefined && fb.pixels.every((p, i) => p === images.get(row.image)![i]))
        matched++;
    };
    compare();
    for (const event of observedSpaceImpactInput(golden.note).filter(
      (event) => event.atMs < 7000,
    )) {
      state = deliver(state, event);
      compare();
      if (matched === expected.length) break;
    }
    expect(expected[matched]?.image, `matched ${matched}/${expected.length} rows`).toBeUndefined();
    expect(state.hud.score).toBe(50);
  });
});
