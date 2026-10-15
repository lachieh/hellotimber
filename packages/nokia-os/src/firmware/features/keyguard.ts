// The stock keyguard (plan 25 D4-D8): a standby mode over the kernel. This module's engine is
// pure (an injected clock, no widget): it decides what each key does while the keypad is locked,
// which screen of its own shows since when, and which steps are light activity (D3), so the
// wrapper (Task 7) routes keys and paints without rules of its own.
//
// Durations are the generated widget timelines' (plan 25's resource registration); the lock
// window and the leads before the hint and `Keypad active` are the goldens' (tests check them).
import type { Phone, PhoneKey, ScreenModel } from "@hellotimber/phone-core";
import { Framebuffer } from "@hellotimber/phone-screen";
import { paintWidget, type KeyguardModel } from "../../display/widgets";
import { KEYPAD_LOCKED_LINES } from "../../display/widgets/keyguard";
import type { StockWidgetTimeline } from "../../resources";
import { timelineByName } from "../timelines";
import type { StockFeature } from "./feature";

/** The keyguard's generated widget timelines (plan 25's resource registration). */
const TIMELINES = {
  lockNote: timelineByName("keypad-locked"),
  hint: timelineByName("keyguard-hint"),
  hintScroll: timelineByName("keyguard-hint-scroll"),
  nowPress: timelineByName("keyguard-now-press"),
  activeNote: timelineByName("keypad-active"),
  emergency: timelineByName("keyguard-emergency"),
} as const;

/** The phone's lengths of the keyguard's screens, from the generated widget timelines. */
export const KEYGUARD_TIMES = {
  /** `Keypad locked` (K1: 442/232/240/1972 ms, a 9 ms partial draw). */
  lockNoteMs: TIMELINES.lockNote.timeline.durationMs,
  /** The hint after a digit, `*` or `#` (K3). */
  hintMs: TIMELINES.hint.timeline.durationMs,
  /** The hint after C, ▲, ▼ or the power key, before its closing partial (its last step ends 23 ms sooner). */
  hintScrollMs: TIMELINES.hintScroll.timeline.durationMs,
  /** `Now press *` (K4): also the unlock window (`*` at 1440 ms unlocks, at 1450 ms does not). */
  nowPressMs: TIMELINES.nowPress.timeline.durationMs,
  /** `Keypad active` (K5: `Done`'s box and tick, 683/232/521 ms, a 9 ms partial). */
  activeNoteMs: TIMELINES.activeNote.timeline.durationMs,
  /** The emergency display (K6: 3879 ms). */
  emergencyMs: TIMELINES.emergency.timeline.durationMs,
} as const;

/**
 * Menu at standby, then `*` within this long locks (`keyguard/lock-gap/2920` locks, `2930` does
 * not; plan 14's carousel dots turn at 2948 ms, a redraw later).
 */
export const KEYGUARD_LOCK_WINDOW_MS = 2925;
/** Standby with its ladders erased before the hint (`keyguard/hint` frame 1). */
export const KEYGUARD_HINT_LEAD_MS = 27;
/** The same before the hint of C, ▲, ▼ and the power key (`keyguard/hint/up` frame 1). */
export const KEYGUARD_HINT_SCROLL_LEAD_MS = 25;
/**
 * The partial draw that closes the hint of C, ▲, ▼ and the power key (`keyguard/hint/up` and
 * `hint/pwr` frame 10, the image of
 * the digits' 8 ms one): longer than the extractor's partials, so the generated timeline stops
 * before it and the keyguard plays the digits' hint's last frame for this long.
 */
export const KEYGUARD_HINT_SCROLL_PARTIAL_MS = 23;
/** `Now press *` without its ladders before `Keypad active` (`keyguard/unlock` frame 2). */
export const KEYGUARD_UNLOCK_LEAD_MS = 21;
/** Of the numbers tried (112, 911, 999, 000, 08, 110), only 112 passes the keyguard (Task 0). */
export const KEYGUARD_EMERGENCY_NUMBERS: readonly string[] = ["112"];

