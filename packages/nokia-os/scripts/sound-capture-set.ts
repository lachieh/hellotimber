// Sound goldens (plan 16 "Capture set"): an explicit table over the plan 16 Task 0 captures
// (`captures/6.39/plan16/`), plus the rules that turn a recording's `.events.csv` (v2 columns) and
// `keys.csv` into a `sound-golden 1` fixture: per-output states, one-grain register writes dropped
// (D6), times aligned on the first key-down, the tone's cycle (`@loop`), equal note recordings
// shared.
//
// Reads captures only through the injected `SoundCaptureIo`, so tests run it on synthetic
// recordings. Paths are relative to `$REF/captures/6.39`. Pure: imports only sibling scripts.
import type { GoldenStatus } from "./golden-format.ts";
import type {
  SoundGolden,
  SoundKey,
  SoundLoop,
  SoundOmission,
  SoundOutputName,
  SoundRow,
  SoundState,
} from "./sound-format.ts";
import { placeholderOwner } from "./tree-capture-set.ts";

// ---------------------------------------------------------------- io

export interface SoundCaptureIo {
  /** The text of `<dir>.events.csv`, or undefined when the recording is missing. */
  events(dir: string): string | undefined;
  /** The text of `<dir>/keys.csv`, or undefined. */
  keys(dir: string): string | undefined;
  /** sha256 (hex) over `<dir>.events.csv` then `<dir>/keys.csv`. */
  sha256(dir: string): string;
  /** Recording names (no extension) directly under `dir`. */
  list(dir: string): readonly string[];
}

export class SoundCaptureError extends Error {
  constructor(where: string, message: string) {
    super(`${where}: ${message}`);
    this.name = "SoundCaptureError";
  }
}

// ---------------------------------------------------------------- measured constants

export const EVENTS_HEADER =
  "t_ms,dsp_tone1_hz,dsp_tone2_hz,buzzer_on,buzzer_hz,vibra,buzzer_vol,dsp_level";
export const KEYS_HEADER = "key,down_ms,up_ms";
/** A state held this long or less is a two-step register write, polled once (D6); so is a
 * note's volume written ahead of its divider, however long (`staleFrequency`). */
export const GRAIN_MS = 1.05;
/** Keys held longer than this carry their hold in `keys` (taps are 40-100 ms). */
export const HOLD_MS = 200;
/** A later pass's edge may stray this far from the first pass's (Task 0: median 11, ≤ 48 ms)… */
export const LOOP_TOLERANCE_MS = 25;
/** …plus this fraction of its offset (the second pass runs up to ≈1 % slower). */
export const LOOP_DRIFT = 0.012;
/** Note recordings this close (same states, times within it) share one golden. */
export const NOTE_SHARE_TOLERANCE_MS = 2;

/** Harness key names (`keys.csv`) → phone key names. */
const KEY_NAMES: Readonly<Record<string, string>> = {
  menu: "navi",
  pwr: "power",
  c: "c",
  up: "up",
  down: "down",
  "*": "*",
  "#": "#",
  ...Object.fromEntries("0123456789".split("").map((d) => [d, d])),
};

// ---------------------------------------------------------------- parsing

export interface RawEvent {
  readonly ms: number;
  readonly tone1: number;
  readonly tone2: number;
  readonly buzzerOn: boolean;
  readonly buzzerHz: number;
  readonly vibra: boolean;
  readonly buzzerVol: number;
  readonly dspLevel: number;
}

export interface RawKey {
  readonly key: string;
  readonly downMs: number;
  readonly upMs: number;
}

export function parseEventsCsv(text: string, where: string): RawEvent[] {
  const lines = text.trim().split("\n");
  if (lines[0] !== EVENTS_HEADER) {
    throw new SoundCaptureError(
      where,
      `expected the v2 events header "${EVENTS_HEADER}", got "${lines[0]}"`,
    );
  }
  return lines.slice(1).map((line, i) => {
    const c = line.split(",");
    const nums = c.slice(0, 7).map(Number);
    if (c.length !== 8 || nums.some((n) => !Number.isFinite(n)) || !/^0x[0-9A-F]{4}$/.test(c[7]!)) {
      throw new SoundCaptureError(`${where}:${i + 2}`, `bad events row "${line}"`);
    }
    const [ms, tone1, tone2, on, hz, vib, vol] = nums as [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ];
    return {
      ms,
      tone1,
      tone2,
      buzzerOn: on === 1,
      buzzerHz: hz,
      vibra: vib === 1,
      buzzerVol: vol,
      dspLevel: Number.parseInt(c[7]!.slice(2), 16),
    };
  });
}

