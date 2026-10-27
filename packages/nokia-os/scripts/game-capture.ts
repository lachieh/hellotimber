// The game-golden machinery every game shares (plan 23 "Capture set", generalised by plan 24
// Task 3): recordings played back to back, engine ticks numbered from the frames a game draws,
// `keys.csv` turned into `input`, tick stills selected and the period fixture's rows. Each game
// supplies its frame predicate, period, silent-tick rule and still selection
// (`game-capture-set.ts` for Snake II, `space-impact-capture-set.ts` for Space impact).
//
// Reads captures only through the injected `GameCaptureIo`, so tests run it on synthetic
// recordings. Paths are relative to `$REF/captures/6.39`. Pure: imports only sibling scripts.
import type { CaptureSetEntry, CaptureSource, FrameRange } from "./capture-set.ts";
import {
  INPUT_KEYS,
  LCD_WIDTH,
  type GoldenKeyPress,
  type GoldenStatus,
  type TickRow,
} from "./golden-format.ts";

// ---------------------------------------------------------------- io

/** One distinct LCD state of a `record` directory. */
export interface GameRecordingFrame {
  /** LCD_WIDTH × LCD_HEIGHT, row-major, 1 = lit. */
  readonly pixels: Uint8Array;
  readonly startMs: number;
  readonly durationMs: number;
}

/** One row of a recording's `keys.csv` (Task 0): `tick` as the capture script labelled it. */
export interface GameKeyRow {
  readonly tick: number;
  readonly key: string;
  readonly pressMs: number;
  /** Plan 24's `keys.csv` also logs the release (plan 23's taps have none). */
  readonly releaseMs?: number;
}

export interface GameCaptureIo {
  /** The frames of `<dir>/timings.csv`, or undefined when the recording is missing. */
  recording(dir: string): readonly GameRecordingFrame[] | undefined;
  /** The rows of `<dir>/keys.csv`, or undefined when there is none. */
  keys(dir: string): readonly GameKeyRow[] | undefined;
}

export class GameCaptureError extends Error {
  constructor(where: string, message: string) {
    super(`${where}: ${message}`);
    this.name = "GameCaptureError";
  }
}

// ---------------------------------------------------------------- pixels

export function lit(pixels: Uint8Array, x: number, y: number): boolean {
  return pixels[y * LCD_WIDTH + x] === 1;
}

/** The pixels of a rectangle (inclusive) as a 0/1 string. */
export function region(pixels: Uint8Array, x0: number, x1: number, y0: number, y1: number): string {
  let out = "";
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out += lit(pixels, x, y) ? 1 : 0;
  return out;
}

