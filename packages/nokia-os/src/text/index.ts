// Plan 18's text entry: the multi-tap tables, the entry engine and the editor layout (pure).
export { isTextKey, MULTITAP_KEYS, SYMBOLS, TEXT_KEYS, TYPEABLE } from "./keys";
export type { KeyCycles, TextKey } from "./keys";
export {
  emptyText,
  pendingCycle,
  shownMode,
  textClear,
  textDelete,
  textHold,
  textInsert,
  textKey,
  textMove,
  textTick,
} from "./multitap";
export type { TextInputKey, TextMode, TextState } from "./multitap";
export {
  advance,
  cursorLine,
  EDITOR_LINE_WIDTH,
  pendingSlot,
  textWidth,
  viewTop,
  wrapText,
} from "./layout";
export type { PendingSlot, TextLine } from "./layout";
