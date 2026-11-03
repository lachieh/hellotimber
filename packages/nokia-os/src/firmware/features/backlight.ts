// The stock lights' rules (plan 25 D3, D7): Games › Settings › Lights during play, over the
// handset's lights (`nokia-kit/src/system/lights.ts`).
import { SNAKE_DEATH_STEPS, SNAKE_TOP_SCORE_MS } from "@hellotimber/nokia-kit/ui/resources";
import type { StockGames } from "./games";
import type { SuspendedSnake } from "../../widgets/snake";
import type { StockCue, StockCueSink } from "@hellotimber/nokia-kit/system/cues";
import type { StockSettings } from "../settings";
import { timelineByName } from "@hellotimber/nokia-kit/ui/timelines";
import type { StockFeature } from "./feature";
import type { StockLights } from "@hellotimber/nokia-kit/system/lights";

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
  readonly games: Pick<StockGames, "suspended">;
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
  readonly #games: Pick<StockGames, "suspended">;
  readonly #now: () => number;
  #playing = false;
  /** The playing game's crash (its cue), once it has crashed. */
  #crash: number | undefined;
  #topScore = false;
  /** Activity still due: the fireworks' `Game over!` title. */
  #due: number | undefined;
  /** The suspended game when last seen out of play (a session clears it as it starts). */
  #suspended: SuspendedSnake | undefined;

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
      this.#suspended = this.#games.suspended.snake as SuspendedSnake | undefined;
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
export const backlightFeature: StockFeature = {
  name: "backlight",
  settings: {
    // Restore factory settings stores Lights Off: the restored image opens it on Off after a
    // power cycle and holds the LEDs off in play (`lights/game/off/play`). The session that
    // restored keeps showing and using its old value until then (not reproduced).
    factoryDefaults: [
      {
        key: GAMES_LIGHTS_KEY,
        label: "Off",
        evidence: "v6.39",
        capture: "plan25/lights/game/off/play.lights.csv",
      },
    ],
  },
};
