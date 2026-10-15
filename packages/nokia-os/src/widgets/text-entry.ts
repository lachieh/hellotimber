// Multi-tap entry as the editor and the text-input prompts run it (plan 18 D4, D5): keys go
// through the engine (src/text) on key-down, as the firmware acts (Task 0: a character, C, # in
// 123, ▲/▼ and * redraw ≈50 ms after key-down; a tapped # changes the case on release); holds
// are timed here with TEXT_TIMINGS, not the kernel's long press. The cursor blinks on a
// free-running TEXT_TIMINGS.blinkMs timer from the entry's start: keys and commits never restart
// it (`text/commit` and `text/hold-digit` keep the phase they had before the key).
import type { PhoneKey } from "@hellotimber/phone-core";
import { TEXT_TIMINGS, type StockWidgetTimeline } from "../resources";
import { isTextKey } from "../text/keys";
import { Playback } from "./playback";
import {
  emptyText,
  textClear,
  textDelete,
  textHold,
  textInsert,
  textKey,
  textMove,
  textTick,
  type TextMode,
  type TextState,
} from "../text/multitap";

/** What an entry's Options, symbol table and Insert number may do to it. */
export interface EditorControl {
  /** The text, the pending character committed. */
  readonly text: string;
  /** Erase: the text cleared. */
  clear(): void;
  /** `chars` inserted at the cursor (Insert symbol, Insert number). */
  insert(chars: string): void;
}

export interface TextEntryOptions {
  readonly limit: number;
  readonly text?: string;
  /** Default the end of `text`. */
  readonly cursor?: number;
  readonly mode?: TextMode;
  /**
   * The cursor's blink as a node's own recording shows it (a loop of `cursor`/`plain` steps,
   * plan 14 P9: Welcome note's); default TEXT_TIMINGS.blinkMs steps.
   */
  readonly blink?: StockWidgetTimeline;
}

/** A key held down: when, and when it came up (undefined while it is down). */
interface Held {
  readonly key: PhoneKey;
  readonly downAt: number;
  upAt?: number;
  /** Its hold has acted (123 entered, the text cleared). */
  fired: boolean;
  /** `#` in 123 typed itself at its down; its hold takes it back (`text/hold-hash-back`). */
  typed?: boolean;
}

/** What a key-down asks of the screen around the entry. */
export type EntryRequest = "empty-c" | "symbols" | undefined;

/**
 * Whether a free-running blink shows the cursor `nowMs` after it started: by the node's own
 * recording (`blink`, already advanced to now), else every TEXT_TIMINGS.blinkMs, shown first.
 */
export function blinkShown(blink: Playback | undefined, nowMs: number): boolean {
  if (blink !== undefined) return blink.frame.kind === "cursor";
  return Math.floor(nowMs / TEXT_TIMINGS.blinkMs) % 2 === 0;
}

/** One multi-tap entry: its state, its clock, its holds and its cursor blink. */
export class TextEntry {
  readonly limit: number;
  #state: TextState;
  #now = 0;
  /** The last character key pressed, for a held digit at its commit. */
  #digit: Held | undefined;
  #hash: Held | undefined;
  /** C held after a deletion: when that deletion happened. */
  #clear: Held | undefined;
  readonly #blink: Playback | undefined;

  constructor(options: TextEntryOptions) {
    this.limit = options.limit;
    const text = options.text ?? "";
    this.#state = {
      ...emptyText(options.mode ?? "Abc"),
      text,
      cursor: options.cursor ?? Array.from(text).length,
    };
    this.#blink = options.blink === undefined ? undefined : new Playback(options.blink);
  }

  get state(): TextState {
    return this.#state;
  }

  /** The text with its pending character committed. */
  get text(): string {
    return this.#state.text;
  }

  /** The blink's step: the cursor shows (while nothing is pending). */
  get cursorShown(): boolean {
    return blinkShown(this.#blink, this.#now);
  }

  /** The pending character commits (a screen opens over the entry: Options). */
  commit(): void {
    this.#state = textTick(this.#state, Number.POSITIVE_INFINITY);
  }

  control(): EditorControl {
    return {
      text: this.#state.text,
      clear: () => {
        this.#state = textClear(this.#state);
      },
      insert: (chars) => {
        this.#state = textInsert(this.#state, chars, this.limit);
      },
    };
  }

  keyDown(key: PhoneKey): EntryRequest {
    const limit = this.limit;
    if (isTextKey(key)) {
      this.#state = textKey(this.#state, key, this.#now, limit);
      this.#digit = { key, downAt: this.#now, fired: false };
      return undefined;
    }
    switch (key) {
      case "#": {
        const typed = this.#state.mode === "123";
        this.#hash = { key, downAt: this.#now, fired: false, typed };
        if (typed) this.#state = textKey(this.#state, "#", this.#now, limit);
        return undefined;
      }
      case "*":
        return "symbols";
      case "up":
      case "down":
        this.#state = textMove(this.#state, key);
        return undefined;
      case "c":
        if (this.#state.text === "") return "empty-c";
        this.#state = textDelete(this.#state);
        this.#clear = { key, downAt: this.#now, fired: false };
        return undefined;
      default:
        return undefined;
    }
  }

  keyUp(key: PhoneKey): void {
    if (this.#digit?.key === key && this.#digit.upAt === undefined) this.#digit.upAt = this.#now;
    if (key === "#") {
      const hash = this.#hash;
      this.#hash = undefined;
      if (hash !== undefined && !hash.fired && this.#state.mode !== "123") {
        this.#state = textKey(this.#state, "#", this.#now, this.limit);
      }
    }
    if (key === "c") this.#clear = undefined;
  }

  tick(dtMs: number): void {
    this.#now += dtMs;
    this.#blink?.advance(dtMs);
    const now = this.#now;
    const hash = this.#hash;
    if (hash !== undefined && !hash.fired && now - hash.downAt >= TEXT_TIMINGS.numberModeHoldMs) {
      hash.fired = true;
      // Held in 123, # leaves 123 without the # its down typed (`text/hold-hash-back` row 4).
      const typed = hash.typed === true ? textDelete(this.#state) : this.#state;
      this.#state = textHold(typed, "#", now, this.limit);
    }
    const clear = this.#clear;
    if (
      clear !== undefined &&
      !clear.fired &&
      now - clear.downAt >= TEXT_TIMINGS.clearAfterDeleteMs
    ) {
      clear.fired = true;
      this.#state = textClear(this.#state);
    }
    const pending = this.#state.pending;
    if (pending === null || now < pending.sinceMs + TEXT_TIMINGS.commitMs) return;
    // A digit held long enough types the digit when its letter commits (`text/hold-digit`).
    const digit = this.#digit;
    const held =
      digit !== undefined && digit.key === pending.key && digit.downAt === pending.sinceMs
        ? (digit.upAt ?? now) - digit.downAt
        : 0;
    this.#state =
      isTextKey(pending.key) && held >= TEXT_TIMINGS.digitHoldMs
        ? textHold(this.#state, pending.key, now, this.limit)
        : textTick(this.#state, now);
  }
}
