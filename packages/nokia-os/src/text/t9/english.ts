// @hellotimber/nokia-os/t9-english (plan 18b D5): the English T9 dictionary, built from the open
// word list (generated/english.ts; provenance and licence in THIRD_PARTY.md). A separate entry
// point, so hosts load it as its own chunk (`await import(...)`) and pass it as
// `StockPhoneConfig.t9.english`; it is indexed on its first lookup.
import { createT9Dictionary, type T9Dictionary } from "./dictionary";
import { ENGLISH_T9_WORDS } from "./generated/english";

export type { T9Dictionary } from "./dictionary";

export const englishT9: T9Dictionary = createT9Dictionary("english", ENGLISH_T9_WORDS);
