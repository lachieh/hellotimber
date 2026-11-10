// Recording from play (plan 28 D11): wraps a module so that a live session's keys are logged with
// their session ms. A replay needs nothing else, because the game's wakes follow from them.

import type { GameFonts, GameKey, GameModule, GameSession, GameStart } from "./contract";
import { recordReplay, serializeReplay, type ReplayKey } from "./replay";

interface Played {
  readonly start: GameStart;
  readonly fonts: GameFonts;
  readonly keys: ReplayKey[];
  /** The last session ms the host gave. */
  until: number;
}

/**
 * The same module, remembering the start and keys of its latest session. `lastReplay()` plays them
 * again through `module` and returns the `game-replay 1` text of what the game did, so `module`
 * must give its results synchronously, as `localGame` does. It throws if the game fails in the replay.
 */
export function recording(module: GameModule): GameModule & { lastReplay(): string | undefined } {
  let last: Played | undefined;
  return {
    manifest: module.manifest,
    start(start, fonts) {
      const session = module.start(start, fonts);
      const played: Played = {
        start: { ...start, choices: { ...start.choices }, storage: start.storage.slice() },
        fonts,
        keys: [],
        until: 0,
      };
      last = played;
      // A call is logged once the session has taken it: one it throws on never happened. A time
      // out of order that it did not throw on went to a session already over, which ignored it.
      const taken = (nowMs: number): boolean => {
        if (!Number.isInteger(nowMs) || nowMs < played.until) return false;
        played.until = nowMs;
        return true;
      };
      const key = (name: GameKey, nowMs: number, down: boolean): void => {
        if (down) session.keyDown(name, nowMs);
        else session.keyUp(name, nowMs);
        if (taken(nowMs)) played.keys.push({ at: nowMs, key: name, down });
      };
      const wrapped: GameSession = {
        keyDown: (name, nowMs) => key(name, nowMs, true),
        keyUp: (name, nowMs) => key(name, nowMs, false),
        advance(nowMs) {
          session.advance(nowMs);
          taken(nowMs);
        },
        wake: () => session.wake(),
        frame: () => session.frame(),
        drain: () => session.drain(),
        get failure() {
          return session.failure;
        },
        dispose: () => session.dispose(),
      };
      return wrapped;
    },
    lastReplay() {
      if (last === undefined) return undefined;
      const { start, fonts, keys, until } = last;
      return serializeReplay(recordReplay(module, start, keys, until, { fonts }));
    },
  };
}
