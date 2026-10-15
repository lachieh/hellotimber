// Plan 18 test support: the key sequences of the text entry stills, transcribed from Task 0's
// command logs (`$REF/captures/scripts/v639-plan18-<section>.cap`), and their replay through the
// multi-tap engine. A script is space-separated tokens:
//
//   K:<keys>   taps, comma-separated (`K:5,5,5`): `#` taps, `up`/`down` move, `c` deletes;
//   R:<ms>     time passing;
//   [<name>]   a shot: the golden image `<name>` (shots the golden left out are skipped).
//
// A tap is 392 ms in the captures (≈42 ms down, the emulator's 250 ms settle, a 100 ms key gap).
import { MESSAGES_CAPTURE_SCRIPTS } from "../../scripts/generated/messages-scripts.ts";
import { MESSAGES_ASSERTED } from "../../scripts/messages-capture-set.ts";
import type { TextMode, TextState } from "../../src/text/multitap";
import { PROBE_TOLERANCE_MS } from "./golden.ts";
import { replayScenario, type ReplayContext, type TimelineOptions } from "./replay.ts";
import { standbyRig } from "./rig.ts";
import {
  emptyText,
  textDelete,
  textKey,
  textMove,
  textTick,
  type TextInputKey,
} from "../../src/text/multitap";

export const TAP_MS = 392;
export const SMS_LIMIT = 459;

export interface TextTrace {
  readonly mode: TextMode;
  readonly script: string;
  /** Text already in the editor (a stored welcome note). */
  readonly text?: string;
}

const repeat = (n: number, f: (i: number) => string): string =>
  Array.from({ length: n }, (_, i) => f(i + 1)).join(" ");
const pad = (n: number, width = 2): string => String(n).padStart(width, "0");

/** Each key's presses, one shot per press (keys-upper.cap, keys-lower.cap). */
function keyTraces(): Record<string, TextTrace> {
  const traces: Record<string, TextTrace> = {};
  for (const mode of ["upper", "lower"] as const) {
    for (const key of "1234567890") {
      traces[`text/key-${key}-${mode}`] = {
        mode: mode === "upper" ? "ABC" : "abc",
        script: repeat(23, (i) => `K:${key} [${pad(i)}]`),
      };
    }
  }
  return traces;
}

const HASHES = repeat(9, (i) => `K:# R:300 [${pad(i)}]`);
const HELLO = "K:4,4 K:3,3 K:5,5,5 R:1700 K:5,5,5 K:6,6,6 R:1700";

/** Wrap probes (wrap.cap): one key per shot; a space is key 0. */
const WORDS = "2345 6789 23 4567 823456789 234 2345 67 89 2345678 2345 2367".replace(/ /g, "0");
const LONG_WORD = `${"23456789".repeat(4)}02345`;

/** counter.cap's 470 keys (2-9 with a space now and then); shot `NNN` follows key NNN. */
const COUNTER_KEYS =
  "23456789023456789234567802345678923456780234567892345678902345678923456780234567892345678023456789234567890234567892345678023456789234567802345678923456789023456789234567802345678923456780234567892345678902345678923456780234567892345678023456789234567890234567892345678023456789234567802345678923456789023456789234567802345678923456780234567892345678902345678923456780234567892345678023456789234567890234567892345678023456789234567802345678923456789023456789234567802345";

