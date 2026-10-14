// Sound programs and rules derived from the committed sound goldens (plan 16 D3, D10, Task 3).
//
// A program is the list of steps a golden's rows describe from its first edge: each step sets
// the outputs that change at its start (undefined = unchanged) and lasts until the next edge; the
// program's end silences what is still on (the sequencer's rule, plan 16 Task 4).
// `renderProgram` replays a program as rows, and every derivation is checked by replaying it
// against its golden. Pure: reads goldens through an injected loader, imports only sibling
// scripts.
import type { SoundGolden, SoundRow, SoundState } from "./sound-format.ts";
import { LEVEL_COVER_TONES, RINGING_TONE_NAMES, toneSlug } from "./sound-capture-set.ts";

// ---------------------------------------------------------------- programs

export interface SoundOutputData {
  readonly hz: number;
  readonly volume: number;
}

/** One step (plan 16 `SoundStep`): the outputs set at its start, held for `ms`. */
export interface SoundStepData {
  readonly ms: number;
  readonly buzzer?: SoundOutputData | null;
  readonly tone?: SoundOutputData | null;
  readonly vibrator?: boolean;
}

export interface SoundProgramData {
  readonly id: string;
  readonly steps: readonly SoundStepData[];
  /** Step index the program repeats from; absent = plays once. */
  readonly loopFrom?: number;
}

export class SoundProgramError extends Error {
  constructor(where: string, message: string) {
    super(`${where}: ${message}`);
    this.name = "SoundProgramError";
  }
}

function outputOf(state: SoundState): SoundOutputData | null {
  if (state.kind !== "sounding") return null;
  return { hz: state.hz, volume: state.volume };
}

/**
 * The program of `rows` (buzzer, tone and vibrator changes, times in ms) from their first edge.
 * The last edge must only silence outputs (it becomes the program's end).
 */
export function programFromRows(id: string, rows: readonly SoundRow[]): SoundProgramData {
  if (rows.length === 0) throw new SoundProgramError(id, "no rows");
  const times = [...new Set(rows.map((r) => r.ms))].sort((a, b) => a - b);
  const steps: SoundStepData[] = [];
  times.forEach((t, i) => {
    const at = rows.filter((r) => r.ms === t);
    if (i === times.length - 1) {
      const loud = at.find((r) => r.state.kind !== "off");
      if (loud) {
        throw new SoundProgramError(id, `the last edge (${t} ms) turns ${loud.output} on`);
      }
      return;
    }
    const step: { -readonly [K in keyof SoundStepData]: SoundStepData[K] } = {
      ms: times[i + 1]! - t,
    };
    for (const row of at) {
      if (row.output === "vibrator") step.vibrator = row.state.kind === "on";
      else step[row.output] = outputOf(row.state);
    }
    steps.push(step);
  });
  return { id, steps };
}

/**
 * Rows of `program` started at `startMs`, played once: each step's changes (only those that
 * differ), then at its end every output still on goes off. With `stopStep`, the program is cut
 * at that step's start instead.
 */
export function renderProgram(
  program: SoundProgramData,
  startMs: number,
  options: { stopStep?: number; volume?: (step: number, output: SoundOutputData) => number } = {},
): SoundRow[] {
  const rows: SoundRow[] = [];
  const now: Record<"buzzer" | "tone" | "vibrator", string> = {
    buzzer: "off",
    tone: "off",
    vibrator: "off",
  };
  const emit = (ms: number, output: "buzzer" | "tone" | "vibrator", state: SoundState) => {
    const key = state.kind === "sounding" ? `${state.hz}@${state.volume}` : state.kind;
    if (now[output] === key) return;
    now[output] = key;
    rows.push({ ms, output, state });
  };
  let t = startMs;
  const end = options.stopStep ?? program.steps.length;
  program.steps.slice(0, end).forEach((step, i) => {
    for (const output of ["buzzer", "tone"] as const) {
      const value = step[output];
      if (value === undefined) continue;
      emit(
        t,
        output,
        value === null
          ? { kind: "off" }
          : {
              kind: "sounding",
              hz: value.hz,
              volume: options.volume ? options.volume(i, value) : value.volume,
            },
      );
    }
    if (step.vibrator !== undefined) emit(t, "vibrator", { kind: step.vibrator ? "on" : "off" });
    t += step.ms;
  });
  for (const output of ["buzzer", "tone", "vibrator"] as const) {
    if (now[output] !== "off") emit(t, output, { kind: "off" });
  }
  return rows;
}

