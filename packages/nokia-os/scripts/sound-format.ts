// Sound golden fixture format (`*.sound.txt`, plan 16 D6): parse, validate and serialize.
//
// A sound golden is a captured event timeline of the phone's three outputs (buzzer, tone
// generator, vibrator), aligned on the recording's first key-down. Shared by the capture importer
// (Node type stripping), the tests and the generators, so it imports only sibling scripts.
import { GoldenFormatError, INPUT_KEYS, type GoldenStatus } from "./golden-format.ts";

export const SOUND_MAGIC = "sound-golden 1";
const EVENTS_HEADER = "# t_ms output   state";

export type SoundOutputName = "buzzer" | "tone" | "vibrator";
export const SOUND_OUTPUTS: readonly SoundOutputName[] = ["buzzer", "tone", "vibrator"];

/**
 * An output's state. `sounding`: the buzzer (13 MHz / divider, rounded to 0.1 Hz) or the tone
 * generator (its first oscillator; `hz2` the second, lit for DTMF pairs only) at `volume`, the
 * firmware's level register as captured (buzzer: MAD2 PUP 0x1E; tone: the DSP word at 0x100A8).
 */
export type SoundState =
  | { readonly kind: "off" }
  | { readonly kind: "on" }
  | {
      readonly kind: "sounding";
      readonly hz: number;
      readonly hz2?: number;
      readonly volume: number;
    };

export interface SoundRow {
  readonly ms: number;
  readonly output: SoundOutputName;
  readonly state: SoundState;
}

/** A key-down of the recording at `ms`; `holdMs` when the key was held (not a tap). */
export interface SoundKey {
  readonly ms: number;
  readonly key: string;
  readonly holdMs?: number;
}

export interface SoundOmission {
  readonly count: number;
  readonly reason: string;
}

/** The recording's repeat: the rows from `startMs` repeat every `periodMs` (the last pass may stop early). */
export interface SoundLoop {
  readonly startMs: number;
  readonly periodMs: number;
}

export interface SoundGolden {
  readonly id: string;
  readonly status: GoldenStatus;
  readonly source: string;
  readonly sourceSha256: string;
  /** `virgin`, `factory` or the REF image name the recording started from. */
  readonly state: string;
  readonly keys?: readonly SoundKey[];
  readonly note?: string;
  readonly omitted: readonly SoundOmission[];
  readonly rows: readonly SoundRow[];
  readonly loop?: SoundLoop;
}

const ID = /^sound\/[a-z0-9][a-z0-9./-]*$/;
const STATUS = /^(asserted|pending:[a-z0-9-]+)$/;
const SHA256 = /^[0-9a-f]{64}$/;
const STATE = /^[a-z0-9][a-z0-9.-]*$/;
const INTEGER = /^(0|[1-9][0-9]*)$/;
const SIGNED = /^-?(0|[1-9][0-9]*)$/;
const HZ = /^(0|[1-9][0-9]*)(\.[0-9])?$/;
const KEY = /^(0|[1-9][0-9]*):([^+\s]+)(?:\+([1-9][0-9]*))?$/;
const OMISSION = /^([1-9][0-9]*) \(([^()]+)\)$/;
const SOUNDING = /^(\S+?)(?:\+(\S+))? v=(\S+)$/;

// ---------------------------------------------------------------- serialize

export function formatSoundState(output: SoundOutputName, state: SoundState): string {
  if (state.kind !== "sounding") return state.kind;
  const hz = `${formatHz(state.hz)}${state.hz2 !== undefined ? `+${formatHz(state.hz2)}` : ""}`;
  return `${hz} v=${formatVolume(output, state.volume)}`;
}

function formatHz(hz: number): string {
  return Number.isInteger(hz) ? String(hz) : hz.toFixed(1);
}

/** Buzzer volumes are decimal (PUP 0x1E); tone levels are the 16-bit DSP word in hex. */
function formatVolume(output: SoundOutputName, volume: number): string {
  return output === "tone"
    ? `0x${volume.toString(16).toUpperCase().padStart(4, "0")}`
    : String(volume);
}