export const TEXT_TRACES: Readonly<Record<string, TextTrace>> = {
  ...keyTraces(),
  "text/case-cycle-empty": { mode: "Abc", script: `[00] ${HASHES}` },
  "text/case-cycle-word": { mode: "Abc", script: `K:2 R:1700 K:2,2 R:1700 [00] ${HASHES}` },
  "text/case-cycle-sentence": {
    mode: "Abc",
    script: `K:2 R:1700 K:2,2 K:1 K:0 R:1700 [00] ${HASHES}`,
  },
  "text/case-cycle-space": { mode: "Abc", script: `K:2 R:1700 K:2,2 K:0 R:1700 [00] ${HASHES}` },
  "text/case-after": {
    mode: "Abc",
    script: "K:2 R:1700 K:2,2 R:1700 K:1 R:1700 K:0 R:1700 [after-dot] K:2 R:1700 [after-dot-2]",
  },
  "text/case-after#question": {
    mode: "Abc",
    script:
      "K:2 R:1700 K:2,2 R:1700 K:1,1,1,1 R:1700 K:0 R:1700 [after-question] K:2 R:1700 [after-question-2]",
  },
  "text/case-after#exclaim": {
    mode: "Abc",
    script:
      "K:2 R:1700 K:2,2 R:1700 K:1,1,1,1,1 R:1700 K:0 R:1700 [after-exclaim] K:2 R:1700 [after-exclaim-2]",
  },
  "text/cursor-one": {
    mode: "Abc",
    script: [
      HELLO,
      "[end]",
      repeat(7, (i) => `K:up R:200 [up-${i}]`),
      repeat(7, (i) => `K:down R:200 [down-${i}]`),
      "K:down,down,down R:200 [middle] K:9,9 [middle-typed-pending] R:1700 [middle-typed]",
      "K:c R:300 [middle-c]",
    ].join(" "),
  },
  "text/cursor-three": {
    mode: "Abc",
    script: [
      `K:${repeat(6, () => "2,3,4,5,6,0").replace(/ /g, ",")},2,2 R:1700 [end]`,
      repeat(40, (i) => `K:up R:150 [up-${pad(i)}]`),
      repeat(40, (i) => `K:down R:150 [down-${pad(i)}]`),
      `K:${repeat(12, () => "down").replace(/ /g, ",")} R:200 [middle] K:9,9 R:1700 [middle-typed]`,
    ].join(" "),
  },
  "text/delete": { mode: "Abc", script: `${HELLO} [00] K:c R:300 [c-1] K:c R:300 [c-2]` },
  "text/delete#pending": { mode: "Abc", script: `${HELLO} K:2 K:c R:300 [c-pending]` },
  "text/wrap-words": {
    mode: "Abc",
    script: Array.from(WORDS, (key, i) => `K:${key} [${pad(i + 1)}]`).join(" "),
  },
  "text/wrap-long-word": {
    mode: "Abc",
    script: Array.from(LONG_WORD, (key, i) => `K:${key} [${pad(i + 1)}]`).join(" "),
  },
  "text/counter": {
    mode: "Abc",
    script: `${Array.from(COUNTER_KEYS.slice(0, 469), (key, i) => `K:${key} [${pad(i + 1, 3)}]`).join(" ")} K:${COUNTER_KEYS[469]} R:1700 [470-settled]`,
  },
  "text/wrap-spaces": {
    mode: "Abc",
    script: `K:2,3,4,5,6,7,8,9,2,3,4 ${repeat(6, (i) => `K:0 R:1700 [${pad(i)}]`)} K:2 R:1700 [then-2]`,
  },
};

export const WELCOME_LIMIT = 36;

/** The welcome note's stills (welcome.cap, welcome-face.cap), replayed with WELCOME_LIMIT. */
export const WELCOME_TRACES: Readonly<Record<string, TextTrace>> = {
  "welcome/face": {
    mode: "Abc",
    script: Array.from(`${"23456789".repeat(4)}0234`, (key, i) => `K:${key} [${pad(i + 1)}]`).join(
      " ",
    ),
  },
  "welcome/editor": {
    mode: "Abc",
    script: "[editor] K:4,4 R:1700 K:4,4,4 R:1700 [hi] K:c R:300 [hi-c]",
  },
  "welcome/editor#36": {
    mode: "Abc",
    script: `K:${Array.from(`${"23456789".repeat(4)}2345`).join(",")} R:1700 [36] K:6 R:3000 K:0 R:1700 [37th-key-0]`,
  },
  "welcome/editor#reopened": { mode: "Abc", text: "Hi", script: "[reopened]" },
};

/** One shot of a replayed script: the golden image and the entry state at that moment. */
export interface TraceShot {
  readonly image: string;
  readonly state: TextState;
  readonly atMs: number;
}