/**
 * `renderProgram` with the buzzer's volume taken from `tables` at a level that changes over
 * time: `levels` lists `{ atMs, level }` (ms from the start, ascending; the first at 0). A note
 * sounding when the level changes takes the new volume at once (Task 0: Ascending, Level 5).
 */
export function renderAtLevels(
  program: SoundProgramData,
  startMs: number,
  tables: VolumeTables,
  levels: readonly { readonly atMs: number; readonly level: number }[],
): SoundRow[] {
  const levelAt = (t: number) => levels.filter((l) => l.atMs <= t).at(-1)!.level;
  const volume = (level: number, hz: number) => {
    const v = tables[String(level)]?.[String(hz)];
    if (v === undefined)
      throw new SoundProgramError(program.id, `no Level ${level} volume for ${hz} Hz`);
    return v;
  };
  let t = 0;
  const starts = program.steps.map((step) => {
    const at = t;
    t += step.ms;
    return at;
  });
  const rows = renderProgram(program, startMs, {
    volume: (i, out) => volume(levelAt(starts[i]!), out.hz),
  });
  // a level change inside a sounding note
  for (const { atMs, level } of levels.slice(1)) {
    const at = startMs + atMs;
    const sounding = rows.filter((r) => r.output === "buzzer" && r.ms <= at).at(-1);
    if (!sounding || sounding.state.kind !== "sounding" || sounding.ms === at) continue;
    const v = volume(level, sounding.state.hz);
    if (v === sounding.state.volume) continue;
    rows.push({ ms: at, output: "buzzer", state: { ...sounding.state, volume: v } });
  }
  const order = { buzzer: 0, tone: 1, vibrator: 2 } as const;
  return rows.sort((a, b) => a.ms - b.ms || order[a.output] - order[b.output]);
}

/** The buzzer and vibrator rows after the key's beep: a preview's own rows. */
export function previewRows(golden: SoundGolden, after = 300): SoundRow[] {
  return golden.rows.filter((r) => r.ms > after && r.output !== "tone");
}

/** Indices (in buzzer-note order) of the steps that start a buzzer note. */
function noteSteps(program: SoundProgramData): number[] {
  const out: number[] = [];
  program.steps.forEach((step, i) => {
    if (step.buzzer) out.push(i);
  });
  return out;
}

function notes(program: SoundProgramData): SoundOutputData[] {
  return program.steps.flatMap((s) => (s.buzzer ? [s.buzzer] : []));
}

// ---------------------------------------------------------------- the volume rule (D10)

/** Level → frequency → buzzer volume register, as captured. */
export type VolumeTables = Readonly<Record<string, Readonly<Record<string, number>>>>;

function setVolume(
  tables: Record<string, Record<string, number>>,
  level: number,
  output: SoundOutputData,
  where: string,
): void {
  const table = (tables[String(level)] ??= {});
  const key = String(output.hz);
  const had = table[key];
  if (had !== undefined && had !== output.volume) {
    throw new SoundProgramError(
      where,
      `Level ${level} at ${key} Hz is ${output.volume}, elsewhere ${had}: no table rule`,
    );
  }
  table[key] = output.volume;
}

/** The frequencies of a program's notes; a volume change within a note is the same note. */
function noteHz(program: SoundProgramData): number[] {
  const out: number[] = [];
  let sounding: number | null = null;
  for (const step of program.steps) {
    if (step.buzzer === undefined) continue;
    const hz = step.buzzer === null ? null : step.buzzer.hz;
    if (hz !== null && hz !== sounding) out.push(hz);
    sounding = hz;
  }
  return out;
}

/** The start time of each note of `noteHz` (a volume change within a note is the same note). */
export function noteStarts(program: SoundProgramData): number[] {
  const out: number[] = [];
  let sounding: number | null = null;
  let t = 0;
  for (const step of program.steps) {
    if (step.buzzer !== undefined) {
      const hz = step.buzzer === null ? null : step.buzzer.hz;
      if (hz !== null && hz !== sounding) out.push(t);
      sounding = hz;
    }
    t += step.ms;
  }
  return out;
}

/** Where in its notes a level change happens: note `note` (0-based), `offsetMs` into it. */
export interface NotePosition {
  readonly note: number;
  readonly offsetMs: number;
}

