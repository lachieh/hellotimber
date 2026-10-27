import type { KeyEvent, MenuIndicator, PhoneKey, ScreenModel } from "./types";

export type DeactivationReason = "exit" | "replace" | "navigate" | "power-off";

/** Where ApplicationContext.exit goes (see there). */
export interface ExitOptions {
  to?: "standby";
  levels?: number;
  select?: string;
  row?: "top" | "bottom";
  /**
   * Plan 22: with `to: "standby"`, the key `key` (down now) then starts PhoneConfig.standbyEntry
   * as if it had gone down at standby; its release reaches the entry. Throws without
   * `to: "standby"` and from a boot gate, an interruption or a wake application; ignored when
   * `key` is not one of `standbyEntry.keys`.
   */
  key?: PhoneKey;
  /**
   * Keys held across the exit lose their long press as well as their release (plan 21: C held on
   * the running stopwatch stays on the Stopwatch page). By default only the release is swallowed,
   * so C held from a screen that leaves at C's down still goes on to standby (plan 19).
   */
  endHolds?: boolean;
}

export interface ApplicationContext {
  /**
   * Leave the application: back to the launching stack (default) or straight to standby
   * (`to: "standby"`, deactivation reason `exit`; the menus are left as C-hold leaves them).
   * `levels` (default 1) also closes `levels - 1` enclosing levels, and `select` selects that
   * child (by slug) in the level returned to. In a rows window `row` places it: on the bottom
   * row (default) or on the top row, the window rebuilt at it as on entry. They are ignored
   * with `to: "standby"` and throw when they name no level or child, or `row` comes without
   * `select`. May be called inside createSession: the kernel then returns without rendering the
   * application.
   */
  exit(options?: ExitOptions): void;
  open(application: PhoneApplication): void;
  /**
   * The menu indicator for this application's position: its menu numbers and, while a
   * `shortcutEntry` digit is awaited, `typed` (plan 14). Provided by the kernel; optional so
   * hosts may wrap contexts.
   */
  menuIndicator?(): MenuIndicator;
  /**
   * Plan 17: power the phone off (deactivation reason `power-off`), as the power key's long press
   * does. Always provided by the kernel (optional so hosts may wrap contexts); a no-op once this
   * activation has ended.
   */
  powerOff?(): void;
}

/**
 * PhoneConfig.shortcutEntry: an application's options numbered 1..count as a menu level (v6.39:
 * an option list).
 */
export interface ShortcutLevel {
  readonly count: number;
  /** The typed number chose option `number` (1-based); the shortcut has closed. */
  choose(number: number): void;
}

export interface PhoneApplicationSession {
  onKey(event: KeyEvent): void;
  tick(dtMs: number): void;
  render(): ScreenModel;
  onDeactivate?(reason: DeactivationReason): void;
  /**
   * Plan 22: PhoneConfig.interruption began holding this session (it gets no keys or ticks until
   * the interruption ends). Called once per interruption; an exception is ignored.
   */
  onInterrupted?(): void;
  /**
   * PhoneConfig.shortcutEntry: the application's options while it is a menu level to the stock
   * shortcut (undefined: it is not). Digits typed while the shortcut window is open over it, or
   * while it is about to open, are then matched as numbers among them, as at a menu level, and
   * do not reach `onKey`: an option's number chooses it, digits that number none open
   * `invalid`.
   */
  shortcutLevel?(): ShortcutLevel | undefined;
}

export abstract class PhoneApplication {
  readonly id: string;

  constructor(id: string) {
    if (id.trim() === "") throw new Error("Application id must be a non-empty identifier.");
    this.id = id;
    Object.defineProperty(this, "id", { writable: false, configurable: false });
  }

  abstract createSession(context: ApplicationContext): PhoneApplicationSession;
}
