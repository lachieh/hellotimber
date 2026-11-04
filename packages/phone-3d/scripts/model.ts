/** The phone's GLB, decoded for the build scripts: its parts in stage units and a front view. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { STAGE_HEIGHT } from "../src/frame.ts";

const root = new URL("../", import.meta.url);
const MODEL = new URL("public/models/nokia3310-v3.glb", root);
const DRACO = new URL("public/draco/draco_decoder.js", root);

export type Vec3 = [number, number, number];

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

export interface Part {
  name: string;
  points: Vec3[];
  triangles: number[];
}

/** Transparent parts: the trace looks through them. */
const SEE_THROUGH = new Set(["screen_glass"]);

/** The front view as a z-buffer: per cell, the index of the nearest part (or -1). */
export function rasterise(parts: Part[], bounds: Bounds, cell: number) {
  const width = Math.ceil((bounds.maxX - bounds.minX) / cell) + 3;
  const height = Math.ceil((bounds.maxY - bounds.minY) / cell) + 3;
  const owner = new Int16Array(width * height).fill(-1);
  const depth = new Float32Array(width * height).fill(-Infinity);
  const gx = (x: number) => (x - bounds.minX) / cell + 1;
  const gy = (y: number) => (y - bounds.minY) / cell + 1;
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
    depth,
    width,
    height,
    toX: (x: number) => bounds.minX + (x - 1) * cell,
    toY: (y: number) => bounds.minY + (y - 1) * cell,
  };
}

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** The model's parts in stage units (Nokia3310.tsx: height STAGE_HEIGHT, centred), with the
 *  front view's bounds, and the centre and scale that map the GLB's own units onto them. */
export async function loadModel() {
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
  // Loops, not Math.min(...points): the model has too many points to spread onto the stack.
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const part of parts)
    for (const point of part.points)
      for (const k of [0, 1, 2]) {
        min[k] = Math.min(min[k]!, point[k]!);
        max[k] = Math.max(max[k]!, point[k]!);
      }
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
  return { parts, bounds, center, scale };
}
