import type { PhoneKey } from "@hellotimber/phone-core";
import type { LevelBarModel } from "../kit/ui/display/widgets";
import type { StockSettings } from "../firmware/settings";
import type { Flow, Widget } from "../kit/ui/widgets/flow";
import { LEVEL_REPEAT } from "../kit/ui/widgets/key-repeat";

/**
 * A Level page with fixed bars, as the virgin EEPROM shows them; OK and C go back (P12). Bantumi
 * and Pairs II keep it until plans 24b and 24c measure their Level pages (Snake II's ▲/▼ were
 * not inert: plan 23 D11).
 */
export function levelBar(options: { readonly bars: string; readonly softkey: string }): Widget {
  return {
    render: (): LevelBarModel => ({ kind: "level-bar", ...options }),
    onKey(key: PhoneKey, flow: Flow) {
      if (key === "navi" || key === "c") flow.back();
    },
  };
}

export interface LevelPageOptions {
  readonly settings: StockSettings;
  /** The numeric setting the page edits (`games/snake/level`). */
  readonly key: string;
  /** The most bars the page draws, and the highest level ▲ reaches (Snake II: 9). */
  readonly max: number;
  /** The bar sprites' prefix: `<bars>-<n>` draws n filled bars (Snake II: `level/snake`). */
  readonly bars: string;
  readonly softkey: string;
  /**
   * Runs when OK stores the level; a slug it returns is selected in the level returned to
   * (Snake II: OK while a game is suspended discards it, plan 23 Task 0 C8).
   */
  readonly onStore?: () => string | undefined;
}

/**
 * A game's Level page (plan 24 D14; Snake II's, plan 23 D11, Task 0 C1, is the `max: 9` case):
 * `min(level, max)` filled bars. ▼ lowers the level by one down to 1; ▲ raises it by one only
 * below `max` (from Snake II's virgin 175 it does nothing). Both act on key-down and repeat
 * while held. OK stores the level and goes back; C goes back without storing.
 */
class LevelPageWidget implements Widget {
  readonly #options: LevelPageOptions;
  #level: number;
  #held: { key: "up" | "down"; elapsedMs: number; nextMs: number } | undefined;

  constructor(options: LevelPageOptions) {
    this.#options = options;
    this.#level = options.settings.number(options.key);
  }

  render(): LevelBarModel {
    const { bars, max, softkey } = this.#options;
    return { kind: "level-bar", bars: `${bars}-${Math.min(this.#level, max)}`, softkey };
  }

  onKeyDown(key: PhoneKey, flow: Flow): void {
    // Plan 22 (S10): a dial key leaves for standby's number entry (`game/snake/level-keys-digit-1`).
    if (/^[0-9*#]$/.test(key)) {
      flow.standby(key);
      return;
    }
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
    else if (key === "up" && this.#level < this.#options.max) this.#level++;
  }
}

export function levelPage(options: LevelPageOptions): Widget {
  return new LevelPageWidget(options);
}
