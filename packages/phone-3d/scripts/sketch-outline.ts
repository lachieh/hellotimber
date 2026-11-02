/**
 * Traces the phone's front view out of the GLB into `src/sketch/outline.generated.ts`: one SVG
 * path per model node, in the stage units `Nokia3310` renders in (height 10, centred, y up).
 * The flat sketch is therefore the 3D phone squashed to its front, which is how the stage's
 * entrance starts. Run after changing the model: `vp run @hellotimber/phone-3d#sketch-outline`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { STAGE_HEIGHT } from "../src/frame.ts";

const root = new URL("../", import.meta.url);
const MODEL = new URL("public/models/nokia3310-v3.glb", root);
const DRACO = new URL("public/draco/draco_decoder.js", root);
const OUT = new URL("src/sketch/outline.generated.ts", root);

/** Raster cell, in stage units: about 1/700 of the phone's height. */
const CELL = STAGE_HEIGHT / 700;
/** Douglas–Peucker tolerance, in stage units. */
const TOLERANCE = CELL * 1.5;

type Vec3 = [number, number, number];

interface GltfNode {
  name: string;
  mesh?: number;
  translation?: Vec3;
  scale?: Vec3;
  rotation?: [number, number, number, number];
}

function readGlb(bytes: Buffer) {
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString("utf8")) as {
    nodes: GltfNode[];
    meshes: {
      primitives: {
        extensions: {
          KHR_draco_mesh_compression: { bufferView: number; attributes: { POSITION: number } };
        };
      }[];
    }[];
    bufferViews: { byteOffset?: number; byteLength: number }[];
  };
  const binStart = 20 + jsonLength + 8;
  return { json, bin: bytes.subarray(binStart) };
}

// oxlint-disable-next-line typescript/no-explicit-any -- the emscripten module is untyped
type Draco = any;

async function loadDraco(): Promise<Draco> {
  const module = { exports: {} as unknown };
  vm.runInNewContext(readFileSync(DRACO, "utf8"), {
    module,
    exports: module.exports,
    console,
    WebAssembly,
    require: () => ({}),
    __dirname: fileURLToPath(new URL(".", DRACO)),
    process,
    Buffer,
    URL,
  });
  const factory = module.exports as (options: object) => Promise<Draco>;
  return factory({ wasmBinary: readFileSync(new URL("draco_decoder.wasm", DRACO)) });
}

/** A decoded primitive: its positions and triangle indices. */
function decode(draco: Draco, data: Uint8Array, positionId: number) {
  const decoder = new draco.Decoder();
  const mesh = new draco.Mesh();
  const status = decoder.DecodeArrayToMesh(data, data.byteLength, mesh);
  if (!status.ok()) throw new Error(`draco: ${status.error_msg()}`);
  const attribute = decoder.GetAttributeByUniqueId(mesh, positionId);
  const values = new draco.DracoFloat32Array();
  decoder.GetAttributeFloatForAllPoints(mesh, attribute, values);
  const positions = Float32Array.from({ length: values.size() }, (_, i) => values.GetValue(i));
  const faces = new draco.DracoInt32Array();
  const indices: number[] = [];
  for (let f = 0; f < mesh.num_faces(); f++) {
    decoder.GetFaceFromMesh(mesh, f, faces);
    indices.push(faces.GetValue(0), faces.GetValue(1), faces.GetValue(2));
  }
  for (const object of [values, faces, mesh, decoder]) draco.destroy(object);
  return { positions, indices };
}

function transform(node: GltfNode, [x, y, z]: Vec3): Vec3 {
  if (node.rotation && node.rotation.some((v, i) => v !== (i === 3 ? 1 : 0)))
    throw new Error(`${node.name}: rotated nodes are not supported`);
  const [sx, sy, sz] = node.scale ?? [1, 1, 1];
  const [tx, ty, tz] = node.translation ?? [0, 0, 0];
  return [x * sx + tx, y * sy + ty, z * sz + tz];
}

interface Part {
  name: string;
  points: Vec3[];
  triangles: number[];
}

/** Transparent parts: the trace looks through them. */
const SEE_THROUGH = new Set(["screen_glass"]);