/** The position of time `t` (a step of `program` that sounds a note) among its notes. */
function notePosition(program: SoundProgramData, t: number, where: string): NotePosition {
  const starts = noteStarts(program);
  const note = starts.filter((start) => start <= t).length - 1;
  if (note < 0) throw new SoundProgramError(where, `no note sounds at ${t} ms`);
  return { note, offsetMs: t - starts[note]! };
}

/** Same frequencies, the last note aside (the preview's stop races it). */
function sameNotes(a: SoundProgramData, b: SoundProgramData): boolean {
  const x = noteHz(a);
  const y = noteHz(b);
  if (Math.abs(x.length - y.length) > 1) return false;
  return x.slice(0, Math.min(x.length, y.length)).every((hz, i) => hz === y[i]);
}

/**
 * The times (ms from the program's start) at which a recording's buzzer volume moves up one
 * level of `tables`, from `from` up to at most `to`; throws where a volume fits no level.
 */
function levelSteps(
  program: SoundProgramData,
  tables: VolumeTables,
  from: number,
  to: number,
  where: string,
): number[] {
  const out: number[] = [];
  let level = from;
  let t = 0;
  for (const step of program.steps) {
    const note = step.buzzer;
    if (note) {
      const at = (l: number) => tables[String(l)]?.[String(note.hz)];
      while (level < to && note.volume !== at(level) && note.volume === at(level + 1)) {
        level++;
        out.push(t);
      }
      if (note.volume !== at(level)) {
        throw new SoundProgramError(
          where,
          `${note.hz} Hz at ${note.volume} (${t} ms) is not Level ${level}`,
        );
      }
    }
    t += step.ms;
  }
  return out;
}

// ---------------------------------------------------------------- extraction

export interface RingingToneData {
  readonly name: string;
  readonly slug: string;
  /** The Ringing tone list preview at Level 4 (to the tone's second cycle mark). */
  readonly program: SoundProgramData;
  /** The step the Ringing volume list's preview of this tone stops at (its first mark). */
  readonly firstMarkStep: number;
  /** The tone's cycle (`@loop`): absent when the preview ends inside the first pass. */
  readonly cycleMs?: number;
  /**
   * Level 5: where the fifth table takes over from Level 4's, as a note of the tone and a time
   * into it (recordings of one tone drift, so a time from the preview's start would land on
   * another note).
   */
  readonly level5At: NotePosition;
  /** Ascending: where the level rises one step, Level 1 first (a note sounding changes at once). */
  readonly ascendingAt: readonly NotePosition[];
}

export interface SoundResourceData {
  readonly previewDelayMs: number;
  readonly messagePreviewDelayMs: number;
  readonly ringingTones: readonly RingingToneData[];
  readonly volumeTables: VolumeTables;
  readonly messageTones: Readonly<Record<string, SoundProgramData>>;
  /** Message Beep once: Ringing volume level → the DSP word of its tone (as captured). */
  readonly beepOnceLevels: Readonly<Record<string, number>>;
  /**
   * Message tones with Ringing volume unset (the virgin EEPROM): frequency → buzzer volume
   * (`sound/preview/virgin-message`; not Level 1's table).
   */
  readonly unsetMessageVolumes: Readonly<Record<string, number>>;
  readonly keypad: {
    readonly hz: number;
    /** Keypad tones level (`1`-`3`, `unset`) → DSP word; Off plays nothing. */
    readonly levels: Readonly<Record<string, number>>;
    readonly awakeMs: number;
    readonly wokenMs: number;
    /** The DSP powers down this long after the tone generator's last output ends. */
    readonly sleepAfterMs: number;
  };
  /** Note text → its warning tone (Warning tones On). */
  readonly noteSounds: Readonly<Record<string, SoundProgramData>>;
  readonly gameCues: {
    readonly eat: SoundProgramData;
    readonly crash: SoundProgramData;
    readonly topScore: SoundProgramData;
    readonly vibrateMs: number;
  };
  readonly bootTone: { readonly atMs: number; readonly program: SoundProgramData };
}

/** The DSP's power-down delay (Task 0, from the 0x900F word, n = 640: median 2966 ms). */
export const DSP_SLEEP_AFTER_MS = 2966;

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)]!;
};

