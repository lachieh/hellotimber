// A game run in-process (plan 28 D4, D6): the session that owns a game's schedule. First-party
// games use it directly, and the sandbox worker runs the same session behind the protocol, so a
// game behaves identically in both.

import type {
  GameContext,
  GameDefinition,
  GameEffect,
  GameFonts,
  GameInstance,
  GameKey,
  GameManifest,
  GameModule,
  GameSession,
  GameSound,
  GameStart,
} from "./contract";
import {
  MAX_EFFECTS_PER_REPLY,
  MAX_NOTES_PER_REPLY,
  MAX_SESSION_MS,
  MAX_STORAGE_BYTES,
  MIN_WAKE_MS,
} from "./limits";
import { validateManifest } from "./manifest";
import { createRandom } from "./random";
import { GameScreen } from "./screen";

const KEYS: readonly string[] = [
  "up",
  "down",
  "*",
  "#",
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
];

/** Thrown inside the game by a ctx call it got wrong; the session fails even if the game catches it. */
class Violation extends Error {}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function describe(value: unknown): string {
  return typeof value === "string" ? JSON.stringify(value) : String(value);
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function startSession(
  definition: GameDefinition,
  manifest: GameManifest,
  start: GameStart,
  fonts: GameFonts,
): GameSession {
  const quota = Math.min(manifest.storageBytes ?? 0, MAX_STORAGE_BYTES);
  if (start.storage.length > quota) {
    throw new RangeError(
      `start.storage holds ${start.storage.length} bytes; ${manifest.id} may keep ${quota}`,
    );
  }

  const screen = new GameScreen();
  const held = new Set<GameKey>();
  let instance: GameInstance | undefined;
  /** The session ms of the host's last call. */
  let now = 0;
  /** The session ms of the next wake. */
  let pending: number | null = null;
  let frame: Uint8Array | undefined;
  let effects: GameEffect[] = [];
  let failure: string | undefined;
  let over = false;
  let disposed = false;

  // The game call in progress: its time, its share of D19's bounds, and what it did wrong.
  let calling = false;
  let callAt = 0;
  let callEffects = 0;
  let callNotes = 0;
  let violation: string | undefined;
  let overCalled = false;

  const alive = (): boolean => !disposed && !over && failure === undefined;

  function fail(reason: string): void {
    failure ??= reason;
    pending = null;
  }

  function violate(kind: "effect" | "limit", message: string): never {
    violation ??= `${kind}: ${message}`;
    throw new Violation(message);
  }

  function emit(effect: GameEffect): void {
    if (++callEffects > MAX_EFFECTS_PER_REPLY) {
      violate("limit", `more than ${MAX_EFFECTS_PER_REPLY} effects in one call`);
    }
    effects.push(Object.freeze(effect));
  }

  function checkedSound(sound: GameSound): GameSound {
    if (sound === "eat" || sound === "crash") return sound;
    const notes: unknown = (sound as { notes?: unknown } | null)?.notes;
    if (!Array.isArray(notes)) violate("effect", `sound(${describe(sound)}) is not a sound`);
    const copy = notes.map((note: { hz?: unknown; ms?: unknown } | null, i) => {
      const hz = note?.hz;
      const ms = note?.ms;
      if (!positiveInteger(hz) || !positiveInteger(ms)) {
        violate(
          "effect",
          `note ${i} needs a positive integer hz and ms, not ${describe(hz)} and ${describe(ms)}`,
        );
      }
      return Object.freeze({ hz, ms });
    });
    callNotes += copy.length;
    if (callNotes > MAX_NOTES_PER_REPLY) {
      violate("limit", `more than ${MAX_NOTES_PER_REPLY} notes in one call`);
    }
    return Object.freeze({ notes: Object.freeze(copy) });
  }

  const context: GameContext = Object.freeze({
    start: Object.freeze({
      mode: start.mode,
      level: start.level,
      choices: Object.freeze({ ...start.choices }),
      seed: start.seed,
      topScore: start.topScore,
      storage: start.storage.slice(),
    }),
    fonts,
    random: createRandom(start.seed),
    sound(sound: GameSound): void {
      if (calling) emit({ kind: "sound", at: callAt, sound: checkedSound(sound) });
    },
    vibrate(ms: number): void {
      if (!calling) return;
      if (!positiveInteger(ms))
        violate("effect", `vibrate(${describe(ms)}) is not a positive integer`);
      emit({ kind: "vibrate", at: callAt, ms });
    },
    save(bytes: Uint8Array): boolean {
      if (!calling) return false;
      if (!(bytes instanceof Uint8Array)) violate("effect", "save() takes a Uint8Array");
      if (bytes.length > quota) return false;
      emit({ kind: "save", at: callAt, bytes: bytes.slice() });
      return true;
    },
    over(score?: number): void {
      if (!calling) return;
      if (overCalled) violate("effect", "over() was called twice");
      if (
        score !== undefined &&
        (typeof score !== "number" ||
          !Number.isInteger(score) ||
          score < 0 ||
          score > MAX_SESSION_MS)
      ) {
        violate("effect", `over(${describe(score)}) is not a score in 0..${MAX_SESSION_MS}`);
      }
      emit({ kind: "over", at: callAt, score });
      overCalled = true;
    },
  });

  /**
   * One call into the game at session time `at`. Whatever goes wrong inside it fails the session
   * and drops the effects it made; a game's own `over` ends the session once the call returns.
   */
  function call(at: number, body: () => void): void {
    const kept = effects.length;
    calling = true;
    callAt = at;
    callEffects = 0;
    callNotes = 0;
    try {
      body();
      if (violation !== undefined) fail(violation);
    } catch (error) {
      fail(violation ?? `game: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      calling = false;
    }
    if (failure !== undefined) effects.length = kept;
    else if (overCalled) {
      over = true;
      pending = null;
    }
  }

  /** Applies what a timed call returned (D4), then draws. */
  function settle(at: number, wake: unknown, keepsPending: boolean): void {
    if (wake === null) pending = null;
    else if (typeof wake === "number" && Number.isFinite(wake) && wake >= 0) {
      pending = at + Math.max(MIN_WAKE_MS, Math.ceil(wake));
    } else if (wake !== undefined || !keepsPending) {
      fail(`wake: ${describe(wake)} is not a delay in ms or null`);
      return;
    }
    instance!.draw(screen);
    const packed = screen.pack();
    if (frame === undefined || !sameBytes(frame, packed)) frame = packed;
  }

  function update(at: number): void {
    call(at, () => settle(at, instance!.update(at), false));
  }

  /** Brings the session to `nowMs`: every wake due by then runs first, each at its own time. */
  function enter(nowMs: number): boolean {
    if (!alive()) return false;
    if (!Number.isInteger(nowMs) || nowMs < now) {
      throw new RangeError(
        `Session time is whole ms that never decrease: got ${nowMs} after ${now}`,
      );
    }
    now = nowMs;
    while (alive() && pending !== null && pending <= nowMs && pending < MAX_SESSION_MS) {
      update(pending);
    }
    if (alive() && nowMs >= MAX_SESSION_MS) fail("clock");
    return alive();
  }

  function key(name: GameKey, nowMs: number, down: boolean): void {
    if (!KEYS.includes(name)) throw new TypeError(`${describe(name)} is not a game key`);
    if (!enter(nowMs)) return;
    // A release reaches the game only for a key it saw go down, and a key goes down once.
    if (down === held.has(name)) return;
    if (down) held.add(name);
    else held.delete(name);
    const game = instance!;
    if (down ? !game.keyDown : !game.keyUp) return;
    call(nowMs, () =>
      settle(nowMs, down ? game.keyDown!(name, nowMs) : game.keyUp!(name, nowMs), true),
    );
  }

  call(0, () => {
    const made = definition.create(context);
    if (typeof made?.update !== "function" || typeof made.draw !== "function") {
      throw new Error("create() returned no instance with update and draw");
    }
    instance = made;
  });
  if (alive()) update(0);

  return {
    keyDown: (name, nowMs) => key(name, nowMs, true),
    keyUp: (name, nowMs) => key(name, nowMs, false),
    advance: (nowMs) => void enter(nowMs),
    wake: () => (alive() ? pending : null),
    frame: () => frame,
    drain() {
      const drained = effects;
      effects = [];
      return drained;
    },
    get failure() {
      return failure;
    },
    dispose() {
      disposed = true;
    },
  };
}

/**
 * Runs a definition in-process. Throws if its manifest is not valid. Each `start` is one session:
 * it creates the instance and runs `update(0)`, and frames and effects are ready when a call
 * returns. A session's `failure` starts with its kind: `game` (it threw), `wake` (a malformed
 * delay), `effect` (a malformed ctx call), `limit` (a D19 bound) or `clock`.
 */
export function localGame(definition: GameDefinition): GameModule {
  const manifest = validateManifest(definition.manifest);
  return Object.freeze({
    manifest,
    start: (start: GameStart, fonts: GameFonts) => startSession(definition, manifest, start, fonts),
  });
}
