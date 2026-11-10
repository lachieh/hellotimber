// Fixture games for the session and replay tests.
//
// `probeGame` is a game whose every call is scripted by the test and logged. `counterGame` is a
// small complete game that uses every ctx call on a schedule of wakes that is deliberately off any
// grid; the replay tests record and check it.

import {
  GameScreen,
  encodeFrame,
  sdk,
  type GameContext,
  type GameDefinition,
  type GameFonts,
  type GameKey,
  type GameManifest,
  type GameStart,
  type GameWake,
} from "../../src/index";

const BLANK = encodeFrame(new GameScreen());

export const FONTS: GameFonts = { game: sdk.GAME_DIGITS };

export function startOf(overrides: Partial<GameStart> = {}): GameStart {
  return {
    mode: "",
    level: 1,
    choices: { step: 0 },
    seed: 44530,
    topScore: 0,
    storage: new Uint8Array(0),
    ...overrides,
  };
}

export const COUNTER_MANIFEST: GameManifest = {
  sdk: 1,
  id: "counter",
  name: "Counter",
  splash: { frames: [BLANK], steps: [{ frame: 0, ms: 250 }] },
  menu: [
    { kind: "play", slug: "new-game", label: "New game" },
    { kind: "play", slug: "quick", label: "Quick game", mode: "quick" },
    { kind: "level" },
    { kind: "choice", slug: "step", label: "Step", options: ["1", "10"], initial: 0 },
    { kind: "top-score" },
  ],
  level: { max: 9, initial: 1 },
  suspend: true,
  storageBytes: 4,
};

export interface ProbeScript {
  readonly manifest?: Partial<GameManifest>;
  readonly create?: (ctx: GameContext) => void;
  readonly update?: (nowMs: number, ctx: GameContext) => GameWake;
  /** Absent: the instance has no keyDown method. */
  readonly keyDown?: (key: GameKey, nowMs: number, ctx: GameContext) => GameWake | undefined;
  readonly keyUp?: (key: GameKey, nowMs: number, ctx: GameContext) => GameWake | undefined;
  readonly draw?: (screen: GameScreen, ctx: GameContext) => void;
}

export interface Probe {
  readonly definition: GameDefinition;
  /** `update@0`, `down 5@120`, `up 5@130`, `draw`: every call the game received, in order. */
  readonly calls: string[];
}

/** A game that sleeps unless the script says otherwise, and logs each call. */
export function probeGame(script: ProbeScript = {}): Probe {
  const calls: string[] = [];
  const definition: GameDefinition = {
    manifest: { ...COUNTER_MANIFEST, ...script.manifest },
    create(ctx) {
      script.create?.(ctx);
      const { keyDown, keyUp } = script;
      return {
        update(nowMs) {
          calls.push(`update@${nowMs}`);
          return script.update ? script.update(nowMs, ctx) : null;
        },
        ...(keyDown && {
          keyDown(key: GameKey, nowMs: number) {
            calls.push(`down ${key}@${nowMs}`);
            return keyDown(key, nowMs, ctx);
          },
        }),
        ...(keyUp && {
          keyUp(key: GameKey, nowMs: number) {
            calls.push(`up ${key}@${nowMs}`);
            return keyUp(key, nowMs, ctx);
          },
        }),
        draw(screen) {
          calls.push("draw");
          script.draw?.(screen, ctx);
        },
      };
    },
  };
  return { definition, calls };
}

/** The delays the counter cycles through: fractions, a delay below the minimum, a long one. */
const BEAT_MS = [130, 12.5, 4, 480, 97];
/** How long a game lasts: `quick` mode ends sooner. */
const LENGTH_MS = { "": 6000, quick: 2500 } as const;

/**
 * Counter: a marker hops to a random column on every beat, and the count is drawn at the top
 * right. Keys:
 *
 * - `5` adds the step (choice `step`: 1 or 10) times the level, and plays `eat`;
 * - `8` held adds one every 60 ms after a 200 ms hold (a wake the key schedules), until released;
 * - `1` plays a three-note tune, `2` vibrates, `3` saves the count;
 * - `0` pauses (sleeps until the next key), and any key resumes;
 * - `*` ends the game with the count as its score.
 *
 * The count starts from the saved byte. The game ends by itself at its length, with a crash.
 */
export const counterGame: GameDefinition = {
  manifest: COUNTER_MANIFEST,
  create(ctx) {
    const length = ctx.start.mode === "quick" ? LENGTH_MS.quick : LENGTH_MS[""];
    const step = (ctx.start.choices.step === 1 ? 10 : 1) * ctx.start.level;
    let count = ctx.start.storage[0] ?? 0;
    let column = 0;
    let beat = 0;
    let nextBeat = 0;
    let repeatAt: number | undefined;
    let paused = false;

    /** The delay to whichever comes first: the next beat or the held key's repeat. */
    const next = (nowMs: number): GameWake =>
      paused ? null : Math.min(nextBeat, repeatAt ?? Number.POSITIVE_INFINITY) - nowMs;

    return {
      update(nowMs) {
        if (nowMs >= length) {
          ctx.sound("crash");
          ctx.vibrate(300);
          ctx.over(count);
          return null;
        }
        if (repeatAt !== undefined && nowMs >= repeatAt) {
          count++;
          repeatAt = nowMs + 60;
        }
        if (nowMs >= nextBeat) {
          column = ctx.random() % 80;
          nextBeat = Math.min(
            length,
            nowMs + Math.max(sdk.MIN_WAKE_MS, Math.ceil(BEAT_MS[beat++ % 5]!)),
          );
        }
        return next(nowMs);
      },
      keyDown(key, nowMs) {
        if (paused) {
          paused = false;
          nextBeat = nowMs + 50;
          return next(nowMs);
        }
        switch (key) {
          case "5":
            count += step;
            ctx.sound("eat");
            return undefined;
          case "8":
            repeatAt = nowMs + 200;
            return next(nowMs);
          case "1":
            ctx.sound({
              notes: [
                { hz: 523, ms: 80 },
                { hz: 659, ms: 80 },
                { hz: 784, ms: 160 },
              ],
            });
            return undefined;
          case "2":
            ctx.vibrate(120);
            return undefined;
          case "3":
            ctx.save(Uint8Array.of(count & 0xff));
            return undefined;
          case "0":
            paused = true;
            repeatAt = undefined;
            return null;
          case "*":
            ctx.over(count);
            return null;
          default:
            return undefined;
        }
      },
      keyUp(key, nowMs) {
        if (key !== "8" || repeatAt === undefined) return undefined;
        repeatAt = undefined;
        return next(nowMs);
      },
      draw(screen) {
        screen.clear();
        sdk.drawNumber(screen, count, 84, 0, { align: "right" });
        screen.fill(column, 40, 4, 4);
        if (paused) screen.invert(0, 20, 84, 8);
      },
    };
  },
};
