// Replays capture command logs (the harness language of `$REF/captures/README.md`, transcribed
// into `scripts/generated/messages-scripts.ts`) on a stock phone, and compares the shots, scrolls
// and recordings they took with their goldens (plan 18 Task 12).
//
// A log is a command stream; `fork` … `exit` blocks run from a snapshot that `exit` restores, so
// the commands that reach a target are the log's own up to it, through the blocks that hold it
// and past the blocks that do not. Timing follows the harness: a tap (`key`) is ≈42 ms down, then
// the emulator's 250 ms settle and `keygap` (default 300 ms); `hold k d` releases after `d`, then
// settles 250 ms. Every key edge acts KEY_LATENCY_MS after its command, standing in for the
// firmware's key-to-redraw latency (25-95 ms in the recordings, plan 14 D8) so that timers that
// start at a redraw (a note, a commit, the editor's free-running blink) start near where the
// firmware's did; time stamps (`sms`) and shots do not move.
//
// Recordings are compared from their start: the golden's frame 0 is the screen when `record
// start` ran. A key edge inside a recording moves to the start of the first golden row within
// LATENCY_WINDOW_MS after it (its redraw, D8); a short tap goes down and up there at once, so a
// widget that acts on either edge redraws on that row. A still accepts either blink phase within
// one blink step of its shot (the cursor's phase is the recordings').
import type { PhoneKey, ScreenModel } from "@hellotimber/phone-core";
import { Framebuffer } from "@hellotimber/phone-screen";
import { findGoldenImage, type Golden } from "../../scripts/golden-format.ts";
import { paintStockScreen, type StockStorage } from "../../src/index";
import { lcdMismatch, TIMING_TOLERANCE_MS, type RecordedTimeline } from "./golden.ts";
import { loadGolden } from "./goldens.ts";
import type { Rig } from "./rig.ts";

/** One command of a log, identified by its log and position. */
export interface Command {
  readonly id: string;
  readonly op: string;
  readonly args: readonly string[];
}

interface ForkNode {
  readonly op: "fork";
  readonly body: readonly ScriptNode[];
}

type ScriptNode = Command | ForkNode;

/** What a replay needs to know about the logs and the phone they drive. */
export interface ReplayContext {
  /** Logs by name: one command per line. */
  readonly scripts: Readonly<Record<string, string>>;
  /** A block's command lines as this phone's firmware needs them (default: unchanged). */
  readonly rewrite?: (lines: readonly string[]) => string[];
  /** The phone after `include setup`: at standby over `storage`, every timer settled. */
  readonly setup: (storage: StockStorage) => Rig;
  /** How much emulated time the setup takes in the capture (`sms` time stamps count it). */
  readonly setupMs: number;
  /** `sms <from> <text>`: an SMS for the phone, `capMs` of emulated time after power-on. */
  readonly sms?: (rig: Rig, from: string, text: string, capMs: number) => void;
}

/** A key edge acts this long after its command (the firmware's typical redraw latency). */
export const KEY_LATENCY_MS = 50;
/** How far after a key edge a recording looks for the row it redraws. */
export const LATENCY_WINDOW_MS = 130;
const TAP_DOWN_MS = 42;
const SETTLE_MS = 250;
const DEFAULT_KEYGAP_MS = 300;
/** A press shorter than this inside a recording is a tap: down and up on its row. */
const TAP_MAX_MS = 150;
/** The cursor's blink step: a still may show either phase within one step of its shot. */
const BLINK_STEP_MS = 481;

/** The replay's tick between commands (recordings tick every millisecond). */
const STEP_MS = Number(process.env.REPLAY_STEP_MS ?? 20);

const KEY_NAMES: Readonly<Record<string, PhoneKey>> = { menu: "navi" };

function phoneKey(name: string): PhoneKey {
  return KEY_NAMES[name] ?? (name as PhoneKey);
}

