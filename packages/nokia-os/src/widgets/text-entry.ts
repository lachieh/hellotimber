// Multi-tap entry as the editor and the text-input prompts run it (plan 18 D4, D5): keys go
// through the engine (src/text) on key-down, as the firmware acts (Task 0: a character, C, # in
// 123, ▲/▼ and * redraw ≈50 ms after key-down; a tapped # changes the case on release); holds
// are timed here with TEXT_TIMINGS, not the kernel's long press. The cursor blinks on a
// free-running TEXT_TIMINGS.blinkMs timer from the entry's start: keys and commits never restart
// it (`text/commit` and `text/hold-digit` keep the phase they had before the key).
//
// Plan 18b: while the entry's T9 context is present (Dictionary English) the keys go through the
// T9 editing rules (src/text/t9/editing.ts) instead: letter keys, `*`, `0`, `1` and C act on
// key-down; a digit key held TEXT_TIMINGS.digitHoldMs undoes its press and types the digit; `*`
// held T9_SYMBOLS_HOLD_MS with no composing word asks for the symbol table. A Dictionary change
// takes effect at the next key or frame.
import type { PhoneKey } from "@hellotimber/phone-core";
import { TEXT_TIMINGS, type StockWidgetTimeline } from "../resources";
import { isTextKey, type TextKey } from "../text/keys";
import { Playback } from "./playback";
import {
  emptyText,
  sentenceStart,
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
import {
  composingWord,
  t9ClearText,
  t9Commit,
  t9DeleteKey,
  t9Hash,
  t9HoldDigit,
  t9HoldHash,
  t9InsertText,
  t9MoveKey,
  t9ReplaceComposing,
  t9Space,
  t9StarKey,
  t9SwitchMode,
  t9TypeKey,
  t9UseMatch,
  wordAroundCursor,
  type T9Context,
} from "../text/t9/editing";
import { t9Matches, type T9Display } from "../text/t9/engine";

/**
 * How long `*` is held with no composing word before the symbol table opens (spec 5: held
 * ≈1.5 s in the capture; UNVERIFIED threshold, the held-# one).
 */
export const T9_SYMBOLS_HOLD_MS = TEXT_TIMINGS.numberModeHoldMs;

/** What an entry's Options, symbol table and Insert number may do to it. */
export interface EditorControl {
  /** The text, the pending character committed (a T9 composing word included). */
  readonly text: string;
  /** Erase: the text cleared. */
  clear(): void;
  /** `chars` inserted at the cursor (Insert symbol, Insert number); a T9 word ends first. */
  insert(chars: string): void;
  /** Plan 18b: what the T9 editor's Options do (present while T9 is on). */
  readonly t9?: T9EditorControl;
}

/** The T9 editor's Options and prompts (plan 18b, spec 10). */
export interface T9EditorControl {
  /** A word is composing: Options lists Matches. */
  readonly composing: boolean;
  /** Matches: the composing word's other candidates, then itself. */
  matches(): readonly string[];
  /** Matches › Use. */
  useMatch(index: number): void;
  /** The text without the composing word (the Insert word prompt counts with it). */
  readonly textBesideWord: string;
  /** Insert word's case: a sentence starts at the cursor. */
  readonly sentenceStart: boolean;
  /** Spell's case: a sentence starts where the composing word does. */
  readonly wordSentenceStart: boolean;
  /** Insert word's OK: `word` at the cursor; returns the whole word there (the user word). */
  insertWord(word: string): string;
  /** Spell's OK: `word` in place of the composing word; returns the whole word there. */
  spell(word: string): string;
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
  /** Plan 18b: the T9 dictionary and user words while T9 is on; undefined: multi-tap. */
  readonly t9?: () => T9Context | undefined;
  /**
   * Plan 17: the blink restarts, the cursor shown, when a pending character commits (Rename's
   * prompt: `profiles/rename-*-type`). Default off: the editor's blink never restarts.
   */
  readonly restartBlinkOnCommit?: boolean;
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
  /** T9: the entry before the key's press (a held digit undoes the press). */
  before?: TextState;
}

/** What a key-down (or a hold) asks of the screen around the entry. */
export type EntryRequest = "empty-c" | "symbols" | undefined;

/**
 * Whether a free-running blink shows the cursor `nowMs` after it started: by the node's own
 * recording (`blink`, already advanced to now), else every TEXT_TIMINGS.blinkMs, shown first.
 */
export function blinkShown(blink: Playback | undefined, nowMs: number): boolean {
  if (blink !== undefined) return blink.frame.kind === "cursor";
  return Math.floor(nowMs / TEXT_TIMINGS.blinkMs) % 2 === 0;
}

/** One multi-tap or T9 entry: its state, its clock, its holds and its cursor blink. */
export class TextEntry {
  readonly limit: number;
  readonly #restartBlink: boolean;
  #state: TextState;
  #now = 0;
  /** The last character key pressed, for a held digit at its commit. */
  #digit: Held | undefined;
  #hash: Held | undefined;
  /** C held after a deletion: when that deletion happened. */
  #clear: Held | undefined;
  /** T9: `*` pressed with no composing word. */
  #star: Held | undefined;
  #blink: Playback | undefined;
  readonly #blinkTimeline: StockWidgetTimeline | undefined;
  /**
   * When the cursor's blink (re)started: the entry's start, a commit with restartBlinkOnCommit,
   * or `restartBlink`.
   */
  #blinkFrom = 0;
  readonly #t9: (() => T9Context | undefined) | undefined;
  /** The state follows the T9 rules (the context was present at the last look). */
  #t9On: boolean;

  constructor(options: TextEntryOptions) {
    this.limit = options.limit;
    this.#restartBlink = options.restartBlinkOnCommit ?? false;
    const text = options.text ?? "";
    this.#state = {
      ...emptyText(options.mode ?? "Abc"),
      text,
      cursor: options.cursor ?? Array.from(text).length,
    };
    this.#blinkTimeline = options.blink;
    this.#blink = options.blink === undefined ? undefined : new Playback(options.blink);
    this.#t9 = options.t9;
    this.#t9On = false;
    this.context();
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
    return blinkShown(this.#blink, this.#now - this.#blinkFrom);
  }

  /**
   * The entry is drawn again after a screen above it closed: its cursor blink starts over, shown
   * (plan 18b: `t9/dictionary-off-on/05-off` shows the editor's cursor for a whole step after the
   * note).
   */
  restartBlink(): void {
    this.#blinkFrom = this.#now;
    if (this.#blinkTimeline !== undefined) this.#blink = new Playback(this.#blinkTimeline);
  }

  /**
   * The T9 context now, or undefined in multi-tap. A Dictionary change since the last look ends
   * the composing word and carries the mode over (`t9SwitchMode`).
   */
  context(): T9Context | undefined {
    const ctx = this.#t9?.();
    const on = ctx !== undefined;
    if (on !== this.#t9On) {
      this.#t9On = on;
      this.#state = t9SwitchMode(this.#state, on);
    }
    return ctx;
  }

  /** The composing word as shown (T9), or undefined. */
  composing(): T9Display | undefined {
    const ctx = this.context();
    return ctx === undefined ? undefined : composingWord(this.#state, ctx);
  }

  /** The pending character commits (a screen opens over the entry: Options). */
  commit(): void {
    this.#state = textTick(this.#state, Number.POSITIVE_INFINITY);
  }

  control(): EditorControl {
    const ctx = this.context();
    const insert = (chars: string): void => {
      this.#state =
        this.context() === undefined
          ? textInsert(this.#state, chars, this.limit)
          : t9InsertText(this.#state, chars, this.limit);
    };
    return {
      text: this.#state.text,
      clear: () => {
        this.#state =
          this.context() === undefined ? textClear(this.#state) : t9ClearText(this.#state);
      },
      insert,
      ...(ctx === undefined ? {} : { t9: this.#t9Control(ctx) }),
    };
  }

  #t9Control(ctx: T9Context): T9EditorControl {
    const state = this.#state;
    const word = composingWord(state, ctx)?.text ?? "";
    const start = state.cursor - word.length;
    const live = (): T9Context => this.context() ?? ctx;
    return {
      composing: state.t9 !== undefined && state.t9 !== null,
      matches: () => {
        const composing = this.#state.t9;
        return composing ? t9Matches(composing, live().dictionary, live().user) : [];
      },
      useMatch: (index) => {
        this.#state = t9UseMatch(this.#state, index, live(), this.limit);
      },
      textBesideWord: state.text.slice(0, start) + state.text.slice(state.cursor),
      sentenceStart: sentenceStart(state.text, state.cursor),
      wordSentenceStart: sentenceStart(state.text, start),
      insertWord: (text) => {
        this.#state = t9InsertText(this.#state, text, this.limit);
        return wordAroundCursor(this.#state);
      },
      spell: (text) => {
        this.#state = t9ReplaceComposing(this.#state, text, live(), this.limit);
        return wordAroundCursor(this.#state);
      },
    };
  }

  keyDown(key: PhoneKey): EntryRequest {
    const ctx = this.context();
    if (ctx !== undefined) return this.#t9KeyDown(key, ctx);
    const limit = this.limit;
    if (isTextKey(key)) {
      this.#state = textKey(this.#state, key, this.#now, limit);
      this.#digit = { key, downAt: this.#now, fired: false };
      return undefined;
    }
    switch (key) {
      case "#":
        this.#hashDown((state) => textKey(state, "#", this.#now, limit));
        return undefined;
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

  /** `#` down: in 123 it types itself at once (taken back if held), else it acts on release. */
  #hashDown(type: (state: TextState) => TextState): void {
    const typed = this.#state.mode === "123";
    this.#hash = { key: "#", downAt: this.#now, fired: false, typed };
    if (typed) this.#state = type(this.#state);
  }

  #t9KeyDown(key: PhoneKey, ctx: T9Context): EntryRequest {
    const limit = this.limit;
    if (isTextKey(key)) {
      const before = this.#state;
      this.#state =
        key === "0"
          ? t9Space(before, limit)
          : t9TypeKey(before, key as Exclude<TextKey, "0">, ctx, limit);
      this.#digit = { key, downAt: this.#now, fired: false, before };
      return undefined;
    }
    switch (key) {
      case "#":
        this.#hashDown((state) => t9Hash(state, limit));
        return undefined;
      case "*":
        if (this.#state.t9) this.#state = t9StarKey(this.#state, ctx, limit);
        else this.#star = { key, downAt: this.#now, fired: false };
        return undefined;
      case "up":
      case "down":
        this.#state = t9MoveKey(this.#state, key, ctx);
        return undefined;
      case "c":
        if (this.#state.text === "") return "empty-c";
        this.#state = t9DeleteKey(this.#state, ctx);
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
        const ctx = this.context();
        this.#state =
          ctx === undefined
            ? textKey(this.#state, "#", this.#now, this.limit)
            : t9Hash(this.#state, this.limit);
      }
    }
    if (key === "*") this.#star = undefined;
    if (key === "c") this.#clear = undefined;
  }

  /** Time passes; a held `*` may ask for the symbol table (T9). */
  tick(dtMs: number): EntryRequest {
    this.#now += dtMs;
    this.#blink?.advance(dtMs);
    const now = this.#now;
    const ctx = this.context();
    const hash = this.#hash;
    if (hash !== undefined && !hash.fired && now - hash.downAt >= TEXT_TIMINGS.numberModeHoldMs) {
      hash.fired = true;
      // Held in 123, # leaves 123 without the # its down typed (`text/hold-hash-back` row 4).
      const typed = hash.typed === true ? textDelete(this.#state) : this.#state;
      this.#state = ctx === undefined ? textHold(typed, "#", now, this.limit) : t9HoldHash(typed);
    }
    const clear = this.#clear;
    if (
      clear !== undefined &&
      !clear.fired &&
      now - clear.downAt >= TEXT_TIMINGS.clearAfterDeleteMs
    ) {
      clear.fired = true;
      this.#state = ctx === undefined ? textClear(this.#state) : t9ClearText(this.#state);
    }
    if (ctx !== undefined) return this.#t9Tick(now);
    const pending = this.#state.pending;
    if (pending === null || now < pending.sinceMs + TEXT_TIMINGS.commitMs) return undefined;
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
    if (this.#restartBlink && this.#state.pending === null) this.#blinkFrom = now;
    return undefined;
  }

  #t9Tick(now: number): EntryRequest {
    const digit = this.#digit;
    if (
      digit !== undefined &&
      digit.before !== undefined &&
      !digit.fired &&
      digit.upAt === undefined &&
      digit.before.mode !== "123" &&
      isTextKey(digit.key) &&
      now - digit.downAt >= TEXT_TIMINGS.digitHoldMs
    ) {
      digit.fired = true;
      this.#state = t9HoldDigit(digit.before, digit.key, this.limit);
    }
    const star = this.#star;
    if (star !== undefined && !star.fired && now - star.downAt >= T9_SYMBOLS_HOLD_MS) {
      star.fired = true;
      return "symbols";
    }
    return undefined;
  }

  /** The composing word ends (a screen that inserts opens over the entry). */
  endWord(): void {
    this.#state = t9Commit(this.#state);
  }
}
