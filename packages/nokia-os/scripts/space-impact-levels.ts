import type { SpaceImpactObservation } from "../tests/support/space-impact-decode.ts";

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
