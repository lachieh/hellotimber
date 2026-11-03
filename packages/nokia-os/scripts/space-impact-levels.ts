import { SPACE_IMPACT_DATA } from "../src/kit/ui/resources/generated/space-impact.ts";
import { LEVEL_ZERO_OBJECTS, LEVEL_ZERO_READINGS } from "./space-impact-level-zero.ts";
import {
  decodeSpaceImpact,
  type SpaceImpactObservation,
} from "../tests/support/space-impact-decode.ts";
import { findGoldenImage, type Golden } from "./golden-format.ts";
import { resourceModule, type GeneratedResourceModule } from "./resource-declarations.ts";

export interface SpaceImpactLinearMotion {
  readonly family: string;
  readonly dx: number;
  readonly dy: number;
}

export interface SpaceImpactCandidateFrame {
  readonly tick: number;
  readonly candidates: readonly (readonly SpaceImpactObservation[])[];
}

export interface SpaceImpactTrackEdge {
  readonly candidate: number;
  readonly links: readonly { readonly from: number; readonly to: number }[];
  readonly entries: readonly number[];
  readonly exits: readonly number[];
}

export interface SpaceImpactTrackNode {
  readonly tick: number;
  readonly sourceCandidate: number;
  readonly objects: readonly SpaceImpactObservation[];
  readonly predecessors: readonly SpaceImpactTrackEdge[];
}

function family(object: SpaceImpactObservation): string {
  return object.picture.replace(/\/\d+$/, "");
}

function validTick(tick: number): boolean {
  return Number.isSafeInteger(tick) && tick >= 0;
}

function validateObjects(objects: readonly SpaceImpactObservation[]) {
  for (const [index, object] of objects.entries()) {
    if (
      !object.picture ||
      ![object.x, object.y, object.width, object.height].every(Number.isSafeInteger) ||
      object.width <= 0 ||
      object.height <= 0 ||
      object.x >= 84 ||
      object.x + object.width <= 0 ||
      object.y >= 48 ||
      object.y + object.height <= 0
    )
      throw new Error("tracker: invalid visible object");
    if (
      objects
        .slice(0, index)
        .some(
          (previous) =>
            family(previous) === family(object) &&
            previous.x === object.x &&
            previous.y === object.y,
        )
    )
      throw new Error("tracker: indistinguishable duplicate objects");
  }
}