export function samePixels(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// ---------------------------------------------------------------- ticks

/** A frame of one or more recordings played back to back, on one clock. */
export interface PlayedFrame extends GameRecordingFrame {
  /** Recording directory and frame index within it. */
  readonly dir: string;
  readonly frame: number;
}

/**
 * One engine tick: its first frame (when the redraw started) and its last frame (the finished
 * picture, before the next tick). A tick that draws nothing (Snake II's blocked tick, Space
 * impact's step eaten by a pending sound) is `virtual`, inferred from the gap, with no frames.
 */
export interface Tick {
  readonly tick: number;
  readonly startMs: number;
  readonly first?: PlayedFrame;
  readonly last?: PlayedFrame;
  readonly virtual: boolean;
}

/**
 * Concatenates recordings that were made back to back (the next `record` starts when the
 * previous one stops): each one's clock starts where the previous one's last frame ended.
 */
export function playBackToBack(
  parts: readonly { dir: string; frames: readonly GameRecordingFrame[] }[],
): { frames: PlayedFrame[]; offsets: Map<string, number> } {
  const frames: PlayedFrame[] = [];
  const offsets = new Map<string, number>();
  let offset = 0;
  for (const part of parts) {
    offsets.set(part.dir, offset);
    part.frames.forEach((frame, i) => {
      frames.push({ ...frame, startMs: frame.startMs + offset, dir: part.dir, frame: i });
    });
    const last = part.frames.at(-1);
    if (last) offset += last.startMs + last.durationMs;
  }
  return { frames, offsets };
}

/** How a game draws its ticks. */
export interface TickRule {
  /** Whether a frame shows the game (menus, notes and other screens are not numbered). */
  readonly isGameFrame: (pixels: Uint8Array) => boolean;
  /** The engine period: frames closer than half of it finish the tick they follow. */
  readonly periodMs: number;
  /**
   * How many ticks drew nothing in a gap of `gapMs` between the frames of tick `fromTick` and
   * the next frame. Default: none.
   */
  readonly silentTicks?: (gapMs: number, fromTick: number) => number;
  /**
   * Keys the game redraws for at once (Space impact's shots and specials): a frame up to
   * `latencyMs` after such a press, and less than `withinMs(tick)` after the first frame of
   * tick `tick`, finishes that tick instead of starting the next.
   */
  readonly keyRedraw?: {
    readonly keys: readonly string[];
    readonly latencyMs: number;
    readonly withinMs: (tick: number) => number;
  };
}

/**
 * Numbers engine ticks from frames: tick 0 is the first game frame. A later game frame whose
 * pixels differ from the current tick's last frame starts a new tick when it comes at least
 * half a period after that tick's first frame; closer, it finishes the same tick (a redraw in
 * two bursts). Silent ticks in between are numbered `virtual`, a period apart. Frames that are
 * not the game end nothing and are not numbered.
 */
export function numberTicks(
  frames: readonly PlayedFrame[],
  rule: TickRule,
  presses: readonly { readonly key: string; readonly pressMs: number }[] = [],
): Tick[] {
  const { isGameFrame, periodMs, silentTicks = () => 0, keyRedraw } = rule;
  const redraws = presses.filter((p) => keyRedraw?.keys.includes(p.key));
  const isRedraw = (startMs: number, tickMs: number, tick: number): boolean =>
    keyRedraw !== undefined &&
    startMs - tickMs < keyRedraw.withinMs(tick) &&
    redraws.some((p) => p.pressMs > tickMs && startMs - p.pressMs <= keyRedraw.latencyMs);
  const ticks: Tick[] = [];
  let current: { tick: number; startMs: number; first: PlayedFrame; last: PlayedFrame } | undefined;
  const close = (): void => {
    if (current) ticks.push({ ...current, virtual: false });
  };
  for (const frame of frames) {
    if (!isGameFrame(frame.pixels)) continue;
    if (current === undefined) {
      current = { tick: 0, startMs: frame.startMs, first: frame, last: frame };
      continue;
    }
    if (samePixels(frame.pixels, current.last.pixels)) continue;
    const gap = frame.startMs - current.startMs;
    if (gap < periodMs / 2 || isRedraw(frame.startMs, current.startMs, current.tick)) {
      current.last = frame;
      continue;
    }
    close();
    let tick = current.tick + 1;
    const silent = silentTicks(gap, current.tick);
    for (let i = 1; i <= silent; i++) {
      ticks.push({ tick, startMs: current.startMs + i * periodMs, virtual: true });
      tick += 1;
    }
    current = { tick, startMs: frame.startMs, first: frame, last: frame };
  }
  close();
  return ticks;
}

// ---------------------------------------------------------------- input

/** Key-to-game latency window (plan 23 Task 0: 30-45 ms; D6). */
export const KEY_LATENCY_MS = { min: 30, max: 45 } as const;
/**
 * A tick frame drawn within this long after the latency window may still precede the key's
 * processing (the tick event comes a few ms before its redraw ends).
 */
export const DRAW_SLACK_MS = 5;

/** Harness key names (`tools/harness`) → phone keys. */
const PHONE_KEY: Readonly<Record<string, string>> = { menu: "navi" };

/**
 * The engine tick an edge at `ms` belongs to: the last tick that started before the edge was
 * processed (ms + KEY_LATENCY_MS.min), or undefined before tick 0. A tick starting while the
 * edge may still be in flight (up to KEY_LATENCY_MS.max + DRAW_SLACK_MS after it) makes it
 * ambiguous, which throws, naming the recording.
 */
function tickOf(
  ticks: readonly Tick[],
  edge: KeyEdge,
  where: string,
  resolve?: AmbiguityResolver,
): number | undefined {
  const processed = edge.ms + KEY_LATENCY_MS.min;
  const before = ticks.filter((tick) => tick.startMs <= processed);
  const late = ticks.find(
    (tick) =>
      tick.startMs > processed && tick.startMs <= edge.ms + KEY_LATENCY_MS.max + DRAW_SLACK_MS,
  );
  if (before.length > 0 && late !== undefined) {
    const resolved = resolve?.(edge, before.at(-1)!, late);
    if (resolved !== undefined) return resolved;
    const what = edge.release ? `release of ${edge.key}` : `key ${edge.key}`;
    throw new GameCaptureError(
      where,
      `${what} at ${edge.ms} ms is ambiguous: tick ${late.tick} starts at ${late.startMs} ms, within its latency window`,
    );
  }
  return before.at(-1)?.tick;
}

/** A key going down (or, `release`, up) at `ms`, as the phone names it. */
export interface KeyEdge {
  readonly key: string;
  readonly ms: number;
  readonly release: boolean;
}

/**
 * Decides an edge whose latency window holds the start of tick `late`: the tick it belongs
 * to (`before.tick` when the game took it before `late`'s step, else `late.tick`), read from
 * the frames, or undefined when they cannot tell.
 */
export type AmbiguityResolver = (edge: KeyEdge, before: Tick, late: Tick) => number | undefined;

/**
 * The game's `input` from its keys: each press on the tick it belongs to (`tickOf`). A press
 * whose release belongs to a later tick is held: its release follows on that tick (plan 24);
 * otherwise it is a tap. Keys before tick 0 (the Select that starts the game) are not input.
 */
export function inputFromKeys(
  ticks: readonly Tick[],
  keys: readonly { key: string; pressMs: number; releaseMs?: number }[],
  where: string,
  resolve?: AmbiguityResolver,
): GoldenKeyPress[] {
  const events: { tick: number; ms: number; press: GoldenKeyPress }[] = [];
  for (const row of keys) {
    const key = PHONE_KEY[row.key] ?? row.key;
    if (!INPUT_KEYS.includes(key)) throw new GameCaptureError(where, `unknown key "${row.key}"`);
    const tick = tickOf(ticks, { key, ms: row.pressMs, release: false }, where, resolve);
    if (tick === undefined) continue; // the Select that starts the game
    events.push({ tick, ms: row.pressMs, press: { tick, key } });
    if (row.releaseMs === undefined) continue;
    // A release in the press's own tick, however late, is a tap: the game sees the key go up
    // long before it would repeat. Only a held key's release is placed (and must be clear).
    const processed = row.releaseMs + KEY_LATENCY_MS.min;
    if (ticks.filter((t) => t.startMs <= processed).at(-1)!.tick === tick) continue;
    const up = tickOf(ticks, { key, ms: row.releaseMs, release: true }, where, resolve)!;
    events.push({ tick: up, ms: row.releaseMs, press: { tick: up, key, release: true } });
  }
  return events.sort((a, b) => a.tick - b.tick || a.ms - b.ms).map((e) => e.press);
}

// ---------------------------------------------------------------- tick stills

/**
 * Which ticks become stills: `first` keeps tick 0; every tick on which `event(previous last
 * frame, this last frame)` holds, widened by `around` ticks each side; every `every`th tick;
 * the last `last` ticks; and each input tick with the `afterInput` ticks after it.
 */
export interface StillRule {
  readonly first?: boolean;
  readonly event?: (before: Uint8Array, after: Uint8Array) => boolean;
  readonly around?: number;
  readonly every?: number;
  readonly last?: number;
  readonly afterInput?: number;
}

export function selectTickStills(
  ticks: readonly Tick[],
  rule: StillRule,
  input: readonly GoldenKeyPress[] = [],
): number[] {
  const real = ticks.filter((tick) => !tick.virtual);
  const lastTick = real.at(-1)?.tick ?? 0;
  const wanted = new Set<number>(rule.first ? [0] : []);
  const around = rule.around ?? 0;
  if (rule.event !== undefined) {
    for (let i = 1; i < real.length; i++) {
      if (!rule.event(real[i - 1]!.last!.pixels, real[i]!.last!.pixels)) continue;
      for (let t = real[i]!.tick - around; t <= real[i]!.tick + around; t++) wanted.add(t);
    }
  }
  if (rule.every !== undefined)
    for (let t = rule.every; t <= lastTick; t += rule.every) wanted.add(t);
  if (rule.last !== undefined) {
    for (let t = Math.max(0, lastTick - rule.last + 1); t <= lastTick; t++) wanted.add(t);
  }
  if (rule.afterInput !== undefined) {
    for (const press of input) {
      for (let t = press.tick; t <= press.tick + rule.afterInput; t++) wanted.add(t);
    }
  }
  const numbered = new Set(real.map((tick) => tick.tick));
  return [...wanted].filter((t) => numbered.has(t)).sort((x, y) => x - y);
}

export function tickName(tick: number): string {
  return `t${String(tick).padStart(4, "0")}`;
}

// ---------------------------------------------------------------- periods

/** A tick fixture (`<id>.ticks.txt`): the period rows of one or more recordings. */
export interface TickFixtureSpec {
  readonly id: string;
  readonly status: GoldenStatus;
  readonly source: string;
  /** The `timings.csv` files hashed for `source-sha256`, in level order. */
  readonly timings: readonly string[];
  readonly note: string;
  readonly rows: readonly TickRow[];
}

/** First tick and every interval of one level's recording (the period fixture). */
export function tickRow(level: number, ticks: readonly Tick[], where: string): TickRow {
  const real = ticks.filter((tick) => !tick.virtual);
  if (real.length < 4) {
    throw new GameCaptureError(where, `${real.length} tick frames, need the start and 3 ticks`);
  }
  const starts = real.map((tick) => Math.round(tick.startMs));
  return {
    level,
    firstMs: starts[1]! - starts[0]!,
    intervalsMs: starts.slice(2).map((start, i) => start - starts[i + 1]!),
  };
}

/**
 * The median interval between distinct game frames: the period the half-period rule uses when
 * it is not known in advance (plan 23 C3).
 */
export function framePeriod(
  frames: readonly PlayedFrame[],
  isGameFrame: (pixels: Uint8Array) => boolean,
): number {
  const game = frames.filter((frame) => isGameFrame(frame.pixels));
  const gaps: number[] = [];
  for (let i = 1; i < game.length; i++) {
    if (!samePixels(game[i]!.pixels, game[i - 1]!.pixels)) {
      gaps.push(game[i]!.startMs - game[i - 1]!.startMs);
    }
  }
  if (gaps.length === 0) return Infinity;
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)]!;
}

