import type { PhoneKey } from "@hellotimber/phone-core";
import type { LevelBarModel } from "../display/widgets";
import type { StockSettings } from "../firmware/settings";
import type { Flow, Widget } from "./flow";

/**
 * A held ▲/▼ on Snake II's Level page (plan 23 Task 0 C1, `game/snake/level-keys-hold-up`): one
 * step on the press, the next ≈778 ms later, then one every 482-496 ms (489 ms).
 */
export const LEVEL_REPEAT = { firstMs: 778, everyMs: 489 } as const;

/**
 * A Level page with fixed bars, as the virgin EEPROM shows them; OK and C go back (P12). Bantumi
 * and Pairs II keep it until plan 24 measures their Level pages (Snake II's ▲/▼ were not inert:
 * plan 23 D11).
 */
export function levelBar(options: { readonly bars: string; readonly softkey: string }): Widget {
  return {
    render: (): LevelBarModel => ({ kind: "level-bar", ...options }),
    onKey(key: PhoneKey, flow: Flow) {
      if (key === "navi" || key === "c") flow.back();
    },
  };
}

/** The most bars the page draws: a higher level (the virgin 175) draws nine (D2). */
const MAX_BARS = 9;

export interface SnakeLevelOptions {
  readonly settings: StockSettings;
  /** The numeric setting the page edits (`games/snake/level`). */
  readonly key: string;
  readonly softkey: string;
  /**
   * Runs when OK stores the level; a slug it returns is selected in the level returned to
   * (Snake II: OK while a game is suspended discards it, plan 23 Task 0 C8).
   */
  readonly onStore?: () => string | undefined;
}

/**
 * Snake II's Level page (plan 23 D11, Task 0 C1): `min(level, 9)` filled bars. ▼ lowers the
 * level by one down to 1; ▲ raises it by one only below 9 (from 175 it does nothing). Both act
 * on key-down and repeat while held. OK stores the level and goes back; C goes back without
 * storing.
 */
class SnakeLevelWidget implements Widget {
  readonly #options: SnakeLevelOptions;
  #level: number;
  #held: { key: "up" | "down"; elapsedMs: number; nextMs: number } | undefined;

  constructor(options: SnakeLevelOptions) {
    this.#options = options;
    this.#level = options.settings.number(options.key);
  }

  render(): LevelBarModel {
    const bars = Math.min(this.#level, MAX_BARS);
    return { kind: "level-bar", bars: `level/snake-${bars}`, softkey: this.#options.softkey };
  }

  onKeyDown(key: PhoneKey): void {
    if (key !== "up" && key !== "down") return;
    this.#step(key);
    this.#held = { key, elapsedMs: 0, nextMs: LEVEL_REPEAT.firstMs };
  }

  tick(dtMs: number): void {
    const held = this.#held;
    if (held === undefined) return;
    held.elapsedMs += dtMs;
    while (held.elapsedMs >= held.nextMs) {
      this.#step(held.key);
      held.nextMs += LEVEL_REPEAT.everyMs;
    }
  }

  onKey(key: PhoneKey, flow: Flow): void {
    if (key === this.#held?.key) this.#held = undefined;
    if (key === "navi") {
      this.#options.settings.setNumber(this.#options.key, this.#level);
      const select = this.#options.onStore?.();
      flow.back(1, select === undefined ? {} : { select });
    } else if (key === "c") {
      flow.back();
    }
  }

  #step(key: "up" | "down"): void {
    if (key === "down" && this.#level > 1) this.#level--;
    else if (key === "up" && this.#level < MAX_BARS) this.#level++;
  }
}

export function snakeLevel(options: SnakeLevelOptions): Widget {
  return new SnakeLevelWidget(options);
}