/** The rows of a sounding note golden that are not the 900 Hz key beep: its warning tone. */
function warningRows(golden: SoundGolden): SoundRow[] {
  const isBeep = (r: SoundRow) =>
    r.output === "tone" && r.state.kind === "sounding" && r.state.hz === 900;
  const rows: SoundRow[] = [];
  let beeping = false;
  for (const row of golden.rows) {
    if (row.output === "tone") {
      if (isBeep(row)) {
        beeping = true;
        continue;
      }
      if (row.state.kind === "off" && beeping) {
        beeping = false;
        continue;
      }
      beeping = false; // the warning tone took over the beep
    }
    if (row.output !== "vibrator") rows.push(row);
  }
  // only the first warning tone (a key on the note sounds it again)
  const first = rows[0];
  if (!first) return [];
  const off = rows.find(
    (r) => r.output === first.output && r.state.kind === "off" && r.ms > first.ms,
  );
  return off ? [first, off] : [first];
}

/** Keypad beeps of a golden: [onset after its key, duration]. */
function beeps(golden: SoundGolden): { onset: number; duration: number; gap: number }[] {
  const out: { onset: number; duration: number; gap: number }[] = [];
  let lastEnd = -Infinity;
  golden.rows.forEach((row, i) => {
    if (row.output !== "tone" || row.state.kind !== "sounding" || row.state.hz !== 900) return;
    const end = golden.rows.slice(i + 1).find((r) => r.output === "tone");
    const key = [...(golden.keys ?? [])].reverse().find((k) => k.ms <= row.ms);
    if (!end || !key) return;
    out.push({ onset: row.ms - key.ms, duration: end.ms - row.ms, gap: row.ms - lastEnd });
    lastEnd = end.ms;
  });
  return out;
}

function toneProgram(id: string, rows: readonly SoundRow[]): SoundProgramData {
  return programFromRows(
    id,
    rows.map((r) => ({ ...r, ms: r.ms - rows[0]!.ms })),
  );
}

/**
 * Every program and rule, from the goldens `load` reads; `ids` lists the committed sound
 * goldens (for the note goldens, which are named after their first node).
 */