export function parseKeysCsv(text: string, where: string): RawKey[] {
  const lines = text.trim().split("\n");
  if (lines[0] !== KEYS_HEADER) {
    throw new SoundCaptureError(where, `expected the header "${KEYS_HEADER}", got "${lines[0]}"`);
  }
  return lines.slice(1).map((line, i) => {
    const [key, down, up] = line.split(",");
    const name = KEY_NAMES[key ?? ""];
    if (name === undefined || !Number.isFinite(Number(down)) || !Number.isFinite(Number(up))) {
      throw new SoundCaptureError(`${where}:${i + 2}`, `bad key row "${line}"`);
    }
    return { key: name, downMs: Number(down), upMs: Number(up) };
  });
}

// ---------------------------------------------------------------- normalisation (D6)

/** A state change of one output at a capture time (ms, unrounded). */
export interface TimedRow {
  readonly ms: number;
  readonly output: SoundOutputName;
  readonly state: SoundState;
}

type Polled = SoundState | "divider-rewrite";

const OFF: SoundState = { kind: "off" };
const OUTPUT_ORDER: Readonly<Record<SoundOutputName, number>> = { buzzer: 0, tone: 1, vibrator: 2 };

function stateKey(state: Polled): string {
  if (state === "divider-rewrite") return "z";
  if (state.kind !== "sounding") return state.kind;
  return `${state.hz}+${state.hz2 ?? 0}@${state.volume}`;
}

function polled(event: RawEvent, output: SoundOutputName): Polled {
  if (output === "buzzer") {
    if (!event.buzzerOn) return OFF;
    if (event.buzzerHz === 0) return "divider-rewrite";
    return { kind: "sounding", hz: Math.round(event.buzzerHz * 10) / 10, volume: event.buzzerVol };
  }
  if (output === "tone") {
    if (event.tone1 === 0) return OFF;
    return {
      kind: "sounding",
      hz: event.tone1,
      ...(event.tone2 !== 0 ? { hz2: event.tone2 } : {}),
      volume: event.dspLevel,
    };
  }
  return event.vibra ? { kind: "on" } : OFF;
}

function omissionReason(output: SoundOutputName, state: Polled): string {
  if (state === "divider-rewrite") return "divider rewrite";
  if (output === "buzzer") return state.kind === "off" ? "buzzer gap" : "stale frequency";
  if (output === "tone") return state.kind === "off" ? "tone gap" : "level rewrite";
  return "vibrator glitch";
}

/**
 * The firmware writes a note's volume before its divider: a state with the previous note's
 * frequency at the next note's volume is that gap, however long it lasted (Task 0 saw 1-14 ms).
 */
function staleFrequency(previous?: Polled, state?: Polled, next?: Polled): boolean {
  const sounding = (p?: Polled): p is Extract<SoundState, { kind: "sounding" }> =>
    p !== undefined && p !== "divider-rewrite" && p.kind === "sounding";
  if (!sounding(previous) || !sounding(state) || !sounding(next)) return false;
  return (
    previous.hz === state.hz &&
    previous.volume !== state.volume &&
    next.hz !== state.hz &&
    next.volume === state.volume
  );
}

/**
 * The events as per-output state changes: a state held for one grain or less is dropped (and
 * counted by reason), equal neighbours merge, and the log's initial "off" rows go.
 */
export function normaliseEvents(events: readonly RawEvent[]): {
  rows: TimedRow[];
  omitted: SoundOmission[];
} {
  const counts = new Map<string, number>();
  const rows: TimedRow[] = [];
  for (const output of ["buzzer", "tone", "vibrator"] as const) {
    const changes: { ms: number; state: Polled }[] = [];
    for (const event of events) {
      const state = polled(event, output);
      if (changes.length === 0 || stateKey(changes.at(-1)!.state) !== stateKey(state)) {
        changes.push({ ms: event.ms, state });
      }
    }
    let current = "off";
    changes.forEach((change, i) => {
      const next = changes[i + 1];
      if (
        change.state === "divider-rewrite" ||
        (next && next.ms - change.ms <= GRAIN_MS) ||
        staleFrequency(changes[i - 1]?.state, change.state, next?.state)
      ) {
        const reason = omissionReason(output, change.state);
        counts.set(reason, (counts.get(reason) ?? 0) + 1);
        return;
      }
      const key = stateKey(change.state);
      if (key === current) return;
      current = key;
      rows.push({ ms: change.ms, output, state: change.state as SoundState });
    });
  }
  rows.sort((a, b) => a.ms - b.ms || OUTPUT_ORDER[a.output] - OUTPUT_ORDER[b.output]);
  const omitted = [...counts.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([reason, count]) => ({ count, reason }));
  return { rows, omitted };
}

