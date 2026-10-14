import type { PlanCaptureSet } from "./capture-set.ts";
import { findGoldenImage, type Golden } from "./golden-format.ts";
import type { GoldenIndexEntry } from "./golden-index.ts";
import { FONT_HEIGHTS, type GlyphOverride, type TextRun } from "./harvest-glyphs.ts";

export type TextRuns = Readonly<Record<string, Readonly<Record<string, readonly TextRun[]>>>>;
export interface SpriteCrop {
  readonly id: string;
  readonly group: string;
  readonly golden: string;
  readonly image: string;
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
}
export type ProbeTimeline = {
  readonly golden: string;
  readonly kind: string;
  readonly fromFrame?: number;
} & (
  | { readonly node: string; readonly name?: never }
  | { readonly name: string; readonly node?: never }
);
export interface OrderedBatch<T> {
  readonly order: number;
  readonly entries: readonly T[];
}
export interface ResourceDeclarations {
  readonly textRuns?: TextRuns;
  readonly glyphOverrides?: readonly GlyphOverride[];
  readonly spriteBatches?: readonly OrderedBatch<SpriteCrop>[];
  readonly timelineBatches?: readonly OrderedBatch<ProbeTimeline>[];
  readonly timelineGroups?: Readonly<Record<string, readonly string[]>>;
}
export interface ResourceInputs {
  readonly textRuns: TextRuns;
  readonly glyphOverrides: readonly GlyphOverride[];
  readonly sprites: readonly SpriteCrop[];
  readonly probes: readonly ProbeTimeline[];
  readonly timelineGroups: Readonly<Record<string, readonly string[]>>;
}

