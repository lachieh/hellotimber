// The Composer's notation (plan 27 K6, D2): a tone is a list of tokens, each a note
// (`[duration][.][#]<note><octave>`, `16.#f2`) or a rest (`[duration]-`, `8-`). Pure.

export type NoteValue = 1 | 2 | 4 | 8 | 16 | 32;
export type NotePitch = "c" | "d" | "e" | "f" | "g" | "a" | "b";

export type ComposerToken =
  | {
      readonly kind: "note";
      readonly value: NoteValue;
      readonly dotted: boolean;
      readonly pitch: NotePitch;
      /** c, d, f, g and a only. */
      readonly sharp: boolean;
      readonly octave: 1 | 2 | 3;
    }
  | { readonly kind: "rest"; readonly value: NoteValue };

/** A tone holds at most this many tokens (K6: the counter reads 0). */
export const COMPOSER_LIMIT = 50;

export const NOTE_VALUES: readonly NoteValue[] = [1, 2, 4, 8, 16, 32];
export const NOTE_PITCHES: readonly NotePitch[] = ["c", "d", "e", "f", "g", "a", "b"];
/** The notes `#` sharpens (K4). */
export const SHARPABLE: ReadonlySet<NotePitch> = new Set(["c", "d", "f", "g", "a"]);

export function formatToken(token: ComposerToken): string {
  if (token.kind === "rest") return `${token.value}-`;
  return `${token.value}${token.dotted ? "." : ""}${token.sharp ? "#" : ""}${token.pitch}${token.octave}`;
}

/** The notation of `tokens`, separated by one space. */
export function formatTokens(tokens: readonly ComposerToken[]): string {
  return tokens.map(formatToken).join(" ");
}

const TOKEN = /^(1|2|4|8|16|32)(?:(\.?)(#?)([a-g])([1-3])|-)$/;

function parseToken(text: string): ComposerToken {
  const match = TOKEN.exec(text);
  if (match === null) throw new Error(`Invalid composer token "${text}".`);
  const value = Number(match[1]) as NoteValue;
  if (match[4] === undefined) return { kind: "rest", value };
  const pitch = match[4] as NotePitch;
  const sharp = match[3] === "#";
  if (sharp && !SHARPABLE.has(pitch)) throw new Error(`Invalid composer token "${text}".`);
  return {
    kind: "note",
    value,
    dotted: match[2] === ".",
    pitch,
    sharp,
    octave: Number(match[5]) as 1 | 2 | 3,
  };
}

/** Tokens from their notation (space-separated); throws naming an invalid token. */
export function parseTokens(text: string): readonly ComposerToken[] {
  return text
    .split(/\s+/)
    .filter((part) => part !== "")
    .map(parseToken);
}