/** Rows and keys relative to the first key-down (or the recording's start), whole ms. */
export function alignOnKeys(
  rows: readonly TimedRow[],
  keys: readonly RawKey[],
): { rows: SoundRow[]; keys: SoundKey[] | undefined } {
  const zero = keys[0]?.downMs ?? 0;
  const aligned: SoundRow[] = rows.map((row) => ({
    ms: Math.round(row.ms - zero),
    output: row.output,
    state: row.state,
  }));
  const soundKeys = keys.length
    ? keys.map((k) => {
        const hold = Math.round(k.upMs - k.downMs);
        return {
          ms: Math.round(k.downMs - zero),
          key: k.key,
          ...(hold > HOLD_MS ? { holdMs: hold } : {}),
        };
      })
    : undefined;
  return { rows: aligned, keys: soundKeys };
}

// ---------------------------------------------------------------- the tone's cycle

function sameState(a: SoundState, b: SoundState): boolean {
  return stateKey(a) === stateKey(b);
}

/**
 * A ringing preview's cycle: the smallest period after which the buzzer and vibrator rows repeat
 * (each later pass a prefix of the first, edges within LOOP_TOLERANCE_MS plus LOOP_DRIFT of their
 * offset). Each output's final "off" is the preview's stop, not a pattern edge. Rows up to `after`
 * (the key's beep) are ignored. Undefined when no second pass starts.
 */
export function detectLoop(rows: readonly SoundRow[], after = 300): SoundLoop | undefined {
  let events = rows.filter((r) => r.ms > after && r.output !== "tone");
  for (const output of ["buzzer", "vibrator"] as const) {
    const final = events.filter((r) => r.output === output).at(-1);
    if (final && final.state.kind === "off") events = events.filter((r) => r !== final);
  }
  if (events.length < 2) return undefined;
  const first = events[0]!;
  const anchor = events.find((r) => r.output === "buzzer") ?? first;
  const lastMs = events.at(-1)!.ms;
  for (const candidate of events) {
    if (candidate.ms <= anchor.ms || candidate.output !== anchor.output) continue;
    if (!sameState(candidate.state, anchor.state)) continue;
    const period = candidate.ms - anchor.ms;
    const edge = anchor.ms - 3;
    const pass1 = events.filter((r) => r.ms < edge + period);
    let ok = true;
    let k = 1;
    for (; ok && edge + k * period <= lastMs; k++) {
      const start = edge + k * period;
      const later = events.filter((r) => r.ms >= start && r.ms < start + period);
      if (later.length === 0) {
        ok = false;
        break;
      }
      for (const output of ["buzzer", "vibrator"] as const) {
        let a = pass1.filter((r) => r.output === output);
        const b = later.filter((r) => r.output === output);
        const carried = events.filter((r) => r.output === output && r.ms < start).at(-1);
        if (
          a[0] &&
          a[0].ms < edge + LOOP_TOLERANCE_MS &&
          carried &&
          sameState(a[0].state, carried.state) &&
          !(b[0] && b[0].ms < start + LOOP_TOLERANCE_MS)
        ) {
          a = a.slice(1); // the pass starts in the state the previous pass left this output in
        }
        if (b.length > a.length) ok = false;
        b.forEach((row, i) => {
          const want = a[i];
          const slack = LOOP_TOLERANCE_MS + LOOP_DRIFT * (row.ms - first.ms);
          if (
            !want ||
            !sameState(row.state, want.state) ||
            Math.abs(row.ms - k * period - want.ms) > slack
          ) {
            ok = false;
          }
        });
        if (!ok) break;
      }
    }
    if (ok && k > 1) return { startMs: anchor.ms, periodMs: period };
  }
  return undefined;
}

// ---------------------------------------------------------------- the table