export function extractSoundResources(
  load: (id: string) => SoundGolden,
  ids: readonly string[],
): SoundResourceData {
  const tables: Record<string, Record<string, number>> = {};
  const delays: number[] = [];

  // the Ringing tone list previews (Level 4), their first marks and Level 5 jumps
  const tones = RINGING_TONE_NAMES.map((name, i) => {
    const slug = toneSlug(i + 1);
    const golden = load(`sound/ringing-tone/${slug}`);
    const rows = previewRows(golden);
    delays.push(rows[0]!.ms - (golden.keys?.[0]?.ms ?? 0));
    const program = toneProgram(`ringing-tone/${slug}`, rows);
    const played = notes(program);
    for (const note of played) setVolume(tables, 4, note, golden.id);

    const volume = load(`sound/ringing-volume/tone/${slug}`);
    const volumeNotes = notes(programFromRows(volume.id, previewRows(volume)));
    const toneHz = noteHz(program);
    if (!noteHz(toneProgram(volume.id, previewRows(volume))).every((hz, k) => hz === toneHz[k])) {
      throw new SoundProgramError(volume.id, "is not a prefix of the Ringing tone list preview");
    }
    const firstMarkStep = noteSteps(program)[volumeNotes.length] ?? program.steps.length;
    return { name, slug, program, firstMarkStep, cycleMs: golden.loop?.periodMs };
  });

  // Level 5: Level 4's table, then the fifth from one point on (its table first, then the points)
  const level5 = tones.map((tone) => {
    const golden = load(`sound/ringing-tone/level-5/${tone.slug}`);
    const program = toneProgram(golden.id, previewRows(golden));
    if (!sameNotes(program, tone.program)) {
      throw new SoundProgramError(golden.id, "plays other notes than Level 4");
    }
    const played = notes(program);
    const from = played.findIndex((n) => n.volume !== tables["4"]![String(n.hz)]);
    if (from < 0) throw new SoundProgramError(golden.id, "never leaves Level 4's table");
    for (const n of played.slice(from)) setVolume(tables, 5, n, golden.id);
    return program;
  });

  // Levels 1-3: the cover tones (D10); every level of Nokia tune from the Ringing volume list
  // (its Level 5 plays Level 4's table: one pass, before any jump)
  const levelPlays: [number, string, SoundProgramData][] = [];
  for (const nn of LEVEL_COVER_TONES) {
    for (const level of [1, 2, 3]) {
      levelPlays.push([
        level,
        `sound/ringing-tone/level-${level}/${toneSlug(nn)}`,
        tones[nn - 1]!.program,
      ]);
    }
  }
  for (const level of [1, 2, 3, 4, 5]) {
    levelPlays.push([level, `sound/ringing-volume/level-${level}`, tones[12]!.program]);
  }
  for (const [level, id, program] of levelPlays) {
    const played = toneProgram(id, previewRows(load(id)));
    const whole = noteHz(program);
    const same = id.startsWith("sound/ringing-volume/")
      ? noteHz(played).every((hz, k) => hz === whole[k]) // the list plays to the first mark
      : sameNotes(played, program);
    if (!same) throw new SoundProgramError(id, "plays other notes");
    for (const n of notes(played)) setVolume(tables, Math.min(level, 4), n, id);
  }

  // message tones (Level 4), Special at Level 1 and Standard at Level 5
  const messageTones: Record<string, SoundProgramData> = {};
  const messageDelays: number[] = [];
  for (const slug of ["standard", "special", "beep-once", "ascending"]) {
    const golden = load(`sound/message-tone/${slug}`);
    const rows = golden.rows.filter((r) => r.ms > 300);
    messageDelays.push(rows[0]!.ms);
    messageTones[slug] = toneProgram(`message-tone/${slug}`, rows);
  }
  for (const n of notes(messageTones.standard!))
    setVolume(tables, 4, n, "sound/message-tone/standard");
  for (const [level, id] of [
    [1, "sound/message-tone/special-l1"],
    [5, "sound/message-tone/standard-l5"],
  ] as const) {
    for (const n of notes(programFromRows(id, previewRows(load(id)))))
      setVolume(tables, level, n, id);
  }
  const toneWord = (id: string): number => {
    const row = load(id).rows.find(
      (r) => r.ms > 300 && r.output === "tone" && r.state.kind === "sounding",
    );
    if (!row || row.state.kind !== "sounding")
      throw new SoundProgramError(id, "has no Beep once tone");
    return row.state.volume;
  };
  const unsetMessageVolumes: Record<string, number> = {};
  for (const n of notes(
    programFromRows("preview/virgin-message", previewRows(load("sound/preview/virgin-message"))),
  )) {
    const had = unsetMessageVolumes[String(n.hz)];
    if (had !== undefined && had !== n.volume) {
      throw new SoundProgramError(
        "sound/preview/virgin-message",
        `${n.hz} Hz at ${n.volume} and ${had}`,
      );
    }
    unsetMessageVolumes[String(n.hz)] = n.volume;
  }
  const beepOnceLevels = {
    "1": toneWord("sound/message-tone/beep-once-ringing-l1"),
    "4": toneWord("sound/message-tone/beep-once"),
    "5": toneWord("sound/message-tone/beep-once-ringing-l5"),
  };

  // Ascending: Level 1 first, one level up at each point, capped at the stored Level 4
  const ringingTones: RingingToneData[] = tones.map((tone, i) => {
    const golden = load(`sound/alert/ascending/${tone.slug}`);
    const program = toneProgram(golden.id, previewRows(golden));
    if (!sameNotes(program, tone.program)) {
      throw new SoundProgramError(golden.id, `plays other notes than ${tone.name}`);
    }
    const level5Id = `sound/ringing-tone/level-5/${tone.slug}`;
    const jump = levelSteps(level5[i]!, tables, 4, 5, level5Id);
    if (jump.length !== 1) throw new SoundProgramError(tone.slug, "Level 5 needs exactly one jump");
    return {
      name: tone.name,
      slug: tone.slug,
      program: tone.program,
      firstMarkStep: tone.firstMarkStep,
      ...(tone.cycleMs !== undefined ? { cycleMs: tone.cycleMs } : {}),
      level5At: notePosition(level5[i]!, jump[0]!, level5Id),
      ascendingAt: levelSteps(program, tables, 1, 4, golden.id).map((t) =>
        notePosition(program, t, golden.id),
      ),
    };
  });

  // keypad tones
  const keypadLevels: Record<string, number> = {};
  const all: ReturnType<typeof beeps> = [];
  for (const [level, id] of [
    ["1", "sound/keypad/level-1"],
    ["2", "sound/keypad/level-2"],
    ["3", "sound/keypad/level-3"],
    ["unset", "sound/keypad/virgin"],
  ] as const) {
    const golden = load(id);
    const words = new Set(
      golden.rows.flatMap((r) =>
        r.output === "tone" && r.state.kind === "sounding" ? [r.state.volume] : [],
      ),
    );
    if (words.size !== 1) throw new SoundProgramError(id, `beeps at ${words.size} levels`);
    keypadLevels[level] = [...words][0]!;
    all.push(...beeps(golden));
  }
  if (load("sound/keypad/level-off").rows.some((r) => r.output === "tone")) {
    throw new SoundProgramError("sound/keypad/level-off", "Keypad tones Off beeps");
  }
  all.push(...beeps(load("sound/keypad/pair")), ...beeps(load("sound/keypad/list")));
  const woken = all.filter((b) => b.gap >= DSP_SLEEP_AFTER_MS);
  const awake = all.filter((b) => b.gap < DSP_SLEEP_AFTER_MS - 100);
  if (woken.length === 0 || awake.length === 0) {
    throw new SoundProgramError("sound/keypad/*", "no beeps either side of the DSP's sleep");
  }

  // warning tones by note text: every note golden whose note starts with its quoted text
  const noteSounds: Record<string, SoundProgramData> = {};
  for (const id of ids.filter((x) => x.startsWith("sound/note/")).sort()) {
    const golden = load(id);
    const text = /^"([^"]+)"/.exec(golden.note ?? "")?.[1];
    if (text === undefined) continue;
    const program = toneProgram(id, warningRows(golden));
    const seen = noteSounds[text];
    if (
      seen &&
      JSON.stringify(seen.steps.map((s) => ({ ...s, ms: 0 }))) !==
        JSON.stringify(program.steps.map((s) => ({ ...s, ms: 0 })))
    ) {
      throw new SoundProgramError(id, `"${text}" sounds unlike ${seen.id}`);
    }
    noteSounds[text] ??= program;
  }

  return {
    previewDelayMs: median(delays),
    messagePreviewDelayMs: median(messageDelays),
    ringingTones,
    volumeTables: tables,
    messageTones,
    beepOnceLevels,
    unsetMessageVolumes,
    keypad: {
      hz: 900,
      levels: keypadLevels,
      awakeMs: median(awake.map((b) => b.duration)),
      wokenMs: median(woken.map((b) => b.duration)),
      sleepAfterMs: DSP_SLEEP_AFTER_MS,
    },
    noteSounds,
    gameCues: gameCues(load),
    bootTone: bootTone(load("sound/boot/power-on")),
  };
}

