// @vitest-environment jsdom
import type { KeyEvent, PhoneKey } from "@hellotimber/phone-core";
import { describe, expect, it } from "vite-plus/test";
import { attachKeyboard, phoneKeyForKeyboardKey } from "../src/phone/keyboard";

describe("phoneKeyForKeyboardKey", () => {
  it("maps the documented keys", () => {
    expect(phoneKeyForKeyboardKey("ArrowUp")).toBe("up");
    expect(phoneKeyForKeyboardKey("ArrowDown")).toBe("down");
    expect(phoneKeyForKeyboardKey("Enter")).toBe("navi");
    expect(phoneKeyForKeyboardKey("Backspace")).toBe("c");
    expect(phoneKeyForKeyboardKey("Escape")).toBe("c");
    expect(phoneKeyForKeyboardKey("p")).toBe("power");
    expect(phoneKeyForKeyboardKey("P")).toBe("power");
    expect(phoneKeyForKeyboardKey("*")).toBe("*");
    expect(phoneKeyForKeyboardKey("#")).toBe("#");
    for (const d of ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]) {
      expect(phoneKeyForKeyboardKey(d)).toBe(d);
    }
  });

  it("returns null for everything else", () => {
    for (const k of ["a", "F5", "Tab", " ", "ArrowLeft", "Shift", "Dead"]) {
      expect(phoneKeyForKeyboardKey(k)).toBeNull();
    }
  });
});

describe("attachKeyboard", () => {
  function recordingPhone() {
    const sent: KeyEvent[] = [];
    // The runtime input funnel: (key, action) → reconstruct the KeyEvent shape.
    const input = (key: PhoneKey, type: KeyEvent["type"]) => sent.push({ type, key });
    return { sent, input };
  }

  function press(target: EventTarget, type: "keydown" | "keyup", key: string): KeyboardEvent {
    const event = new KeyboardEvent(type, { key, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event;
  }

  it("sends down/up for handled keys and prevents default", () => {
    const { sent, input } = recordingPhone();
    const detach = attachKeyboard(input);
    const down = press(document, "keydown", "Enter");
    const up = press(document, "keyup", "Enter");
    expect(sent).toEqual([
      { type: "down", key: "navi" },
      { type: "up", key: "navi" },
    ]);
    expect(down.defaultPrevented).toBe(true);
    expect(up.defaultPrevented).toBe(true);
    detach();
  });

  it("ignores unhandled keys and leaves their default alone", () => {
    const { sent, input } = recordingPhone();
    const detach = attachKeyboard(input);
    const ev = press(document, "keydown", "a");
    expect(sent).toEqual([]);
    expect(ev.defaultPrevented).toBe(false);
    detach();
  });

  it("ignores modifier chords (Cmd/Ctrl/Alt)", () => {
    const { sent, input } = recordingPhone();
    const detach = attachKeyboard(input);
    const ev = new KeyboardEvent("keydown", {
      key: "5",
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(ev);
    expect(sent).toEqual([]);
    expect(ev.defaultPrevented).toBe(false);
    detach();
  });

  it("ignores keys typed into inputs and textareas", () => {
    const { sent, input } = recordingPhone();
    const detach = attachKeyboard(input);
    const inputEl = document.createElement("input");
    const textarea = document.createElement("textarea");
    document.body.append(inputEl, textarea);
    press(inputEl, "keydown", "Enter");
    press(textarea, "keydown", "5");
    expect(sent).toEqual([]);
    inputEl.remove();
    textarea.remove();
    detach();
  });

  it("stops sending after detach", () => {
    const { sent, input } = recordingPhone();
    const detach = attachKeyboard(input);
    detach();
    press(document, "keydown", "Enter");
    expect(sent).toEqual([]);
  });
});