export interface SoundCaptureEntry {
  readonly id: string;
  /** The recording, relative to `captures/6.39`. */
  readonly dir: string;
  /** `virgin`, `factory` or the image the recording started from. */
  readonly state: string;
  readonly status: GoldenStatus;
  readonly note: string;
  /** Ringing previews: `@loop` when a second pass starts (`required`: it must). */
  readonly loop?: "required";
}

/** The 35 built-in tones in list order (Tones › Ringing tone, entries 1-35). */
export const RINGING_TONE_NAMES: readonly string[] = [
  "Ring ring",
  "Low",
  "Mosquito",
  "Bee",
  "City bird",
  "Hopping down",
  "Kick",
  "Playground",
  "That's it!",
  "Improvisation",
  "Rocket",
  "Croak",
  "Nokia tune",
  "Mozart 40",
  "Badinerie",
  "Attraction",
  "Dawn",
  "Polite",
  "Tick tick",
  "Samba rumble",
  "Jumping",
  "Lamb",
  "Toreador",
  "Matilda",
  "Merry Xmas",
  "Auld lang syne",
  "Hurdy-gurdy",
  "Groovy Blue",
  "Sunny walks",
  "The Buffoon",
  "Indifference",
  "Barn dance",
  "Mangrove",
  "Knick-knack",
  "Get cool",
];

/** Previews that stop inside the tone's first pass (Task 0): no `@loop`. */
export const ONE_PASS_TONES: readonly number[] = [14, 15, 23, 24, 33];
/** Tones whose Levels 1-3 are committed: together they play all 45 frequencies (D10). */
export const LEVEL_COVER_TONES: readonly number[] = [8, 11, 14, 15, 16, 24, 27, 35];

/** `13-nokia-tune` for tone 13. */
export function toneSlug(nn: number): string {
  const slug = RINGING_TONE_NAMES[nn - 1]!.toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${String(nn).padStart(2, "0")}-${slug}`;
}

const P = "plan16";

function entry(
  id: string,
  dir: string,
  note: string,
  extra: { state?: string; status?: GoldenStatus; loop?: "required" } = {},
): SoundCaptureEntry {
  return {
    id: `sound/${id}`,
    dir: `${P}/${dir}`,
    state: extra.state ?? "factory",
    status: extra.status ?? "asserted",
    note,
    ...(extra.loop ? { loop: extra.loop } : {}),
  };
}

function toneEntries(): SoundCaptureEntry[] {
  const out: SoundCaptureEntry[] = [];
  for (let nn = 1; nn <= 35; nn++) {
    const name = RINGING_TONE_NAMES[nn - 1]!;
    const nnn = String(nn).padStart(2, "0");
    const from = nn === 1 ? "▲ from Low" : `▼ from ${RINGING_TONE_NAMES[nn - 2]}`;
    const slug = toneSlug(nn);
    out.push(
      entry(
        `ringing-tone/${slug}`,
        `ringing-tone/${nnn}`,
        `Tones › Ringing tone, ${from} onto ${name}: its preview at Level 4, Vibrating alert On.`,
        ONE_PASS_TONES.includes(nn) ? {} : { loop: "required" },
      ),
      entry(
        `ringing-tone/level-5/${slug}`,
        `levels/5/${nnn}`,
        `${name}'s Ringing tone preview at Ringing volume Level 5 (D10: its jump).`,
      ),
      entry(
        `alert/ascending/${slug}`,
        `alert/ascending-tones/${nnn}`,
        `${name}'s Ringing tone preview with Incoming call alert Ascending, Level 4 (D10: its steps).`,
      ),
      entry(
        `ringing-volume/tone/${slug}`,
        `ringing-volume/tones/${nnn}`,
        `${name} stored; Tones › Ringing volume, ▼ from Level 3 onto Level 4 (to its first mark).`,
      ),
    );
    if (LEVEL_COVER_TONES.includes(nn)) {
      for (const level of [1, 2, 3]) {
        out.push(
          entry(
            `ringing-tone/level-${level}/${slug}`,
            `levels/${level}/${nnn}`,
            `${name}'s Ringing tone preview at Ringing volume Level ${level}.`,
          ),
        );
      }
    }
  }
  return out;
}

function titled(profile: string): string {
  return `${profile[0]!.toUpperCase()}${profile.slice(1)}`;
}