/** Tracks only established constant motion, with viewport entries/exits and no interior events. */
export function trackSpaceImpactLinearSegment(
  frames: readonly SpaceImpactCandidateFrame[],
  motions: readonly SpaceImpactLinearMotion[],
): readonly (readonly SpaceImpactTrackNode[])[] {
  if (frames.length === 0) throw new Error("tracker: empty segment");
  const byFamily = new Map<string, SpaceImpactLinearMotion>();
  for (const motion of motions) {
    if (
      !motion.family ||
      ![motion.dx, motion.dy].every(Number.isSafeInteger) ||
      byFamily.has(motion.family)
    )
      throw new Error("tracker: invalid or duplicate motion family");
    byFamily.set(motion.family, motion);
  }
  const motionOf = (object: SpaceImpactObservation) => {
    const motion = byFamily.get(family(object));
    if (!motion) throw new Error(`tracker: no established motion for ${family(object)}`);
    return motion;
  };
  const transition = (
    previous: SpaceImpactTrackNode,
    objects: readonly SpaceImpactObservation[],
    tick: number,
    candidate: number,
  ): SpaceImpactTrackEdge | null => {
    const elapsed = tick - previous.tick;
    const links: { from: number; to: number }[] = [];
    const exits: number[] = [];
    for (const [from, object] of previous.objects.entries()) {
      const { dx, dy } = motionOf(object);
      const x = object.x + dx * elapsed,
        y = object.y + dy * elapsed;
      const to = objects.findIndex(
        (next) => family(next) === family(object) && next.x === x && next.y === y,
      );
      if (to !== -1) links.push({ from, to });
      else if (x >= 84 || x + object.width <= 0) exits.push(from);
      else return null;
    }
    const entries: number[] = [];
    for (const [to, object] of objects.entries()) {
      if (links.some((link) => link.to === to)) continue;
      const { dx } = motionOf(object);
      const priorX = object.x - dx * elapsed;
      if ((dx < 0 && priorX >= 84) || (dx > 0 && priorX + object.width <= 0)) entries.push(to);
      else return null;
    }
    return { candidate, links, entries, exits };
  };
  const graph: SpaceImpactTrackNode[][] = [];
  for (const [index, frame] of frames.entries()) {
    if (!validTick(frame.tick) || (index > 0 && frame.tick <= frames[index - 1]!.tick))
      throw new Error("tracker: ticks must be nonnegative and strictly increasing");
    if (frame.candidates.length === 0)
      throw new Error(`tracker: no candidates at tick ${frame.tick}`);
    const nodes: SpaceImpactTrackNode[] = [];
    for (const [sourceCandidate, objects] of frame.candidates.entries()) {
      validateObjects(objects);
      objects.forEach(motionOf);
      const predecessors =
        index === 0
          ? []
          : graph[index - 1]!.flatMap((previous, candidate) => {
              const edge = transition(previous, objects, frame.tick, candidate);
              return edge ? [edge] : [];
            });
      if (index === 0 || predecessors.length > 0)
        nodes.push({ tick: frame.tick, sourceCandidate, objects, predecessors });
    }
    if (nodes.length === 0)
      throw new Error(
        `tracker: no consistent linear path at tick ${frame.tick}; requires motion or collision evidence`,
      );
    graph.push(nodes);
  }
  // Retain only candidates belonging to a complete path, including constraints from later frames.
  const retained = graph.map(() => new Set<number>());
  graph.at(-1)!.forEach((_, index) => retained.at(-1)!.add(index));
  for (let index = graph.length - 1; index > 0; index--)
    for (const candidate of retained[index]!)
      for (const edge of graph[index]![candidate]!.predecessors)
        retained[index - 1]!.add(edge.candidate);
  const indices = retained.map(
    (set) => new Map([...set].sort((a, b) => a - b).map((old, next) => [old, next])),
  );
  return graph.map((nodes, index) =>
    nodes.flatMap((node, candidate) => {
      if (!retained[index]!.has(candidate)) return [];
      return [
        {
          ...node,
          predecessors: node.predecessors.map((edge) => ({
            ...edge,
            candidate: indices[index - 1]!.get(edge.candidate)!,
          })),
        },
      ];
    }),
  );
}

/** Fits observed samples only; missing ticks need independent evidence of linear motion. */
export function fitSpaceImpactLinearPath(
  samples: readonly {
    readonly tick: number;
    readonly object: SpaceImpactObservation;
  }[],
) {
  const first = samples[0],
    second = samples[1];
  if (!first || !second) throw new Error("fitter: linear path needs at least two observations");
  const elapsed = second.tick - first.tick;
  const dx = (second.object.x - first.object.x) / elapsed;
  const dy = (second.object.y - first.object.y) / elapsed;
  if (elapsed <= 0 || ![dx, dy].every(Number.isSafeInteger))
    throw new Error("fitter: nonintegral or unordered linear path");
  for (const [index, sample] of samples.entries()) {
    validateObjects([sample.object]);
    if (!validTick(sample.tick) || (index > 0 && sample.tick <= samples[index - 1]!.tick))
      throw new Error("fitter: linear ticks must increase");
    if (family(sample.object) !== family(first.object))
      throw new Error("fitter: mixed object family");
    if (
      sample.object.x !== first.object.x + dx * (sample.tick - first.tick) ||
      sample.object.y !== first.object.y + dy * (sample.tick - first.tick)
    )
      throw new Error(`fitter: nonlinear path at tick ${sample.tick}; retain every tick`);
  }
  return {
    family: family(first.object),
    startTick: first.tick,
    endTick: samples.at(-1)!.tick,
    x: first.object.x,
    y: first.object.y,
    dx,
    dy,
  };
}

export type SpaceImpactObservedFrame = {
  readonly image: string;
  readonly frame: number;
  readonly startMs: number;
  readonly durationMs: number;
} & (
  | {
      readonly kind: "decoded";
      readonly hud: {
        readonly lives: number;
        readonly weapon: "missile" | "wall" | "beam";
        readonly count: number;
        readonly score: number;
      };
      readonly candidates: readonly {
        readonly ship: number | null;
        readonly objects: readonly number[];
      }[];
    }
  | { readonly kind: "unresolved"; readonly reason: string }
);