function durationMs(text: string): number {
  const m = /^(\d+(?:\.\d+)?)(ms|s)$/.exec(text);
  if (m === null) throw new Error(`bad duration "${text}"`);
  return Number(m[1]) * (m[2] === "s" ? 1000 : 1);
}

/** A storage whose items can be copied (`saveflash`). */
function mapStorage(items = new Map<string, string>()): StockStorage & {
  readonly items: Map<string, string>;
} {
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem(key, value) {
      items.set(key, String(value));
    },
    removeItem(key) {
      items.delete(key);
    },
  };
}

function samePixels(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function paint(screen: ScreenModel): Uint8Array {
  const fb = new Framebuffer();
  paintStockScreen(fb, screen);
  return fb.pixels;
}

// ---------------------------------------------------------------- parsing and locating

const PARSED = new WeakMap<ReplayContext, Map<string, readonly ScriptNode[]>>();

function parse(context: ReplayContext, name: string): readonly ScriptNode[] {
  let cache = PARSED.get(context);
  if (cache === undefined) PARSED.set(context, (cache = new Map()));
  const known = cache.get(name);
  if (known !== undefined) return known;
  const text = context.scripts[name];
  if (text === undefined) throw new Error(`No capture log ${name}.`);
  // Each run of commands between fork boundaries is rewritten as a whole, then parsed.
  const lines = text.split("\n");
  let line = 0;
  let serial = 0;
  const block = (): ScriptNode[] => {
    const nodes: ScriptNode[] = [];
    let run: string[] = [];
    const flush = () => {
      for (const command of context.rewrite?.(run) ?? run) {
        const [op, ...args] = command.split(" ");
        nodes.push({ id: `${name}#${serial++}`, op: op!, args });
      }
      run = [];
    };
    while (line < lines.length) {
      const command = lines[line++]!;
      if (command === "exit") break;
      if (command === "fork") {
        flush();
        nodes.push({ op: "fork", body: block() });
      } else run.push(command);
    }
    flush();
    return nodes;
  };
  const nodes = block();
  cache.set(name, nodes);
  return nodes;
}

/** A target's place in a log: the commands that reach it, and those after it in its block. */
interface Located {
  readonly path: readonly Command[];
  readonly following: readonly Command[];
}

function locateIn(nodes: readonly ScriptNode[], hit: (c: Command) => boolean): Located | undefined {
  const walk = (block: readonly ScriptNode[], prefix: Command[]): Located | undefined => {
    for (let i = 0; i < block.length; i++) {
      const node = block[i]!;
      if (node.op === "fork") {
        const found = walk((node as ForkNode).body, [...prefix]);
        if (found !== undefined) return found;
        continue;
      }
      prefix.push(node as Command);
      if (hit(node as Command)) {
        const following = block.slice(i + 1).filter((n): n is Command => n.op !== "fork");
        return { path: prefix, following };
      }
    }
    return undefined;
  };
  return walk(nodes, []);
}

/** The target (`shot`, `scroll` or `record … start` of `name`) in whichever log took it. */
function locate(
  context: ReplayContext,
  op: "shot" | "scroll" | "record",
  name: string,
): Located | undefined {
  const hit = (c: Command) =>
    c.op === op && c.args[0] === name && (op !== "record" || c.args[1] === "start");
  const found = Object.keys(context.scripts).flatMap((script) => {
    const at = locateIn(parse(context, script), hit);
    return at === undefined ? [] : [at];
  });
  if (found.length > 1) throw new Error(`${op} ${name} is in ${found.length} capture logs.`);
  return found[0];
}

// ---------------------------------------------------------------- the replay

interface LoggedFrame {
  readonly atMs: number;
  readonly pixels: Uint8Array;
}

interface Action {
  readonly atMs: number;
  readonly run: () => void;
}

/** One phone replaying a log's commands in order; it can go on along a longer path. */
export class Replay {
  readonly #context: ReplayContext;
  #rig: Rig | undefined;
  #storage = mapStorage();
  readonly #flashes = new Map<string, Map<string, string>>();
  #keygap = DEFAULT_KEYGAP_MS;
  /** Emulated time since the capture's power-on. */
  #capMs = 0;
  /** The commands run so far. */
  readonly #done: Command[] = [];
  /** Frames shown recently (a still's blink window). */
  #frames: LoggedFrame[] = [];
  #unsubscribe: (() => void) | undefined;
  #lastKeyMs = -Infinity;
  /** Key edges waiting for their latency, at rig times. */
  #pending: Action[] = [];

  constructor(context: ReplayContext) {
    this.#context = context;
  }

  get rig(): Rig {
    if (this.#rig === undefined) throw new Error("The log has not set up a phone yet.");
    return this.#rig;
  }

  /** Whether this replay can reach `path` by running more commands. */
  canReach(path: readonly Command[]): boolean {
    return this.#done.length <= path.length && this.#done.every((c, i) => path[i] === c);
  }

  /** Runs the commands of `path` this replay has not run yet. */
  reach(path: readonly Command[]): void {
    if (!this.canReach(path)) throw new Error("This replay has gone another way.");
    for (const command of path.slice(this.#done.length)) this.run(command);
  }

  #watch(): void {
    this.#unsubscribe?.();
    const rig = this.rig;
    this.#frames = [{ atMs: rig.now, pixels: new Uint8Array(rig.paint().pixels) }];
    this.#unsubscribe = rig.phone.subscribe((snapshot) => {
      const pixels = paint(snapshot.screen);
      const last = this.#frames.at(-1);
      if (last !== undefined && samePixels(last.pixels, pixels)) return;
      if (last !== undefined && last.atMs === rig.now) this.#frames.pop();
      this.#frames.push({ atMs: rig.now, pixels });
      const keep = rig.now - BLINK_STEP_MS * 2;
      while (this.#frames.length > 2 && this.#frames[1]!.atMs < keep) this.#frames.shift();
    });
  }

  /**
   * Advances `ms` in steps of up to STEP_MS (timers fire up to a step late between commands; a
   * recording ticks every millisecond), running key edges at their times.
   */
  #advance(ms: number): void {
    const rig = this.rig;
    const end = rig.now + ms;
    while (rig.now < end) {
      const next = Math.min(end, this.#pending[0]?.atMs ?? Infinity, rig.now + STEP_MS);
      rig.advance(next - rig.now, next - rig.now);
      while (this.#pending.length > 0 && this.#pending[0]!.atMs <= rig.now) {
        this.#pending.shift()!.run();
      }
    }
    this.#capMs += ms;
  }

  /** A key edge KEY_LATENCY_MS from now. */
  #edge(key: PhoneKey, down: boolean): void {
    const atMs = this.rig.now + KEY_LATENCY_MS;
    this.#pending.push({
      atMs,
      run: () => {
        if (down) this.rig.hold(key);
        else this.rig.release(key);
        this.#lastKeyMs = this.rig.now;
      },
    });
  }

  /** Runs one command. Targets (`shot`, `scroll`, `record`) only advance the path here. */
  run(command: Command): void {
    this.#done.push(command);
    const { op, args } = command;
    switch (op) {
      case "include":
        this.#rig = this.#context.setup(this.#storage);
        this.#capMs += this.#context.setupMs;
        this.#watch();
        return;
      case "reboot": {
        const flash = this.#flashes.get(args[0]!);
        this.#storage = mapStorage(new Map(flash ?? []));
        this.#capMs = 0;
        return;
      }
      case "saveflash":
        this.#flashes.set(args[0]!, new Map(this.#storage.items));
        return;
      case "keygap":
        this.#keygap = durationMs(args[0]!);
        return;
      case "run":
        this.#advance(durationMs(args[0]!));
        return;
      case "key":
        for (const name of args) {
          const key = phoneKey(name);
          this.#edge(key, true);
          this.#advance(TAP_DOWN_MS);
          this.#edge(key, false);
          this.#advance(SETTLE_MS + this.#keygap);
        }
        return;
      case "press":
        this.#edge(phoneKey(args[0]!), true);
        return;
      case "release":
        this.#edge(phoneKey(args[0]!), false);
        return;
      case "hold": {
        const key = phoneKey(args[0]!);
        this.#edge(key, true);
        this.#advance(durationMs(args[1]!));
        this.#edge(key, false);
        this.#advance(SETTLE_MS);
        return;
      }
      case "idle": {
        // Until the screen has not changed for `quiet`, at most `max`.
        const quiet = durationMs(args[0]!);
        const max = durationMs(args[1]!);
        for (let t = 0; t < max && this.rig.now - this.#frames.at(-1)!.atMs < quiet; t++) {
          this.#advance(1);
        }
        return;
      }
      case "sms": {
        const sms = this.#context.sms;
        if (sms === undefined) throw new Error("This replay cannot deliver an SMS.");
        sms(this.rig, args[0]!, args.slice(1).join(" "), this.#capMs);
        return;
      }
      case "shot":
      case "scroll":
      case "record":
      case "audio":
        return;
      default:
        throw new Error(`Unknown capture command ${op} (${command.id}).`);
    }
  }

  /**
   * The mismatch of `image` against the screen now, or undefined when it shows now or showed
   * within the blink step before (both blink phases); when a key came less than a step ago it
   * also looks that much ahead.
   */
  mismatchNow(id: string, image: string, context: string): string | undefined {
    // Pending key edges (a tap's release) act first, as they would before the shot.
    while (this.#pending.length > 0) this.#advance(1);
    const ref = { id, image: findGoldenImage(loadGolden(id), image) };
    const rig = this.rig;
    const from = Math.max(rig.now - BLINK_STEP_MS, this.#lastKeyMs);
    const frames = this.#frames;
    const seen = frames.filter((_, i) => (frames[i + 1]?.atMs ?? Infinity) > from);
    if (seen.some((frame) => lcdMismatch(frame.pixels, ref, context) === undefined)) {
      return undefined;
    }
    const ahead = BLINK_STEP_MS - (rig.now - from);
    for (let t = 0; t < ahead; t++) {
      this.#advance(1);
      if (lcdMismatch(frames.at(-1)!.pixels, ref, context) === undefined) return undefined;
    }
    return lcdMismatch(rig.paint().pixels, ref, `${context} (no blink phase matches)`);
  }

  /** Records a `record … start` block (`body`, up to `record stop`) and compares it. */
  record(golden: Golden, body: readonly Command[], options: TimelineOptions): void {
    const rows = golden.timeline;
    if (rows === undefined) throw new Error(`${golden.id} is not a timeline golden.`);
    const stop = body.findIndex((c) => c.op === "record" && c.args[0] === "stop");
    if (stop < 0) throw new Error(`${golden.id}: no record stop in its block.`);
    const origin = rows[0]!.startMs;
    const rowStarts = rows.map((row) => row.startMs - origin);
    const { schedule, endMs } = this.#schedule(body.slice(0, stop), rowStarts, options);
    const rig = this.rig;
    // Key edges still waiting (a tap's release) run at their times inside the recording.
    const waiting = this.#pending.map((a) => ({ atMs: a.atMs - rig.now, run: a.run }));
    this.#pending = [];
    const recording = rig.record(endMs, undefined, [...waiting, ...schedule]);
    this.#capMs += endMs + 1;
    for (const c of body.slice(0, stop + 1)) this.#done.push(c);
    this.#watch();
    expectFromStart(recording, golden, options);
  }

  /** The record body as rig actions at their recording times, presses moved onto their rows. */
  #schedule(
    body: readonly Command[],
    rowStarts: readonly number[],
    options: TimelineOptions,
  ): { schedule: Action[]; endMs: number } {
    const presses: { key: PhoneKey; down: number; up: number }[] = [];
    const actions: Action[] = [];
    const press = (key: PhoneKey, at: number) => presses.push({ key, down: at, up: Infinity });
    const release = (key: PhoneKey, at: number) => {
      const open = presses.find((p) => p.key === key && p.up === Infinity);
      if (open === undefined) throw new Error(`release ${key} without its press`);
      open.up = at;
    };
    let t = 1;
    for (const command of body) {
      const { op, args } = command;
      switch (op) {
        case "press":
          press(phoneKey(args[0]!), t);
          break;
        case "release":
          release(phoneKey(args[0]!), t);
          break;
        case "run":
          t += durationMs(args[0]!);
          break;
        case "key":
          for (const name of args) {
            press(phoneKey(name), t);
            release(phoneKey(name), t + TAP_DOWN_MS);
            t += TAP_DOWN_MS + SETTLE_MS + this.#keygap;
          }
          break;
        case "hold": {
          const key = phoneKey(args[0]!);
          press(key, t);
          t += durationMs(args[1]!);
          release(key, t);
          t += SETTLE_MS;
          break;
        }
        case "keygap":
          this.#keygap = durationMs(args[0]!);
          break;
        case "sms": {
          const sms = this.#context.sms;
          if (sms === undefined) throw new Error("This replay cannot deliver an SMS.");
          const capMs = this.#capMs + t;
          const text = args.slice(1).join(" ");
          actions.push({ atMs: t, run: () => sms(this.rig, args[0]!, text, capMs) });
          break;
        }
        default:
          throw new Error(`Cannot record over ${op} (${command.id}).`);
      }
    }
    let lastRow = 0;
    presses.forEach((p, k) => {
      const fixed = options.keyAt?.[k];
      let at: number;
      if (fixed !== undefined) at = fixed === "latency" ? p.down + KEY_LATENCY_MS : fixed;
      else {
        const row = rowStarts.findIndex(
          (s, i) => i > lastRow && s >= p.down && s <= p.down + LATENCY_WINDOW_MS,
        );
        if (row > 0) lastRow = row;
        at = row > 0 ? rowStarts[row]! : p.down + KEY_LATENCY_MS;
      }
      const held = p.up - p.down;
      actions.push({
        atMs: at,
        run: () => {
          this.rig.hold(p.key);
          this.#lastKeyMs = this.rig.now;
        },
      });
      if (p.up !== Infinity) {
        actions.push({
          atMs: held < TAP_MAX_MS ? at : at + held,
          run: () => this.rig.release(p.key),
        });
      }
    });
    // Stable: a tap's release stays after its press on the same millisecond.
    actions.sort((a, b) => a.atMs - b.atMs);
    return { schedule: actions, endMs: t };
  }

  /** Runs the key edges still waiting. */
  end(): void {
    while (this.#pending.length > 0) this.#advance(1);
    this.#unsubscribe?.();
  }
}

// ---------------------------------------------------------------- comparing

export interface TimelineOptions {
  /** Allowed |Δ| of a frame start, aligned at the recording's start. Default ±2 ms. */
  readonly toleranceMs?: number;
  /**
   * `free` (default): the text cursor's blink phase is not compared. Rows that only blink the
   * cursor are left out on both sides and a frame may differ from its row by the cursor alone:
   * the firmware's phase differs between forks of one editor (welcome/hold-c and 37th-key: 47
   * ms apart from the same editor) and depends on key latencies the replay does not reproduce
   * (D8). `strict`: every row, the cursor too (the blink goldens).
   */
  readonly blink?: "free" | "strict";
  /** Rows whose start is not compared (their pixels are). */
  readonly untimedRows?: ReadonlySet<number>;
  /** Where press k of the recording goes down: a time, or `latency` (no row of its own). */
  readonly keyAt?: Readonly<Record<number, number | "latency">>;
}

/** Whether `b` differs from `a` only in one column's contiguous run (a text cursor). */
export function cursorOnly(a: Uint8Array, b: Uint8Array, width = 84): boolean {
  let column = -1;
  let top = Infinity;
  let bottom = -1;
  let count = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    const x = i % width;
    const y = Math.floor(i / width);
    if (column >= 0 && x !== column) return false;
    column = x;
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
    count++;
  }
  return count >= 6 && count === bottom - top + 1;
}

const ms = (value: number): string => value.toFixed(1);

/** A frame of either side: its start from the recording's start, its pixels, its label. */
interface Step {
  readonly startMs: number;
  readonly pixels: Uint8Array;
  readonly label: string;
  /** The golden row's index (golden side). */
  readonly row?: number;
}

/** `steps` without the ones that only blink the cursor (`free`). */
function withoutBlinks(steps: readonly Step[]): Step[] {
  return steps.filter((step, i) => i === 0 || !cursorOnly(steps[i - 1]!.pixels, step.pixels));
}

/** Compares a recording with every row of a timeline golden, both from the recording's start. */
export function expectFromStart(
  recorded: RecordedTimeline,
  golden: Golden,
  options: TimelineOptions = {},
): void {
  const rows = golden.timeline!;
  const tolerance = options.toleranceMs ?? TIMING_TOLERANCE_MS;
  const free = (options.blink ?? "free") === "free";
  const start = recorded.frames[0]!.startMs;
  const origin = rows[0]!.startMs;
  const last = rows.at(-1)!;
  const lastEnd = last.startMs - origin + last.durationMs;
  let expected: Step[] = rows.map((row, i) => ({
    startMs: row.startMs - origin,
    pixels: findGoldenImage(golden, row.image).pixels,
    label: `${String(row.frame).padStart(6)} ${row.image.padEnd(5)}`,
    row: i,
  }));
  // Frames that start after the golden stopped recording are not compared.
  let actual: Step[] = recorded.frames
    .map((frame) => ({ startMs: frame.startMs - start, pixels: frame.pixels, label: "" }))
    .filter((step, i) => i === 0 || step.startMs < lastEnd - tolerance);
  if (free) {
    expected = withoutBlinks(expected);
    actual = withoutBlinks(actual);
  }
  const lines = [" frame image  golden start  actual start       Δ  pixels"];
  let failed = false;
  let firstPixels: string | undefined;
  expected.forEach((step, i) => {
    const frame = actual[i];
    const prefix = `${step.label}${ms(step.startMs).padStart(14)}`;
    if (frame === undefined) {
      failed = true;
      lines.push(`${prefix}${"-".padStart(14)}${"-".padStart(8)}  missing  ✗ never shown`);
      return;
    }
    const timed = i > 0 && !options.untimedRows?.has(step.row!);
    const marks: string[] = [];
    if (timed && Math.abs(frame.startMs - step.startMs) > tolerance) marks.push("✗ timing");
    const image = findGoldenImage(golden, rows[step.row!]!.image);
    const mismatch =
      free && cursorOnly(image.pixels, frame.pixels)
        ? undefined
        : lcdMismatch(frame.pixels, { id: golden.id, image }, `frame ${rows[step.row!]!.frame}`);
    if (mismatch !== undefined) {
      marks.push("✗ pixels");
      firstPixels ??= mismatch;
    }
    if (marks.length > 0) failed = true;
    const delta = timed ? ms(frame.startMs - step.startMs) : "n/a";
    lines.push(
      `${prefix}${ms(frame.startMs).padStart(14)}${delta.padStart(8)}  ${mismatch === undefined ? "ok     " : "differ "}  ${marks.join("  ")}`.trimEnd(),
    );
  });
  const extra = actual.slice(expected.length);
  if (extra.length > 0) {
    failed = true;
    lines.push(` extra frames at ${extra.map((f) => ms(f.startMs)).join(", ")} ms ✗`);
  }
  if (!failed) return;
  const out = [
    `Recording mismatch: ${golden.id} (from the recording's start${free ? "; cursor blinks left out" : ""})`,
    ...lines,
  ];
  if (firstPixels !== undefined) out.push("", firstPixels);
  throw new Error(out.join("\n"));
}

// ---------------------------------------------------------------- scenarios

type Target =
  | { readonly kind: "record"; readonly name: string }
  | { readonly kind: "shot"; readonly name: string; readonly image: string }
  | {
      readonly kind: "scroll";
      readonly name: string;
      /** Golden image names by scroll position (0 = the first shot). */
      readonly images: { readonly at: number; readonly image: string }[];
    };

/** A golden's capture targets, from its `source`: a recording, a scroll, or shots. */
function targetsOf(context: ReplayContext, golden: Golden): Target[] {
  const strip = (file: string) => file.replace(/^captures\/6\.39\//, "").replace(/\.png$/, "");
  const source = strip(golden.source);
  if (golden.timeline !== undefined) return [{ kind: "record", name: source }];
  if (!golden.source.includes(".png")) {
    // A directory: a `scroll` into it, or one `shot` per image (`<dir>/<image>`).
    if (locate(context, "scroll", source) === undefined) {
      return golden.images.map((image) => ({
        kind: "shot",
        name: `${source}/${image.name}`,
        image: image.name,
      }));
    }
    return [
      {
        kind: "scroll",
        name: source,
        images: golden.images.map((image, at) => ({ at, image: image.name })),
      },
    ];
  }
  const targets: Target[] = [];
  golden.source.split(" + ").forEach((file, i) => {
    const name = strip(file);
    const image = golden.images[i]!.name;
    const scrolled = /^(.*)\/(\d\d)$/.exec(name);
    if (scrolled !== null && locate(context, "shot", name) === undefined) {
      const at = Number(scrolled[2]) - 1;
      const last = targets.at(-1);
      if (last?.kind === "scroll" && last.name === scrolled[1]) last.images.push({ at, image });
      else targets.push({ kind: "scroll", name: scrolled[1]!, images: [{ at, image }] });
    } else targets.push({ kind: "shot", name, image });
  });
  return targets;
}

/**
 * The scenario of golden `id`: each target replayed from its log's start (one replay while the
 * next target lies further along the same path) and compared.
 */
export function replayScenario(
  context: ReplayContext,
  id: string,
  options: TimelineOptions = {},
): void {
  const golden = loadGolden(id);
  let replay: Replay | undefined;
  const fresh = (path: readonly Command[]): Replay => {
    if (replay === undefined || !replay.canReach(path)) {
      replay?.end();
      replay = new Replay(context);
    }
    replay.reach(path);
    return replay;
  };
  for (const target of targetsOf(context, golden)) {
    const op = target.kind;
    const located = locate(context, op, target.name);
    if (located === undefined) throw new Error(`${id}: no ${op} ${target.name} in the logs.`);
    if (target.kind === "record") {
      fresh(located.path).record(golden, located.following, options);
      continue;
    }
    if (target.kind === "shot") {
      const mismatch = fresh(located.path).mismatchNow(id, target.image, `shot ${target.name}`);
      if (mismatch !== undefined) throw new Error(mismatch);
      continue;
    }
    // `scroll <prefix> [key]`: a shot, then the key, until the list wraps.
    const scrolling = fresh(located.path);
    const command = located.path.at(-1)!;
    const key = command.args[1] ?? "down";
    let at = 0;
    for (const { at: want, image } of target.images) {
      for (; at < want; at++) scrolling.run({ id: `${command.id}~${at}`, op: "key", args: [key] });
      const mismatch = scrolling.mismatchNow(id, image, `scroll ${target.name} image ${want + 1}`);
      if (mismatch !== undefined) throw new Error(mismatch);
    }
    // The scroll's keys are not the log's: the next target starts afresh.
    scrolling.end();
    replay = undefined;
  }
  replay?.end();
}
