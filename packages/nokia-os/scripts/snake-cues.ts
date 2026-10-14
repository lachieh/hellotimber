// The Snake II cue fixture (plan 23 Task 10, D8): the buzzer and vibrator edges of Task 0's C10
// sound recordings, placed on the game's ticks, for the tests (which never read REF) and for
// plan 16. Writes tests/fixtures/snake-cues.json.
//
//   mise exec -- vp run @hellotimber/nokia-os#snake-cues /path/to/nokia-3310
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** One buzzer or vibrator run. */
export interface CueEdge {
  readonly kind: "buzzer" | "vibra";
  /** The buzzer's frequency (Hz, rounded). */
  readonly hz?: number;
  /** When it starts, from the recording's reference frame (ms). */
  readonly onMs: number;
  /** How long it runs; null when the recording ends first. */
  readonly durationMs: number | null;
  /** The game tick whose frame follows it, or `death` (the first hidden frame). */
  readonly tick: number | "death";
  /** That frame's start minus the edge: how far the edge leads the redraw (< 0: it follows). */
  readonly leadMs: number;
}

export interface CueRecording {
  /** Under captures/6.39/plan23/sound. */
  readonly id: string;
  readonly note: string;
  readonly edges: readonly CueEdge[];
}

interface Row {
  readonly t: number;
  readonly buzzer: boolean;
  readonly hz: number;
  readonly vibra: boolean;
}

function parseEvents(csv: string): Row[] {
  const [header, ...lines] = csv.trim().split("\n");
  const cols = header!.split(",");
  const at = (name: string) => cols.indexOf(name);
  return lines.map((line) => {
    const v = line.split(",");
    return {
      t: Number(v[at("t_ms")]),
      buzzer: v[at("buzzer_on")] === "1",
      hz: Number(v[at("buzzer_hz")]),
      vibra: v[at("vibra")] === "1",
    };
  });
}

function frameStarts(csv: string): number[] {
  const [, ...lines] = csv.trim().split("\n");
  return lines.map((line) => Number(line.split(",")[1]));
}

const round1 = (ms: number) => Math.round(ms * 10) / 10;

/**
 * The edges of an events log. `frames` are the reference frames' starts in the log's time:
 * tick n's frame for a game (the first, tick 0, is the reference), or the death's first hidden
 * frame.
 */
export function cueEdges(events: string, frames: readonly number[], death: boolean): CueEdge[] {
  const rows = parseEvents(events);
  const origin = frames[0]!;
  const edges: CueEdge[] = [];
  for (const kind of ["buzzer", "vibra"] as const) {
    let on: Row | undefined;
    for (const row of rows) {
      const lit = row[kind];
      if (lit && on === undefined) on = row;
      else if (!lit && on !== undefined) {
        edges.push(edge(kind, on, row.t));
        on = undefined;
      }
    }
    if (on !== undefined) edges.push(edge(kind, on, null));
  }
  return edges.sort((a, b) => a.onMs - b.onMs);

  function edge(kind: "buzzer" | "vibra", on: Row, off: number | null): CueEdge {
    // A death's edges all belong to its first hidden frame (the crash's beeps run past it).
    const next = death ? 0 : frames.findIndex((start) => start >= on.t);
    if (next < 0) throw new Error(`no frame after the ${kind} edge at ${on.t} ms`);
    return {
      kind,
      ...(kind === "buzzer" ? { hz: Math.round(on.hz) } : {}),
      onMs: round1(on.t - origin),
      durationMs: off === null ? null : round1(off - on.t),
      tick: death ? "death" : next,
      leadMs: round1(frames[next]! - on.t),
    };
  }
}

/** C10's recordings: the game with its ticks (frames 1.., frame 0 is the menu) and the death. */
const RECORDINGS: readonly { id: string; death: boolean; note: string }[] = [
  {
    id: "warning-on/game",
    death: false,
    note: "Tones › Warning tones On, a level-2 game (bot-short's): meals on ticks 7 and 13.",
  },
  {
    id: "warning-on/death",
    death: true,
    note: "Warning tones On: bot-short's death; the crash's three 440 Hz beeps and the vibrator.",
  },
  {
    id: "sounds-off/game",
    death: false,
    note: "Games › Settings › Sounds Off (virgin tones): bot-short's game; vibrator only.",
  },
  {
    id: "sounds-off/death",
    death: true,
    note: "Sounds Off: bot-short's death; vibrator only.",
  },
  {
    id: "shakes-on/game",
    death: false,
    note: "Shakes On, a level-1 game (bot-long's first meal on tick 7); the recording ends first.",
  },
  {
    id: "shakes-off/game",
    death: false,
    note: "Shakes Off, the same level-1 meal: no edge.",
  },
];

export function snakeCues(soundDir: string): CueRecording[] {
  return RECORDINGS.map(({ id, death, note }) => {
    const events = readFileSync(join(soundDir, `${id}.events.csv`), "utf8");
    const starts = frameStarts(readFileSync(join(soundDir, id, "timings.csv"), "utf8"));
    // Games: frame 0 is the game menu, frame n + 1 tick n. Deaths: frame 1 is the first hidden.
    const frames = death ? starts.slice(1, 2) : starts.slice(1);
    return { id, note, edges: cueEdges(events, frames, death) };
  });
}

function main(): void {
  const ref = process.argv[2];
  if (!ref) throw new Error("usage: snake-cues <REF> (the nokia-3310 capture corpus directory)");
  const dir = join(ref, "captures/6.39/plan23/sound");
  if (!existsSync(dir)) throw new Error(`missing ${dir}: pass the nokia-3310 corpus as REF`);
  const out = join(import.meta.dirname, "../tests/fixtures/snake-cues.json");
  const fixture = {
    source: "captures/6.39/plan23/sound",
    note: "Plan 23 Task 0 C10: buzzer and vibrator edges by game tick (scripts/snake-cues.ts).",
    recordings: snakeCues(dir),
  };
  writeFileSync(out, `${JSON.stringify(fixture, null, 2)}\n`);
  console.log(`wrote ${out}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
