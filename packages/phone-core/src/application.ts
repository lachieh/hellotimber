import type { KeyEvent, MenuIndicator, ScreenModel } from "./types";

export type DeactivationReason = "exit" | "replace" | "navigate" | "power-off";

/** Where ApplicationContext.exit goes (see there). */
export interface ExitOptions {
  to?: "standby";
  levels?: number;
  select?: string;
  row?: "top" | "bottom";
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