// ---------------------------------------------------------------- golden entries

/** A game golden over one or more back-to-back recordings under `root`. */
export interface GameGoldenSpec {
  readonly id: string;
  readonly root: string;
  readonly dirs: readonly string[];
  /** How the game's ticks are numbered (or, from the frames, when the period is measured). */
  readonly ticks: TickRule | ((frames: readonly PlayedFrame[]) => TickRule);
  readonly note: string;
  readonly status: GoldenStatus;
  /** Tick stills (with how the note names the rule), or else a timeline. */
  readonly stills?: { readonly rule: StillRule; readonly note: string };
  /** Timelines: cut after this tick's last frame. */
  readonly toTick?: number;
  /** Input read from the frames when the keys are ambiguous, with the reason in the note. */
  readonly input?: readonly GoldenKeyPress[];
  /** Keys a capture pressed but did not log, as keys.csv rows. */
  readonly extraKeys?: readonly { dir: string; key: string; pressMs: number }[];
  /** The timeline note's sentence about its trigger frame. */
  readonly triggerNote?: (frame: number) => string;
  /** Reads ambiguous key edges from the frames (Space impact's ship and shots). */
  readonly resolve?: (frames: readonly PlayedFrame[], ticks: readonly Tick[]) => AmbiguityResolver;
}

