// A stock flow application driven on a virtual 1 ms clock without the kernel: widget tests
// compare its frames with the widget part of a timeline golden (plan 14 Tasks 9-11). The
// kernel-level scenarios (what the menu shows after the flow exits) are Task 13's.
import type {
  ApplicationContext,
  MenuIndicator,
  PhoneApplicationSession,
  PhoneKey,
} from "@hellotimber/phone-core";
import { expect } from "vite-plus/test";
import type { Golden } from "../../scripts/golden-format.ts";
import { findGoldenImage } from "../../scripts/golden-format.ts";
import { StockFlowApplication, type Widget } from "../../src/widgets/flow";
import { lcdMismatch, sameTime, timelineTolerance } from "./golden.ts";

export type ExitOptions = Parameters<ApplicationContext["exit"]>[0];

export interface FlowRig {
  readonly session: PhoneApplicationSession;
  /** Exits requested so far, with the virtual time of each. */
  readonly exits: { readonly atMs: number; readonly options: ExitOptions }[];
  readonly now: number;
  press(key: PhoneKey): void;
  /** Ticks every 1 ms for `ms` (stops ticking once the flow has exited). */
  advance(ms: number): void;
  /** The pixels of the flow's current frame. */
  frame(): Uint8Array;
}

/** Starts `root` as a stock flow at time 0, positioned where `indicator` says. */
export function flowRig(
  root: () => Widget,
  indicator: MenuIndicator = { segments: [], awaitingNext: false },
): FlowRig {
  let now = 0;
  const exits: { atMs: number; options: ExitOptions }[] = [];
  const context: ApplicationContext = {
    exit: (options) => void exits.push({ atMs: now, options }),
    open: () => {
      throw new Error("stock flows do not open applications");
    },
    menuIndicator: () => indicator,
  };
  const session = new StockFlowApplication("stock:test", root).createSession(context);
  const rig: FlowRig = {
    session,
    exits,
    get now() {
      return now;
    },
    press(key) {
      session.onKey({ type: "down", key });
      session.onKey({ type: "up", key });
    },
    advance(ms) {
      for (let i = 0; i < ms && exits.length === 0; i++) {
        now++;
        session.tick(1);
      }
    },
    frame() {
      const screen = session.render();
      if (screen.kind !== "custom") throw new Error(`Expected a custom frame, got ${screen.kind}.`);
      return screen.frame.pixels;
    },
  };
  return rig;
}

export interface FlowRecording {
  readonly frames: readonly { readonly startMs: number; readonly pixels: Uint8Array }[];
  /** When the flow exited, if it did. */
  readonly exitMs?: number;
}

/**
 * Records the flow's distinct frames from now (the trigger) for `durationMs`, rendering after
 * every 1 ms tick, until it exits.
 */
export function recordFlow(rig: FlowRig, durationMs: number): FlowRecording {
  const start = rig.now;
  // The trigger itself may have closed the flow (a `Back` page): nothing of it is shown.
  if (rig.exits.length > 0) return { frames: [], exitMs: rig.exits[0]!.atMs - start };
  const frames = [{ startMs: 0, pixels: rig.frame() }];
  for (let t = 0; t < durationMs && rig.exits.length === 0; t++) {
    rig.advance(1);
    if (rig.exits.length > 0) break;
    const pixels = rig.frame();
    const last = frames[frames.length - 1]!;
    if (!samePixels(last.pixels, pixels)) frames.push({ startMs: rig.now - start, pixels });
  }
  const exit = rig.exits[0];
  return { frames, ...(exit === undefined ? {} : { exitMs: exit.atMs - start }) };
}

function samePixels(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

/**
 * Compares a flow recording started at the golden's trigger with the golden's widget rows:
 * from `trigger-frame` up to, but not including, the last row when `returns` (the screen the
 * flow returns to, which the kernel draws), else every row from the trigger. Pixels must match;
 * starts follow the fidelity standard (aligned on the trigger); with `returns` the flow must exit
 * when the last row starts.
 */
export function expectFlowTimeline(
  recording: FlowRecording,
  golden: Golden,
  options: { returns: boolean },
): void {
  const rows = golden.timeline;
  const trigger = golden.triggerFrame;
  if (rows === undefined || typeof trigger !== "number") {
    throw new Error(`${golden.id} is not a timeline golden with a numeric trigger-frame.`);
  }
  const origin = rows[trigger]!.startMs;
  const widgetRows = rows.slice(trigger, options.returns ? rows.length - 1 : rows.length);
  const tolerance = timelineTolerance(rows.slice(trigger).map((row) => row.startMs - origin));
  widgetRows.forEach((row, i) => {
    const frame = recording.frames[i];
    const context = `${golden.id} row ${trigger + i} (image ${row.image})`;
    expect(frame, `${context}: never shown`).toBeDefined();
    const mismatch = lcdMismatch(
      frame!.pixels,
      { id: golden.id, image: findGoldenImage(golden, row.image) },
      context,
    );
    if (mismatch !== undefined) throw new Error(mismatch);
    const expected = row.startMs - origin;
    expect(
      sameTime(frame!.startMs, expected, tolerance(expected)),
      `${context}: starts at ${frame!.startMs} ms, golden ${expected} ms`,
    ).toBe(true);
  });
  if (!options.returns) return;
  const last = rows[rows.length - 1]!;
  expect(recording.frames.length, `${golden.id}: extra frames before the return`).toBe(
    widgetRows.length,
  );
  expect(recording.exitMs, `${golden.id}: the flow never exited`).toBeDefined();
  expect(
    sameTime(recording.exitMs!, last.startMs - origin, tolerance(last.startMs - origin)),
    `${golden.id}: exits at ${recording.exitMs} ms, golden returns at ${last.startMs - origin} ms`,
  ).toBe(true);
}
