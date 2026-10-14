import type { KeyEvent, ScreenModel } from "./types";

export type DeactivationReason = "exit" | "replace" | "navigate" | "power-off";

export interface ApplicationContext {
  exit(): void;
  open(application: PhoneApplication): void;
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
