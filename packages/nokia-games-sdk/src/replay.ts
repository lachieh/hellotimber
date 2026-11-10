// Replay goldens (plan 28 D11, "Replay goldens (`game-replay 1`)"): a session's start and keys, and
// what the game must then do. The game's wakes are not recorded: they follow from the start and the
// keys, so playing a replay reproduces every call.

import { decodeBase64, encodeBase64 } from "./base64";
import type { GameEffect, GameFonts, GameKey, GameModule, GameSound, GameStart } from "./contract";
import { GAME_DIGITS } from "./digits";
import { MAX_SESSION_MS, PACKED_FRAME_BYTES, SCREEN_HEIGHT, SCREEN_WIDTH } from "./limits";
import { unpackFrame } from "./screen";

/** One key event of a replay, at a session ms. */
export interface ReplayKey {
  readonly at: number;
  readonly key: GameKey;
  readonly down: boolean;
}

/** The packed frame standing at a session ms. */
export interface ReplayFrame {
  readonly at: number;
  readonly frame: Uint8Array;
}

export interface GameReplay {
  /** The manifest id of the game played. */
  readonly game: string;
  readonly start: GameStart;
  /** In order; ms never decrease. A wake due at a key's ms runs before the key. */
  readonly input: readonly ReplayKey[];
  /** The session ms the run ends at; it ends earlier at `over`. */
  readonly until: number;
  readonly note: string;
  /** Every effect, in order. */
  readonly effects: readonly GameEffect[];
  /** The frame standing at 0, every 10 000 ms, at every vibrate or over, and at the end. */
  readonly frames: readonly ReplayFrame[];
  /** FNV-1a (32-bit) over every distinct frame drawn: its ms (u32 LE), then its 504 bytes. */
  readonly hash: number;
}

/** Where a replay and a game part: the session ms (none for the hash) and a report to print. */
export interface ReplayMismatch {
  readonly at: number | undefined;
  readonly message: string;
}

export class ReplayFormatError extends Error {
  readonly file: string;
  readonly line: number;

  constructor(file: string, line: number, message: string) {
    super(`${file}:${line}: ${message}`);
    this.name = "ReplayFormatError";
    this.file = file;
    this.line = line;
  }
}

