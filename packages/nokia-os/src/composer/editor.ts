// The Composer's note editor (plan 27 D1, D2, K3-K6): pure rules over a list of tokens and a
// cursor (the number of tokens before it). Keys act on key-down; holds are timed by the widget,
// which calls `composerHeld` when a key has been down long enough. No widget, timer or storage.
import type { PhoneKey } from "@hellotimber/phone-core";
import {
  COMPOSER_LIMIT,
  NOTE_PITCHES,
  SHARPABLE,
  type ComposerToken,
  type NoteValue,
} from "./notation";

export interface ComposerState {
  readonly tokens: readonly ComposerToken[];
  /** 0..tokens.length: the tokens before the cursor. */
  readonly cursor: number;
}

export interface ComposerEdit {
  readonly state: ComposerState;
  /** The note to sound (K8), when the key added a note or changed one. */
  readonly sound?: ComposerToken;
}

export const EMPTY_COMPOSER: ComposerState = { tokens: [], cursor: 0 };

/** Note keys 1-7 → c … b. */
const NOTE_KEYS: Readonly<Record<string, (typeof NOTE_PITCHES)[number]>> = Object.fromEntries(
  NOTE_PITCHES.map((pitch, i) => [String(i + 1), pitch]),
);

/** Whether `key` enters a note (1-7). */
export function isNoteKey(key: PhoneKey): boolean {
  return NOTE_KEYS[key] !== undefined;
}

/**
 * What a new token copies (K3, Task 0 E): the duration and octave of the nearest note before the
 * cursor, rests skipped (`4c2 8- 4d2`); never its dot or sharp; 4 and octave 1 with none.
 */
function inherited(state: ComposerState): { value: NoteValue; octave: 1 | 2 | 3 } {
  for (let i = state.cursor - 1; i >= 0; i--) {
    const token = state.tokens[i]!;
    if (token.kind === "note") return { value: token.value, octave: token.octave };
  }
  return { value: 4, octave: 1 };
}

function insert(state: ComposerState, token: ComposerToken): ComposerState {
  const tokens = [...state.tokens];
  tokens.splice(state.cursor, 0, token);
  return { tokens, cursor: state.cursor + 1 };
}

/** The token before the cursor replaced by `change(token)`; unchanged when there is none. */
function modify(
  state: ComposerState,
  change: (token: ComposerToken) => ComposerToken,
): ComposerEdit {
  const before = state.tokens[state.cursor - 1];
  if (before === undefined) return { state };
  const after = change(before);
  if (after === before) return { state };
  const tokens = [...state.tokens];
  tokens[state.cursor - 1] = after;
  const next = { tokens, cursor: state.cursor };
  return after.kind === "note" ? { state: next, sound: after } : { state: next };
}

/** 8 shortens through 4, 8, 16, 32, 1, 2 (wrapping); 9 lengthens the other way (K4). */
function cycleValue(value: NoteValue, step: 1 | -1): NoteValue {
  const order: readonly NoteValue[] = [4, 8, 16, 32, 1, 2];
  const i = order.indexOf(value);
  return order[(i + step + order.length) % order.length]!;
}

/** A key going down on the editor (K3-K6). C on an empty editor is the widget's (it leaves). */
export function composerKeyDown(state: ComposerState, key: PhoneKey): ComposerEdit {
  const full = state.tokens.length >= COMPOSER_LIMIT;
  const pitch = NOTE_KEYS[key];
  if (pitch !== undefined) {
    if (full) return { state };
    const { value, octave } = inherited(state);
    const note: ComposerToken = { kind: "note", value, dotted: false, pitch, sharp: false, octave };
    return { state: insert(state, note), sound: note };
  }
  switch (key) {
    case "0":
      return full
        ? { state }
        : { state: insert(state, { kind: "rest", value: inherited(state).value }) };
    case "8":
    case "9": {
      const step = key === "8" ? 1 : -1;
      return modify(state, (token) => ({ ...token, value: cycleValue(token.value, step) }));
    }
    case "*":
      return modify(state, (token) =>
        token.kind === "note" ? { ...token, octave: ((token.octave % 3) + 1) as 1 | 2 | 3 } : token,
      );
    case "#":
      return modify(state, (token) =>
        token.kind === "note" && SHARPABLE.has(token.pitch)
          ? { ...token, sharp: !token.sharp }
          : token,
      );
    case "up":
    case "down": {
      const positions = state.tokens.length + 1;
      const step = key === "up" ? 1 : -1;
      return { state: { ...state, cursor: (state.cursor + step + positions) % positions } };
    }
    case "c": {
      if (state.cursor === 0) return { state };
      const tokens = [...state.tokens];
      tokens.splice(state.cursor - 1, 1);
      return { state: { tokens, cursor: state.cursor - 1 } };
    }
    default:
      return { state };
  }
}

/**
 * A key still down at its hold time (K5, K6): a note key that inserted a note dots it (the token
 * before the cursor), C clears every token. Other keys act once (Task 0 H).
 */
export function composerHeld(state: ComposerState, key: PhoneKey): ComposerEdit {
  if (key === "c") return { state: EMPTY_COMPOSER };
  if (!isNoteKey(key)) return { state };
  const before = state.tokens[state.cursor - 1];
  if (before?.kind !== "note" || before.dotted) return { state };
  return modify(state, (token) => ({ ...token, dotted: true }));
}
