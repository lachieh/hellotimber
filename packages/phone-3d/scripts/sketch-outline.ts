/**
 * Traces the phone's front view out of the GLB into `src/sketch/outline.generated.ts`: one SVG
 * path per model node, in the stage units `Nokia3310` renders in (height 10, centred, y up).
 * The flat sketch is therefore the 3D phone squashed to its front, which is how the stage's
 * entrance starts. Run after changing the model: `vp run @hellotimber/phone-3d#sketch-outline`.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { STAGE_HEIGHT } from "../src/frame.ts";
import { loadModel, rasterise } from "./model.ts";

const OUT = new URL("../src/sketch/outline.generated.ts", import.meta.url);

/** Raster cell, in stage units: about 1/700 of the phone's height. */
const CELL = STAGE_HEIGHT / 700;
/** Douglas–Peucker tolerance, in stage units. */
const TOLERANCE = CELL * 1.5;

/** Boundary loops of the occupied cells (cell-edge tracing; outer loops counter-clockwise). */
function contours(width: number, height: number, inside: (cell: number) => boolean) {
  const filled = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height && inside(y * width + x);
  // Directed boundary edges, keyed by their start vertex: filled cell on the left.
  const next = new Map<number, number[]>();
  const key = (x: number, y: number) => y * (width + 1) + x;
  const add = (x0: number, y0: number, x1: number, y1: number) => {
    const list = next.get(key(x0, y0)) ?? [];
    list.push(key(x1, y1));
    next.set(key(x0, y0), list);
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!filled(x, y)) continue;
      if (!filled(x, y - 1)) add(x, y, x + 1, y);
      if (!filled(x + 1, y)) add(x + 1, y, x + 1, y + 1);
      if (!filled(x, y + 1)) add(x + 1, y + 1, x, y + 1);
      if (!filled(x - 1, y)) add(x, y + 1, x, y);
    }
  }
  const loops: [number, number][][] = [];
  for (const start of next.keys()) {
    while ((next.get(start)?.length ?? 0) > 0) {
      const loop: [number, number][] = [];
      let at = start;
      do {
        loop.push([at % (width + 1), Math.floor(at / (width + 1))]);
        const list = next.get(at)!;
        const to = list.pop()!;
        at = to;
      } while (at !== start);
      loops.push(loop);
    }
  }
  return loops;
}

function simplify(points: [number, number][], tolerance: number): [number, number][] {
  if (points.length < 3) return points;
  const [a, b] = [points[0]!, points[points.length - 1]!];
  let worst = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i]!;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const length = Math.hypot(dx, dy);
    const d =
      length === 0
        ? Math.hypot(p[0] - a[0], p[1] - a[1])
        : Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / length;
    if (d > worst) {
      worst = d;
      index = i;
    }
  }
  if (worst <= tolerance) return [a, b];
  return [
    ...simplify(points.slice(0, index + 1), tolerance).slice(0, -1),
    ...simplify(points.slice(index), tolerance),
  ];
}

function signedArea(loop: [number, number][]): number {
  let sum = 0;
  for (let i = 0; i < loop.length; i++) {
    const [x0, y0] = loop[i]!;
    const [x1, y1] = loop[(i + 1) % loop.length]!;
    sum += x0 * y1 - x1 * y0;
  }
  return sum / 2;
}

/**
 * A closed loop as a smooth SVG path: quadratic curves through the midpoints of its edges, with
 * its corners as control points. y is up in stage units and down in SVG, so the path negates it.
 */
function smoothPath(loop: [number, number][]): string {
  const at = (i: number) => loop[(i + loop.length) % loop.length]!;
  const mid = (i: number) => {
    const [a, b] = [at(i), at(i + 1)];
    return `${round((a[0] + b[0]) / 2)} ${round(-(a[1] + b[1]) / 2)}`;
  };
  let d = `M${mid(-1)}`;
  for (let i = 0; i < loop.length; i++) d += `Q${round(at(i)[0])} ${round(-at(i)[1])} ${mid(i)}`;
  return `${d}Z`;
}

const round = (v: number) => Math.round(v * 200) / 200;

/** Loops smaller than this many cells are raster specks. */
const MIN_AREA = 6;

async function main() {
  const { parts, bounds } = await loadModel();
  const raster = rasterise(parts, bounds, CELL);
  const trace = (inside: (cell: number) => boolean, outerOnly: boolean) =>
    contours(raster.width, raster.height, inside)
      // Cell-edge loops run counter-clockwise around filled cells (holes clockwise).
      .filter(
        (loop) => Math.abs(signedArea(loop)) >= MIN_AREA && (!outerOnly || signedArea(loop) > 0),
      )
      .map((loop) => {
        const world = loop.map(([x, y]) => [raster.toX(x), raster.toY(y)] as [number, number]);
        // Close the loop for simplification, then drop the duplicate end.
        return simplify([...world, world[0]!], TOLERANCE).slice(0, -1);
      })
      .filter((loop) => loop.length >= 3)
      .map(smoothPath)
      .join("");

  /** A part's visible cells' centroid, in SVG coordinates. */
  const centroid = (id: number): [number, number] => {
    let [sx, sy, n] = [0, 0, 0];
    raster.owner.forEach((owner, cell) => {
      if (owner !== id) return;
      sx += (cell % raster.width) + 0.5;
      sy += Math.floor(cell / raster.width) + 0.5;
      n++;
    });
    return [round(raster.toX(sx / n)), round(-raster.toY(sy / n))];
  };

  // The body is whatever the silhouette shows between the other parts: it needs no region.
  const regions = Object.fromEntries(
    parts.flatMap((part, id) => {
      if (part.name === "body") return [];
      const d = trace((cell) => raster.owner[cell] === id, false);
      return d === "" ? [] : [[part.name, { d, center: centroid(id) }]];
    }),
  );
  const silhouette = trace((cell) => raster.owner[cell]! >= 0, true);

  const body = `// Generated by scripts/sketch-outline.ts from public/models/nokia3310-v3.glb. Do not edit.

/** The phone's front-view outline, in stage units (SVG y down: y = -stage y). */
export const SILHOUETTE = ${JSON.stringify(silhouette)};

/**
 * The region of each model node visible from the front (the body is the silhouette around them),
 * with the centroid of what shows. Regions do not overlap.
 */
export const REGIONS: Readonly<Record<string, { d: string; center: readonly [number, number] }>> =
  ${JSON.stringify(regions)};

/** The model's front-view bounds in stage units (SVG y down). */
export const BOUNDS = ${JSON.stringify({
    x: round(bounds.minX),
    y: round(-bounds.maxY),
    width: round(bounds.maxX - bounds.minX),
    height: round(bounds.maxY - bounds.minY),
  })} as const;
`;
  writeFileSync(OUT, body);
  console.log(
    `wrote ${fileURLToPath(OUT)}:`,
    `${Object.keys(regions).length} regions, ${body.length} chars`,
  );
}

await main();