function gameCues(load: (id: string) => SoundGolden): SoundResourceData["gameCues"] {
  const meal = load("sound/game/snake-meal");
  const buzz = meal.rows.filter((r) => r.output === "buzzer");
  const eat = programFromRows(
    "game/eat",
    buzz.slice(0, 2).map((r) => ({ ...r, ms: r.ms - buzz[0]!.ms })),
  );
  const vib = meal.rows.filter((r) => r.output === "vibrator");
  const vibrateMs = vib[1]!.ms - vib[0]!.ms;
  const crashGolden = load("sound/game/snake-crash");
  const crashRows = crashGolden.rows.filter((r) => r.output === "buzzer");
  const crash = programFromRows(
    "game/crash",
    crashRows.map((r) => ({ ...r, ms: r.ms - crashRows[0]!.ms })),
  );
  // the top score: the buzzer rows after the crash's three pulses
  const top = load("sound/game/snake-top-score").rows.filter((r) => r.output === "buzzer");
  const crashAt = top.findIndex((r) => r.state.kind === "sounding" && r.state.hz === 440);
  const fireworks = top.slice(crashAt + crashRows.length);
  const topScore = programFromRows(
    "game/top-score",
    fireworks.map((r) => ({ ...r, ms: r.ms - fireworks[0]!.ms })),
  );
  return { eat, crash, topScore, vibrateMs };
}

function bootTone(golden: SoundGolden): SoundResourceData["bootTone"] {
  const rows = golden.rows.filter((r) => r.output === "tone");
  if (rows.length !== 2) throw new SoundProgramError(golden.id, "expected one power-on tone");
  return {
    atMs: rows[0]!.ms,
    program: programFromRows(
      "boot/power-on",
      rows.map((r) => ({ ...r, ms: r.ms - rows[0]!.ms })),
    ),
  };
}