export function extractSpaceImpactLevelObservations(golden: Golden) {
  if (golden.id !== "game/space-impact/level-0" || !golden.timeline)
    throw new Error("level observations: expected the level-0 timeline");
  const frames: SpaceImpactObservedFrame[] = [];
  const objects: SpaceImpactObservation[] = LEVEL_ZERO_OBJECTS.map(
    ([picture, x, y, width, height]) => ({ picture, x, y, width, height }),
  );
  const readings = new Map(LEVEL_ZERO_READINGS.map((reading) => [reading[0], reading]));
  for (const [index, row] of golden.timeline.entries()) {
    if (row.frame < Number(golden.triggerFrame)) continue;
    if (row.durationMs < 34 && index !== golden.timeline.length - 1) continue;
    const { image, frame, startMs, durationMs } = row;
    const source = { image, frame, startMs, durationMs };
    const pixels = findGoldenImage(golden, image).pixels;
    if (image === "ala") {
      const previous = findGoldenImage(golden, "akz").pixels;
      for (let y = 23; y <= 46; y++)
        for (let x = 56; x <= 75; x++)
          if (pixels[y * 84 + x] !== previous[(y < 32 ? y + 1 : y) * 84 + x])
            throw new Error("level-0 ala: no longer the established mixed boss redraw");
      frames.push({
        ...source,
        kind: "unresolved",
        reason:
          "Boss mixed redraw: upper rows shifted by one, lower rows retained; requires engine replay.",
      });
      continue;
    }
    const reading = readings.get(image);
    if (!reading) throw new Error(`level-0 ${image}: missing retained observations`);
    const [, lives, weapon, count, score, alternatives] = reading;
    const hud = { lives, weapon, count, score };
    const candidates = alternatives.map(([ship, ...observed]) => ({
      ship: ship === -1 ? null : ship,
      objects: observed,
    }));
    for (const candidate of candidates) {
      const actual = new Uint8Array(84 * 48).fill(1);
      const draw = (picture: string, x: number, y: number) => {
        const art = SPACE_IMPACT_DATA.sprites[picture];
        if (!art) throw new Error(`level-0: missing observed sprite ${picture}`);
        for (const [dy, row] of art.entries())
          for (let dx = 0; dx < row.length; dx++)
            if (row[dx] === "#" && x + dx >= 0 && x + dx < 84 && y + dy >= 0 && y + dy < 48)
              actual[(y + dy) * 84 + x + dx] ^= 1;
      };
      for (let life = 0; life < lives; life++) draw("heart", life * 6, 0);
      draw(`special/${weapon}`, 36, 0);
      for (const [value, x, length] of [
        [count, 43, 2],
        [score, 57, 5],
      ] as const)
        for (const [offset, digit] of String(value).padStart(length, "0").split("").entries())
          draw(`digit/${digit}`, x + offset * 4, 0);
      const sprites = [
        ...(candidate.ship === null ? [] : [objects[candidate.ship]!]),
        ...candidate.objects.map((index) => objects[index]!),
      ];
      for (const sprite of sprites) draw(sprite.picture, sprite.x, sprite.y);
      if (!actual.every((pixel, index) => pixel === pixels[index]))
        throw new Error(
          `level-0 ${image}: unread settled observation (retained alternative no longer paints exactly)`,
        );
    }
    frames.push({ ...source, kind: "decoded", hud, candidates });
  }
  return { level: 0, source: golden.id, sourceSha256: golden.sourceSha256, objects, frames };
}

export const spaceImpactLevelModule: GeneratedResourceModule = {
  file: "space-impact-levels.ts",
  extract: ({ golden }) =>
    resourceModule(
      "SPACE_IMPACT_LEVEL_OBSERVATIONS",
      "{ readonly level: number; readonly source: string; readonly sourceSha256: string; readonly objects: readonly { readonly picture: string; readonly x: number; readonly y: number; readonly width: number; readonly height: number }[]; readonly frames: readonly ({ readonly image: string; readonly frame: number; readonly startMs: number; readonly durationMs: number } & ({ readonly kind: 'decoded'; readonly hud: { readonly lives: number; readonly weapon: 'missile' | 'wall' | 'beam'; readonly count: number; readonly score: number }; readonly candidates: readonly { readonly ship: number | null; readonly objects: readonly number[] }[] } | { readonly kind: 'unresolved'; readonly reason: string }))[] }",
      extractSpaceImpactLevelObservations(golden("game/space-impact/level-0")),
    ),
};

