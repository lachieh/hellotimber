import { describe, expect, it } from "vite-plus/test";
import {
  checkReplay,
  localGame,
  parseReplay,
  recording,
  type GameEffect,
  type GameKey,
  type GameSession,
} from "../src/index";
import { counterGame, FONTS, probeGame, startOf } from "./support/counter-game";

const counter = localGame(counterGame);
const START = startOf({ level: 3, mode: "quick", storage: Uint8Array.of(2) });

/** Drives a session as the shell does: `advance` on every 17 ms tick, keys at their own ms. */
function drive(
  session: GameSession,
  keys: readonly (readonly [number, GameKey, "down" | "up"])[],
  until: number,
): GameEffect[] {
  const effects: GameEffect[] = [];
  let next = 0;
  for (let now = 0; now <= until; now += 17) {
    for (; next < keys.length && keys[next]![0] <= now + 16 && keys[next]![0] <= until; next++) {
      const [at, key, edge] = keys[next]!;
      if (edge === "down") session.keyDown(key, at);
      else session.keyUp(key, at);
      effects.push(...session.drain());
    }
    session.advance(Math.min(until, now + 16));
    effects.push(...session.drain());
  }
  return effects;
}

describe("recording", () => {
  it("is the module it wraps, with no replay before a session", () => {
    const recorded = recording(counter);
    expect(recorded.manifest).toBe(counter.manifest);
    expect(recorded.lastReplay()).toBeUndefined();
  });

  it("passes every call through unchanged", () => {
    const keys = [
      [140, "5", "down"],
      [150, "5", "up"],
      [400, "2", "down"],
    ] as const;
    const plain = counter.start(START, FONTS);
    const wrapped = recording(counter).start(START, FONTS);
    expect(wrapped.frame()).toEqual(plain.frame());
    expect(drive(wrapped, keys, 900)).toEqual(drive(plain, keys, 900));
    expect(wrapped.frame()).toEqual(plain.frame());
    expect(wrapped.wake()).toBe(plain.wake());
    expect(wrapped.failure).toBeUndefined();
    wrapped.dispose();
    expect(wrapped.wake()).toBeNull();
  });

  it("yields a replay of a played session that checkReplay passes", () => {
    const recorded = recording(counter);
    const session = recorded.start(START, FONTS);
    // Keys between wakes, a held key (8, repeating until its release) and a pause.
    const effects = drive(
      session,
      [
        [141, "5", "down"],
        [199, "5", "up"],
        [305, "8", "down"],
        [990, "8", "up"],
        [1203, "0", "down"],
        [1250, "0", "up"],
        [1700, "3", "down"],
        [1700, "3", "up"],
        [1712, "3", "down"],
        [1790, "3", "up"],
        [2000, "2", "down"],
      ],
      2400,
    );
    const text = recorded.lastReplay()!;
    const replay = parseReplay(text);

    expect(text.split("\n").slice(0, 11)).toEqual([
      "game-replay 1",
      "game: counter",
      "seed: 44530",
      "level: 3",
      "mode: quick",
      "choices: step=0",
      "top-score: 0",
      "storage: Ag==",
      "input: 141:5+ 199:5- 305:8+ 990:8- 1203:0+ 1250:0- 1700:3 1712:3+ 1790:3- 2000:2+",
      "until: 2400",
      "note:",
    ]);
    expect(replay.effects).toEqual(effects);
    expect(replay.effects.map((effect) => effect.kind)).toEqual(["sound", "save", "vibrate"]);
    expect(replay.frames.at(-1)).toEqual({ at: 2400, frame: session.frame() });
    expect(checkReplay(counter, replay)).toBeUndefined();
    expect(checkReplay(counter, replay, { advanceMs: 1 })).toBeUndefined();
    expect(checkReplay(counter, replay, { advanceMs: 17 })).toBeUndefined();
  });

  it("ends the replay at over, without the keys pressed afterwards", () => {
    const recorded = recording(counter);
    const session = recorded.start(START, FONTS);
    drive(
      session,
      [
        [500, "5", "down"],
        [520, "5", "up"],
        [3000, "5", "down"],
      ],
      4000,
    );
    const replay = parseReplay(recorded.lastReplay()!);
    expect(replay.until).toBe(2500);
    expect(replay.input.length).toBe(2);
    expect(replay.effects.at(-1)).toEqual({ kind: "over", at: 2500, score: 5 });
    expect(checkReplay(counter, replay)).toBeUndefined();
  });

  it("replays the latest session, with the fonts it was started with", () => {
    const seen: unknown[] = [];
    const probe = probeGame({ create: (ctx) => void seen.push(ctx.fonts) });
    const recorded = recording(localGame(probe.definition));
    const fonts = { ...FONTS, small: FONTS.game };
    recorded.start(startOf({ seed: 1 }), FONTS).advance(50);
    recorded.start(startOf({ seed: 2 }), fonts).advance(80);
    seen.length = 0;
    const replay = parseReplay(recorded.lastReplay()!);
    expect([replay.start.seed, replay.until]).toEqual([2, 80]);
    expect(seen).toEqual([fonts]);
  });

  it("does not log a call the session refused", () => {
    const recorded = recording(counter);
    const session = recorded.start(START, FONTS);
    session.keyDown("5", 100);
    expect(() => session.keyDown("6", 50)).toThrow();
    expect(() => session.advance(99)).toThrow();
    session.keyUp("5", 120);
    expect(parseReplay(recorded.lastReplay()!).input).toEqual([
      { at: 100, key: "5", down: true },
      { at: 120, key: "5", down: false },
    ]);
  });

  it("ignores what the host sends, in any order, once the game is over", () => {
    const recorded = recording(counter);
    const session = recorded.start(START, FONTS);
    session.keyDown("*", 300);
    session.keyUp("*", 310);
    session.keyDown("5", 20);
    session.advance(5);
    const replay = parseReplay(recorded.lastReplay()!);
    expect(replay.until).toBe(300);
    expect(replay.input).toEqual([{ at: 300, key: "*", down: true }]);
  });

  it("throws from lastReplay when the game failed", () => {
    const probe = probeGame({
      keyDown: () => {
        throw new Error("boom");
      },
    });
    const recorded = recording(localGame(probe.definition));
    const session = recorded.start(startOf(), FONTS);
    session.keyDown("5", 70);
    expect(session.failure).toBe("game: boom");
    expect(() => recorded.lastReplay()).toThrow("70 ms: game: boom");
  });

  it("keeps the saved bytes the session started with", () => {
    const storage = Uint8Array.of(2);
    const recorded = recording(counter);
    recorded.start({ ...START, storage }, FONTS).advance(10);
    storage[0] = 200;
    expect(parseReplay(recorded.lastReplay()!).start.storage).toEqual(Uint8Array.of(2));
  });
});
