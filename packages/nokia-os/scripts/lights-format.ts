// Lights golden fixture format (`*.lights.txt`, plan 25 D9): parse, validate and serialize.
//
// A lights golden is a captured timeline of the phone's two LED lines (the display LEDs and the
// keypad LEDs), aligned on the recording's first key-down (or its start when no key is pressed),
// with the time from the power-on to that instant, so a scenario can put the firmware's light
// tick where the capture had it. Every light is off before its first row. Shared by the capture
// importer (Node type stripping), the tests and the generators: imports only sibling scripts.
import { GoldenFormatError, INPUT_KEYS, type GoldenStatus } from "./golden-format.ts";

export const LIGHTS_MAGIC = "lights-golden 1";
const EVENTS_HEADER = "# t_ms light   state";

export type LightName = "display" | "keypad";
export const LIGHT_NAMES: readonly LightName[] = ["display", "keypad"];

export interface LightsRow {
  readonly ms: number;
  readonly light: LightName;
  readonly on: boolean;
}

/** A key-down at `ms`; `holdMs` when the key was held (not a tap). As the sound goldens' keys. */
export interface LightsKey {
  readonly ms: number;
  readonly key: string;
  readonly holdMs?: number;
}

export interface LightsOmission {
  readonly count: number;
  readonly reason: string;
}

export interface LightsGolden {
  readonly id: string;
  readonly status: GoldenStatus;
  readonly source: string;
  readonly sourceSha256: string;
  /** `virgin`, `factory` or the REF image name the recording started from. */
  readonly state: string;
  /** Whole ms from the power-on to time 0. */
  readonly powerOnMs: number;
  /**
   * When the recording started and stopped (golden time): the rows hold every change between, a
   * light lit at the start as a row at `startMs`.
   */
  readonly startMs: number;
  readonly endMs: number;
  readonly keys?: readonly LightsKey[];
  readonly note?: string;
  readonly omitted: readonly LightsOmission[];
  readonly rows: readonly LightsRow[];
}

const ID = /^lights\/[a-z0-9][a-z0-9./-]*$/;
const STATUS = /^(asserted|pending:[a-z0-9-]+)$/;
const SHA256 = /^[0-9a-f]{64}$/;
const STATE = /^[a-z0-9][a-z0-9.-]*$/;
const INTEGER = /^(0|[1-9][0-9]*)$/;
const SIGNED = /^-?(0|[1-9][0-9]*)$/;
const KEY = /^(0|[1-9][0-9]*):([^+\s]+)(?:\+([1-9][0-9]*))?$/;
const OMISSION = /^([1-9][0-9]*) \(([^()]+)\)$/;

/** What a capture set reads for lights goldens (the importer's `io.lights`). */
export interface LightsCaptureIo {
  /** The text of `<dir>.lights.csv`, or undefined when the recording is missing. */
  lights(dir: string): string | undefined;
  /** The text of `<dir>/keys.csv`, or undefined. */
  keys(dir: string): string | undefined;
  /** sha256 (hex) over `<dir>.lights.csv` then `<dir>/keys.csv`. */
  sha256(dir: string): string;
}

// ---------------------------------------------------------------- serialize

export function serializeLightsGolden(golden: LightsGolden): string {
  const out = [
    LIGHTS_MAGIC,
    `id: ${golden.id}`,
    `status: ${golden.status}`,
    `source: ${golden.source}`,
    `source-sha256: ${golden.sourceSha256}`,
    `state: ${golden.state}`,
    `power-on: ${golden.powerOnMs}`,
    `start: ${golden.startMs}`,
    `end: ${golden.endMs}`,
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
    out.push(`${String(row.ms).padEnd(7)}${row.light.padEnd(8)}${row.on ? "on" : "off"}`);
  }
  out.push("");
  return out.join("\n");
}

// ---------------------------------------------------------------- parse