export const spaceImpactOpeningWaveModule: GeneratedResourceModule = {
  file: "space-impact-opening-wave.ts",
  extract: ({ golden }) => {
    const capture = golden("game/space-impact/keys-tap-5");
    const snapshots = [40, 41, 42].map((tick) => ({
      tick,
      objects: decodeSpaceImpact(findGoldenImage(capture, `t00${tick}`).pixels, { level: 0 })
        .objects,
    }));
    const first = snapshots[0]!;
    if (first.objects.length !== 3)
      throw new Error("opening wave: expected three observed enemies");
    const entries = first.objects.map((object, index) => {
      const samples = snapshots.map((snapshot) => ({
        tick: snapshot.tick,
        object: snapshot.objects[index]!,
      }));
      const motion = fitSpaceImpactLinearPath(samples);
      if (motion.family !== "enemy/round-wide" || motion.dx !== -2 || motion.dy !== 0)
        throw new Error("opening wave: changed observed motion");
      const entryX = 82;
      const tick = first.tick - (entryX - object.x) / 2;
      if (!Number.isSafeInteger(tick)) throw new Error("opening wave: nonintegral entry");
      return { tick, x: entryX, y: object.y, animationOffset: 0 };
    });
    for (const snapshot of snapshots)
      for (const object of snapshot.objects)
        if (object.picture !== `enemy/round-wide/${snapshot.tick % 2 === 0 ? 1 : 0}`)
          throw new Error("opening wave: changed animation phase");
    const tree = golden("tree/08-games/8-2-1.leaf");
    const following = [
      { tick: 57, image: "ao" },
      { tick: 58, image: "ap" },
    ].map(({ tick, image }) => {
      const objects = decodeSpaceImpact(findGoldenImage(tree, image).pixels, { level: 0 }).objects;
      const object = objects.find((object) => object.y === 17);
      if (!object) throw new Error("following wave: missing observed enemy");
      if (object.picture !== `enemy/round-wide/${tick % 2}`)
        throw new Error("following wave: changed animation phase");
      return { tick, object };
    });
    const motion = fitSpaceImpactLinearPath(following);
    if (motion.family !== "enemy/round-wide" || motion.dx !== -2 || motion.dy !== 0)
      throw new Error("following wave: changed observed motion");
    const firstFollowing = following[0]!;
    const followingTick = firstFollowing.tick - (82 - firstFollowing.object.x) / 2;
    if (!Number.isSafeInteger(followingTick)) throw new Error("following wave: nonintegral entry");
    entries.push({ tick: followingTick, x: 82, y: firstFollowing.object.y, animationOffset: 1 });
    const held = golden("game/space-impact/keys-hold-0.timeline");
    const followingSecond = [
      { image: "ba", tick: 69, x: 72, picture: "enemy/round-wide/1" },
      { image: "bb", tick: 70, x: 70, picture: "enemy/round-wide/0" },
    ].map(({ image, tick, x, picture }) => {
      const pixels = findGoldenImage(held, image).pixels;
      const art = SPACE_IMPACT_DATA.sprites[picture]!;
      if (
        !art.every((line, y) =>
          line
            .split("")
            .every((pixel, dx) => pixels[(17 + y) * 84 + x + dx] === (pixel === "#" ? 0 : 1)),
        )
      )
        throw new Error(`following wave: changed exact second-entry specimen ${image}`);
      return { tick, object: { picture, x, y: 17, width: 11, height: 5 } };
    });
    const secondMotion = fitSpaceImpactLinearPath(followingSecond);
    if (secondMotion.dx !== -2 || secondMotion.dy !== 0)
      throw new Error("following wave: changed second entry motion");
    const secondFirst = followingSecond[0]!;
    entries.push({
      tick: secondFirst.tick - (82 - secondFirst.object.x) / 2,
      x: 82,
      y: secondFirst.object.y,
      animationOffset: 1,
    });
    const complete = extractSpaceImpactLevelObservations(golden("game/space-impact/level-0"));
    const later = [
      {
        tick: 90,
        x: 83,
        y: 17,
        dx: -1,
        animationOffset: 0,
        specimens: [
          ["du", 95, 78],
          ["dv", 96, 77],
        ],
      },
      {
        tick: 108,
        x: 83,
        y: 17,
        dx: -1,
        animationOffset: 0,
        specimens: [
          ["es", 113, 78],
          ["et", 114, 77],
        ],
      },
      {
        tick: 125,
        x: 82,
        y: 29,
        dx: -2,
        animationOffset: 1,
        specimens: [
          ["fk", 127, 78],
          ["fm", 128, 76],
        ],
      },
      {
        tick: 134,
        x: 82,
        y: 29,
        dx: -2,
        animationOffset: 1,
        specimens: [
          ["fx", 136, 78],
          ["fz", 138, 74],
        ],
      },
      {
        tick: 143,
        x: 82,
        y: 29,
        dx: -2,
        animationOffset: 1,
        specimens: [
          ["gj", 145, 78],
          ["gl", 147, 74],
        ],
      },
      {
        tick: 144,
        x: 82,
        y: 9,
        dx: -2,
        animationOffset: 0,
        specimens: [
          ["gk", 146, 78],
          ["gl", 147, 76],
        ],
      },
      {
        tick: 158,
        x: 82,
        y: 9,
        dx: -2,
        animationOffset: 0,
        specimens: [
          ["hb", 160, 78],
          ["hd", 161, 76],
        ],
      },
    ] as const;
    for (const entry of later) {
      for (const [image, tick, x] of entry.specimens) {
        const frame = complete.frames.find((frame) => frame.image === image);
        const picture = `enemy/round-wide/${(tick + entry.animationOffset) % 2 === 0 ? 1 : 0}`;
        if (
          x !== entry.x + entry.dx * (tick - entry.tick) ||
          frame?.kind !== "decoded" ||
          !frame.candidates.every((candidate) =>
            candidate.objects.some((index) => {
              const object = complete.objects[index]!;
              return object.picture === picture && object.x === x && object.y === entry.y;
            }),
          )
        )
          throw new Error(`level-0 wave: changed specimen ${image}`);
      }
    }
    const bonuses = [
      {
        tick: 149,
        animationOffset: 0,
        x: 82,
        y: 9,
        dx: -2,
        specimens: [
          ["gp", 150, 80],
          ["gr", 152, 76],
        ],
      },
      {
        // The first pickup consumes one callback without advancing the world.
        tick: 608,
        animationOffset: 1,
        x: 83,
        y: 24,
        dx: -1,
        specimens: [
          ["acl", 615, 76],
          ["acn", 616, 75],
        ],
      },
    ] as const;
    for (const entry of bonuses) {
      for (const [image, tick, x] of entry.specimens) {
        const frame = complete.frames.find((frame) => frame.image === image);
        if (
          x !== entry.x + entry.dx * (tick - entry.tick) ||
          frame?.kind !== "decoded" ||
          !frame.candidates.every((candidate) =>
            candidate.objects.some((index) => {
              const object = complete.objects[index]!;
              return (
                object.picture === `bonus/orb/${(tick + entry.animationOffset) % 2}` &&
                object.x === x &&
                object.y === entry.y
              );
            }),
          )
        )
          throw new Error(`level-0 bonus: changed specimen ${image}`);
      }
    }
    return resourceModule(
      "SPACE_IMPACT_OPENING_WAVE",
      "{ readonly family: string; readonly bonuses: readonly { readonly animationOffset: number; readonly tick: number; readonly x: number; readonly y: number; readonly dx: number }[]; readonly entries: readonly { readonly tick: number; readonly x: number; readonly y: number; readonly animationOffset: number; readonly dx: number }[] }",
      {
        family: "enemy/round-wide",
        bonuses: bonuses.map(({ specimens: _specimens, ...entry }) => entry),
        entries: [
          ...entries.map((entry) => ({ ...entry, dx: -2 })),
          ...later.map(({ specimens: _specimens, ...entry }) => entry),
        ],
      },
    );
  },
};
