import { describe, expect, it } from "vite-plus/test";
import {
  newSpaceImpactGame,
  spaceImpactKey,
  spaceImpactRender,
  stepSpaceImpact,
  expireSpaceImpactShield,
} from "../src/games/space-impact/engine";

function steps(count: number, state = newSpaceImpactGame()) {
  for (let tick = 0; tick < count; tick++) state = stepSpaceImpact(state).state;
  return state;
}

describe("Space impact ship and player shots", () => {
  it("starts with the virgin HUD, ship and shield", () => {
    expect(spaceImpactRender(newSpaceImpactGame())).toEqual({
      level: 0,
      scroll: 0,
      hud: { lives: 3, weapon: "missile", count: 3, score: 0 },
      sprites: [{ picture: "ship/shielded/0", x: 3, y: 18 }],
    });
  });

  it.each([
    ["8", 5, 19],
    ["0", 5, 21],
    ["*", 4, 20],
    ["#", 6, 20],
  ] as const)("%s moves one pixel on the next game tick", (key, x, y) => {
    const before = newSpaceImpactGame();
    const queued = spaceImpactKey(before, key).state;
    expect(queued.ship).toEqual(before.ship);
    expect(stepSpaceImpact(queued).state.ship).toEqual({ x, y });
    expect(before.ship).toEqual({ x: 5, y: 20 });
  });

  it("keeps the order and multiplicity of moves between ticks", () => {
    let state = newSpaceImpactGame();
    for (const key of ["8", "8", "0"] as const) state = spaceImpactKey(state, key).state;
    expect(stepSpaceImpact(state).state.ship.y).toBe(19);
  });

  it("moves two pixels on repeat and stops after key release", () => {
    let state = spaceImpactKey(newSpaceImpactGame(), "8").state;
    state = stepSpaceImpact(state).state;
    state = spaceImpactKey(state, "8", "repeat").state;
    state = stepSpaceImpact(state).state;
    expect(state.ship.y).toBe(17);
    state = spaceImpactKey(state, "8", "up").state;
    state = spaceImpactKey(state, "8", "repeat").state;
    expect(stepSpaceImpact(state).state.ship.y).toBe(17);
  });

  it.each([
    ["8", 5, 7],
    ["0", 5, 41],
    ["*", 2, 20],
    ["#", 46, 20],
  ] as const)("clamps held %s to the observed play field", (key, x, y) => {
    let state = spaceImpactKey(newSpaceImpactGame(), key).state;
    for (let n = 0; n < 100; n++) {
      state = stepSpaceImpact(state).state;
      state = spaceImpactKey(state, key, "repeat").state;
    }
    expect(state.ship).toEqual({ x, y });
  });

  it.each(["1", "3"] as const)(
    "%s fires immediately from the gun and advances two pixels per tick",
    (key) => {
      const original = newSpaceImpactGame();
      const fired = spaceImpactKey(original, key);
      expect(fired.state.shots).toEqual([{ x: 11, y: 23 }]);
      expect(fired.cues).toEqual([{ kind: "game-sound", id: "space-impact/shot" }]);
      expect(steps(2, fired.state).shots).toEqual([{ x: 15, y: 23 }]);
      expect(original.shots).toEqual([]);
    },
  );

  it("applies ordered queued moves before a shot redraw and clears them for the next tick", () => {
    let state = newSpaceImpactGame();
    for (const key of ["8", "8", "#"] as const) state = spaceImpactKey(state, key).state;
    const fired = spaceImpactKey(state, "1");
    expect(fired.state.ship).toEqual({ x: 6, y: 18 });
    expect(fired.state.shots).toEqual([{ x: 12, y: 21 }]);
    expect(stepSpaceImpact(fired.state).state.ship).toEqual({ x: 6, y: 18 });
    expect(state.ship).toEqual({ x: 5, y: 20 });
  });

  it("rejects a shot during the two-tick cooldown", () => {
    let state = spaceImpactKey(newSpaceImpactGame(), "1").state;
    state = spaceImpactKey(steps(1, state), "3").state;
    expect(state.shots).toHaveLength(1);
    state = spaceImpactKey(steps(1, state), "3").state;
    expect(state.shots).toEqual([
      { x: 15, y: 23 },
      { x: 11, y: 23 },
    ]);
  });

  it("retires shots only after their ink leaves the viewport", () => {
    const state = spaceImpactKey(newSpaceImpactGame(), "1").state;
    expect(steps(36, state).shots).toEqual([{ x: 83, y: 23 }]);
    expect(steps(37, state).shots).toEqual([]);
  });

  it("a held fire key makes five attempts including its first press", () => {
    let state = spaceImpactKey(newSpaceImpactGame(), "1").state;
    for (let tick = 0; tick < 20; tick++) {
      state = stepSpaceImpact(state).state;
      state = spaceImpactKey(state, "1", "repeat").state;
    }
    expect(state.shots).toEqual([
      { x: 51, y: 23 },
      { x: 47, y: 23 },
      { x: 43, y: 23 },
    ]);
  });

  it.each(["2", "5", "7", "9", "up", "down"] as const)("ignores %s", (key) => {
    const state = newSpaceImpactGame();
    expect(spaceImpactKey(state, key)).toEqual({ state, cues: [], events: [] });
  });

  it("alternates the shield and expires it only on its one-shot event", () => {
    let state = steps(1);
    expect(spaceImpactRender(state).sprites[0]!.picture).toBe("ship/shielded/1");
    state = steps(1, state);
    expect(spaceImpactRender(state).sprites[0]!.picture).toBe("ship/shielded/0");
    expect(spaceImpactRender(expireSpaceImpactShield(state).state).sprites[0]).toEqual({
      picture: "ship",
      x: 5,
      y: 20,
    });
  });

  it("returns a pending sound without executing the next event", () => {
    const state = { ...newSpaceImpactGame(), pendingCue: "space-impact/bonus" };
    const result = stepSpaceImpact(state);
    expect(result.state.tick).toBe(0);
    expect(result.state.pendingCue).toBeNull();
    expect(result.cues).toEqual([{ kind: "game-sound", id: "space-impact/bonus" }]);
    const key = spaceImpactKey(state, "1");
    expect(key.state.shots).toEqual([]);
    expect(key.cues).toEqual(result.cues);
  });

  it.each(["navi", "c"] as const)("%s suspends on press and ignores release", (key) => {
    const state = newSpaceImpactGame();
    expect(spaceImpactKey(state, key).events).toEqual([{ kind: "suspend" }]);
    expect(spaceImpactKey(state, key, "up")).toEqual({ state, cues: [], events: [] });
  });

  it("scrolls independently of the ship and keeps its world coordinate", () => {
    const state = steps(513);
    expect(state.scroll).toBe(513);
    expect(state.ship).toEqual({ x: 5, y: 20 });
  });
});
