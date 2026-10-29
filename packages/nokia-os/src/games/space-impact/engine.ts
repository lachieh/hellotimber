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
  const enemies = [
    ...state.enemies.flatMap((enemy) => {
      if (enemy.deathFrame !== null)
        return enemy.deathFrame >= 3 ? [] : [{ ...enemy, deathFrame: enemy.deathFrame + 1 }];
      const x = enemy.x + SPACE_IMPACT_OPENING_WAVE.dx;
      return x < 0 ? [] : [{ ...enemy, x, y: enemy.y + SPACE_IMPACT_OPENING_WAVE.dy }];
    }),
    ...SPACE_IMPACT_OPENING_WAVE.entries
      .filter((entry) => entry.tick === state.tick + 1)
      .map(({ x, y, animationOffset }) => ({ x, y, animationOffset, deathFrame: null })),
  ];
  let score = state.hud.score;
  const shots = state.shots.flatMap((shot) => {
    const moved = { ...shot, x: shot.x + 2 };
    if (moved.x >= 84) return [];
    const hit = enemies.findIndex(
      (enemy) =>
        enemy.deathFrame === null &&
        moved.x + 2 > enemy.x &&
        moved.x < enemy.x + 11 &&
        moved.y + 1 >= enemy.y &&
        moved.y < enemy.y + 5,
    );
    if (hit === -1) return [moved];
    enemies[hit] = { ...enemies[hit]!, deathFrame: 0 };
    score += 10;
    return [];
  });
  return result({
    ...state,
    enemies,
    hud: { ...state.hud, score },
    ship,
    moves: [],
    tick: state.tick + 1,
    scroll: state.scroll + 1,
    fireCooldown: Math.max(0, state.fireCooldown - 1),
    shots,
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
      ...state.enemies.map(({ x, y, animationOffset, deathFrame }) => {
        if (deathFrame === null || deathFrame === 0)
          return {
            picture: `${SPACE_IMPACT_OPENING_WAVE.family}/${(state.tick + animationOffset) % 2 === 0 ? 1 : 0}`,
            x,
            y,
          };
        const picture = ["explosion/split/0", "explosion/checker/0", "explosion/spark/0"][
          deathFrame - 1
        ]!;
        return { picture, x: x + deathFrame - 1, y: y + deathFrame - 1 };
      }),
      ...state.shots.map((shot) => ({ picture: "shot", ...shot })),
    ],
  };
}
