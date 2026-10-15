// The lights across the phone (plan 25 D3, D7, Task 8): which keys and screens light the LEDs,
// with the keyguard locked and during Snake II under Games › Settings › Lights. The recordings
// themselves are this plan's acceptance scenarios (`lightsScenario`); these tests pin the rules.
import type { PhoneKey } from "@hellotimber/phone-core";
import { describe, expect, it } from "vite-plus/test";
import {
  FIREWORKS_MS,
  GAMES_LIGHTS_KEY,
  LIGHT_TICK_MS,
  LIGHT_TICK_PHASE_MS,
  LIGHT_TIMEOUT_MS,
  SNAKE_DEATH_MS,
} from "../src/firmware/features/backlight";
import { KEYGUARD_TIMES } from "../src/firmware/features/keyguard";
import { StockEeprom } from "../src/firmware/eeprom";
import { createStockSettings } from "../src/firmware/settings";
import { SNAKE_TOP_SCORE_MS } from "../src/resources";
import { SNAKE_SETTINGS } from "../src/widgets/snake";
import { lightsRig, storageFor, type LightsRig } from "./support/lights.ts";

function tap(rig: LightsRig, key: PhoneKey, gapMs = 600): void {
  rig.hold(key);
  rig.advance(60);
  rig.release(key);
  rig.advance(gapMs - 60);
}

/** The lights' changes from `from` on, as `[ms after from, on]` (both lights switch together). */
function edges(rig: LightsRig, from: number): [number, boolean][] {
  return rig.events
    .filter((e) => e.light === "display" && e.atMs >= from)
    .map((e) => [e.atMs - from, e.on]);
}

/** A factory phone at a dark standby. */
function darkRig(storage = storageFor("factory")): LightsRig {
  const rig = lightsRig({ storage });
  rig.powerOn();
  // The boot's light (from standby, ≈10 s) has timed out.
  rig.advance(30_000, 20);
  return rig;
}

/** Locked (Menu, `*`) and dark again. */
function lockedDark(): LightsRig {
  const rig = darkRig();
  tap(rig, "navi");
  tap(rig, "*");
  rig.advance(20_000, 20);
  return rig;
}

describe("the keyguard's lights (D3)", () => {
  it("keeps a locked phone dark for the hint, Unlock alone, C and digits", () => {
    for (const key of ["5", "*", "#", "c", "up", "navi"] as PhoneKey[]) {
      const rig = lockedDark();
      const from = rig.now;
      tap(rig, key, 4000);
      expect(edges(rig, from), key).toEqual([]);
    }
  });

  it("lights for the power key's hint, the emergency display and Unlock then *", () => {
    const power = lockedDark();
    let from = power.now;
    tap(power, "power", 1000);
    expect(edges(power, from)).toEqual([[0, true]]);

    const emergency = lockedDark();
    from = emergency.now;
    tap(emergency, "1", 500);
    tap(emergency, "1", 500);
    expect(edges(emergency, from)).toEqual([]);
    tap(emergency, "2", 500);
    expect(edges(emergency, from)).toEqual([[1000, true]]);

    const unlock = lockedDark();
    from = unlock.now;
    tap(unlock, "navi", 300);
    expect(edges(unlock, from)).toEqual([]);
    tap(unlock, "*", 1000);
    expect(edges(unlock, from)).toEqual([[300, true]]);
  });

  it("times the lock's light from Menu: the locking * is no activity", () => {
    const rig = darkRig();
    const from = rig.now;
    // `*` 2000 ms after Menu (within the lock window): a light tick apart.
    tap(rig, "navi", 2000);
    tap(rig, "*", KEYGUARD_TIMES.lockNoteMs + 16_000);
    // The first light tick at least D after Menu, not after the `*`.
    const tickAfter = (ms: number) => {
      const anchor = rig.poweredOnAt! + LIGHT_TICK_PHASE_MS;
      return anchor + Math.ceil((ms - anchor) / LIGHT_TICK_MS) * LIGHT_TICK_MS - from;
    };
    expect(tickAfter(from + LIGHT_TIMEOUT_MS)).not.toBe(tickAfter(from + 2000 + LIGHT_TIMEOUT_MS));
    expect(edges(rig, from)).toEqual([
      [0, true],
      [tickAfter(from + LIGHT_TIMEOUT_MS), false],
    ]);
  });
});

/** Factory, Lights `on`, Snake II at level 1 in `maze`, its menu open (the intro played). */
function snakeMenu(lightsOn: boolean, maze = 0): LightsRig {
  const storage = storageFor("factory");
  const settings = createStockSettings(new StockEeprom(storage));
  settings.choose(GAMES_LIGHTS_KEY, lightsOn ? 1 : 0);
  settings.choose(SNAKE_SETTINGS.maze, maze);
  settings.setNumber(SNAKE_SETTINGS.level, 1);
  const rig = darkRig(storage);
  for (const key of ["navi", ...Array<PhoneKey>(7).fill("down"), "navi", "navi"] as PhoneKey[]) {
    tap(rig, key);
  }
  rig.advance(8000);
  return rig;
}

describe("Games › Settings › Lights during play (D7)", () => {
  it("Off: dark from New game through play keys and the power key; the pause lights", () => {
    const rig = snakeMenu(false);
    const from = rig.now;
    tap(rig, "navi", 2000); // New game, at Select's release
    tap(rig, "8", 1000);
    tap(rig, "power", 1000);
    expect(edges(rig, from)).toEqual([[60, false]]);
    const pause = rig.now;
    tap(rig, "c", 3000); // the pause: activity
    expect(edges(rig, pause)).toEqual([[0, true]]);
    const resume = rig.now;
    tap(rig, "navi", 1000); // Continue: lit by its key, dark again as play resumes
    expect(edges(rig, resume)).toEqual([[60, false]]);
  });

  it("On: lit through play with no timeout; the pause times out as usual", () => {
    const rig = snakeMenu(true);
    const from = rig.now;
    tap(rig, "navi", 30_000);
    expect(edges(rig, from)).toEqual([]);
    tap(rig, "c", 20_000);
    const [off] = edges(rig, from).at(-1)!;
    expect(edges(rig, from)).toHaveLength(1);
    expect(off - 30_000).toBeGreaterThanOrEqual(LIGHT_TIMEOUT_MS);
  });

  it("lights at the death's end: the crash plus the death steps (Maze 1, into the wall)", () => {
    const rig = snakeMenu(false, 1);
    const from = rig.now;
    tap(rig, "navi", 30_000);
    const crash = rig.cues.find((c) => c.cue.kind === "crash")!.atMs;
    // Dark from New game until the game-over screen, lit there, then the usual timeout.
    const [start, gameOver, timeout] = edges(rig, from);
    expect(start).toEqual([60, false]);
    expect(gameOver).toEqual([crash + SNAKE_DEATH_MS - from, true]);
    expect(timeout![1]).toBe(false);
    expect(timeout![0] - gameOver![0]).toBeGreaterThanOrEqual(LIGHT_TIMEOUT_MS);
  });

  it("times the top score's screens from the death: fireworks, then Game over!", () => {
    expect(SNAKE_DEATH_MS).toBe(2066);
    expect(SNAKE_TOP_SCORE_MS).toBe(45);
    expect(FIREWORKS_MS).toBe(2872);
  });
});
