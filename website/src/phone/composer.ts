/**
 * Parser for the Nokia composer notation (docs/specs/nokia-3310.md §8):
 * token = [duration][.][#][note][octave], '-' instead of note+octave = rest.
 * Manual example verbatim: `16.a2 16d2 16#f2 16a1 16d2 16#f2 8a2 1- 8-`.
 * Pitch mapping: composer octave 1 = scientific octave 5 (a1 = 880 Hz) —
 * matches the handset's high piezo rendition.
 */
export interface ComposerNote {
  /** Hz; null = rest. */
  freq: number | null;
  ms: number;
}

const NOTE_OFFSETS: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const TOKEN_RE = /^(32|16|8|4|2|1)(\.?)(?:-|(#?)([a-g])([1-3]))$/;

export function parseComposer(notation: string, bpm: number): ComposerNote[] {
  const quarterMs = 60_000 / bpm;
  return notation
    .trim()
    .split(/\s+/)
    .map((token) => {
      const m = TOKEN_RE.exec(token);
      if (m === null) throw new Error(`bad composer token: "${token}"`);
      const [, duration, dot, sharp, note, octave] = m;
      const ms = quarterMs * (4 / Number(duration)) * (dot === "." ? 1.5 : 1);
      if (note === undefined) return { freq: null, ms };
      const midi = 12 * (Number(octave) + 5) + NOTE_OFFSETS[note]! + (sharp === "#" ? 1 : 0);
      return { freq: 440 * 2 ** ((midi - 69) / 12), ms };
    });
}
