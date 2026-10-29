import type { PhoneKey } from "@hellotimber/phone-core";
import type { StockCue } from "../../firmware/cues";

export interface SpaceImpactPoint {
  readonly x: number;
  readonly y: number;
}

export interface SpaceImpactSprite extends SpaceImpactPoint {
  readonly picture: string;
}

export interface SpaceImpactHud {
  readonly lives: number;
  readonly weapon: "missile" | "wall" | "beam";
  readonly count: number;
  readonly score: number;
}

export type SpaceImpactControl = "8" | "0" | "*" | "#" | "1" | "3";

export interface SpaceImpactState {
  readonly tick: number;
  readonly randomState: number;
  readonly level: number;
  readonly scroll: number;
  readonly ship: SpaceImpactPoint;
  readonly shield: boolean;
  readonly hud: SpaceImpactHud;
  readonly shots: readonly SpaceImpactPoint[];
  readonly enemies: readonly (SpaceImpactPoint & { readonly animationOffset: number })[];
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
