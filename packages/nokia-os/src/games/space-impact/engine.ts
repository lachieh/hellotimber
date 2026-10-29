import { SPACE_IMPACT_OPENING_WAVE } from "../../resources/generated/space-impact-opening-wave";
import type { PhoneKey } from "@hellotimber/phone-core";
import { isSpaceImpactControl, spaceImpactMove } from "./keys";
import type { SpaceImpactState, SpaceImpactResult, SpaceImpactRenderModel } from "./model";

function result(state: SpaceImpactState): SpaceImpactResult {
  return { state, cues: [], events: [] };
}

function pending(state: SpaceImpactState): SpaceImpactResult | null {
  return state.pendingCue === null
    ? null
    : {
        state: { ...state, pendingCue: null },
        cues: [{ kind: "game-sound", id: state.pendingCue }],
        events: [],
      };
}

export function newSpaceImpactGame({ seed = 0 }: { seed?: number } = {}): SpaceImpactState {
  return {
    tick: 0,
    randomState: seed,
    level: 0,
    scroll: 0,
    ship: { x: 5, y: 20 },
    shield: true,
    hud: { lives: 3, weapon: "missile", count: 3, score: 0 },
    shots: [],
    enemies: [],
    moves: [],
    held: null,
    fireCooldown: 0,
    pendingCue: null,
  };
}

function moveShip(state: SpaceImpactState) {
  return state.moves.reduce(
    (ship, move) => ({
      x: Math.max(2, Math.min(46, ship.x + move.x)),
      y: Math.max(7, Math.min(41, ship.y + move.y)),
    }),
    state.ship,
  );
}

export function spaceImpactKey(
  state: SpaceImpactState,
  key: PhoneKey,
  action: "down" | "up" | "repeat" = "down",
): SpaceImpactResult {
  const deferred = pending(state);
  if (deferred) return deferred;
  if (key === "navi" || key === "c")
    return action === "down" ? { ...result(state), events: [{ kind: "suspend" }] } : result(state);
  if (action === "up") return result({ ...state, held: null });
  if (action === "repeat" && state.held?.key !== key) return result(state);
  const attempts = action === "down" ? 1 : (state.held?.attempts ?? 0) + 1;
  const held = { key, attempts };
  if (!isSpaceImpactControl(key)) return result({ ...state, held });
  const move = spaceImpactMove(key, action === "repeat" ? 2 : 1);
  if (move) return result({ ...state, held, moves: [...state.moves, move] });
  // H2, UNVERIFIED: five held-fire attempts including the initial press.
  if (state.fireCooldown > 0 || (action === "repeat" && attempts > 5))
    return result({ ...state, held });
  const ship = moveShip(state);
  return {
    state: {
      ...state,
      ship,
      moves: [],
      held,
      fireCooldown: 2,
      shots: [...state.shots, { x: ship.x + 6, y: ship.y + 3 }],
    },
    cues: [{ kind: "game-sound", id: "space-impact/shot" }],
    events: [],
  };
}

export function stepSpaceImpact(state: SpaceImpactState): SpaceImpactResult {
  const deferred = pending(state);
  if (deferred) return deferred;
  const ship = moveShip(state);
  return result({
    ...state,
    enemies: [
      ...state.enemies
        .map((enemy) => ({
          ...enemy,
          x: enemy.x + SPACE_IMPACT_OPENING_WAVE.dx,
          y: enemy.y + SPACE_IMPACT_OPENING_WAVE.dy,
        }))
        .filter((enemy) => enemy.x + 11 > 0),
      ...SPACE_IMPACT_OPENING_WAVE.entries
        .filter((entry) => entry.tick === state.tick + 1)
        .map(({ x, y, animationOffset }) => ({ x, y, animationOffset })),
    ],
    ship,
    moves: [],
    tick: state.tick + 1,
    scroll: state.scroll + 1,
    fireCooldown: Math.max(0, state.fireCooldown - 1),
    shots: state.shots.map((shot) => ({ ...shot, x: shot.x + 2 })).filter((shot) => shot.x < 84),
  });
}

export function expireSpaceImpactShield(state: SpaceImpactState): SpaceImpactResult {
  return pending(state) ?? result({ ...state, shield: false });
}

export function spaceImpactRender(
  state: SpaceImpactState,
  { waiting = false }: { waiting?: boolean } = {},
): SpaceImpactRenderModel {
  const ship = state.shield
    ? {
        picture: `ship/shielded/${waiting ? 2 : state.tick % 2}`,
        x: state.ship.x - 2,
        y: state.ship.y - 2,
      }
    : { picture: "ship", ...state.ship };
  return {
    level: state.level,
    scroll: state.scroll,
    hud: state.hud,
    sprites: [
      ship,
      ...state.enemies.map(({ x, y, animationOffset }) => ({
        picture: `${SPACE_IMPACT_OPENING_WAVE.family}/${(state.tick + animationOffset) % 2 === 0 ? 1 : 0}`,
        x,
        y,
      })),
      ...state.shots.map((shot) => ({ picture: "shot", ...shot })),
    ],
  };
}
