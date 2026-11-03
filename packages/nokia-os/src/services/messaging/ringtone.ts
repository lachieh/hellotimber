// A Composer tone as data (plan 27 K6, D2): what a ringtone message carries and the Composer
// saves. Its notation lives in src/composer/notation.ts and its sound in src/composer/program.ts.

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

/** A saved tone (plan 27 Internal API; stored by `src/composer/store.ts`). */
export interface ComposerTone {
  /** 1-15 characters. */
  readonly name: string;
  /** One of COMPOSER_TEMPI. */
  readonly tempo: number;
  /** 1-50 tokens. */
  readonly tokens: readonly ComposerToken[];
}
