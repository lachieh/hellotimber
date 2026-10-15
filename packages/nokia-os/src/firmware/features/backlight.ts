// The stock lights (plan 25 D1, D2): the display and keypad LEDs on the firmware's light tick.
//
// A light activity lights both LEDs and restarts the timeout; they go dark on the first tick of
// the 1982.61 ms light tick (anchored at the power-on) at least LIGHT_TIMEOUT_MS after the last
// activity (Task 0: 122 off edges within 2.9 ms of that tick). `force` holds them on or off
// (Games › Settings › Lights, D7); releasing it returns to the timeout. Pure: the clock is
// injected, and every edge is emitted stamped with the time it happens at, so the events are the
// same at any tick rate. What counts as activity is the wiring's (D3); this is the timer.
import { SNAKE_DEATH_STEPS, SNAKE_TOP_SCORE_MS } from "../../resources";
import type { StockGames } from "../../widgets/snake";
import type { StockCue, StockCueSink } from "../cues";
import type { StockSettings } from "../settings";
import { timelineByName } from "../timelines";
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

  /**
   * A light activity (D3) now, or at `atMs` (not before the last event, not after now): both
   * lights on (unless forced off), the timeout restarted.
   */
  activity(atMs = this.#now()): void {
    this.#settle(atMs);
    if (this.#anchor === undefined) return;
    this.#lastActivity = atMs;
    this.#apply(atMs);
  }

  /**
   * Holds both lights on or off (D7, plan 21's alarm) from now, or from `atMs` as `activity`;
   * null releases them into the timeout.
   */
  force(state: "on" | "off" | null, atMs = this.#now()): void {
    this.#settle(atMs);
    if (this.#anchor === undefined) return;
    this.#forced = state;
    this.#apply(atMs);
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

  /** Emits the timeout's off edge if it is due by `atMs`. */
  #settle(atMs = this.#now()): void {
    if (!this.#lit || this.#forced !== null) return;
    const off = this.#offAt();
    if (off !== undefined && off <= atMs) this.#set(false, off);
  }

  #apply(atMs: number): void {
    const off = this.#offAt();
    const lit = this.#forced === null ? off !== undefined && atMs < off : this.#forced === "on";
    this.#set(lit, atMs);
  }

  #set(lit: boolean, atMs: number): void {
    if (lit === this.#lit) return;
    this.#lit = lit;
    for (const light of LIGHTS) this.#emit({ light, atMs, on: lit });
  }
}

// ---------------------------------------------------------------- the rules (Task 8, D3, D7)

/** Games › Settings › Lights (8-6-2): Off, On. */
export const GAMES_LIGHTS_KEY = "games/settings/lights";
const LIGHTS_ON = 1;

/** Snake II's play leaves (plan 23): its session plays under them. */
const SNAKE_PLAY = /^menu\/games\/snake\/(?:new-game|continue)$/;

/** From the crash to the game-over screen: the death steps (plan 23, 2066 ms). */
export const SNAKE_DEATH_MS = SNAKE_DEATH_STEPS.reduce((sum, step) => sum + step.durationMs, 0);
/** A new top score's fireworks before their `Game over!` title (plan 23's widget timeline). */
export const FIREWORKS_MS = timelineByName("game-over-fireworks")
  .timeline.steps.slice(0, -1)
  .reduce((sum, step) => sum + step.durationMs, 0);

export interface StockLightRulesOptions {
  readonly lights: StockLights;
  readonly settings: StockSettings;
  /** Snake II's holder, read only: the game Continue resumes. */
  readonly games: Pick<StockGames, "snake">;
  readonly now: () => number;
}

/**
 * The lights' rules beyond key activity (the wrapper lights every key-down the keyguard calls
 * activity, D3): Games › Settings › Lights during play (D7). While a Snake II session plays (New
 * game or Continue, until its death ends), Lights Off holds the LEDs off and Lights On holds them
 * on with no timeout; leaving play (the pause: its key is activity) releases them. The death ends
 * on the game-over screen, the crash cue plus SNAKE_DEATH_MS (a new top score's fireworks
 * SNAKE_TOP_SCORE_MS later): activity there, the force released; the fireworks' `Game over!`
 * title FIREWORKS_MS later is activity again. Continue on a game whose death had begun plays no
 * more (UNVERIFIED: no capture).
 */
export class StockLightRules {
  readonly #lights: StockLights;
  readonly #settings: StockSettings;
  readonly #games: Pick<StockGames, "snake">;
  readonly #now: () => number;
  #playing = false;
  /** The playing game's crash (its cue), once it has crashed. */
  #crash: number | undefined;
  #topScore = false;
  /** Activity still due: the fireworks' `Game over!` title. */
  #due: number | undefined;
  /** The suspended game when last seen out of play (a session clears it as it starts). */
  #suspended: StockGames["snake"];

  constructor({ lights, settings, games, now }: StockLightRulesOptions) {
    this.#lights = lights;
    this.#settings = settings;
    this.#games = games;
    this.#now = now;
  }

  /** The games' cues, passed on to `sink`: a crash starts the death the rule times. */
  cues(sink: StockCueSink): StockCueSink {
    return {
      cue: (cue: StockCue, atMs: number) => {
        if (cue.kind === "crash" && this.#playing) this.#crash = atMs;
        if (cue.kind === "top-score") this.#topScore = true;
        sink.cue(cue, atMs);
      },
    };
  }

  /** After every key, tick or navigation: what plays at `path` now. */
  update(path: string): void {
    const now = this.#now();
    if (this.#due !== undefined && this.#due <= now) {
      this.#lights.activity(this.#due);
      this.#due = undefined;
    }
    const atPlay = SNAKE_PLAY.test(path);
    if (!atPlay) {
      this.#suspended = this.#games.snake;
      this.#crash = undefined;
      if (this.#playing) {
        this.#playing = false;
        this.#lights.force(null, now);
      }
      return;
    }
    // New game or Continue (once: the game-over screen stays at the leaf after the death).
    if (!this.#playing && this.#crash === undefined) {
      this.#playing = this.#suspended?.death === undefined;
      this.#topScore = false;
      this.#due = undefined;
    }
    if (!this.#playing) return;
    const crash = this.#crash;
    const screen =
      crash === undefined
        ? undefined
        : crash + SNAKE_DEATH_MS + (this.#topScore ? SNAKE_TOP_SCORE_MS : 0);
    if (screen !== undefined && screen <= now) {
      this.#playing = false;
      this.#lights.force(null, screen);
      this.#lights.activity(screen);
      if (this.#topScore) this.#due = screen + FIREWORKS_MS;
      return;
    }
    this.#lights.force(this.#settings.choice(GAMES_LIGHTS_KEY) === LIGHTS_ON ? "on" : "off");
  }
}

/** The lights' rules are wired by the stock phone wrapper (`src/firmware/phone.ts`). */
export const backlightFeature: StockFeature = { name: "backlight" };