/** Plan 22: where Call on an emergency number goes (D6). */
export interface KeyguardCalls {
  dial(number: string): void;
}

export type KeyguardState =
  | "unlocked"
  | "locking"
  | "locked"
  | "hint"
  | "unlocking"
  | "emergency"
  | "unlocked-note"
  | "passing";

/** A screen of the keyguard's with ladders, which a key leaves (ladders erased) for the hint. */
export type KeyguardLeadScreen =
  | { readonly screen: "locked-standby" }
  | { readonly screen: "now-press" }
  | { readonly screen: "emergency"; readonly number: string };

/**
 * What the keyguard shows, since when (kernel time). A hint called from a screen with ladders
 * first shows that screen without them for `lead.ms` (`keyguard/hint` b, `unlock-digit` c,
 * `emergency/112-digit` e); one that replaces a note (a key during the hint) starts at once
 * (`keyguard/hint-during`).
 */
export type KeyguardView =
  | {
      readonly state: "hint";
      readonly since: number;
      readonly scroll: boolean;
      readonly lead?: { readonly ms: number; readonly under: KeyguardLeadScreen };
    }
  | { readonly state: "emergency"; readonly since: number; readonly number: string }
  | { readonly state: Exclude<KeyguardState, "hint" | "emergency">; readonly since: number };

/** What a key-down did. */
export interface KeyguardOutcome {
  /** The keyguard took the key: the kernel must not see it (nor its key-up). */
  readonly consumed: boolean;
  /** Light activity (D3): the lights go on and their timeout restarts. */
  readonly activity: boolean;
  /** No key beep (D12): locked keys, and the locking `*` (its note's tone replaces it). */
  readonly silent: boolean;
}

const PASSED: KeyguardOutcome = { consumed: false, activity: true, silent: false };
const SWALLOWED: KeyguardOutcome = { consumed: true, activity: false, silent: true };
/** Keys whose hint has the shorter lead and the 23 ms closing partial (`keyguard/hint/up`, `pwr`). */
const SCROLL_KEYS: ReadonlySet<PhoneKey> = new Set(["c", "up", "down", "power"]);
const DIGITS = /^[0-9]$/;

export interface KeyguardOptions {
  readonly now: () => number;
  readonly calls?: KeyguardCalls;
}

export class KeyguardEngine {
  readonly #now: () => number;
  readonly #calls: KeyguardCalls | undefined;
  #view: KeyguardView = { state: "unlocked", since: 0 };
  /** When Menu at standby opened the lock window, while it is open. */
  #armedAt: number | undefined;
  /** Digits typed while locked since the locked standby last showed (D6). */
  #digits = "";
  readonly #taken = new Set<PhoneKey>();

  constructor({ now, calls }: KeyguardOptions) {
    this.#now = now;
    this.#calls = calls;
    this.#view = { state: "unlocked", since: now() };
  }

  get state(): KeyguardState {
    return this.#view.state;
  }

  get view(): KeyguardView {
    return this.#view;
  }

  /** The keypad is locked (a call passing through included); false while `Keypad active` shows. */
  get locked(): boolean {
    return this.state !== "unlocked" && this.state !== "unlocked-note";
  }

  /** Ends the timed screens that are due. */
  tick(): void {
    const now = this.#now();
    const view = this.#view;
    const ends = this.#endOf(view);
    if (ends === undefined || now < ends) return;
    if (view.state === "unlocked-note") this.#show({ state: "unlocked", since: ends });
    else this.#locked(ends);
  }