const LISTED: readonly SoundCaptureEntry[] = [
  // K keypad
  entry("keypad/keys", "keypad/keys", "Every key at standby, C held after each (DTMF digits).", {
    status: "pending:22",
  }),
  entry(
    "keypad/hold",
    "keypad/hold",
    "5 held at standby (DTMF), C held, ▼ held in the menu (repeats), ▲ held, C held.",
    { status: "pending:22" },
  ),
  entry(
    "keypad/pair",
    "keypad/pair",
    "Phone book list: ▼▼ 100, 200, 400 ms apart, then ▲ after 1-4 s gaps (the DSP powers down).",
  ),
  entry(
    "keypad/list",
    "keypad/list",
    "Tones › Incoming call alert: ▼ with 1 s and 4 s gaps, C, ▼, Select, ▼.",
  ),
  entry(
    "keypad/levels-list",
    "keypad/levels/list",
    "Tones › Keypad tones from Level 2: ▲ ×4, ▼ ×3, C (each beep at the highlighted level).",
  ),
  ...["off", "1", "2", "3"].map((level) =>
    entry(
      `keypad/level-${level}`,
      `keypad/levels/${level}`,
      `Keypad tones ${level === "off" ? "Off" : `Level ${level}`}: Menu, ▼, ▼, C, C held, Menu after 4 s, C held.`,
    ),
  ),
  entry(
    "keypad/virgin",
    "keypad/virgin",
    "Virgin (Keypad tones unset): Menu, ▼, ▼, C, C held, Menu after 4 s, C held.",
    { state: "virgin" },
  ),
  entry("keypad/virgin-list", "keypad/virgin-list", "Virgin Tones › Keypad tones: ▼ ×5.", {
    state: "virgin",
  }),
  // R the (empty) slot
  entry(
    "ringing-tone/empty",
    "ringing-tone/36",
    "Tones › Ringing tone, ▼ from Get cool onto the first (empty) slot: no preview.",
  ),
  // V volume
  ...[1, 2, 3, 4, 5].map((level) =>
    entry(
      `ringing-volume/level-${level}`,
      `ringing-volume/${level}`,
      `Tones › Ringing volume (Nokia tune stored), ${level === 1 ? "▲ from Level 2" : `▼ from Level ${level - 1}`} onto Level ${level}${level === 5 ? "; OK, the query, OK" : ""}.`,
    ),
  ),
  // A alert types
  ...(
    [
      ["ascending-l1", "Ascending, Ringing volume Level 1"],
      ["ascending-l4", "Ascending, Ringing volume Level 4"],
      ["ascending-l5", "Ascending, Ringing volume Level 5"],
      ["ring-once", "Ring once"],
      ["beep-once", "Beep once"],
      ["off", "Off"],
    ] as const
  ).map(([slug, what]) =>
    entry(
      `alert/${slug}`,
      `alert/${slug}`,
      `Incoming call alert ${what}: ▼ from Croak onto Nokia tune.`,
    ),
  ),
  entry("alert/list", "alert/list", "Tones › Incoming call alert: ▼ ×5, 5 s apart."),
  // Vb vibrator
  entry("vibrator/off", "vibrator/off", "Vibrating alert Off: ▼ from Croak onto Nokia tune."),
  entry(
    "vibrator/choose",
    "vibrator/choose",
    "Tones › Vibrating alert: ▼ Off, OK, Select, ▲ On, OK.",
  ),
  // M message tones
  ...(
    [
      ["no-tone", "▲ from Standard onto No tone"],
      ["standard", "▼ from No tone onto Standard"],
      ["special", "▼ from Standard onto Special"],
      ["beep-once", "▼ from Special onto Beep once"],
      ["ascending", "▼ from Beep once onto Ascending"],
      ["special-l1", "Ringing volume Level 1, ▼ onto Special"],
      ["standard-l5", "Ringing volume Level 5, ▼ onto Standard"],
      ["vib-off-special", "Vibrating alert Off, ▼ onto Special"],
      ["vib-off-beep-once", "Vibrating alert Off, ▼ onto Beep once"],
      ["alert-off-special", "Incoming call alert Off, ▼ onto Special"],
      ["beep-once-ringing-l1", "Ringing volume Level 1, ▼ onto Beep once"],
      ["beep-once-ringing-l5", "Ringing volume Level 5, ▼ onto Beep once"],
      ["beep-once-keypad-l3", "Keypad tones Level 3, ▼ onto Beep once"],
      ["beep-once-keypad-off", "Keypad tones Off, ▼ onto Beep once"],
      ["ok", "▼ onto Special, OK during its preview"],
    ] as const
  ).map(([slug, what]) =>
    entry(`message-tone/${slug}`, `message-tone/${slug}`, `Tones › Message alert tone: ${what}.`),
  ),
  // P profiles
  ...["general", "silent", "discreet", "loud"].flatMap((profile) => [
    entry(
      `profile/${profile}/ringing-tone`,
      `profile/${profile}/ringing-tone`,
      `Profiles › ${titled(profile)} › Personalise › Ringing tone: ▼ from Croak onto Nokia tune.`,
    ),
    entry(
      `profile/${profile}/message-tone`,
      `profile/${profile}/message-tone`,
      `Profiles › ${titled(profile)} › Personalise › Message alert tone: ▼ from Standard onto Special.`,
    ),
  ]),
  ...(
    [
      ["general-vibra-off", "Vibrating alert Off"],
      ["general-alert-off", "Incoming call alert Off"],
      ["general-volume-1", "Ringing volume Level 1"],
    ] as const
  ).flatMap(([slug, what]) => [
    entry(
      `profile/active/${slug}/ringing-tone`,
      `profile/active/${slug}/ringing-tone`,
      `General (active) with ${what}; Loud › Personalise › Ringing tone: ▼ onto Nokia tune.`,
    ),
    entry(
      `profile/active/${slug}/message-tone`,
      `profile/active/${slug}/message-tone`,
      `General (active) with ${what}; Loud › Personalise › Message alert tone: ▼ onto Beep once.`,
    ),
  ]),
  // X preview mechanics
  ...(
    [
      ["stop-key", "▼ onto Nokia tune, ▼ again 2.5 s later"],
      ["stop-up", "▼ onto Nokia tune, ▲ 2.5 s later"],
      ["stop-c", "▼ onto Nokia tune, C 2.5 s later"],
      ["ok", "▼ onto Nokia tune, OK 2.5 s later"],
      ["rapid", "▼ ×4 from Nokia tune, 150 ms apart"],
      ["rapid-500", "▼ ×4 from Nokia tune, 500 ms apart"],
      ["delay-sweep", "▼ ×6 from Nokia tune, 0.7-1.2 s apart"],
      ["long", "▼ onto Nokia tune, left for 65 s"],
      ["volume-stop-c", "Ringing volume: ▲ onto Level 3, C 2.5 s later"],
      ["open", "Menu 5 1 (the list opens on Nokia tune), C held, Menu 5 5"],
    ] as const
  ).map(([slug, what]) => entry(`preview/${slug}`, `preview/${slug}`, `${what}.`)),
  ...(
    [
      ["virgin", "nothing set"],
      ["virgin-volume", "only Ringing volume set (Level 3)"],
      ["virgin-alert", "only Incoming call alert set (Ringing)"],
      ["first-down", "Ringing volume Level 3 and Incoming call alert Ringing set"],
      ["virgin-vibra", "Ringing volume, Incoming call alert and Vibrating alert set"],
    ] as const
  ).map(([slug, what]) =>
    entry(
      `preview/${slug}`,
      `preview/${slug}`,
      `Virgin, ${what}: Tones › Ringing tone (unset) ▼, 8 s later ▼.`,
      { state: "virgin" },
    ),
  ),
  entry(
    "preview/first-down-back",
    "preview/first-down-back",
    "Virgin, Ringing volume Level 3 and Incoming call alert Ringing: ▼, ▼, ▲, ▼, 8 s apart.",
    { state: "virgin" },
  ),
  entry(
    "preview/virgin-message",
    "preview/virgin-message",
    "Virgin Tones › Message alert tone (No tone): ▼ Standard, 8 s later ▼ Special.",
    { state: "virgin" },
  ),
  // N named notes
  entry(
    "note/invalid-shortcut",
    "notes/invalid-shortcut",
    '"Invalid shortcut" (Warning tones On) after Menu 1 9.',
  ),
  entry(
    "note/invalid-shortcut-key",
    "notes/invalid-shortcut-key",
    '"Invalid shortcut" (Warning tones On) after Menu 1 9; ▼ on the note.',
  ),
  entry(
    "note/invalid-shortcut-keypad-l3",
    "notes/invalid-shortcut-keypad-l3",
    '"Invalid shortcut" (Warning tones On) after Menu 1 9, Keypad tones Level 3.',
  ),
  entry(
    "note/code-error",
    "notes/code-error",
    '"Code error" (Warning tones On): Menu 6 4, 00000, OK.',
  ),
  entry(
    "note/gate-code-error",
    "notes/gate-code-error",
    '"Code error" (Warning tones On) at the power-on prompt (Phone security On, a new SIM): 00000, OK.',
    { state: "v639-plan15-factory-security-on" },
  ),
  entry(
    "note/request-not-confirmed",
    "notes/request-not-confirmed",
    "Call divert › Cancel all diverts: Requesting, Quit, Request not confirmed (silent).",
  ),
  entry(
    "note/warning-off",
    "notes/warning-off",
    "Warning tones Off: Menu 1 9 (Invalid shortcut), C held, Menu 6 4, 00000, OK (Code error).",
  ),
  // G games
  ...(
    [
      ["top-score-page", "Snake II › Top score (the note)"],
      ["meal", "two meals"],
      ["crash", "a crash before any meal"],
      ["top-score", "a meal, then a crash: the top score"],
      ["shakes-on-vibra-off", "Vibrating alert Off, one meal"],
      ["shakes-off-vibra-on", "Shakes Off, one meal"],
      ["shakes-off-vibra-off", "Shakes Off and Vibrating alert Off, one meal"],
      ["warning-off", "Warning tones Off, one meal"],
      ["sounds-off", "Sounds Off, one meal, then a crash"],
      ["keys", "2 4 8 6 5 1 3 during play"],
    ] as const
  ).map(([slug, what]) =>
    entry(`game/snake-${slug}`, `game/${slug}`, `Snake II, level 1, factory settings: ${what}.`),
  ),
  // B boot
  entry("boot/power-on", "boot/power-on", "The harness power-on (no keys), 16 s.", {
    state: "v639-plan15-restored",
  }),
  entry(
    "boot/power-on-keypad-off",
    "boot/power-on-keypad-off",
    "The harness power-on with Keypad tones Off (no keys), 16 s.",
    { state: "v639-plan16-keypad-off" },
  ),
  entry(
    "boot/power-off",
    "boot/power-off",
    "▼ onto Nokia tune, then the power key held until the phone is off.",
  ),
  entry(
    "boot/power-key",
    "boot/power-key",
    "A short power-key press at standby (the profile list), C.",
  ),
];

