// Plan 18b's T9 predictive text (pure): dictionaries, the engine and the punctuation of key 1.
export { createT9Dictionary, keysOf, t9Index } from "./dictionary";
export type { T9Dictionary, T9Index } from "./dictionary";
export {
  T9_MAX,
  t9Candidates,
  t9Delete,
  t9Display,
  t9FromWord,
  t9Key,
  t9Matches,
  t9Star,
  t9Use,
} from "./engine";
export type { T9Composing, T9Display, T9Key } from "./engine";
export { T9_MARKS, T9_PUNCTUATION } from "./punctuation";