  /**
   * A key-down. `atStandby`: the kernel was at standby (Menu there opens the lock window). While
   * unlocked only the locking `*` is the keyguard's; while locked every key is.
   */
  keyDown(key: PhoneKey, atStandby = false): KeyguardOutcome {
    this.tick();
    const now = this.#now();
    switch (this.state) {
      case "unlocked":
        return this.#unlockedKey(key, atStandby, now);
      case "passing":
        return PASSED;
      case "unlocked-note":
        // A key ends `Keypad active` (UNVERIFIED: no capture presses one during it).
        this.#show({ state: "unlocked", since: now });
        return this.#take(key, { consumed: true, activity: true, silent: false });
      case "unlocking":
        if (key === "*") {
          this.#show({ state: "unlocked-note", since: now });
          return this.#take(key, { consumed: true, activity: true, silent: false });
        }
        if (key === "navi") {
          this.#show({ state: "unlocking", since: now });
          return this.#take(key, SWALLOWED);
        }
        return this.#hint(key, now);
      case "emergency":
        if (key === "c") {
          this.#locked(now);
          return this.#take(key, SWALLOWED);
        }
        if (key === "navi") {
          const view = this.#view as Extract<KeyguardView, { state: "emergency" }>;
          if (this.#calls === undefined) return this.#take(key, SWALLOWED);
          this.#calls.dial(view.number);
          return this.#take(key, { consumed: true, activity: true, silent: false });
        }
        return this.#hint(key, now);
      case "locking":
      case "locked":
      case "hint":
        // Unlock during the hint unlocks as at the locked standby (UNVERIFIED).
        if (key === "navi") {
          this.#show({ state: "unlocking", since: now });
          return this.#take(key, SWALLOWED);
        }
        return this.#hint(key, now);
    }
  }

  /** A key-up: true when the keyguard took its key-down (the kernel must not see it either). */
  keyUp(key: PhoneKey): boolean {
    return this.#taken.delete(key);
  }

  /** Plan 22: an incoming call. Light activity; a locked phone's keys go to the kernel. */
  pass(): { readonly activity: boolean } {
    this.tick();
    if (this.locked) this.#show({ state: "passing", since: this.#now() });
    return { activity: true };
  }

  /** Plan 22: the call ended. A locked phone shows `Keypad locked` again (K8). */
  resume(): void {
    this.tick();
    if (this.state === "passing") this.#show({ state: "locking", since: this.#now() });
  }

  /** Plan 18: a message arrived while locked. It lights nothing (K7). */
  arrivedWhileLocked(): { readonly activity: boolean } {
    return { activity: false };
  }

  /** Power-off: the keyguard lives in RAM, so the next power-on is unlocked. */
  reset(): void {
    this.#armedAt = undefined;
    this.#digits = "";
    this.#taken.clear();
    this.#show({ state: "unlocked", since: this.#now() });
  }

  #unlockedKey(key: PhoneKey, atStandby: boolean, now: number): KeyguardOutcome {
    const armed = this.#armedAt;
    this.#armedAt = key === "navi" && atStandby ? now : undefined;
    if (key === "*" && armed !== undefined && now - armed <= KEYGUARD_LOCK_WINDOW_MS) {
      this.#show({ state: "locking", since: now });
      this.#digits = "";
      return this.#take(key, SWALLOWED);
    }
    return PASSED;
  }