/** Note texts of the sounding note recordings (OCR of their LCD frames, Task 0), by node. */
export const NOTE_TEXTS: Readonly<Record<string, string>> = {
  "1-2": "No phone numbers",
  "1-4-1": "No phone numbers",
  "1-4-2": "No phone numbers",
  "1-5": "No phone numbers",
  "1-6": "No phone numbers",
  "1-7": "No phone numbers",
  "1-10-1": "No phone numbers",
  "1-10-2": "No voice tags saved",
  "1-10-3": "No voice tags saved",
  "1-10-4": "No voice tags saved",
  "12-2-2-9-4": "Screen saver missing",
  "12-4-2-9-4": "Screen saver missing",
  "4-6-3": "Not allowed",
  "4-7-1": "Not allowed",
  "4-7-2": "Not allowed",
  "6-3-6-2": "Set PIN code request on",
};

export const SOUND_NOT_IMPORTED: Readonly<Record<string, string>> = {
  "plan16/levels/<1-3>/<nn> beyond the eight cover tones":
    "the volume rule (a table per level and frequency) reproduces them; gen_v639_plan16.py check verifies all 105 in REF (D10)",
  "plan16/ringing-tone/37-42": "the other (empty) slots, silent as 36",
  "plan16/notes/unreached-*":
    "leaves the factory tree does not reach (2-8-4 topics; game Score IDs and Instructions pages)",
  "plan23/sound/":
    "plan 23's Snake II sound runs (v1 events, no volume columns): superseded by plan16/game/",
  "boot-clean/power-on.events.csv": "v1 events: superseded by plan16/boot/power-on",
  "*.wav": "the emulator's synthesis, not firmware output (D1)",
};

