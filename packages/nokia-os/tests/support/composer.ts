// Drive the stock Composer as plan 27's captures did (`gen_v639_plan27.py`).
import type { PhoneKey } from "@hellotimber/phone-core";
import {
  composerHeld,
  composerKeyDown,
  isNoteKey,
  type ComposerState,
} from "../../src/composer/editor";

/** Task 0 H (provisional until COMPOSER_TIMINGS): a hold's times from its key-down. */
const HOLD = { dotMs: 771, clearMs: 465, repeatFirstMs: 778, repeatEveryMs: 196 } as const;

const KEY_NAMES: Readonly<Record<string, PhoneKey>> = { menu: "navi" };

function phoneKey(name: string): PhoneKey {
  return KEY_NAMES[name] ?? (name as PhoneKey);
}

/**
 * The editor engine through harness tokens (`1`, `1@1500`, `+500`): each key's down, and for a
 * held key what its hold does (a note key's dot, C's clear, ▲/▼'s repeats) by its duration.
 */
export function replayComposerKeys(start: ComposerState, keys: string): { state: ComposerState } {
  let state = start;
  for (const token of keys.split(/\s+/).filter(Boolean)) {
    if (token.startsWith("+")) continue;
    const held = /^(.+)[@~](\d+)$/.exec(token);
    const key = phoneKey(held ? held[1]! : token);
    const ms = held ? Number(held[2]) : 42;
    const before = state.tokens.length;
    state = composerKeyDown(state, key).state;
    if (isNoteKey(key) && ms >= HOLD.dotMs && state.tokens.length > before) {
      state = composerHeld(state, key).state;
    } else if (key === "c" && ms >= HOLD.clearMs) {
      state = composerHeld(state, key).state;
    } else if (key === "up" || key === "down") {
      for (let t = HOLD.repeatFirstMs; t < ms; t += HOLD.repeatEveryMs) {
        state = composerKeyDown(state, key).state;
      }
    }
  }
  return { state };
}
