// The stock keyguard (plan 25 D4-D8): a standby mode over the kernel. This module's engine is
// pure (an injected clock, no widget): it decides what each key does while the keypad is locked,
// which screen of its own shows since when, and which steps are light activity (D3), so the
// wrapper (Task 7) routes keys and paints without rules of its own.
//
// Durations are the generated widget timelines' (plan 25's resource registration); the lock
// window and the leads before the hint and `Keypad active` are the goldens' (tests check them).
import type { PhoneKey } from "@hellotimber/phone-core";
import { timelineByName } from "../timelines";
import type { StockFeature } from "./feature";

/** The phone's lengths of the keyguard's screens, from the generated widget timelines. */
export const KEYGUARD_TIMES = {
  /** `Keypad locked` (K1: 442/232/240/1972 ms, a 9 ms partial draw). */
  lockNoteMs: timelineByName("keypad-locked").timeline.durationMs,
  /** The hint after a digit, `*` or `#` (K3). */
  hintMs: timelineByName("keyguard-hint").timeline.durationMs,
  /** The hint after C, ▲ or ▼ (its last step ends 23 ms sooner). */
  hintScrollMs: timelineByName("keyguard-hint-scroll").timeline.durationMs,
  /** `Now press *` (K4): also the unlock window (`*` at 1440 ms unlocks, at 1450 ms does not). */
  nowPressMs: timelineByName("keyguard-now-press").timeline.durationMs,
  /** `Keypad active` (K5: `Done`'s box and tick, 683/232/521 ms, a 9 ms partial). */
  activeNoteMs: timelineByName("keypad-active").timeline.durationMs,
  /** The emergency display (K6: 3879 ms). */
  emergencyMs: timelineByName("keyguard-emergency").timeline.durationMs,
} as const;

/**
 * Menu at standby, then `*` within this long locks (`keyguard/lock-gap/2920` locks, `2930` does
 * not; plan 14's carousel dots turn at 2948 ms, a redraw later).
 */
export const KEYGUARD_LOCK_WINDOW_MS = 2925;
/** Standby with its ladders erased before the hint (`keyguard/hint` frame 1). */
export const KEYGUARD_HINT_LEAD_MS = 27;
/** The same before C's, ▲'s and ▼'s hint (`keyguard/hint/up` frame 1). */
export const KEYGUARD_HINT_SCROLL_LEAD_MS = 25;
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

/** What the keyguard shows, since when (kernel time). */
export type KeyguardView =
  | { readonly state: "hint"; readonly since: number; readonly scroll: boolean }
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
const SCROLL_KEYS: ReadonlySet<PhoneKey> = new Set(["c", "up", "down"]);
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
    this.#show({ state: "hint", since: now, scroll: SCROLL_KEYS.has(key) });
    return this.#take(key, { ...SWALLOWED, activity: key === "power" });
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
          (view.scroll
            ? KEYGUARD_HINT_SCROLL_LEAD_MS + KEYGUARD_TIMES.hintScrollMs
            : KEYGUARD_HINT_LEAD_MS + KEYGUARD_TIMES.hintMs)
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

/** The keyguard's wiring over the kernel arrives in Task 7; the engine is above. */
export const keyguardFeature: StockFeature = { name: "keyguard" };