// ---------------------------------------------------------------- building

export function buildSoundGolden(entry: SoundCaptureEntry, io: SoundCaptureIo): SoundGolden {
  const eventsText = io.events(entry.dir);
  if (eventsText === undefined) {
    throw new SoundCaptureError(entry.id, `missing ${entry.dir}.events.csv`);
  }
  const keysText = io.keys(entry.dir);
  if (keysText === undefined) {
    throw new SoundCaptureError(entry.id, `missing ${entry.dir}/keys.csv`);
  }
  const events = parseEventsCsv(eventsText, `${entry.dir}.events.csv`);
  const rawKeys = parseKeysCsv(keysText, `${entry.dir}/keys.csv`);
  const { rows: timed, omitted } = normaliseEvents(events);
  const { rows, keys } = alignOnKeys(timed, rawKeys);
  const loop = entry.loop ? detectLoop(rows) : undefined;
  if (entry.loop && !loop) {
    throw new SoundCaptureError(entry.id, `${entry.dir}: no second pass of the tone`);
  }
  return {
    id: entry.id,
    status: entry.status,
    source: `captures/6.39/${entry.dir}`,
    sourceSha256: io.sha256(entry.dir),
    state: entry.state,
    ...(keys ? { keys } : {}),
    note: entry.note,
    omitted,
    rows,
    ...(loop ? { loop } : {}),
  };
}