function loadRecording(io: GameCaptureIo, dir: string): readonly GameRecordingFrame[] {
  const frames = io.recording(dir);
  if (frames === undefined || frames.length === 0) {
    throw new GameCaptureError(dir, "missing capture");
  }
  return frames;
}

function recordingSource(
  root: string,
  dirs: readonly string[],
  cut?: { dir: string; frame: number },
): CaptureSource {
  if (cut === undefined && dirs.length === 1)
    return { kind: "recording", dir: `${root}/${dirs[0]}` };
  const parts: FrameRange[] = [];
  for (const dir of dirs) {
    if (cut !== undefined && dir === cut.dir) {
      parts.push({ dir: `${root}/${dir}`, from: 0, to: cut.frame });
      break;
    }
    parts.push({ dir: `${root}/${dir}`, from: 0, to: Infinity });
  }
  return { kind: "composite", parts };
}

/** The recordings of `spec` played back to back, numbered into ticks. */
export function playGame(
  spec: Pick<GameGoldenSpec, "id" | "root" | "dirs" | "ticks" | "extraKeys">,
  io: GameCaptureIo,
): { frames: PlayedFrame[]; offsets: Map<string, number>; ticks: Tick[] } {
  const { frames, offsets } = playBackToBack(
    spec.dirs.map((dir) => ({ dir, frames: loadRecording(io, `${spec.root}/${dir}`) })),
  );
  const rule = typeof spec.ticks === "function" ? spec.ticks(frames) : spec.ticks;
  const ticks = numberTicks(frames, rule, gameKeys(spec, io, offsets));
  if (ticks.length === 0) throw new GameCaptureError(spec.id, "no game frame");
  return { frames, offsets, ticks };
}

