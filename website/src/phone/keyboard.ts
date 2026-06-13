import type { KeyEvent, PhoneKey } from "@hellotimber/phone-core";

/**
 * Physical keyboard → phone key. Arrow keys scroll, Enter is the NaviKey,
 * Backspace/Escape are the C key, digits and the star/hash keys map to
 * themselves, p toggles power. Key SEMANTICS (long-press, multi-tap,
 * shortcuts) live in phone-core.
 */
export function phoneKeyForKeyboardKey(key: string): PhoneKey | null {
  switch (key) {
    case "ArrowUp":
      return "up";
    case "ArrowDown":
      return "down";
    case "Enter":
      return "navi";
    case "Backspace":
    case "Escape":
      return "c";
    case "p":
    case "P":
      return "power";
    case "*":
    case "#":
      return key;
    default:
      return /^[0-9]$/.test(key) ? (key as PhoneKey) : null;
  }
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
}

/**
 * Attach document-level key handling. preventDefault ONLY for handled keys;
 * text inputs and modifier chords pass through untouched. Returns a detach
 * function. The param is the runtime input funnel (deviation 10) — keys flow
 * through `input(key, action)` so the runtime can watch the stream (*#06#,
 * screensaver idle). Tests can pass a stub.
 */
export function attachKeyboard(
  input: (key: PhoneKey, action: KeyEvent["type"]) => void,
  doc: Document = document,
): () => void {
  const handle = (type: KeyEvent["type"]) => (e: KeyboardEvent) => {
    if (isTextEntryTarget(e.target)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const key = phoneKeyForKeyboardKey(e.key);
    if (key === null) return;
    e.preventDefault();
    if (type === "down" && e.repeat) return; // OS auto-repeat: hold = one down
    input(key, type);
  };
  const onKeyDown = handle("down");
  const onKeyUp = handle("up");
  doc.addEventListener("keydown", onKeyDown);
  doc.addEventListener("keyup", onKeyUp);
  return () => {
    doc.removeEventListener("keydown", onKeyDown);
    doc.removeEventListener("keyup", onKeyUp);
  };
}