  /** A key on a locked phone: the hint, or the emergency display when the digits end in one. */
  #hint(key: PhoneKey, now: number): KeyguardOutcome {
    if (DIGITS.test(key)) {
      this.#digits += key;
      const number = KEYGUARD_EMERGENCY_NUMBERS.find((n) => this.#digits.endsWith(n));
      if (number !== undefined && this.state !== "emergency") {
        this.#show({ state: "emergency", since: now, number });
        return this.#take(key, { consumed: true, activity: true, silent: true });
      }
    }
    const scroll = SCROLL_KEYS.has(key);
    const under = this.#leadScreen();
    this.#show({
      state: "hint",
      since: now,
      scroll,
      ...(under === undefined
        ? {}
        : { lead: { ms: scroll ? KEYGUARD_HINT_SCROLL_LEAD_MS : KEYGUARD_HINT_LEAD_MS, under } }),
    });
    return this.#take(key, { ...SWALLOWED, activity: key === "power" });
  }

  /** The screen with ladders showing now, if one does (a note shows none). */
  #leadScreen(): KeyguardLeadScreen | undefined {
    const view = this.#view;
    switch (view.state) {
      case "locked":
        return { screen: "locked-standby" };
      case "unlocking":
        return { screen: "now-press" };
      case "emergency":
        return { screen: "emergency", number: view.number };
      default:
        return undefined;
    }
  }

  #locked(since: number): void {
    this.#digits = "";
    this.#show({ state: "locked", since });
  }

  #take(key: PhoneKey, outcome: KeyguardOutcome): KeyguardOutcome {
    if (outcome.consumed) this.#taken.add(key);
    return outcome;
  }

  #show(view: KeyguardView): void {
    this.#view = view;
  }

  #endOf(view: KeyguardView): number | undefined {
    switch (view.state) {
      case "locking":
        return view.since + KEYGUARD_TIMES.lockNoteMs;
      case "hint":
        return (
          view.since +
          (view.lead?.ms ?? 0) +
          (view.scroll
            ? KEYGUARD_TIMES.hintScrollMs + KEYGUARD_HINT_SCROLL_PARTIAL_MS
            : KEYGUARD_TIMES.hintMs)
        );
      case "unlocking":
        return view.since + KEYGUARD_TIMES.nowPressMs;
      case "emergency":
        return view.since + KEYGUARD_TIMES.emergencyMs;
      case "unlocked-note":
        return view.since + KEYGUARD_UNLOCK_LEAD_MS + KEYGUARD_TIMES.activeNoteMs;
      default:
        return undefined;
    }
  }
}

// ---------------------------------------------------------------- the overlay (Task 7, D4)

type Standby = Extract<ScreenModel, { kind: "standby" }>;
type NoteScreen = Extract<KeyguardModel, { frame: unknown }>["screen"];

/** A note's step `elapsed` ms into `timeline` (a `cut` step carries the step it draws). */
function noteStep(
  screen: NoteScreen,
  timeline: StockWidgetTimeline,
  elapsed: number,
): KeyguardModel {
  const index = timeline.timeline.frameAt(elapsed);
  const frame = timeline.frames[index]!;
  const next = frame.kind === "cut" ? timeline.frames[index + 1] : undefined;
  return { kind: "keyguard", screen, frame, ...(next === undefined ? {} : { next }) };
}

/** A screen of the keyguard's with ladders, over the kernel's standby. */
function withLadders(under: KeyguardLeadScreen, standby: Standby): KeyguardModel {
  return under.screen === "emergency"
    ? { kind: "keyguard", screen: "emergency", standby, number: under.number }
    : { kind: "keyguard", screen: under.screen, standby };
}

/**
 * What the keyguard shows at `now` for `view`, over the kernel's `standby`; undefined while the
 * kernel's own screen shows (unlocked, or a call passing through).
 */
export function keyguardModel(
  view: KeyguardView,
  now: number,
  standby: Standby,
): KeyguardModel | undefined {
  const elapsed = now - view.since;
  switch (view.state) {
    case "unlocked":
    case "passing":
      return undefined;
    case "locked":
      return withLadders({ screen: "locked-standby" }, standby);
    case "unlocking":
      return withLadders({ screen: "now-press" }, standby);
    case "emergency":
      return withLadders({ screen: "emergency", number: view.number }, standby);
    case "locking":
      return noteStep("lock-note", TIMELINES.lockNote, elapsed);
    case "unlocked-note":
      return elapsed < KEYGUARD_UNLOCK_LEAD_MS
        ? withLadders({ screen: "now-press" }, { ...standby, leaving: true })
        : noteStep("active-note", TIMELINES.activeNote, elapsed - KEYGUARD_UNLOCK_LEAD_MS);
    case "hint": {
      const lead = view.lead;
      if (lead !== undefined && elapsed < lead.ms) {
        return withLadders(lead.under, { ...standby, leaving: true });
      }
      const t = elapsed - (lead?.ms ?? 0);
      if (!view.scroll) return noteStep("hint", TIMELINES.hint, t);
      if (t < KEYGUARD_TIMES.hintScrollMs) return noteStep("hint", TIMELINES.hintScroll, t);
      // The closing partial draw: the digits' hint's last step (KEYGUARD_HINT_SCROLL_PARTIAL_MS).
      return noteStep("hint", TIMELINES.hint, KEYGUARD_TIMES.hintMs - 1);
    }
  }
}

