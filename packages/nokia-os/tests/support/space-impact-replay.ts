import { loadGolden } from "./goldens";
import { Framebuffer } from "@hellotimber/phone-screen";
import { expectTimeline, samePixels, type RecordedFrame } from "./golden";
import { SPACE_IMPACT_DATA } from "../../src/kit/ui/resources/generated/space-impact";
import recovery from "../fixtures/space-impact-seed-recovery.json";
import type { Golden } from "../../scripts/golden-format";
import {
  observedSpaceImpactInput,
  type SpaceImpactDeliveredEvent,
} from "../../scripts/space-impact-delivery";
import {
  expireSpaceImpactShield,
  newSpaceImpactGame,
  spaceImpactKey,
  spaceImpactRender,
  stepSpaceImpact,
} from "../../src/kit/apps/games/space-impact/engine";
import type {
  SpaceImpactResult,
  SpaceImpactState,
} from "../../src/kit/apps/games/space-impact/model";
import { paintSpaceImpact } from "../../src/kit/ui/display/widgets/space-impact";

export function deliverSpaceImpactResult(
  state: SpaceImpactState,
  event: SpaceImpactDeliveredEvent,
): SpaceImpactResult {
  switch (event.kind) {
    case "step":
      return stepSpaceImpact(state);
    case "shield":
      return expireSpaceImpactShield(state);
    case "up":
      return spaceImpactKey(state, state.held?.key ?? "1", "up");
    case "down":
    case "repeat":
      return spaceImpactKey(state, event.key, event.kind);
  }
}

export function deliverSpaceImpactEvent(
  state: SpaceImpactState,
  event: SpaceImpactDeliveredEvent,
): SpaceImpactState {
  return deliverSpaceImpactResult(state, event).state;
}

/** Diagnostic prefix accounting; full acceptance must also check every settled output and its timing. */
export function replaySpaceImpactLevel(golden: Golden) {
  const rows = golden.timeline!.filter(
    (row) => row.frame >= Number(golden.triggerFrame) && row.durationMs >= 34,
  );
  const images = new Map(golden.images.map((image) => [image.name, image.pixels]));
  // Accepted UNVERIFIED counted-order seed, derived from this informative LCD trace.
  let state = newSpaceImpactGame({ seed: recovery.countedOrder.effectiveSeeds[0] });
  let matched = 0;
  const compare = () => {
    const fb = new Framebuffer();
    paintSpaceImpact(fb, { kind: "space-impact", board: spaceImpactRender(state) });
    const row = rows[matched];
    if (row && fb.pixels.every((pixel, i) => pixel === images.get(row.image)![i])) matched++;
  };
  compare();
  const events = observedSpaceImpactInput(golden.note);
  for (const event of events) {
    state = deliverSpaceImpactEvent(state, event);
    compare();
  }
  return {
    matched,
    total: rows.length,
    next: rows[matched],
    last: rows[matched - 1],
    events: events.length,
    state,
  };
}

/** Every settled engine output, with the first tick at the session's captured offset. */
export function expectSpaceImpactLevel(golden: Golden): void {
  const timeline = golden.timeline;
  if (!timeline || typeof golden.triggerFrame !== "number")
    throw new Error(`${golden.id}: expected a triggered gameplay timeline`);
  const events = observedSpaceImpactInput(golden.note);
  const firstStep = events.find((event) => event.kind === "step");
  if (!firstStep) throw new Error(`${golden.id}: missing first game tick`);
  const triggerMs = firstStep.atMs - SPACE_IMPACT_DATA.timings.firstTickMs;
  const last = timeline.at(-1)!;
  const endMs = last.startMs + last.durationMs;
  let state = newSpaceImpactGame({ seed: recovery.countedOrder.effectiveSeeds[0] });
  const frames: RecordedFrame[] = [];
  const draw = (startMs: number) => {
    const fb = new Framebuffer();
    paintSpaceImpact(fb, { kind: "space-impact", board: spaceImpactRender(state) });
    if (!frames.length || !samePixels(frames.at(-1)!.pixels, fb.pixels))
      frames.push({ startMs, pixels: fb.pixels.slice() });
  };
  draw(triggerMs);
  for (const event of events) {
    state = deliverSpaceImpactEvent(state, event);
    if (event.kind !== "shield" && event.kind !== "up") draw(event.atMs);
  }
  expectTimeline({ triggerMs, endMs, frames }, golden, golden.id);
}

export function expectSpaceImpactExit(golden: Golden): void {
  const timeline = golden.timeline;
  if (!timeline || typeof golden.triggerFrame !== "number")
    throw new Error(`${golden.id}: expected a triggered exit timeline`);
  const level = loadGolden("game/space-impact/level-0");
  let state = newSpaceImpactGame({ seed: recovery.countedOrder.effectiveSeeds[0] });
  for (const event of observedSpaceImpactInput(level.note))
    state = deliverSpaceImpactEvent(state, event);
  const period = SPACE_IMPACT_DATA.timings.levelExitStepMs;
  const last = timeline.at(-1)!;
  const endMs = period + last.startMs + last.durationMs - timeline[golden.triggerFrame]!.startMs;
  const frames: RecordedFrame[] = [];
  for (let startMs = 0; startMs <= endMs; startMs += period) {
    const fb = new Framebuffer();
    paintSpaceImpact(fb, { kind: "space-impact", board: spaceImpactRender(state) });
    if (!frames.length || !samePixels(frames.at(-1)!.pixels, fb.pixels))
      frames.push({ startMs, pixels: fb.pixels.slice() });
    state = stepSpaceImpact(state).state;
  }
  expectTimeline({ triggerMs: period, endMs, frames }, golden, golden.id);
}
