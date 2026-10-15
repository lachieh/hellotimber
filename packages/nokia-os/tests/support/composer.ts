// Drive the stock Composer as plan 27's captures did (`gen_v639_plan27.py`).
import type { PhoneKey } from "@hellotimber/phone-core";
import type { ComposerModel } from "../../src/display/widgets";
import { composerLines } from "../../src/composer/layout";
import { COMPOSER_LIMIT } from "../../src/composer/notation";
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

/**
 * The editor's view after each key of `keys` from `start`: the engine's state and the layout's
 * top, scrolled key by key as the editor does.
 */
export function replayComposerView(
  start: ComposerState,
  keys: string,
): { state: ComposerState; top: number } {
  let state = start;
  let top = composerLines(state.tokens, state.cursor).top;
  for (const token of keys.split(/\s+/).filter(Boolean)) {
    state = replayComposerKeys(state, token).state;
    top = composerLines(state.tokens, state.cursor, top).top;
  }
  return { state, top };
}

/** The editor's model for `state` with the cursor in its shown phase. */
export function composerModel(state: ComposerState, top: number): ComposerModel {
  const layout = composerLines(state.tokens, state.cursor, top);
  const line = layout.cursorAt.line - layout.top;
  return {
    kind: "composer",
    lines: layout.lines.slice(layout.top, layout.top + 3),
    cursor: { line, x: layout.cursorAt.x },
    counter: String(COMPOSER_LIMIT - state.tokens.length),
    softkey: state.tokens.length === 0 ? "Back" : "Options",
  };
}
