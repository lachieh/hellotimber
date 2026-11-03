import { SPACE_IMPACT_VIBRATE_MS } from "../../kit/ui/resources/generated/space-impact-sounds";
import { SPACE_IMPACT_WAVE_PROGRAM } from "../../kit/ui/resources/generated/space-impact-wave-program";
import { createGameRandom } from "../random";
import { spaceImpactEnemyEntries, spaceImpactEnemyY } from "./objects";
import { spaceImpactBonus } from "./random";
import { SPACE_IMPACT_DATA } from "../../kit/ui/resources/generated/space-impact";
import { SPACE_IMPACT_OPENING_WAVE } from "../../kit/ui/resources/generated/space-impact-opening-wave";
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
    phase: { kind: "playing" },
    tick: 0,
    randomState: seed,
    level: 0,
    scroll: 0,
    ship: { x: 5, y: 20 },
    shield: true,
    hud: { lives: 3, weapon: "missile", count: 3, score: 0 },
    shots: [],
    enemyShots: [],
    enemies: [],
    bonuses: [],
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
      y: Math.max(6, Math.min(41, ship.y + move.y)),
    }),
    state.ship,
  );
}

export function spaceImpactKey(
  state: SpaceImpactState,
  key: PhoneKey,
  action: "down" | "up" | "repeat" = "down",
): SpaceImpactResult {
  if (action === "up") return result({ ...state, held: null });
  const deferred = pending(state);
  if (deferred) {
    const move = isSpaceImpactControl(key)
      ? spaceImpactMove(key, action === "repeat" ? 2 : 1)
      : null;
    // UNVERIFIED outside pickup two: movement queues before the deferred cue is returned.
    return move
      ? {
          ...deferred,
          state: { ...deferred.state, moves: [...state.moves, move], held: { key, attempts: 1 } },
        }
      : deferred;
  }
  if (key === "navi" || key === "c")
    return action === "down" ? { ...result(state), events: [{ kind: "suspend" }] } : result(state);
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
      shots: [...state.shots, { x: ship.x + 6, y: ship.y + 3, bornTick: state.tick }],
    },
    cues: [{ kind: "game-sound", id: "space-impact/shot" }],
    events: [],
  };
}

function touchesBonus(
  state: SpaceImpactState,
  ship: SpaceImpactState["ship"],
  bonus: SpaceImpactState["bonuses"][number],
  tick: number,
): boolean {
  if (state.shield) return false;
  const inverted = state.level === 0 || state.level === 4 || state.level === 5;
  const orb = SPACE_IMPACT_DATA.sprites[`bonus/orb/${(tick + bonus.animationOffset) % 2}`]!;
  // The opaque ship meets clear XOR-orb bits on inverted levels. UNVERIFIED outside level 0.
  return SPACE_IMPACT_DATA.sprites.ship!.some((row, y) =>
    row
      .split("")
      .some(
        (pixel, x) =>
          pixel === "#" &&
          orb[ship.y + y - bonus.y]?.[ship.x + x - bonus.x] === (inverted ? "." : "#"),
      ),
  );
}

