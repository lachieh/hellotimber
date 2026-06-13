import { LONG_PRESS_MS } from "./machine";
import {
  clearAll,
  commitPending,
  createMultitap,
  deleteLeft,
  holdDigit,
  moveCursor,
  pressDigit,
  pressHash,
  tickMultitap,
} from "./multitap";
import type { MultitapKey, MultitapState } from "./multitap";
import type { AppFactory, KeyEvent, PhoneApp, PhoneKey, ScreenModel } from "./types";

export interface EditorOptions {
  title: string;
  initial?: string;
  /** Called with the final text when the user presses the NaviKey. */
  onAccept?: (text: string) => void;
}

const DIGITS: ReadonlySet<PhoneKey> = new Set(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);

/**
 * A traditional multi-tap text editor hosted as a PhoneApp (the contract's
 * MenuNode union has no editor variant — wire it as {type:'app'}).
 * Time arrives only via tick(dtMs), so the app keeps its own clock.
 */
export function editorApp(opts: EditorOptions): AppFactory {
  return (ctx) => {
    const initial = opts.initial ?? "";
    let state: MultitapState = { ...createMultitap(), text: initial, cursor: initial.length };
    let now = 0;
    let held: { key: PhoneKey; downAt: number; longFired: boolean } | null = null;

    function shortPress(key: PhoneKey): void {
      if (DIGITS.has(key)) {
        state = pressDigit(state, key as MultitapKey, now);
        return;
      }
      if (key === "#") {
        state = pressHash(state);
        return;
      }
      if (key === "up") {
        state = moveCursor(state, -1);
        return;
      }
      if (key === "down") {
        state = moveCursor(state, 1);
        return;
      }
      if (key === "c") {
        if (state.text.length === 0) {
          ctx.exit(); // backing out of an empty editor leaves it
          return;
        }
        state = deleteLeft(state);
        return;
      }
      if (key === "navi") {
        state = commitPending(state);
        opts.onAccept?.(state.text);
        ctx.exit();
      }
      // '*' (special-character picker) and 'power' are not handled here.
    }

    function longPress(key: PhoneKey): void {
      if (DIGITS.has(key)) {
        state = holdDigit(state, key as MultitapKey); // hold-digit = number, hold-0 = 123
        return;
      }
      if (key === "c") state = clearAll(state);
    }

    const app: PhoneApp = {
      onKey(e: KeyEvent): void {
        if (e.type === "down") {
          held = { key: e.key, downAt: now, longFired: false };
          return;
        }
        if (held === null || held.key !== e.key) return;
        const wasLong = held.longFired;
        held = null;
        if (!wasLong) shortPress(e.key);
      },
      tick(dtMs: number): void {
        now += dtMs;
        if (held !== null && !held.longFired && now - held.downAt >= LONG_PRESS_MS) {
          held.longFired = true;
          longPress(held.key);
        }
        state = tickMultitap(state, now);
      },
      render(): ScreenModel {
        return {
          kind: "editor",
          title: opts.title,
          text: state.text,
          cursor: state.cursor,
          mode: state.mode,
        };
      },
    };
    return app;
  };
}