/** Replays `trace` through the engine (taps on key-down; # on release as one tap). */
export function replayTrace(trace: TextTrace, limit = SMS_LIMIT): TraceShot[] {
  const text = trace.text ?? "";
  let state: TextState = { ...emptyText(trace.mode), text, cursor: Array.from(text).length };
  let now = 0;
  const shots: TraceShot[] = [];
  for (const token of trace.script.split(" ").filter((t) => t !== "")) {
    if (token.startsWith("[")) {
      state = textTick(state, now);
      shots.push({ image: token.slice(1, -1), state, atMs: now });
    } else if (token.startsWith("R:")) {
      now += Number(token.slice(2));
      state = textTick(state, now);
    } else if (token.startsWith("K:")) {
      for (const key of token.slice(2).split(",")) {
        state = textTick(state, now);
        if (key === "up" || key === "down") state = textMove(state, key);
        else if (key === "c") state = textDelete(state);
        else state = textKey(state, key as TextInputKey, now, limit);
        now += TAP_MS;
      }
    } else throw new Error(`bad trace token "${token}"`);
  }
  return shots;
}

// ---------------------------------------------------------------- capture replay (Task 12)

/**
 * The capture's setup (`v639-setup.inc`): power-on, the security code, time and date, C. It
 * takes 55.4 s of emulated time (taps of 592 ms at the default key gap).
 */
export const SETUP_MS = 8000 + 6 * 592 + 9000 + 5 * 592 + 4000 + 9 * 592 + 20000 + 592 + 2000;

/** A tap as a recording presses it: down, 60 ms, up, then `gap`. */
const pressed = (key: string, gap: string): string[] => [
  `press ${key}`,
  "run 60ms",
  `release ${key}`,
  `run ${gap}`,
];

/**
 * The T9 editor's Options › Dictionary › Dictionary off (Dictionary is Options' eighth entry; its
 * list opens on English, ▲ to Dictionary off), as taps and as a recording's presses
 * (`text/dictionary-off`), and the same done in the multi-tap editor nokia-os opens with (D3):
 * Dictionary is Options' fifth entry and its list opens on Dictionary off.
 */
const DICTIONARY_OFF_REWRITES: readonly (readonly [readonly string[], readonly string[]])[] = [
  [
    [
      ...Array.from({ length: 7 }, () => "key down"),
      "key menu",
      "run 1200ms",
      "key up",
      "key menu",
    ],
    // Three ▼ and the ▲ become waits as long as their taps (392 ms at the logs' 100 ms key gap),
    // so everything after keeps the capture's times.
    [
      ...Array.from({ length: 4 }, () => "key down"),
      "run 1176ms",
      "key menu",
      "run 1200ms",
      "run 392ms",
      "key menu",
    ],
  ],
  [
    [
      ...Array.from({ length: 7 }, () => pressed("down", "300ms")).flat(),
      ...pressed("menu", "1500ms"),
      ...pressed("up", "600ms"),
    ],
    [
      ...Array.from({ length: 4 }, () => pressed("down", "300ms")).flat(),
      "run 1080ms",
      ...pressed("menu", "1500ms"),
      "run 660ms",
    ],
  ],
];

/**
 * A block's commands as a stock phone replays them: each T9 Dictionary off replaced by the
 * multi-tap one, and a reboot's power-on (plan 15's logs record the boot, then type the setup's
 * code, time and date) replaced by the setup.
 */
export function messagesRewrite(lines: readonly string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.startsWith("reboot ") && lines[i + 1] !== "include setup") {
      out.push(lines[i]!, "include setup");
      // The setup ends with C and 2 s at standby.
      while (i < lines.length && !(lines[i] === "run 2s" && lines[i - 1] === "key c")) i++;
      continue;
    }
    const rewrite = DICTIONARY_OFF_REWRITES.find(([t9]) =>
      t9.every((line, k) => lines[i + k] === line),
    );
    if (rewrite !== undefined) {
      out.push(...rewrite[1]);
      i += rewrite[0].length - 1;
    } else out.push(lines[i]!);
  }
  return out;
}

/** Plan 18's capture logs on a virgin stock phone (`standbyRig` stands for the setup). */
export const MESSAGES_REPLAY: ReplayContext = {
  scripts: MESSAGES_CAPTURE_SCRIPTS,
  rewrite: messagesRewrite,
  setup: (storage) => standbyRig({ storage }),
  setupMs: SETUP_MS,
};

/** The scenario of plan 18 golden `id`: its capture replayed (tests/support/replay.ts). */
export function messagesScenario(options: TimelineOptions = {}): (id: string) => void {
  return (id) => replayScenario(MESSAGES_REPLAY, id, options);
}

/** A recording of a note whose timeline another recording of the same note gave (D8). */
const OTHER_RECORDING: TimelineOptions = { toleranceMs: PROBE_TOLERANCE_MS };