export function serializeSoundGolden(golden: SoundGolden): string {
  const out = [
    SOUND_MAGIC,
    `id: ${golden.id}`,
    `status: ${golden.status}`,
    `source: ${golden.source}`,
    `source-sha256: ${golden.sourceSha256}`,
    `state: ${golden.state}`,
  ];
  if (golden.keys !== undefined) {
    out.push(
      `keys: ${golden.keys.map((k) => `${k.ms}:${k.key}${k.holdMs !== undefined ? `+${k.holdMs}` : ""}`).join(" ")}`,
    );
  }
  if (golden.note !== undefined) out.push(`note: ${golden.note}`);
  out.push(
    `omitted: ${
      golden.omitted.length === 0
        ? "none"
        : golden.omitted.map((o) => `${o.count} (${o.reason})`).join(", ")
    }`,
  );
  out.push("", "@events", EVENTS_HEADER);
  for (const row of golden.rows) {
    out.push(
      `${String(row.ms).padEnd(7)}${row.output.padEnd(9)}${formatSoundState(row.output, row.state)}`,
    );
  }
  if (golden.loop) out.push(`@loop ${golden.loop.startMs} ${golden.loop.periodMs}`);
  out.push("");
  return out.join("\n");
}

// ---------------------------------------------------------------- parse

export function parseSoundGolden(text: string, file: string): SoundGolden {
  const lines = text.split("\n");
  let index = 0;
  const fail = (lineIndex: number, message: string): never => {
    throw new GoldenFormatError(file, lineIndex + 1, message);
  };
  if (lines[0] !== SOUND_MAGIC) fail(0, `expected "${SOUND_MAGIC}", got "${lines[0] ?? ""}"`);
  index = 1;
  const header = (key: string, optional: boolean): { value: string; line: number } | undefined => {
    const line = lines[index] ?? "";
    if (line.startsWith(`${key}: `)) {
      index++;
      return { value: line.slice(key.length + 2), line: index - 1 };
    }
    if (optional) return undefined;
    return fail(index, `expected header "${key}: …", got "${line}"`);
  };

  const id = header("id", false)!;
  if (!ID.test(id.value)) fail(id.line, `id must match ${ID.source}, got "${id.value}"`);
  const status = header("status", false)!;
  if (!STATUS.test(status.value)) {
    fail(status.line, `status must be "asserted" or "pending:<plan>", got "${status.value}"`);
  }
  const source = header("source", false)!;
  const sha = header("source-sha256", false)!;
  if (!SHA256.test(sha.value)) fail(sha.line, "source-sha256 must be 64 lowercase hex digits");
  const state = header("state", false)!;
  if (!STATE.test(state.value)) {
    fail(state.line, `state must be "virgin", "factory" or an image name, got "${state.value}"`);
  }
  const keysLine = header("keys", true);
  const keys = keysLine ? parseKeys(keysLine.value, (m) => fail(keysLine.line, m)) : undefined;
  const note = header("note", true);
  const omittedLine = header("omitted", false)!;
  const omitted = parseOmitted(omittedLine.value);
  if (!omitted) {
    fail(omittedLine.line, 'omitted must be "none" or a comma list of "<count> (<reason>)"');
  }
  if (lines[index] !== "")
    fail(index, `expected a blank line after the header, got "${lines[index]}"`);
  index++;
  if (lines[index] !== "@events") fail(index, 'expected "@events"');
  index++;
  if (lines[index] !== EVENTS_HEADER) fail(index, `expected the column header "${EVENTS_HEADER}"`);
  index++;

  const rows: SoundRow[] = [];
  const last = new Map<SoundOutputName, string>();
  for (; index < lines.length && lines[index] !== "" && !lines[index]!.startsWith("@"); index++) {
    const row = parseRow(lines[index]!, (m) => fail(index, m));
    const previous = rows.at(-1);
    if (previous !== undefined && row.ms < previous.ms) {
      fail(index, `times must not decrease: ${row.ms} after ${previous.ms}`);
    }
    if (keys === undefined && row.ms < 0) fail(index, "times may not be negative without keys");
    const text = formatSoundState(row.output, row.state);
    if (last.get(row.output) === text) {
      fail(index, `${row.output} repeats its previous state "${text}"`);
    }
    last.set(row.output, text);
    rows.push(row);
  }

  let loop: SoundLoop | undefined;
  if ((lines[index] ?? "").startsWith("@loop")) {
    const match = /^@loop (\S+) (\S+)$/.exec(lines[index]!);
    if (!match || !INTEGER.test(match[1]!) || !INTEGER.test(match[2]!) || Number(match[2]) === 0) {
      fail(
        index,
        `expected "@loop <start_ms> <period_ms>" with a positive period, got "${lines[index]}"`,
      );
    }
    loop = { startMs: Number(match![1]), periodMs: Number(match![2]) };
    if (!rows.some((row) => row.ms === loop!.startMs)) {
      fail(index, `@loop starts at ${loop.startMs}, which is no row's time`);
    }
    index++;
  }
  if (lines.slice(index).some((line) => line !== ""))
    fail(index, "unexpected content after @events");

  return {
    id: id.value,
    status: status.value as GoldenStatus,
    source: source.value,
    sourceSha256: sha.value,
    state: state.value,
    ...(keys !== undefined ? { keys } : {}),
    ...(note ? { note: note.value } : {}),
    omitted: omitted!,
    rows,
    ...(loop ? { loop } : {}),
  };
}