/** Same keys and states, every time within NOTE_SHARE_TOLERANCE_MS. */
export function sameRecording(a: SoundGolden, b: SoundGolden): boolean {
  if (JSON.stringify(a.keys ?? []) !== JSON.stringify(b.keys ?? [])) return false;
  if (a.rows.length !== b.rows.length) return false;
  return a.rows.every((row, i) => {
    const other = b.rows[i]!;
    return (
      row.output === other.output &&
      sameState(row.state, other.state) &&
      Math.abs(row.ms - other.ms) <= NOTE_SHARE_TOLERANCE_MS
    );
  });
}

function compareNumbers(a: string, b: string): number {
  const x = a.split("-").map(Number);
  const y = b.split("-").map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? -1) - (y[i] ?? -1);
    if (d !== 0) return d;
  }
  return 0;
}

/** A note golden sounds when it has a buzzer row or a tone other than the 900 Hz key beep. */
export function noteSounds(golden: SoundGolden): boolean {
  return golden.rows.some(
    (row) =>
      row.output === "buzzer" ||
      (row.output === "tone" && row.state.kind === "sounding" && row.state.hz !== 900),
  );
}

/**
 * The tree's note recordings (`plan16/notes/<number>`: OK on each leaf or option of plan 14's
 * `open/` set): one golden per group of equal recordings, named after its first number, its note
 * listing the numbers (the note text first, quoted, when it sounds). A placeholder leaf's golden
 * is pending on the plan that owns it.
 */
export function noteGoldens(io: SoundCaptureIo): SoundGolden[] {
  const numbers = io
    .list(`${P}/notes`)
    .filter((name) => /^[1-9][0-9]*(-[1-9][0-9]*)*$/.test(name))
    .sort(compareNumbers);
  const groups: { golden: SoundGolden; numbers: string[] }[] = [];
  for (const number of numbers) {
    const owner = placeholderOwner(number);
    const golden = buildSoundGolden(
      entry(`note/${number}`, `notes/${number}`, "", owner ? { status: `pending:${owner}` } : {}),
      io,
    );
    const text = NOTE_TEXTS[number];
    if (noteSounds(golden) !== (text !== undefined)) {
      throw new SoundCaptureError(
        golden.id,
        text === undefined
          ? "a sounding note needs its text in NOTE_TEXTS"
          : `NOTE_TEXTS names "${text}" but the recording is silent`,
      );
    }
    const group = groups.find(
      (g) =>
        g.golden.status === golden.status &&
        NOTE_TEXTS[g.numbers[0]!] === text &&
        sameRecording(g.golden, golden),
    );
    if (group) group.numbers.push(number);
    else groups.push({ golden, numbers: [number] });
  }
  return groups.map(({ golden, numbers: nums }) => {
    const text = NOTE_TEXTS[nums[0]!];
    const what = text !== undefined ? `"${text}" (Warning tones On) after ` : "";
    return { ...golden, note: `${what}OK on ${nums.join(", ")} (factory).` };
  });
}

export const SOUND_CAPTURE_SET: readonly SoundCaptureEntry[] = [...toneEntries(), ...LISTED];

/** Every sound golden: the table, then the shared note goldens. */
export function soundCaptureSet(io: SoundCaptureIo): SoundGolden[] {
  return [...SOUND_CAPTURE_SET.map((e) => buildSoundGolden(e, io)), ...noteGoldens(io)];
}
