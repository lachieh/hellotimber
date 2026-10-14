import type { KeyEvent, MenuIndicator, ScreenModel } from "./types";

export type DeactivationReason = "exit" | "replace" | "navigate" | "power-off";

export interface ApplicationContext {
  /**
   * Leave the application: back to the launching stack (default) or straight to standby
   * (`to: "standby"`, deactivation reason `exit`; the menus are left as C-hold leaves them).
   * `levels` (default 1) also closes `levels - 1` enclosing levels, and `select` selects that
   * child (by slug) in the level returned to, on the bottom row of a rows window; both are
   * ignored with `to: "standby"` and throw when they name no level or child. May be called
   * inside createSession: the kernel then returns without rendering the application.
   */
  exit(options?: { to?: "standby"; levels?: number; select?: string }): void;
  open(application: PhoneApplication): void;
  /**
   * The menu indicator for this application's position: its menu numbers and, while a
   * `shortcutEntry` digit is awaited, `typed` (plan 14). Provided by the kernel; optional so
   * hosts may wrap contexts.
   */
  menuIndicator?(): MenuIndicator;
}

export interface PhoneApplicationSession {
  onKey(event: KeyEvent): void;
  tick(dtMs: number): void;
  render(): ScreenModel;
  onDeactivate?(reason: DeactivationReason): void;
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
