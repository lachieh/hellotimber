// The stock multi-tap character tables (plan 18 D2, D6): each key's cycle in upper case (also
// used at a sentence start) and lower case, the symbol table, and the typeable set. Every row was
// read from Task 0's captures, cited per row; `text/key-<k>-<case>` holds each cycle press by
// press (the second cycle repeats the first, plan 18 Task 0).

/** A key that types characters. */
export type TextKey = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

export const TEXT_KEYS: readonly TextKey[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

export interface KeyCycles {
  /** ABC, and Abc at a sentence start. */
  readonly upper: readonly string[];
  /** abc, and Abc elsewhere. */
  readonly lower: readonly string[];
}

const cycle = (chars: string): readonly string[] => Array.from(chars);

/** Each key's characters, in press order (the cycle wraps to the first). */
export const MULTITAP_KEYS: Readonly<Record<TextKey, KeyCycles>> = {
  // text/key-1-upper (11 presses), text/key-1-lower (8: no @ \ /).
  "1": { upper: cycle(".,'?!-&1@\\/"), lower: cycle(".,'?!-&1") },
  // text/key-2-upper, text/key-2-lower (11 each).
  "2": { upper: cycle("ABC2ÄÀÁÂÃÆÇ"), lower: cycle("abc2äàáâãæç") },
  // text/key-3-upper, text/key-3-lower (8 each).
  "3": { upper: cycle("DEF3ÈÉËÊ"), lower: cycle("def3èéëê") },
  // text/key-4-upper, text/key-4-lower (10 each; İ and ı are the Turkish dotted and dotless i).
  "4": { upper: cycle("GHI4ÎÏÌÍİĞ"), lower: cycle("ghi4îïìíığ") },
  // text/key-5-upper, text/key-5-lower (5 each).
  "5": { upper: cycle("JKL5£"), lower: cycle("jkl5£") },
  // text/key-6-upper, text/key-6-lower (10 each).
  "6": { upper: cycle("MNO6ÖÔÒÓØÑ"), lower: cycle("mno6öôòóøñ") },
  // text/key-7-upper (6), text/key-7-lower (7: ß last).
  "7": { upper: cycle("PQRS7$"), lower: cycle("pqrs7$ß") },
  // text/key-8-upper, text/key-8-lower (8 each).
  "8": { upper: cycle("TUV8ÜÙÛÚ"), lower: cycle("tuv8üùûú") },
  // text/key-9-upper, text/key-9-lower (5 each).
  "9": { upper: cycle("WXYZ9"), lower: cycle("wxyz9") },
  // text/key-0-upper, text/key-0-lower (2 each).
  "0": { upper: cycle(" 0"), lower: cycle(" 0") },
};

/** The symbol table in order, rows of 11/11/9 (text/symbols-down, plan 18 Task 0). */
export const SYMBOLS: readonly string[] = cycle(".,?!:;-+#*()\\'\"_@&$£%/<>¿¡§=¤€¥");

/** Every character the editor can type: the cycles and the symbol table (149, D6). */
export const TYPEABLE: ReadonlySet<string> = new Set([
  ...Object.values(MULTITAP_KEYS).flatMap((keys) => [...keys.upper, ...keys.lower]),
  ...SYMBOLS,
]);

export function isTextKey(key: string): key is TextKey {
  return (TEXT_KEYS as readonly string[]).includes(key);
}