export function composeResourceDeclarations(
  sets: readonly PlanCaptureSet[],
  index: readonly GoldenIndexEntry[],
  load: (id: string) => Golden,
): ResourceInputs {
  const owners = new Map<string, string>();
  const claim = (kind: string, key: string, plan: string): void => {
    const identity = `${kind}:${key}`;
    const previous = owners.get(identity);
    if (previous !== undefined)
      throw new Error(`${kind} "${key}" owned by plans ${previous} and ${plan}`);
    owners.set(identity, plan);
  };
  const goldens = new Map<string, Golden>();
  const golden = (id: string, plan: string): Golden => {
    const entry = index.find((entry) => entry.id === id);
    if (!entry || (entry.kind !== "still" && entry.kind !== "timeline")) {
      throw new Error(`plan ${plan}: ${id} is not an indexed LCD fixture`);
    }
    let result = goldens.get(id);
    if (!result) {
      result = load(id);
      goldens.set(id, result);
    }
    return result;
  };
  const rectangle = (x0: number, x1: number, y0: number, y1: number, where: string): void => {
    if (
      ![x0, x1, y0, y1].every(Number.isInteger) ||
      x0 < 0 ||
      x1 > 83 ||
      y0 < 0 ||
      y1 > 47 ||
      x0 > x1 ||
      y0 > y1
    ) {
      throw new Error(`${where}: invalid LCD rectangle`);
    }
  };
  const textRuns: Record<string, Record<string, TextRun[]>> = {};
  const glyphOverrides: GlyphOverride[] = [];
  const spriteBatches: OrderedBatch<SpriteCrop>[] = [];
  const timelineBatches: OrderedBatch<ProbeTimeline>[] = [];
  const timelineGroups: Record<string, readonly string[]> = {};
  const probeOwners = new Map<ProbeTimeline, string>();
  for (const set of sets) {
    claim("plan", set.plan, set.plan);
    const resources = set.resources;
    if (!resources) continue;
    for (const [id, images] of Object.entries(resources.textRuns ?? {})) {
      const fixture = golden(id, set.plan);
      for (const [image, runs] of Object.entries(images)) {
        findGoldenImage(fixture, image);
        for (const run of runs) {
          const left = run.left ?? 0;
          const right = run.right ?? 83;
          rectangle(
            left,
            right,
            run.top,
            run.top + FONT_HEIGHTS[run.font] - 1,
            `plan ${set.plan}: ${id} ${image} text band`,
          );
          claim("text run", `${id}/${image}/${run.font}/${run.top}/${left}/${right}`, set.plan);
          textRuns[id] ??= {};
          textRuns[id]![image] ??= [];
          textRuns[id]![image]!.push(run);
        }
      }
    }
    for (const override of resources.glyphOverrides ?? []) {
      const char = override.kind === "touch" ? override.pair : override.char;
      claim("glyph override", `${override.kind}/${override.font}/${char}`, set.plan);
      glyphOverrides.push(override);
    }
    for (const [kind, groups] of Object.entries(resources.timelineGroups ?? {})) {
      claim("timeline kind", kind, set.plan);
      timelineGroups[kind] = groups;
    }
    for (const batch of resources.spriteBatches ?? []) {
      if (!Number.isSafeInteger(batch.order))
        throw new Error(`plan ${set.plan}: invalid sprite batch order`);
      claim("sprite batch", String(batch.order), set.plan);
      for (const sprite of batch.entries) {
        claim("sprite", sprite.id, set.plan);
        rectangle(sprite.x0, sprite.x1, sprite.y0, sprite.y1, `plan ${set.plan}: ${sprite.id}`);
        const { pixels } = findGoldenImage(golden(sprite.golden, set.plan), sprite.image);
        let ink = false;
        for (let y = sprite.y0; y <= sprite.y1; y++)
          for (let x = sprite.x0; x <= sprite.x1; x++) ink ||= pixels[y * 84 + x] === 1;
        if (!ink) throw new Error(`plan ${set.plan}: sprite ${sprite.id} has no ink`);
      }
      spriteBatches.push(batch);
    }
    for (const batch of resources.timelineBatches ?? []) {
      if (!Number.isSafeInteger(batch.order))
        throw new Error(`plan ${set.plan}: invalid timeline batch order`);
      claim("timeline batch", String(batch.order), set.plan);
      for (const probe of batch.entries) {
        if ((probe.node === undefined) === (probe.name === undefined))
          throw new Error(`plan ${set.plan}: ${probe.golden} needs exactly one timeline target`);
        claim(
          "timeline target",
          probe.node === undefined ? `name/${probe.name}` : `node/${probe.node}`,
          set.plan,
        );
        const fixture = golden(probe.golden, set.plan);
        if (!fixture.timeline || typeof fixture.triggerFrame !== "number")
          throw new Error(`plan ${set.plan}: ${probe.golden} is not a triggered timeline`);
        if (
          probe.fromFrame !== undefined &&
          (!Number.isInteger(probe.fromFrame) ||
            probe.fromFrame < 0 ||
            probe.fromFrame >= fixture.timeline.length)
        )
          throw new Error(`plan ${set.plan}: ${probe.golden} invalid fromFrame`);
        probeOwners.set(probe, set.plan);
      }
      timelineBatches.push(batch);
    }
  }
  const sprites = spriteBatches.sort((a, b) => a.order - b.order).flatMap((batch) => batch.entries);
  const probes = timelineBatches
    .sort((a, b) => a.order - b.order)
    .flatMap((batch) => batch.entries);
  const groups = new Set(sprites.map((sprite) => sprite.group));
  for (const [kind, names] of Object.entries(timelineGroups))
    for (const group of names) {
      if (!groups.has(group))
        throw new Error(`timeline kind ${kind}: missing sprite group ${group}`);
    }
  for (const probe of probes)
    if (!Object.hasOwn(timelineGroups, probe.kind))
      throw new Error(`plan ${probeOwners.get(probe)}: unknown timeline kind ${probe.kind}`);
  return { textRuns, glyphOverrides, sprites, probes, timelineGroups };
}