export function parseLightsGolden(text: string, file: string): LightsGolden {
  const lines = text.split("\n");
  let index = 0;
  const fail = (lineIndex: number, message: string): never => {
    throw new GoldenFormatError(file, lineIndex + 1, message);
  };
  if (lines[0] !== LIGHTS_MAGIC) fail(0, `expected "${LIGHTS_MAGIC}", got "${lines[0] ?? ""}"`);
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
  const powerOn = header("power-on", false)!;
  if (!INTEGER.test(powerOn.value)) {
    fail(powerOn.line, `power-on must be a non-negative integer (ms), got "${powerOn.value}"`);
  }
  const start = header("start", false)!;
  if (!SIGNED.test(start.value) || Number(start.value) > 0) {
    fail(start.line, `start must be an integer ≤ 0 (ms), got "${start.value}"`);
  }
  const end = header("end", false)!;
  if (!SIGNED.test(end.value)) fail(end.line, `end must be an integer (ms), got "${end.value}"`);
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

  const rows: LightsRow[] = [];
  const last = new Map<LightName, boolean>();
  for (; index < lines.length && lines[index] !== ""; index++) {
    const row = parseRow(lines[index]!, (m) => fail(index, m));
    const previous = rows.at(-1);
    if (previous !== undefined && row.ms < previous.ms) {
      fail(index, `times must not decrease: ${row.ms} after ${previous.ms}`);
    }
    if (keys === undefined && row.ms < 0) fail(index, "times may not be negative without keys");
    if (last.get(row.light) === row.on) {
      fail(index, `${row.light} repeats its previous state "${row.on ? "on" : "off"}"`);
    }
    last.set(row.light, row.on);
    rows.push(row);
  }
  if (rows[0] !== undefined && rows[0].ms < Number(start.value)) {
    fail(start.line, `start ${start.value} comes after the first row (${rows[0].ms})`);
  }
  const lastRow = rows.at(-1);
  if (lastRow !== undefined && lastRow.ms > Number(end.value)) {
    fail(end.line, `end ${end.value} comes before the last row (${lastRow.ms})`);
  }
  if (lines.slice(index).some((line) => line !== ""))
    fail(
      lines.findIndex((line, i) => i >= index && line !== ""),
      "unexpected content after @events",
    );

  return {
    id: id.value,
    status: status.value as GoldenStatus,
    source: source.value,
    sourceSha256: sha.value,
    state: state.value,
    powerOnMs: Number(powerOn.value),
    startMs: Number(start.value),
    endMs: Number(end.value),
    ...(keys !== undefined ? { keys } : {}),
    ...(note ? { note: note.value } : {}),
    omitted: omitted!,
    rows,
  };
}

function parseKeys(value: string, fail: (message: string) => never): LightsKey[] {
  const out: LightsKey[] = [];
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

function parseOmitted(value: string): LightsOmission[] | undefined {
  if (value === "none") return [];
  const out: LightsOmission[] = [];
  for (const part of value.split(", ")) {
    const match = OMISSION.exec(part);
    if (!match) return undefined;
    out.push({ count: Number(match[1]), reason: match[2]! });
  }
  return out;
}

function parseRow(line: string, fail: (message: string) => never): LightsRow {
  const match = /^(\S+)\s+(\S+)\s+(\S+)$/.exec(line);
  if (!match) return fail(`expected "<t_ms> <light> <state>", got "${line}"`);
  const [, msText, lightText, stateText] = match as unknown as [string, string, string, string];
  if (!SIGNED.test(msText)) fail(`t_ms must be an integer, got "${msText}"`);
  if (!LIGHT_NAMES.includes(lightText as LightName)) {
    fail(`light must be display or keypad, got "${lightText}"`);
  }
  if (stateText !== "on" && stateText !== "off")
    fail(`state must be on or off, got "${stateText}"`);
  return { ms: Number(msText), light: lightText as LightName, on: stateText === "on" };
}
