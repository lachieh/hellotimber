import type { PhoneKey } from "@hellotimber/phone-core";
import type { StockCue } from "../../kit/system/cues";

export interface SpaceImpactPoint {
  readonly x: number;
  readonly y: number;
}

export interface SpaceImpactSprite extends SpaceImpactPoint {
  readonly picture: string;
  readonly opaque?: boolean;
}

export interface SpaceImpactHud {
  readonly lives: number;
  readonly weapon: "missile" | "wall" | "beam";
  readonly count: number;
  readonly score: number;
}

export type SpaceImpactControl = "8" | "0" | "*" | "#" | "1" | "3";

export interface SpaceImpactEnemy extends SpaceImpactPoint {
  readonly family: string;
  readonly motion: "straight" | "descend" | "wave" | "slope" | "boss";
  readonly flash: boolean;
  readonly flashToggle: boolean;
  readonly age: number;
  readonly hp: number;
  readonly shotsLeft: number;
  readonly fireDenominator: number;
  readonly animationOffset: number;
  readonly dx: number;
  readonly deathFrame: number | null;
}

export interface SpaceImpactState {
  readonly phase:
    | { readonly kind: "playing" }
    | {
        readonly kind: "boss-destruction";
        readonly frame: number;
        readonly flightSpeed: number;
        readonly effects: readonly (SpaceImpactPoint & { readonly phase: number })[];
      };
  readonly tick: number;
  readonly randomState: number;
  readonly level: number;
  readonly scroll: number;
  readonly ship: SpaceImpactPoint;
  readonly shield: boolean;
  readonly hud: SpaceImpactHud;
  readonly shots: readonly (SpaceImpactPoint & { readonly bornTick: number })[];
  readonly enemyShots: readonly (SpaceImpactPoint & { readonly deathFrame: number | null })[];
  readonly bonuses: readonly (SpaceImpactPoint & {
    readonly dx: number;
    readonly animationOffset: number;
  })[];
  readonly enemies: readonly SpaceImpactEnemy[];
  readonly moves: readonly SpaceImpactPoint[];
  readonly fireCooldown: number;
  readonly held: { readonly key: PhoneKey; readonly attempts: number } | null;
  /** H16, UNVERIFIED: a pending return consumes the next event without advancing the game. */
  readonly pendingCue: string | null;
}

export interface SpaceImpactRenderModel {
  readonly level: number;
  readonly scroll: number;
  readonly hud: SpaceImpactHud;
  readonly sprites: readonly SpaceImpactSprite[];
}

export interface SpaceImpactResult {
  readonly state: SpaceImpactState;
  readonly cues: readonly StockCue[];
  readonly events: readonly { readonly kind: "suspend" }[];
}