const FORMAT = "game-replay 1";
const CHECKPOINT_MS = 10_000;
const INTEGER = /^(0|[1-9][0-9]*)$/;
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const KEY_TOKEN = /^(0|[1-9][0-9]*):(up|down|[0-9*#])([+-]?)$/;
const HASH = /^@hash fnv1a32 0x([0-9a-f]{8})$/;
const UINT32_MAX = 0xffffffff;

function quote(text: string): string {
  return JSON.stringify(text);
}

function integer(text: string, max: number): number | undefined {
  if (!INTEGER.test(text)) return undefined;
  const value = Number(text);
  return value <= max ? value : undefined;
}

// --- keys ------------------------------------------------------------------------------------

/** Reads `400:6 2600:8+ 2750:8-`; throws with what is wrong. */
function keysOf(text: string, until: number): ReplayKey[] {
  const keys: ReplayKey[] = [];
  let last = 0;
  for (const token of text.split(" ").filter((part) => part !== "")) {
    const match = KEY_TOKEN.exec(token);
    const at = match ? integer(match[1]!, MAX_SESSION_MS) : undefined;
    if (!match || at === undefined) {
      throw new Error(`${quote(token)} is not a key such as 400:6, 400:up+ or 400:#-`);
    }
    if (at < last) throw new Error(`${quote(token)} comes before ${last} ms: input is in order`);
    if (at > until) throw new Error(`${quote(token)} comes after the end at ${until} ms`);
    last = at;
    const key = match[2] as GameKey;
    if (match[3] !== "-") keys.push({ at, key, down: true });
    if (match[3] !== "+") keys.push({ at, key, down: false });
  }
  return keys;
}

function keysText(keys: readonly ReplayKey[]): string {
  const tokens: string[] = [];
  for (let i = 0; i < keys.length; i++) {
    const { at, key, down } = keys[i]!;
    const next = keys[i + 1];
    if (down && next && !next.down && next.at === at && next.key === key) {
      tokens.push(`${at}:${key}`);
      i++;
    } else tokens.push(`${at}:${key}${down ? "+" : "-"}`);
  }
  return tokens.join(" ");
}

// --- effects ---------------------------------------------------------------------------------

function soundText(sound: GameSound): string {
  if (typeof sound === "string") return sound;
  return ["notes", ...sound.notes.map((note) => `${note.hz}x${note.ms}`)].join(" ");
}

/** An effect's kind and value, as the `@effects` table writes them. */
function effectFields(effect: GameEffect): readonly [string, string] {
  switch (effect.kind) {
    case "sound":
      return ["sound", soundText(effect.sound)];
    case "vibrate":
      return ["vibrate", String(effect.ms)];
    case "save":
      return ["save", effect.bytes.length === 0 ? "-" : encodeBase64(effect.bytes)];
    case "over":
      return ["over", effect.score === undefined ? "-" : String(effect.score)];
  }
}

function effectText(effect: GameEffect | undefined): string {
  return effect ? [effect.at, ...effectFields(effect)].join(" ") : "(none)";
}

function effectOf(at: number, kind: string, values: readonly string[]): GameEffect {
  const [value, ...rest] = values;
  switch (kind) {
    case "sound": {
      if ((value === "eat" || value === "crash") && rest.length === 0) {
        return { kind, at, sound: value };
      }
      if (value !== "notes")
        throw new Error(`sound ${quote(values.join(" "))} is not eat, crash or notes`);
      const notes = rest.map((note) => {
        const [hz, ms, more] = note
          .split("x")
          .map((part) => integer(part, Number.MAX_SAFE_INTEGER));
        if (!hz || !ms || more !== undefined || note.split("x").length !== 2) {
          throw new Error(`${quote(note)} is not a note such as 440x100`);
        }
        return { hz, ms };
      });
      return { kind, at, sound: { notes } };
    }
    case "vibrate": {
      const ms = value === undefined ? undefined : integer(value, Number.MAX_SAFE_INTEGER);
      if (!ms || rest.length > 0) throw new Error("vibrate takes a positive whole number of ms");
      return { kind, at, ms };
    }
    case "save": {
      if (value === undefined || rest.length > 0) throw new Error("save takes base64 bytes, or -");
      try {
        return { kind, at, bytes: value === "-" ? new Uint8Array(0) : decodeBase64(value) };
      } catch {
        throw new Error(`save ${quote(value)} is not base64`);
      }
    }
    case "over": {
      const score =
        value === undefined || value === "-" ? undefined : integer(value, MAX_SESSION_MS);
      if (value === undefined || rest.length > 0 || (value !== "-" && score === undefined)) {
        throw new Error("over takes a score, or -");
      }
      return { kind, at, score };
    }
    default:
      throw new Error(`${quote(kind)} is not an effect: sound, vibrate, save or over`);
  }
}

// --- frames ----------------------------------------------------------------------------------

function frameRows(frame: Uint8Array): string[] {
  const pixels = unpackFrame(frame);
  const rows: string[] = [];
  for (let y = 0; y < SCREEN_HEIGHT; y++) {
    let row = "";
    for (let x = 0; x < SCREEN_WIDTH; x++) row += pixels[y * SCREEN_WIDTH + x] === 1 ? "#" : ".";
    rows.push(row);
  }
  return rows;
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** FNV-1a over each frame's ms (u32, little-endian) and bytes. */
function hashFrames(frames: readonly ReplayFrame[]): number {
  let hash = 0x811c9dc5;
  const mix = (byte: number): void => {
    hash = Math.imul(hash ^ byte, 0x01000193);
  };
  for (const { at, frame } of frames) {
    for (let shift = 0; shift < 32; shift += 8) mix((at >>> shift) & 0xff);
    for (let i = 0; i < frame.length; i++) mix(frame[i]!);
  }
  return hash >>> 0;
}

function hashText(hash: number): string {
  return `0x${hash.toString(16).padStart(8, "0")}`;
}

// --- the text format -------------------------------------------------------------------------

/** Reads a `game-replay 1` file. Errors are `file:line: message`. */
export function parseReplay(text: string, file = "replay"): GameReplay {
  const lines = text.split("\n");
  // A final newline leaves one empty string, which is the end of the file, not a line.
  if (lines.at(-1) === "") lines.pop();
  let index = 0;
  const fail = (message: string, line = index + 1): never => {
    throw new ReplayFormatError(file, line, message);
  };
  const found = (): string => (index < lines.length ? quote(lines[index]!) : "the end of the file");
  /** Runs a reader on the current line, reporting what it throws against that line. */
  const read = <T>(reader: () => T): T => {
    try {
      return reader();
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error));
    }
  };
  const literal = (expected: string, what = quote(expected)): void => {
    if (lines[index] !== expected) fail(`expected ${what}, found ${found()}`);
    index++;
  };
  const header = <T>(key: string, value: (text: string) => T | undefined, expected: string): T => {
    const line = lines[index];
    if (line === undefined || !(line === `${key}:` || line.startsWith(`${key}: `))) {
      fail(`expected ${quote(`${key}:`)}, found ${found()}`);
    }
    const parsed = read(() => value(line!.slice(key.length + 2)));
    if (parsed === undefined)
      fail(`${key} is ${expected}, not ${quote(line!.slice(key.length + 2))}`);
    index++;
    return parsed as T;
  };

  literal(FORMAT);
  const game = header("game", (value) => (KEBAB.test(value) ? value : undefined), "a game id");
  const seed = header("seed", (value) => integer(value, UINT32_MAX), "a uint32");
  const level = header(
    "level",
    (value) => integer(value, Number.MAX_SAFE_INTEGER) || undefined,
    "a positive integer",
  );
  const mode = header("mode", (value) => value, "text");
  const choices = header(
    "choices",
    (value) => {
      const record: Record<string, number> = {};
      for (const token of value.split(" ").filter((part) => part !== "")) {
        const [slug, option, more] = token.split("=");
        const chosen = option === undefined ? undefined : integer(option, Number.MAX_SAFE_INTEGER);
        if (!slug || !KEBAB.test(slug) || chosen === undefined || more !== undefined) {
          throw new Error(`${quote(token)} is not a choice such as board=0`);
        }
        if (Object.hasOwn(record, slug)) throw new Error(`choice ${quote(slug)} is given twice`);
        record[slug] = chosen;
      }
      return record;
    },
    "choices",
  );
  const topScore = header("top-score", (value) => integer(value, MAX_SESSION_MS), "a score");
  const storage = header(
    "storage",
    (value) => {
      try {
        return decodeBase64(value);
      } catch {
        return undefined;
      }
    },
    "base64 bytes",
  );
  // The keys are checked against `until`, which the next line holds.
  const inputLine = index;
  const inputText = header("input", (value) => value, "keys");
  const until = header("until", (value) => integer(value, MAX_SESSION_MS), "a whole session ms");
  const input = ((): ReplayKey[] => {
    try {
      return keysOf(inputText, until);
    } catch (error) {
      return fail((error as Error).message, inputLine + 1);
    }
  })();
  const note = header("note", (value) => value, "text");

  literal("", "a blank line");
  literal("@effects");
  const effects: GameEffect[] = [];
  for (; index < lines.length && lines[index] !== ""; index++) {
    const line = lines[index]!;
    if (line.startsWith("#")) continue;
    const [ms, kind, ...values] = line.split(" ").filter((part) => part !== "");
    const at = integer(ms!, MAX_SESSION_MS);
    if (at === undefined || kind === undefined)
      fail(`an effect is "<ms> <kind> <value>", not ${quote(line)}`);
    const last = effects.at(-1)?.at ?? 0;
    if (at! < last)
      fail(`an effect at ${at} ms comes after one at ${last} ms: effects are in order`);
    effects.push(read(() => effectOf(at!, kind!, values)));
  }

  literal("", "a blank line");
  literal("@frames");
  const frames: ReplayFrame[] = [];
  while (index < lines.length && lines[index] !== "") {
    const label = /^t(0|[1-9][0-9]*)$/.exec(lines[index]!);
    const at = label ? integer(label[1]!, MAX_SESSION_MS) : undefined;
    if (at === undefined) fail(`expected a frame label t<ms>, found ${found()}`);
    const last = frames.at(-1);
    if (last && at! <= last.at) fail(`frame t${at} comes after t${last.at}: frames are in order`);
    index++;
    const frame = new Uint8Array(PACKED_FRAME_BYTES);
    for (let y = 0; y < SCREEN_HEIGHT; y++, index++) {
      const row = lines[index];
      if (row === undefined || row === "" || row.startsWith("t") || row.startsWith("@")) {
        fail(`a frame is 48 rows; t${at} has ${y} before ${found()}`);
      }
      if (!/^[#.]{84}$/.test(row!)) fail(`a frame row is 84 of # and ., not ${quote(row!)}`);
      for (let x = 0; x < SCREEN_WIDTH; x++) {
        const bit = y * SCREEN_WIDTH + x;
        if (row![x] === "#") frame[bit >> 3]! |= 0x80 >> (bit & 7);
      }
    }
    frames.push({ at: at!, frame });
  }

  literal("", "a blank line");
  const hash = HASH.exec(lines[index] ?? "");
  if (!hash) fail(`expected "@hash fnv1a32 0x<8 hex digits>", found ${found()}`);
  index++;
  if (index < lines.length) fail(`expected the end of the file, found ${found()}`);

  return {
    game,
    start: { mode, level, choices, seed, topScore, storage },
    input,
    until,
    note,
    effects,
    frames,
    hash: Number.parseInt(hash![1]!, 16),
  };
}

/** A value that fits on its header line and reads back as written. */
function headerText(key: string, value: string): string {
  if (/[\n\r]/.test(value) || value !== value.trim()) {
    throw new Error(`A replay's ${key} is one line without spaces at its ends: ${quote(value)}`);
  }
  return value === "" ? `${key}:` : `${key}: ${value}`;
}

/** Writes the canonical `game-replay 1` text, which `parseReplay` reads back to an equal replay. */
export function serializeReplay(replay: GameReplay): string {
  const { start } = replay;
  const choices = Object.keys(start.choices)
    .sort()
    .map((slug) => `${slug}=${start.choices[slug]}`)
    .join(" ");
  const msWidth = Math.max(5, ...replay.effects.map((effect) => String(effect.at).length)) + 2;
  const lines = [
    FORMAT,
    headerText("game", replay.game),
    `seed: ${start.seed}`,
    `level: ${start.level}`,
    headerText("mode", start.mode),
    headerText("choices", choices),
    `top-score: ${start.topScore}`,
    headerText("storage", encodeBase64(start.storage)),
    headerText("input", keysText(replay.input)),
    `until: ${replay.until}`,
    headerText("note", replay.note),
    "",
    "@effects",
    `${"# ms".padEnd(msWidth)}${"kind".padEnd(8)}value`,
    ...replay.effects.map((effect) => {
      const [kind, value] = effectFields(effect);
      return `${String(effect.at).padEnd(msWidth)}${kind.padEnd(8)}${value}`;
    }),
    "",
    "@frames",
    ...replay.frames.flatMap(({ at, frame }) => [`t${at}`, ...frameRows(frame)]),
    "",
    `@hash fnv1a32 ${hashText(replay.hash)}`,
    "",
  ];
  return lines.join("\n");
}

// --- playing ---------------------------------------------------------------------------------

interface Run {
  readonly effects: readonly GameEffect[];
  /** Every distinct frame drawn, with the ms of the call that drew it. */
  readonly drawn: readonly ReplayFrame[];
  /** The keys delivered before the run ended. */
  readonly played: readonly ReplayKey[];
  /** The session ms the run ended at: `until`, or earlier at `over` or a failure. */
  readonly end: number;
  readonly failure: string | undefined;
}

/**
 * Plays keys into a fresh session. The session is advanced to each wake at its own time, so every
 * frame is seen with the ms it was drawn at; `advanceMs` adds calls on that grid.
 */
function run(
  module: GameModule,
  start: GameStart,
  input: readonly ReplayKey[],
  until: number,
  fonts: GameFonts,
  advanceMs: number | undefined,
): Run {
  if (advanceMs !== undefined && !(Number.isInteger(advanceMs) && advanceMs > 0)) {
    throw new RangeError(`advanceMs is a positive whole number of ms, not ${advanceMs}`);
  }
  const session = module.start(start, fonts);
  const effects: GameEffect[] = [];
  const drawn: ReplayFrame[] = [];
  let end = 0;
  let over = false;

  /** Collects what the call at `at` produced. */
  const observe = (at: number): void => {
    end = at;
    const frame = session.frame();
    const last = drawn.at(-1);
    if (frame && !(last && sameBytes(last.frame, frame))) drawn.push({ at, frame: frame.slice() });
    for (const effect of session.drain()) {
      effects.push(effect);
      over ||= effect.kind === "over";
    }
  };

  try {
    observe(0);
    let next = 0;
    let grid = advanceMs ?? Number.POSITIVE_INFINITY;
    while (!over && session.failure === undefined) {
      const wake = session.wake() ?? Number.POSITIVE_INFINITY;
      const key = input[next];
      const at = Math.min(wake, key?.at ?? Number.POSITIVE_INFINITY, grid, until);
      // At one ms: the wake first, then the grid's call, then the keys in their order.
      if (wake === at) {
        session.advance(at);
        // A session that leaves a due wake standing would be asked for it for ever.
        if ((session.wake() ?? Number.POSITIVE_INFINITY) <= at) {
          throw new Error(`The session did not run its wake at ${at} ms`);
        }
      } else if (grid === at) {
        session.advance(at);
        grid += advanceMs!;
      } else if (key?.at === at) {
        if (key.down) session.keyDown(key.key, at);
        else session.keyUp(key.key, at);
        next++;
      } else {
        session.advance(until);
        observe(until);
        break;
      }
      observe(at);
    }
    return { effects, drawn, played: input.slice(0, next), end, failure: session.failure };
  } finally {
    session.dispose();
  }
}

/** The frames a replay holds: at 0, every 10 000 ms, at every vibrate or over, and at the end. */
function checkpoints(result: Run): ReplayFrame[] {
  const times = new Set<number>([0, result.end]);
  for (let at = CHECKPOINT_MS; at < result.end; at += CHECKPOINT_MS) times.add(at);
  for (const effect of result.effects) {
    if (effect.kind === "vibrate" || effect.kind === "over") times.add(effect.at);
  }
  const frames: ReplayFrame[] = [];
  let index = 0;
  for (const at of [...times].sort((a, b) => a - b)) {
    // The frame standing at `at` is the last one drawn at or before it.
    while (index + 1 < result.drawn.length && result.drawn[index + 1]!.at <= at) index++;
    const standing = result.drawn[index];
    if (standing && standing.at <= at) frames.push({ at, frame: standing.frame });
  }
  return frames;
}

function keysFrom(input: readonly ReplayKey[] | string, until: number): readonly ReplayKey[] {
  if (!Number.isInteger(until) || until < 0 || until > MAX_SESSION_MS) {
    throw new RangeError(`until is a session ms in 0..${MAX_SESSION_MS}, not ${until}`);
  }
  // A list goes through the text form too, so both are held to the same rules.
  return keysOf(typeof input === "string" ? input : keysText(input), until);
}

export interface RecordReplayOptions {
  /** The fonts the game gets (default: only GAME_DIGITS). */
  readonly fonts?: GameFonts;
  readonly note?: string;
}

/**
 * Plays `input` (a list, or text such as `400:6 2600:8+ 2750:8-`) into a new session until
 * `until` ms and returns the replay of what the game did. The replay's `until` is where the run
 * ended, and its input the keys played by then. Throws if the game fails.
 */
export function recordReplay(
  module: GameModule,
  start: GameStart,
  input: readonly ReplayKey[] | string,
  until: number,
  options: RecordReplayOptions = {},
): GameReplay {
  const fonts = options.fonts ?? { game: GAME_DIGITS };
  const result = run(module, start, keysFrom(input, until), until, fonts, undefined);
  if (result.failure !== undefined) {
    throw new Error(`${module.manifest.id} failed at ${result.end} ms: ${result.failure}`);
  }
  return {
    game: module.manifest.id,
    start: { ...start, choices: { ...start.choices }, storage: start.storage.slice() },
    input: result.played,
    until: result.end,
    note: options.note ?? "",
    effects: result.effects,
    frames: checkpoints(result),
    hash: hashFrames(result.drawn),
  };
}

function frameMismatch(at: number, replay: Uint8Array, game: Uint8Array): string {
  const expected = frameRows(replay);
  const actual = frameRows(game);
  const rows: string[] = [];
  let extra = 0;
  let missing = 0;
  let first = "";
  for (let y = 0; y < SCREEN_HEIGHT; y++) {
    let row = "";
    for (let x = 0; x < SCREEN_WIDTH; x++) {
      const inGame = actual[y]![x] === "#";
      const inReplay = expected[y]![x] === "#";
      row += inGame ? (inReplay ? "#" : "+") : inReplay ? "-" : ".";
      if (inGame === inReplay) continue;
      if (inGame) extra++;
      else missing++;
      first ||= `(x=${x}, y=${y})`;
    }
    if (actual[y] !== expected[y]) rows.push(`${`y=${y}`.padEnd(6)}${row}`);
  }
  return [
    `frame t${at} differs: ${extra + missing} px (${extra} only in the game, ${missing} only in the replay); first at ${first}`,
    "# both  + only the game  - only the replay  . neither",
    ...rows,
  ].join("\n");
}

export interface CheckReplayOptions {
  /** Also call `advance` on this grid of ms, which must change nothing (D11). */
  readonly advanceMs?: number;
  /** The fonts the game gets (default: only GAME_DIGITS). */
  readonly fonts?: GameFonts;
}

/**
 * Plays a replay into a new session and reports the first effect or frame that differs, with its
 * ms; undefined when the game does exactly what the replay holds. Replays are exact (D11).
 */
export function checkReplay(
  module: GameModule,
  replay: GameReplay,
  options: CheckReplayOptions = {},
): ReplayMismatch | undefined {
  if (replay.game !== module.manifest.id) {
    throw new Error(`The replay is of ${quote(replay.game)}, not of ${quote(module.manifest.id)}`);
  }
  const fonts = options.fonts ?? { game: GAME_DIGITS };
  const result = run(module, replay.start, replay.input, replay.until, fonts, options.advanceMs);
  if (result.failure !== undefined) {
    return {
      at: result.end,
      message: `the game failed at ${result.end} ms: ${result.failure}`,
    };
  }

  const found: ReplayMismatch[] = [];
  for (let i = 0; i < Math.max(replay.effects.length, result.effects.length); i++) {
    const expected = replay.effects[i];
    const actual = result.effects[i];
    if (effectText(expected) === effectText(actual)) continue;
    const at = Math.min(
      expected?.at ?? Number.POSITIVE_INFINITY,
      actual?.at ?? Number.POSITIVE_INFINITY,
    );
    found.push({
      at,
      message: [
        `effect ${i + 1} differs at ${at} ms`,
        `  replay: ${effectText(expected)}`,
        `  game:   ${effectText(actual)}`,
      ].join("\n"),
    });
    break;
  }
  const frames = checkpoints(result);
  for (let i = 0; i < Math.max(replay.frames.length, frames.length); i++) {
    const expected = replay.frames[i];
    const actual = frames[i];
    if (expected && actual && expected.at === actual.at) {
      if (sameBytes(expected.frame, actual.frame)) continue;
      found.push({
        at: actual.at,
        message: frameMismatch(actual.at, expected.frame, actual.frame),
      });
      break;
    }
    const label = (frame: ReplayFrame | undefined): string => (frame ? `t${frame.at}` : "none");
    found.push({
      at: Math.min(
        expected?.at ?? Number.POSITIVE_INFINITY,
        actual?.at ?? Number.POSITIVE_INFINITY,
      ),
      message: `frame ${i + 1} is ${label(expected)} in the replay, and the game's is ${label(actual)}`,
    });
    break;
  }
  if (found.length > 0) return found.reduce((first, next) => (next.at! < first.at! ? next : first));

  const hash = hashFrames(result.drawn);
  if (hash === replay.hash) return undefined;
  return {
    at: undefined,
    message: `@hash differs: the replay has ${hashText(replay.hash)}, the game gives ${hashText(hash)}. Every effect and checkpoint frame matches, so a frame between two checkpoints differs, or the ms it was drawn at.`,
  };
}