function parseKeys(value: string, fail: (message: string) => never): SoundKey[] {
  const out: SoundKey[] = [];
  for (const part of value.split(" ")) {
    const match = KEY.exec(part);
    if (!match) fail(`keys must be space-separated <t_ms>:<key>[+<hold_ms>], got "${part}"`);
    const ms = Number(match![1]);
    const key = match![2]!;
    if (!INPUT_KEYS.includes(key)) {
      fail(`key must be a phone key (0-9, *, #, up, down, navi, c, power), got "${key}"`);
    }
    const previous = out.at(-1);
    if (previous !== undefined && ms < previous.ms) {
      fail(`key times must ascend: ${ms} after ${previous.ms}`);
    }
    out.push({ ms, key, ...(match![3] !== undefined ? { holdMs: Number(match![3]) } : {}) });
  }
  if (out[0]?.ms !== 0) fail("the first key is time 0");
  return out;
}

function parseOmitted(value: string): SoundOmission[] | undefined {
  if (value === "none") return [];
  const out: SoundOmission[] = [];
  for (const part of value.split(", ")) {
    const match = OMISSION.exec(part);
    if (!match) return undefined;
    out.push({ count: Number(match[1]), reason: match[2]! });
  }
  return out;
}

function parseRow(line: string, fail: (message: string) => never): SoundRow {
  const match = /^(\S+)\s+(\S+)\s+(.+)$/.exec(line);
  if (!match) return fail(`expected "<t_ms> <output> <state>", got "${line}"`);
  const [, msText, outputText, stateText] = match as unknown as [string, string, string, string];
  if (!SIGNED.test(msText)) fail(`t_ms must be an integer, got "${msText}"`);
  if (!SOUND_OUTPUTS.includes(outputText as SoundOutputName)) {
    fail(`output must be buzzer, tone or vibrator, got "${outputText}"`);
  }
  const output = outputText as SoundOutputName;
  return { ms: Number(msText), output, state: parseState(output, stateText, fail) };
}

function parseState(
  output: SoundOutputName,
  text: string,
  fail: (message: string) => never,
): SoundState {
  if (text === "off") return { kind: "off" };
  if (text === "on") {
    if (output !== "vibrator")
      fail(`"on" is the vibrator's state; ${output} needs "<hz> v=<volume>"`);
    return { kind: "on" };
  }
  if (output === "vibrator") return fail(`the vibrator is "on" or "off", got "${text}"`);
  const match = SOUNDING.exec(text);
  if (!match) return fail(`state must be "off" or "<hz> v=<volume>", got "${text}"`);
  const [, hzText, hz2Text, volumeText] = match as unknown as [
    string,
    string,
    string | undefined,
    string,
  ];
  for (const value of [hzText, hz2Text]) {
    if (value !== undefined && (!HZ.test(value) || Number(value) === 0)) {
      fail(`frequency must be positive with at most one decimal, got "${value}"`);
    }
  }
  if (hz2Text !== undefined && output !== "tone")
    fail("only the tone generator plays two frequencies");
  const volume =
    output === "tone"
      ? /^0x[0-9A-F]{4}$/.test(volumeText)
        ? Number.parseInt(volumeText.slice(2), 16)
        : fail(`a tone volume is the DSP word as 0xHHHH, got "${volumeText}"`)
      : INTEGER.test(volumeText)
        ? Number(volumeText)
        : fail(`a buzzer volume is a decimal register value, got "${volumeText}"`);
  return {
    kind: "sounding",
    hz: Number(hzText),
    ...(hz2Text !== undefined ? { hz2: Number(hz2Text) } : {}),
    volume,
  };
}