/**
 * The synthetic cell's link-time spread around the medians the phone uses (D10): five sends
 * 2574.3-2790.4 ms around 2662.4, five arrivals 2141.3-2464.4 ms around 2324.3.
 */
export const SEND_LINK_SPREAD_MS = 130;
export const RECEIVE_LINK_SPREAD_MS = 185;

/** A send's recording: the bar's steps are 7-6's (PROBE_TOLERANCE_MS), `Message sent` at `row`. */
const sendRecording = (row: number): TimelineOptions => ({
  toleranceMs: PROBE_TOLERANCE_MS,
  anchors: { [row]: SEND_LINK_SPREAD_MS },
});

/**
 * A held key's timer runs from its down in the firmware; the replay puts the down on the key's
 * first redraw (D8), here the `#` that 123 types (`text/hold-hash-back`: 1026 ms vs 1010 + 49).
 */
const HOLD_FROM_REDRAW: TimelineOptions = { toleranceMs: 35 };

/**
 * The scenario options of plan 18's goldens that are not the default (`messagesScenario()`), by
 * the task that promoted them.
 */
export const MESSAGES_OPTIONS: Readonly<Record<string, TimelineOptions>> = {
  // Task 8. Welcome note erased plays welcome/erase-empty's timeline; plan 15's recordings of
  // the notes play plan 18's; No phone numbers plays text/number-search-empty's.
  "welcome/save-empty": OTHER_RECORDING,
  "welcome/plan15-erase": OTHER_RECORDING,
  "welcome/plan15-save-long": OTHER_RECORDING,
  "sms/centre-1-ok-empty": OTHER_RECORDING,
  // Task 10.
  // Rows 0-9 are the virgin T9 editor and its Options (plan 18b, D3): the replay's multi-tap
  // editor reaches the Dictionary list on Dictionary off directly; compared from there.
  "text/dictionary-off": { fromRow: 10 },
  // The commit runs 1449-1452 ms after the letter's redraw between recordings (TEXT_TIMINGS is
  // text/commit's 1452.2).
  "text/hold-digit": OTHER_RECORDING,
  "text/hold-digit-pending": OTHER_RECORDING,
  "text/hold-one": OTHER_RECORDING,
  "text/hold-zero": OTHER_RECORDING,
  "text/hold-hash-back": HOLD_FROM_REDRAW,
  "text/case-numeric-back": HOLD_FROM_REDRAW,
  "text/number-hold-2": OTHER_RECORDING,
  "text/number-hold-hash": OTHER_RECORDING,
  "sms/save-empty": OTHER_RECORDING,
  // No phone numbers plays text/number-search-empty's 2914 ms; this recording's runs 2883 ms.
  "sms/send-to-many": { toleranceMs: 35 },
  "text/input-routing-ok": sendRecording(11),
  "sms/send-by-set-numeric": sendRecording(32),
  "sms/send-by-set-alphanumeric": sendRecording(17),
};

/** Every asserted plan 18 golden's scenario (tests/acceptance/18-messages-and-chat.test.ts). */
export const MESSAGES_SCENARIOS: Readonly<Record<string, (id: string) => void>> =
  Object.fromEntries(
    [...MESSAGES_ASSERTED].map((id) => [id, messagesScenario(MESSAGES_OPTIONS[id])]),
  );

/** The leaves plan 18's features bind, by a golden that shows each (the coverage guard). */
export const MESSAGES_COVERS: Readonly<Record<string, readonly string[]>> = {
  "text/editor": ["2-1"],
  "welcome/editor": ["6-2-3"],
  "sms/centre-1": ["2-7-1-1"],
  "sms/centre-2": ["2-7-2-1"],
  "sms/voice-mailbox": ["2-9"],
};

/** Asserted plan 18 goldens whose scenario cannot pass, with the reason. */
export const MESSAGES_KNOWN_GAPS: Readonly<Record<string, string>> = {
  "text/commit-gap":
    "the 1450 ms key gap's second 2 reached the firmware after the first A's commit (1452 ms " +
    "after its redraw): the capture's gap includes key-scan latency that varies between keys, " +
    "while the replay gives every key the same (D8), so its second key cycles A to B; the " +
    "1400 ms shots match",
};