/**
 * The keyguard over a kernel phone (D4): the stock wrapper hands it every key-down of a powered
 * phone and shows its screen, while it has one, instead of the kernel's. The kernel stays at
 * standby underneath, so its clock, indicators and notice keep updating in the locked standby.
 * Frames are `custom` screens painted by the stock painter, repainted only when their model
 * changes (each sees the frame shown before: the notes' partial draws start from it).
 */
export interface KeyguardOverlayOptions extends KeyguardOptions {
  /** Plays a note's warning tone by its lines (plan 16 D12): `Keypad locked`'s 1750 Hz. */
  readonly noteSound?: (lines: readonly string[]) => void;
}

export class KeyguardOverlay {
  readonly engine: KeyguardEngine;
  readonly #kernel: Phone;
  readonly #now: () => number;
  readonly #noteSound: ((lines: readonly string[]) => void) | undefined;
  /** The kernel's standby last seen (the locked standby composes it). */
  #standby: Standby | undefined;
  #shown: { readonly json: string; readonly screen: ScreenModel & { kind: "custom" } } | undefined;

  constructor(kernel: Phone, options: KeyguardOverlayOptions) {
    this.#kernel = kernel;
    this.#now = options.now;
    this.#noteSound = options.noteSound;
    this.engine = new KeyguardEngine(options);
  }

  /**
   * A powered phone's key-down. Menu at standby (no notice: Navi reads it) opens the lock
   * window; the locking `*` returns the kernel's carousel to standby underneath the lock note,
   * whose warning tone plays in place of the `*`'s beep (D12).
   */
  keyDown(key: PhoneKey): KeyguardOutcome {
    const screen = this.#kernel.screen;
    const atStandby = screen.kind === "standby" && screen.notice === undefined;
    const wasLocked = this.engine.locked;
    const outcome = this.engine.keyDown(key, atStandby);
    if (!wasLocked && this.engine.locked) {
      this.#kernel.navigate("standby");
      this.#noteSound?.(KEYPAD_LOCKED_LINES);
    }
    return outcome;
  }

  /** A key-up: true when the keyguard took the key (the kernel must not see its key-up). */
  keyUp(key: PhoneKey): boolean {
    return this.engine.keyUp(key);
  }

  /** Power-off: the keyguard lives in RAM. */
  reset(): void {
    this.engine.reset();
  }

  /** The keyguard's screen now, or undefined while the kernel's shows. */
  get screen(): ScreenModel | undefined {
    this.engine.tick();
    const kernel = this.#kernel.screen;
    if (kernel.kind === "standby") {
      // The locked standby keeps its ladders: Menu's `leaving` frame belongs to the carousel.
      const { leaving: _leaving, ...standby } = kernel;
      this.#standby = standby;
    }
    const standby = this.#standby;
    if (standby === undefined) return undefined;
    const model = keyguardModel(this.engine.view, this.#now(), standby);
    if (model === undefined) return undefined;
    const json = JSON.stringify(model);
    const shown = this.#shown;
    if (shown?.json === json) return shown.screen;
    const fb = new Framebuffer();
    paintWidget(fb, model, shown?.screen.frame.pixels);
    const frame = { width: fb.width, height: fb.height, pixels: fb.pixels };
    this.#shown = { json, screen: { kind: "custom", appId: "keyguard", frame } };
    return this.#shown.screen;
  }
}

/** The keyguard is wired by the stock phone wrapper (`src/firmware/phone.ts`): no tree screens. */
export const keyguardFeature: StockFeature = { name: "keyguard" };