/** The keys of `spec`'s recordings on the played-back clock, in press order. */
function gameKeys(
  spec: Pick<GameGoldenSpec, "root" | "dirs" | "extraKeys">,
  io: GameCaptureIo,
  offsets: Map<string, number>,
): { key: string; pressMs: number; releaseMs?: number }[] {
  return [
    ...spec.dirs.flatMap((dir) =>
      (io.keys(`${spec.root}/${dir}`) ?? []).map((row) => ({
        key: row.key,
        pressMs: row.pressMs + offsets.get(dir)!,
        ...(row.releaseMs === undefined ? {} : { releaseMs: row.releaseMs + offsets.get(dir)! }),
      })),
    ),
    ...(spec.extraKeys ?? []).map((row) => ({
      key: row.key,
      pressMs: row.pressMs + offsets.get(row.dir)!,
    })),
  ].sort((a, b) => a.pressMs - b.pressMs);
}

/**
 * A game golden: tick stills named `t<tick>` (each tick's last frame) or a timeline whose
 * trigger is tick 0's first frame, with the `input` of its keys.
 */
export function gameGolden(spec: GameGoldenSpec, io: GameCaptureIo): CaptureSetEntry {
  const { id, root, dirs } = spec;
  const { frames, offsets, ticks } = playGame(spec, io);
  const keys = gameKeys(spec, io, offsets);
  const input = spec.input ?? inputFromKeys(ticks, keys, id, spec.resolve?.(frames, ticks));
  const trigger = frames.indexOf(ticks[0]!.first!);
  if (spec.stills !== undefined) {
    const wanted = selectTickStills(ticks, spec.stills.rule, input);
    const byTick = new Map(ticks.map((tick) => [tick.tick, tick]));
    return {
      id,
      kind: "still",
      status: spec.status,
      ...(input.length > 0 ? { input } : {}),
      prefer: {
        source: {
          kind: "frames",
          frames: wanted.map((t) => {
            const last = byTick.get(t)!.last!;
            return { name: tickName(t), dir: `${root}/${last.dir}`, frame: last.frame };
          }),
        },
        note: `${spec.note} Tick stills: ${spec.stills.note}.`,
      },
    };
  }
  let cut: { dir: string; frame: number } | undefined;
  if (spec.toTick !== undefined) {
    const tick = ticks.find((t) => t.tick === spec.toTick && !t.virtual);
    if (tick === undefined) throw new GameCaptureError(id, `no tick ${spec.toTick}`);
    cut = { dir: tick.last!.dir, frame: tick.last!.frame };
  }
  const lastTick = spec.toTick ?? ticks.at(-1)!.tick;
  const late = input.find((press) => press.tick > lastTick);
  if (late !== undefined) {
    throw new GameCaptureError(id, `input tick ${late.tick} is after the timeline's last tick`);
  }
  const triggerNote = spec.triggerNote ?? ((f) => `Frame ${f} is the New game frame (tick 0).`);
  return {
    id,
    kind: "timeline",
    status: spec.status,
    ...(input.length > 0 ? { input } : {}),
    prefer: {
      source: recordingSource(root, dirs, cut),
      triggerFrame: trigger,
      note: `${spec.note} ${triggerNote(trigger)}`,
    },
  };
}

/** A timeline over a recording with no engine ticks to number (menus, notes, a death). */
export interface ScreenGoldenSpec {
  readonly id: string;
  readonly root: string;
  readonly dir: string;
  readonly note: string;
  readonly status: GoldenStatus;
  /** Default: the first frame that differs from the first kept frame. */
  readonly triggerFrame?: number;
  /** Keep the recording from this frame on (the frame before a key). */
  readonly from?: number;
}

export function screenGolden(spec: ScreenGoldenSpec, io: GameCaptureIo): CaptureSetEntry {
  const dir = `${spec.root}/${spec.dir}`;
  const from = spec.from ?? 0;
  const frames = loadRecording(io, dir).slice(from);
  const changed = frames.findIndex((frame) => !samePixels(frame.pixels, frames[0]!.pixels));
  const trigger = spec.triggerFrame ?? (changed < 0 ? 0 : changed);
  return {
    id: spec.id,
    kind: "timeline",
    status: spec.status,
    prefer: {
      source:
        from === 0
          ? { kind: "recording", dir }
          : { kind: "composite", parts: [{ dir, from, to: Infinity }] },
      triggerFrame: trigger,
      note: `${spec.note}${from > 0 ? ` From frame ${from} of the recording.` : ""} Trigger: frame ${trigger}, the first change.`,
    },
  };
}

/** Named `shot` PNGs under `root` as one still golden. */
export function shotsGolden(spec: {
  readonly id: string;
  readonly root: string;
  readonly files: readonly string[];
  readonly note: string;
  readonly status: GoldenStatus;
}): CaptureSetEntry {
  return {
    id: spec.id,
    kind: "still",
    status: spec.status,
    prefer: {
      source: { kind: "shots", files: spec.files.map((file) => `${spec.root}/${file}`) },
      note: spec.note,
    },
  };
}