export function stepSpaceImpact(state: SpaceImpactState): SpaceImpactResult {
  const deferred = pending(state);
  if (deferred) return deferred;
  if (state.phase.kind === "boss-destruction") {
    const targetY = 6;
    const ship =
      state.phase.flightSpeed === 0
        ? { ...state.ship, y: state.ship.y + Math.sign(targetY - state.ship.y) }
        : { ...state.ship, x: state.ship.x + state.phase.flightSpeed };
    if (ship.x > 104 && state.level < 7)
      return result({
        ...newSpaceImpactGame({ seed: state.randomState }),
        level: state.level + 1,
        tick: 1,
        hud: state.hud,
      });
    const flightSpeed =
      state.phase.flightSpeed === 0
        ? state.ship.y === targetY
          ? 1
          : 0
        : state.phase.flightSpeed + (ship.x % 3 === 0 ? 1 : 0);
    return result({
      ...state,
      tick: state.tick + 1,
      ship,
      enemyShots: state.enemyShots.flatMap((shot) =>
        shot.x < 3 ? [] : [{ ...shot, x: shot.x - 3 }],
      ),
      phase: {
        ...state.phase,
        frame: state.phase.frame + 1,
        flightSpeed,
        effects: state.phase.effects.flatMap((effect) =>
          (effect.phase + 1) % 5 === 4 ? [] : [{ ...effect, phase: (effect.phase + 1) % 5 }],
        ),
      },
      shots: state.shots.flatMap((shot) => (shot.x + 2 >= 84 ? [] : [{ ...shot, x: shot.x + 2 }])),
    });
  }
  let phase: SpaceImpactState["phase"] = state.phase;
  const ship = moveShip(state);
  const enemies = [
    ...state.enemies.flatMap((enemy) => {
      if (enemy.deathFrame !== null)
        return enemy.deathFrame >= 3 ? [] : [{ ...enemy, deathFrame: enemy.deathFrame + 1 }];
      const x = enemy.motion === "boss" ? Math.max(56, enemy.x + enemy.dx) : enemy.x + enemy.dx;
      return x < 0
        ? []
        : [{ ...enemy, flash: false, age: enemy.age + 1, x, y: spaceImpactEnemyY(enemy, x) }];
    }),
    ...spaceImpactEnemyEntries(state.tick + 1),
  ];
  const random = createGameRandom(state.randomState);
  const enemyShots = state.enemyShots.flatMap((shot) =>
    shot.deathFrame !== null
      ? shot.deathFrame >= 3
        ? []
        : [{ ...shot, deathFrame: shot.deathFrame + 1 }]
      : shot.x - 3 < 0
        ? []
        : [{ ...shot, x: shot.x - 3 }],
  );
  for (const [index, enemy] of enemies.entries()) {
    if (enemy.deathFrame !== null) continue;
    if (enemy.motion === "boss") {
      if (enemy.age <= 27) continue;
      if (random.next() % enemy.fireDenominator === 0)
        enemyShots.push({ x: enemy.x - 5, y: enemy.y + 10, deathFrame: null });
      continue;
    }
    if (enemy.family !== "enemy/round-small" || enemy.motion !== "wave") continue;
    // UNVERIFIED spatial fire hypothesis: the counted calls share these path extrema, including offscreen members.
    if (!SPACE_IMPACT_WAVE_PROGRAM.fireColumns.includes(enemy.x % 84)) continue;
    const fire = random.next() % enemy.fireDenominator === 0;
    if (!fire || enemy.x >= 84 || enemy.shotsLeft === 0) continue;
    enemies[index] = { ...enemy, shotsLeft: enemy.shotsLeft - 1 };
    enemyShots.push({ x: enemy.x - 5, y: enemy.y + 2, deathFrame: null });
  }
  const cues: SpaceImpactResult["cues"][number][] = [];
  let score = state.hud.score;
  const movedBonuses = [
    // UNVERIFIED: level 0 collects both orbs before their left-edge retirement.
    ...state.bonuses.flatMap((bonus) => {
      const x = bonus.x + bonus.dx;
      return x < 0 ? [] : [{ ...bonus, x }];
    }),
    ...SPACE_IMPACT_OPENING_WAVE.bonuses
      .filter((entry) => entry.tick === state.tick + 1)
      .map(({ x, y, dx, animationOffset }) => ({ x, y, dx, animationOffset })),
  ];
  const shots = state.shots.flatMap((shot) => {
    const moved = { ...shot, x: shot.x + 2 };
    if (moved.x >= 84) return [];
    const hit = enemies.findIndex(
      (enemy) =>
        enemy.deathFrame === null &&
        moved.x + 2 >= enemy.x &&
        moved.x < enemy.x + SPACE_IMPACT_DATA.sprites[`${enemy.family}/0`]![0]!.length &&
        moved.y + 1 >= enemy.y &&
        moved.y <= enemy.y + SPACE_IMPACT_DATA.sprites[`${enemy.family}/0`]!.length,
    );
    if (hit === -1) {
      if (
        movedBonuses.some(
          (bonus) =>
            moved.x + 2 >= bonus.x &&
            moved.x <= bonus.x + 8 &&
            moved.y + 1 >= bonus.y &&
            moved.y <= bonus.y + 7,
        )
      )
        return [];
      const bullet = enemyShots.findIndex(
        (bullet) =>
          bullet.deathFrame === null &&
          moved.x + 2 >= bullet.x &&
          moved.x <= bullet.x + 2 &&
          moved.y + 1 >= bullet.y &&
          moved.y <= bullet.y + 1,
      );
      if (bullet === -1) return [moved];
      enemyShots[bullet] = { ...enemyShots[bullet]!, deathFrame: 0 };
      return [];
    }
    const enemy = enemies[hit]!;
    if (
      enemy.motion === "boss" &&
      (moved.y === enemy.y ||
        ![0, 1, 2].some(
          (dx) =>
            SPACE_IMPACT_DATA.sprites[`boss/0/${Math.floor((state.tick + 1) / 2) % 2}`]![
              Math.abs(moved.y - enemy.y)
            ]?.[Math.abs(moved.x - enemy.x) + dx] === "#",
        ))
    )
      return [moved];
    const hp = enemy.hp - 1;
    enemies[hit] = {
      ...enemy,
      hp,
      flash: enemy.motion === "boss" && (enemy.flash || !enemy.flashToggle),
      flashToggle: enemy.motion === "boss" ? !enemy.flashToggle : false,
      deathFrame: hp === 0 ? 0 : null,
    };
    if (hp === 0 && enemy.motion === "boss") {
      const center = { x: enemy.x + 10, y: enemy.y + 11 };
      const effects = [{ ...center, phase: random.next() % 5 }];
      for (let n = 0; n < 5; n++) {
        const dx = (random.next() & 3) + 1;
        effects.push(
          { x: center.x + dx, y: center.y + 6, phase: random.next() % 5 },
          { x: center.x - dx, y: center.y - 6, phase: random.next() % 5 },
        );
      }
      phase = { kind: "boss-destruction", frame: 0, flightSpeed: 0, effects };
      score += 100;
      cues.push({ kind: "vibrate", ms: SPACE_IMPACT_VIBRATE_MS });
    } else score += hp === 0 ? 10 : 5;
    return [];
  });
  let hud = { ...state.hud, score };
  let pendingCue = state.pendingCue;
  const bonuses = movedBonuses.filter((bonus) => {
    if (!touchesBonus(state, ship, bonus, state.tick + 1)) return true;
    hud = spaceImpactBonus(random, hud);
    pendingCue = "space-impact/bonus";
    return false;
  });
  return {
    ...result({
      ...state,
      phase,
      enemies,
      enemyShots,
      bonuses,
      hud,
      randomState: random.state,
      pendingCue,
      ship,
      moves: [],
      tick: state.tick + 1,
      scroll: state.scroll + 1,
      fireCooldown: Math.max(0, state.fireCooldown - 1),
      shots,
    }),
    cues,
  };
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
  const boss = state.enemies.find((enemy) => enemy.motion === "boss");
  const bossBorn = boss ? state.tick - boss.age : Infinity;
  const shotSprites = (before: boolean) =>
    state.shots
      .filter((shot) => (before ? shot.bornTick < bossBorn : shot.bornTick >= bossBorn))
      .map(({ x, y }) => ({ picture: "shot", x, y }));
  return {
    level: state.level,
    scroll: state.scroll,
    hud: state.hud,
    sprites: [
      ship,
      ...state.enemies
        .filter((enemy) => enemy.motion !== "boss")
        .map(({ x, y, family, animationOffset, deathFrame }) => {
          if (deathFrame === null || deathFrame === 0)
            return {
              picture: `${family}/${family === "enemy/round-wide" || family === "enemy/triangle" ? ((state.tick + animationOffset) % 2 === 0 ? 1 : 0) : 0}`,
              x,
              y,
            };
          const picture = ["explosion/split/0", "explosion/checker/0", "explosion/spark/0"][
            deathFrame - 1
          ]!;
          return { picture, x: x + deathFrame - 1, y: y + deathFrame - 1 };
        }),
      ...state.bonuses.map(({ x, y, animationOffset }) => ({
        picture: `bonus/orb/${(state.tick + animationOffset) % 2}`,
        x,
        y,
      })),
      ...shotSprites(true),
      ...state.enemyShots.map(({ x, y, deathFrame }) =>
        deathFrame === null || deathFrame === 0
          ? { picture: "shot", x, y }
          : {
              picture: ["explosion/split/0", "explosion/checker/0", "explosion/spark/0"][
                deathFrame - 1
              ]!,
              x: x + deathFrame - 1,
              y: y + deathFrame - 1,
            },
      ),
      ...state.enemies
        .filter((enemy) => enemy.motion === "boss" && enemy.deathFrame === null && !enemy.flash)
        .map((enemy) => ({
          picture: `boss/0/${Math.floor(state.tick / 2) % 2}`,
          x: enemy.x,
          y: enemy.y,
          opaque: true,
        })),
      ...shotSprites(false),
      ...(state.phase.kind === "boss-destruction"
        ? state.phase.effects.map((effect) => {
            const phase =
              state.phase.kind === "boss-destruction" && state.phase.frame === 0 ? 0 : effect.phase;
            const offset = phase === 1 ? 0 : phase === 3 ? 2 : 1;
            return {
              picture:
                phase === 1
                  ? "explosion/split/0"
                  : phase === 3
                    ? "explosion/spark/0"
                    : "explosion/checker/0",
              x: effect.x + offset,
              y: effect.y + offset,
            };
          })
        : []),
    ],
  };
}
