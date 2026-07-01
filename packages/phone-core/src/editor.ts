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

/** The ctx handed to onMenu entries — mirrors the AppFactory ctx. */
export interface EditorMenuCtx {
  exit(): void;
  open(appId: string): void;
}

export interface EditorOptions {
  title: string;
  initial?: string;
  /** Max text length; carried on the editor ScreenModel as `limit` (SMS countdown). */
  charLimit?: number;
  /** Legacy: called with the final text when the user presses the NaviKey (no menu). */
  onAccept?: (text: string) => void;
  /** When present, the NaviKey opens an "Options" list over the draft instead. */
  menu?: { id: string; label: string }[];
  /** Called for menu picks. Ids "clear"/"exit" are built-in (clear text / ctx.exit()). */
  onMenu?: (id: string, text: string, ctx: EditorMenuCtx) => void;
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
    /** Selection in the Options list, or null while the editor itself shows. */
    let options: number | null = null;

    // The AppFactory ctx already matches EditorMenuCtx — pass it straight through.
    const menuCtx: EditorMenuCtx = ctx;

    /** Reject edits that would grow the text past charLimit (cycling never grows). */
    function limited(next: MultitapState): MultitapState {
      if (opts.charLimit !== undefined && next.text.length > opts.charLimit) return state;
      return next;
    }

    function optionsShortPress(key: PhoneKey): void {
      const menu = opts.menu ?? [];
      if (key === "c") {
        options = null; // back to the draft
        return;
      }
      if (key === "up" || key === "down") {
        if (menu.length === 0) return;
        const dir = key === "down" ? 1 : -1;
        options = ((((options ?? 0) + dir) % menu.length) + menu.length) % menu.length;
        return;
      }
      if (key === "navi") {
        const entry = menu[options ?? 0];
        options = null;
        if (entry === undefined) return;
        if (entry.id === "clear") {
          state = clearAll(state);
          return;
        }
        if (entry.id === "exit") {
          ctx.exit();
          return;
        }
        opts.onMenu?.(entry.id, state.text, menuCtx);
      }
      // digits/*/# do nothing while the Options list is up.
    }

    function shortPress(key: PhoneKey): void {
      if (options !== null) {
        optionsShortPress(key);
        return;
      }
      if (DIGITS.has(key)) {
        state = limited(pressDigit(state, key as MultitapKey, now));
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
        if (opts.menu !== undefined) {
          options = 0; // open the Options list over the draft
          return;
        }
        opts.onAccept?.(state.text);
        ctx.exit();
      }
      // '*' (special-character picker) and 'power' are not handled here.
    }

    function longPress(key: PhoneKey): void {
      if (options !== null) return; // long presses belong to the draft view only
      if (DIGITS.has(key)) {
        state = limited(holdDigit(state, key as MultitapKey)); // hold-digit = number, hold-0 = 123
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
        if (options !== null && opts.menu !== undefined) {
          return {
            kind: "list",
            title: "Options",
            items: opts.menu.map((entry) => entry.label),
            selected: options,
            softkey: "Select",
          };
        }
        return {
          kind: "editor",
          title: opts.title,
          text: state.text,
          cursor: state.cursor,
          mode: state.mode,
          ...(opts.charLimit !== undefined ? { limit: opts.charLimit } : {}),
        };
      },
    };
    return app;
  };
}
