// The stock lights (plan 25 D1, D2): the display and keypad LEDs on the firmware's light tick.
//
// A light activity lights both LEDs and restarts the timeout; they go dark on the first tick of
// the 1982.61 ms light tick (anchored at the power-on) at least LIGHT_TIMEOUT_MS after the last
// activity (Task 0: 122 off edges within 2.9 ms of that tick). `force` holds them on or off
// (Games › Settings › Lights, D7); releasing it returns to the timeout. Pure: the clock is
// injected, and every edge is emitted stamped with the time it happens at, so the events are the
// same at any tick rate. What counts as activity is the wiring's (D3); this is the timer.
import type { StockFeature } from "./feature";

/** Plan 25: one change of the phone's lights at kernel time `atMs`. */
export interface StockLightEvent {
  /** `display`: the LCD backlight LEDs; `keypad`: the keypad LEDs (MAD2's two LED lines). */
  readonly light: "display" | "keypad";
  readonly atMs: number;
  readonly on: boolean;
}

/** Plan 25: where the phone's lights go. Events arrive in `atMs` order from `tick()`. */
export interface StockLightsPort {
  change(event: StockLightEvent): void;
}

/** The light tick's period (Task 0 fit over ticks 12-94). */
export const LIGHT_TICK_MS = 1982.61;
/** The light tick's first edge after the power-on. */
export const LIGHT_TICK_PHASE_MS = 2;
/** D: the LEDs go dark at the first tick at least this long after the last activity. */
export const LIGHT_TIMEOUT_MS = 13624;

const LIGHTS = ["display", "keypad"] as const;

export class StockLights {
  readonly #emit: (event: StockLightEvent) => void;
  readonly #now: () => number;
  /** The power-on time (the tick's anchor); undefined while powered off. */
  #anchor: number | undefined;
  #lastActivity: number | undefined;
  #forced: "on" | "off" | null = null;
  #lit = false;

  constructor(emit: (event: StockLightEvent) => void, now: () => number) {
    this.#emit = emit;
    this.#now = now;
  }

  get display(): boolean {
    return this.#lit;
  }

  get keypad(): boolean {
    return this.#lit;
  }

  /** The phone powered on at `atMs`: the light tick runs from it; both lights are off. */
  powerOn(atMs: number): void {
    this.#settle();
    this.#anchor = atMs;
    this.#lastActivity = undefined;
    this.#forced = null;
    this.#set(false, this.#now());
  }

  /** The phone powered off: every lit light goes off now. */
  powerOff(): void {
    this.#settle();
    this.#anchor = undefined;
    this.#lastActivity = undefined;
    this.#forced = null;
    this.#set(false, this.#now());
  }

  /** A light activity now (D3): both lights on (unless forced off), the timeout restarted. */
  activity(): void {
    this.#settle();
    if (this.#anchor === undefined) return;
    this.#lastActivity = this.#now();
    this.#apply();
  }

  /** Holds both lights on or off (D7, plan 21's alarm); null releases them into the timeout. */
  force(state: "on" | "off" | null): void {
    this.#settle();
    if (this.#anchor === undefined) return;
    this.#forced = state;
    this.#apply();
  }

  /** Emits the timeout's off edge if it is due by now. */
  tick(): void {
    this.#settle();
  }

  /** The first light tick at least LIGHT_TIMEOUT_MS after the last activity. */
  #offAt(): number | undefined {
    if (this.#anchor === undefined || this.#lastActivity === undefined) return undefined;
    const due = this.#lastActivity + LIGHT_TIMEOUT_MS - this.#anchor - LIGHT_TICK_PHASE_MS;
    return this.#anchor + LIGHT_TICK_PHASE_MS + Math.ceil(due / LIGHT_TICK_MS) * LIGHT_TICK_MS;
  }

  #settle(): void {
    if (!this.#lit || this.#forced !== null) return;
    const off = this.#offAt();
    if (off !== undefined && off <= this.#now()) this.#set(false, off);
  }

  #apply(): void {
    const now = this.#now();
    const off = this.#offAt();
    const lit = this.#forced === null ? off !== undefined && now < off : this.#forced === "on";
    this.#set(lit, now);
  }

  #set(lit: boolean, atMs: number): void {
    if (lit === this.#lit) return;
    this.#lit = lit;
    for (const light of LIGHTS) this.#emit({ light, atMs, on: lit });
  }
}

/** The lights' rules across the phone (D3, D7) arrive in Task 8; the timer is above. */
export const backlightFeature: StockFeature = { name: "backlight" };