/** The front view as a z-buffer: per cell, the index of the nearest part (or -1). */
function rasterise(parts: Part[], bounds: Bounds) {
  const width = Math.ceil((bounds.maxX - bounds.minX) / CELL) + 3;
  const height = Math.ceil((bounds.maxY - bounds.minY) / CELL) + 3;
  const owner = new Int16Array(width * height).fill(-1);
  const depth = new Float32Array(width * height).fill(-Infinity);
  const gx = (x: number) => (x - bounds.minX) / CELL + 1;
  const gy = (y: number) => (y - bounds.minY) / CELL + 1;
  parts.forEach((part, id) => {
    if (SEE_THROUGH.has(part.name)) return;
    for (let t = 0; t < part.triangles.length; t += 3) {
      const [a, b, c] = [0, 1, 2].map((k) => part.points[part.triangles[t + k]!]!) as [
        Vec3,
        Vec3,
        Vec3,
      ];
      const ax = gx(a[0]);
      const ay = gy(a[1]);
      const bx = gx(b[0]);
      const by = gy(b[1]);
      const cx = gx(c[0]);
      const cy = gy(c[1]);
      const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      if (Math.abs(area) < 1e-9) continue;
      const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
      const x1 = Math.min(width - 1, Math.ceil(Math.max(ax, bx, cx)));
      const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy)));
      const y1 = Math.min(height - 1, Math.ceil(Math.max(ay, by, cy)));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const px = x + 0.5;
          const py = y + 0.5;
          const w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) / area;
          const w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) / area;
          const w2 = 1 - w0 - w1;
          if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
          const z = w0 * a[2] + w1 * b[2] + w2 * c[2];
          const cell = y * width + x;
          if (z > depth[cell]!) {
            depth[cell] = z;
            owner[cell] = id;
          }
        }
      }
    }
  });
  return {
    owner,
    width,
    height,
    toX: (x: number) => bounds.minX + (x - 1) * CELL,
    toY: (y: number) => bounds.minY + (y - 1) * CELL,
  };
}

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

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

const round = (v: number) => Math.round(v * 200) / 200;

/** Loops smaller than this many cells are raster specks. */
const MIN_AREA = 6;

async function main() {
  const { json, bin } = readGlb(readFileSync(MODEL));
  const draco = await loadDraco();

  const parts: Part[] = [];
  for (const node of json.nodes) {
    if (node.mesh === undefined) continue;
    const part: Part = { name: node.name, points: [], triangles: [] };
    for (const primitive of json.meshes[node.mesh]!.primitives) {
      const ext = primitive.extensions.KHR_draco_mesh_compression;
      const view = json.bufferViews[ext.bufferView]!;
      const offset = view.byteOffset ?? 0;
      const data = new Uint8Array(bin.subarray(offset, offset + view.byteLength));
      const { positions, indices } = decode(draco, data, ext.attributes.POSITION);
      const base = part.points.length;
      for (let i = 0; i < positions.length; i += 3)
        part.points.push(transform(node, [positions[i]!, positions[i + 1]!, positions[i + 2]!]));
      for (const index of indices) part.triangles.push(base + index);
    }
    parts.push(part);
  }

  // Nokia3310.tsx: scale STAGE_HEIGHT / size.y about the bounding box's centre.
  const all = parts.flatMap((p) => p.points);
  const min = [0, 1, 2].map((k) => Math.min(...all.map((p) => p[k]!)));
  const max = [0, 1, 2].map((k) => Math.max(...all.map((p) => p[k]!)));
  const center = min.map((v, k) => (v + max[k]!) / 2);
  const scale = STAGE_HEIGHT / (max[1]! - min[1]!);
  for (const part of parts)
    part.points = part.points.map((p) => p.map((v, k) => (v - center[k]!) * scale) as Vec3);

  const bounds: Bounds = {
    minX: (min[0]! - center[0]!) * scale,
    maxX: (max[0]! - center[0]!) * scale,
    minY: (min[1]! - center[1]!) * scale,
    maxY: (max[1]! - center[1]!) * scale,
  };

  const raster = rasterise(parts, bounds);
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
