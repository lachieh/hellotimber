import type { StockFeature } from "./feature";
import type { PhoneKey } from "@hellotimber/phone-core";
import type { StockGames } from "./games";
import type { Flow, Widget } from "../../widgets/flow";
import type { SpaceImpactModel } from "../../display/widgets/space-impact";
import {
  newSpaceImpactGame,
  spaceImpactKey,
  stepSpaceImpact,
  spaceImpactRender,
  expireSpaceImpactShield,
} from "../../games/space-impact/engine";
import type { SpaceImpactResult, SpaceImpactState } from "../../games/space-impact/model";
import { SPACE_IMPACT_DATA } from "../../resources/generated/space-impact";

const timings = SPACE_IMPACT_DATA.timings;

export interface SpaceImpactGameOptions {
  readonly games: StockGames;
  readonly start: "new" | "continue";
}

interface SuspendedSpaceImpact {
  readonly state: SpaceImpactState;
}

class SpaceImpactGame implements Widget {
  readonly #games: StockGames;
  readonly #events: number;
  #state: SpaceImpactState;
  #waiting: boolean;
  #interrupted = false;
  #tickMs: number = timings.firstTickMs;
  #shieldMs: number | null = timings.newGameShieldMs;
  #repeat: { key: PhoneKey; ms: number } | null = null;
  #model: SpaceImpactModel;

  constructor({ games, start }: SpaceImpactGameOptions) {
    this.#games = games;
    this.#events = games.events?.() ?? 0;
    this.#waiting = start === "continue";
    if (this.#waiting) {
      const suspended = games.suspended["space-impact"] as SuspendedSpaceImpact | undefined;
      if (suspended === undefined)
        throw new Error("Continue without a suspended Space impact game.");
      this.#state = suspended.state;
    } else {
      this.#state = newSpaceImpactGame({ seed: games.seed() });
    }
    this.#model = {
      kind: "space-impact",
      board: spaceImpactRender(this.#state, { waiting: this.#waiting }),
    };
    delete games.suspended["space-impact"];
    if (this.#waiting) this.#shieldMs = null;
  }

  render(): SpaceImpactModel {
    return this.#model;
  }

  onKeyDown(key: PhoneKey, flow: Flow): void {
    if (this.#waiting) {
      this.#waiting = false;
      this.#state = { ...this.#state, shield: true };
      this.#shieldMs = timings.resumeShieldMs;
      this.#tickMs = timings.tickMs;
    }
    this.#accept(spaceImpactKey(this.#state, key), flow, this.#games.now(), {
      suspendSelect: key === "c" ? "new-game" : "continue",
    });
    this.#repeat = { key, ms: timings.repeatMs };
  }

  onKey(key: PhoneKey, flow: Flow): void {
    this.#repeat = null;
    this.#accept(spaceImpactKey(this.#state, key, "up"), flow, this.#games.now(), { draw: false });
  }

  tick(dtMs: number, flow: Flow): void {
    if (this.#interrupted || (this.#games.events?.() ?? 0) !== this.#events) {
      this.#suspend(flow);
      return;
    }
    if (this.#waiting) return;
    let left = dtMs;
    while (left > 0) {
      const next = Math.min(this.#tickMs, this.#shieldMs ?? Infinity, this.#repeat?.ms ?? Infinity);
      const advance = Math.min(left, next);
      this.#tickMs -= advance;
      if (this.#shieldMs !== null) this.#shieldMs -= advance;
      if (this.#repeat !== null) this.#repeat.ms -= advance;
      left -= advance;
      const atMs = this.#games.now() - left;
      if (this.#shieldMs === 0) {
        this.#shieldMs = null;
        this.#accept(expireSpaceImpactShield(this.#state), flow, atMs, { draw: false });
      }
      if (this.#tickMs === 0) {
        this.#tickMs = timings.tickMs;
        this.#accept(stepSpaceImpact(this.#state), flow, atMs);
      }
      if (this.#repeat?.ms === 0) {
        const { key } = this.#repeat;
        this.#repeat.ms = timings.repeatMs;
        this.#accept(spaceImpactKey(this.#state, key, "repeat"), flow, atMs);
      }
    }
  }

  interrupted(): void {
    this.#interrupted = true;
  }

  #accept(
    result: SpaceImpactResult,
    flow: Flow,
    atMs: number,
    {
      draw = true,
      suspendSelect = "continue",
    }: { draw?: boolean; suspendSelect?: "continue" | "new-game" } = {},
  ): void {
    this.#state = result.state;
    if (draw) this.#model = { kind: "space-impact", board: spaceImpactRender(this.#state) };
    for (const cue of result.cues) this.#games.cues.cue(cue, atMs);
    if (result.events.some((event) => event.kind === "suspend")) this.#suspend(flow, suspendSelect);
  }

  #suspend(flow: Flow, select: "continue" | "new-game" = "continue"): void {
    this.#games.suspended["space-impact"] = {
      state: { ...this.#state, held: null },
    } satisfies SuspendedSpaceImpact;
    flow.back(1, {
      select,
      row: "top",
      endHolds: true,
    });
  }
}

export function spaceImpactGame(options: SpaceImpactGameOptions): Widget {
  return new SpaceImpactGame(options);
}

export const spaceImpactFeature: StockFeature = {
  name: "space-impact",
  settings: {
    virginNumbers: [{ key: "games/space-impact/top-score", number: "8-2-2", line: 1 }],
    restoreKeeps: ["games/space-impact/top-score"],
  },
};
