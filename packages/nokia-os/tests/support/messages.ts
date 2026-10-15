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
import { parseManifestNote } from "../../scripts/messages-capture-set.ts";
import { readPlanIndex } from "../../scripts/golden-index.ts";
import { Framebuffer } from "@hellotimber/phone-screen";
import { paintWidget, type WidgetModel } from "../../src/display/widgets";
import { editorModel } from "../../src/widgets/editor";
import { GOLDENS } from "./acceptance.ts";
import { lcdMismatch } from "./golden.ts";
import { loadGolden } from "./goldens.ts";
import { cursorOnly } from "./replay.ts";
import type { TextMode, TextState } from "../../src/text/multitap";
import { PROBE_TOLERANCE_MS } from "./golden.ts";
import { replayScenario, type ReplayContext, type TimelineOptions } from "./replay.ts";
import { standbyRig, type Rig } from "./rig.ts";
import {
  createSyntheticNetwork,
  type StockTimestamp,
  type SyntheticNetwork,
} from "../../src/index";
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
 * Menu, ▼ to Messages, Select (its first page, Write messages), Select: 2968 ms of taps and
 * waits, then 2858 ms so that the whole takes the log's Menu 2 1 and polls (5826 ms).
 */
const WRITE_MESSAGES_BY_SELECT: readonly string[] = [
  "key menu",
  "run 400ms",
  "key down",
  "key menu",
  "run 1000ms",
  "key menu",
  "run 2858ms",
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
    // Menu 2 1, then the log polled the LCD every 250 ms (5 polls) for Write messages. The stock
    // shortcut opens 2-1 once Messages' `1` can no longer become `10` (plan 14 D14), and its
    // window stays open over the editor, taking the digits typed into it (phone-core): the replay
    // opens Write messages with Menu, ▼, Select, Select instead, the next key as late as the log's.
    if (
      lines[i] === "key menu" &&
      lines[i + 1] === "run 400ms" &&
      lines[i + 2] === "key 2 1" &&
      lines[i + 3] === "run 3000ms" &&
      lines.slice(i + 4, i + 9).every((line) => line === "run 250ms")
    ) {
      out.push(...WRITE_MESSAGES_BY_SELECT);
      i += 8;
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

/**
 * The emulator's clock runs this far ahead of the logs' emulated time (its start-up before the
 * setup's first command): `sms/inbox-view-1` down-02 (`10:11:20`) and `sms/inbox-details` 03
 * (`10:11:33`) bound it to 1888-2504 ms.
 */
const CAPTURE_CLOCK_OFFSET_MS = 2200;

/**
 * The captures' SMS time stamps: the harness's `CAP_EPOCH` (the logs' `epoch`: 13 October 2026,
 * 10:10:00 UTC, as the phone shows it) plus the emulated time since power-on.
 */
export function captureStamp(epochMs: number, capMs: number): StockTimestamp {
  const ms = capMs + CAPTURE_CLOCK_OFFSET_MS;
  const at = new Date(epochMs + Math.floor(ms / 1000) * 1000);
  return {
    year: at.getUTCFullYear(),
    month: at.getUTCMonth() + 1,
    day: at.getUTCDate(),
    hour: at.getUTCHours(),
    minute: at.getUTCMinutes(),
    second: at.getUTCSeconds(),
  };
}

/**
 * The emulator's SMS helper as the phone receives it: an alphanumeric sender arrives as `12345`
 * (Task 0 I: `Nokia`, an emulator artefact).
 */
const CAPTURE_SENDERS: Readonly<Record<string, string>> = { Nokia: "12345" };

/** Logs run with another SIM inserted (`sim-2`: plan 15's second SIM fixture, D7). */
const CAPTURE_SIMS: Readonly<Record<string, string>> = { "plan18/sim-2": "sim-2" };

/** Each replayed phone's synthetic network, which the logs' `sms` commands deliver through. */
const NETWORKS = new WeakMap<Rig, SyntheticNetwork>();

/** Plan 18's capture logs on a virgin stock phone (`standbyRig` stands for the setup). */
export const MESSAGES_REPLAY: ReplayContext = {
  scripts: MESSAGES_CAPTURE_SCRIPTS,
  rewrite: messagesRewrite,
  setup(storage, script) {
    const network = createSyntheticNetwork();
    const rig = standbyRig({
      storage,
      network,
      ...(script in CAPTURE_SIMS ? { sim: CAPTURE_SIMS[script] } : {}),
    });
    NETWORKS.set(rig, network);
    return rig;
  },
  setupMs: SETUP_MS,
  sms(rig, from, text, capMs, epochMs) {
    const network = NETWORKS.get(rig);
    if (network === undefined) throw new Error("No network for this phone.");
    const sentAt = captureStamp(epochMs, capMs);
    network.deliver({ number: CAPTURE_SENDERS[from] ?? from, text, sentAt });
  },
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

/** A box's recording: `Opening` lasts 35-78 ms between recordings (the SIM read). */
const OPENING: TimelineOptions = { toleranceMs: 45 };

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
  // Task 11. Arrivals: the notice lands RECEIVE_LINK_MS after the delivery, within the spread.
  ...Object.fromEntries(
    [1, 2, 3, 4, 5].map((n) => [`sms/arrive-${n}`, { anchors: { 1: RECEIVE_LINK_SPREAD_MS } }]),
  ),
  "sms/inbox-option-reply-send": sendRecording(11),
  "sms/elsewhere-sending": sendRecording(11),
  // Opening lasts 35-78 ms between recordings (2-2's own: 60 ms, 2-3's: 45 ms).
  "sms/inbox-menu-2-2": OPENING,
  "sms/notice-read": OPENING,
  "sms/notice-count-read": OPENING,
  "sms/notice-inbox-menu": OPENING,
  "sms/inbox-read": OPENING,
  "sms/outbox-open": OPENING,
  "sms/persist-inbox": OPENING,
  "sms/persist-outbox": OPENING,
  "sms/restore-inbox": OPENING,
  "sms/restore-outbox": OPENING,
  "sms/full-persist-inbox-open": OPENING,
  "sms/full-persist-outbox-open": OPENING,
  "sms/sim-second-inbox": OPENING,
  "sms/sim-second-outbox": OPENING,
  "sms/sim-same-inbox": OPENING,
  "sms/sim-same-outbox": OPENING,
  // Erasing message, Erased and No more messages replay sms/inbox-option-erase's timelines.
  "sms/outbox-erase": OTHER_RECORDING,
  "sms/outbox-erase-last": OTHER_RECORDING,
  "sms/inbox-erase-last": OTHER_RECORDING,
  // No number found plays No phone numbers' timeline (2914 ms; this recording 2883 ms).
  "sms/outbox-use-number": { toleranceMs: 35 },
  // The shortcut window's end (the indicator) varies 2920-2948 ms (plan 14 P5): not timed.
  "sms/elsewhere-menu": { untimedRows: new Set([1]) },
  "sms/elsewhere-messages-menu": { untimedRows: new Set([1]) },
  // The game's ticks run from its start, whose key latency the replay approximates: the first
  // tick sets their phase.
  "sms/elsewhere-snake": { anchors: { 1: 60 } },
  // A sixteenth arrival on a full SIM is refused 2601 ms after the delivery, past the arrivals'
  // spread (RECEIVE_LINK_MS 2324): its link time is the synthetic cell's (D10), not compared.
  "sms/full-arrival": { anchors: { 6: 300 } },
  // Settings restored plays plan 15's timeline (probe/accept-c7-restore).
  "sms/restore-ok": OTHER_RECORDING,
};

// ---------------------------------------------------------------- glyph sheets

/** Rows `y0..y1`, columns `x0..x1` of an 84-column frame; the rest clear. */
function crop(pixels: Uint8Array, x0: number, x1: number, y0: number, y1: number): Uint8Array {
  const out = new Uint8Array(84 * 48);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) out[y * 84 + x] = pixels[y * 84 + x]!;
  }
  return out;
}

const SMS_SPEC = { counter: "sms", limit: SMS_LIMIT, layout: "sms", softkey: "Options" } as const;

/** The editor holding `text` (the cursor at its end), the cursor shown or hidden. */
function editorFrame(text: string, mode: TextMode, cursorShown: boolean): Uint8Array {
  const state: TextState = { ...emptyText(mode), text, cursor: Array.from(text).length };
  const fb = new Framebuffer();
  paintWidget(fb, editorModel(state, SMS_SPEC, 0, cursorShown).model);
  return fb.pixels;
}

interface GlyphSheet {
  /** The region compared: x0, x1, y0, y1. */
  readonly region: readonly [number, number, number, number];
  /** The screens the stock painter draws for image `image` (`char` typed), either blink phase. */
  frames(char: string, image: number): Uint8Array[];
}

/**
 * Where each glyph sheet's character is drawn (`scripts/messages-capture-set.ts` `glyphEntries`)
 * and the screen the stock painter draws for it.
 */
const GLYPH_SHEETS: Readonly<Record<string, GlyphSheet>> = {
  // The Name: prompt's box (plan 19's Add name as a vehicle) with the character pending.
  "glyphs/large": {
    region: [1, 82, 18, 36],
    frames(char) {
      const model: WidgetModel = {
        kind: "prompt",
        icons: ["prompt/pen"],
        label: ["Name:"],
        entry: { kind: "text", text: char },
        cursor: false,
        softkey: "OK",
      };
      const fb = new Framebuffer();
      paintWidget(fb, model);
      return [fb.pixels];
    },
  },
  // The editor's first text line after Use inserted the symbol.
  "glyphs/small": {
    region: [0, 83, 7, 17],
    frames: (char) => [editorFrame(char, "Abc", true), editorFrame(char, "Abc", false)],
  },
  // The editor's header: empty in Abc, ABC, abc and 123, then after 175 characters (abc, 284/2).
  "glyphs/digits": {
    region: [0, 83, 0, 5],
    frames(_label, image) {
      const modes: readonly TextMode[] = ["Abc", "ABC", "abc", "123"];
      const mode = modes[image];
      return [
        mode === undefined
          ? editorFrame("a".repeat(175), "Abc", false)
          : editorFrame("", mode, false),
      ];
    },
  },
};

/**
 * A glyph sheet (D6): each image's character, drawn by the stock fonts on the screen the capture
 * typed it into, shows as the capture shows it within the sheet's region (the rest is the
 * vehicle's: plan 19's prompt, the editor around it).
 */
function glyphScenario(id: string): void {
  const golden = loadGolden(id);
  const chars = parseManifestNote(golden.note);
  const sheet = GLYPH_SHEETS[id];
  if (chars === undefined || sheet === undefined) throw new Error(`${id} is not a glyph sheet.`);
  const [x0, x1, y0, y1] = sheet.region;
  golden.images.forEach((image, i) => {
    const want = crop(image.pixels, x0, x1, y0, y1);
    const ref = { id, image: { ...image, pixels: want } };
    const context = `${id} image ${image.name}: ${JSON.stringify(chars[i])}`;
    const frames = sheet.frames(chars[i]!, i).map((pixels) => crop(pixels, x0, x1, y0, y1));
    if (frames.some((pixels) => lcdMismatch(pixels, ref, context) === undefined)) return;
    if (frames.some((pixels) => cursorOnly(want, pixels))) return;
    throw new Error(lcdMismatch(frames[0]!, ref, context));
  });
}

/**
 * Every asserted plan 18 golden's scenario (tests/acceptance/18-messages-and-chat.test.ts): its
 * capture replayed, or a glyph sheet's fonts.
 */
export const MESSAGES_SCENARIOS: Readonly<Record<string, (id: string) => void>> =
  Object.fromEntries(
    readPlanIndex(GOLDENS, "18")
      .filter((entry) => entry.status === "asserted")
      .map(({ id }) => [
        id,
        id.startsWith("glyphs/") ? glyphScenario : messagesScenario(MESSAGES_OPTIONS[id]),
      ]),
  );

/** The leaves plan 18's features bind, by a golden that shows each (the coverage guard). */
export const MESSAGES_COVERS: Readonly<Record<string, readonly string[]>> = {
  "text/editor": ["2-1"],
  "sms/inbox-list": ["2-2"],
  "sms/outbox-list": ["2-3"],
  "welcome/editor": ["6-2-3"],
  "sms/centre-1": ["2-7-1-1"],
  "sms/centre-2": ["2-7-2-1"],
  "sms/voice-mailbox": ["2-9"],
};

/** Asserted plan 18 goldens whose scenario cannot pass, with the reason. */
export const MESSAGES_KNOWN_GAPS: Readonly<Record<string, string>> = {
  "sms/notice":
    "image standby-down-after-c: ▼ at standby opens the Phone book (No phone numbers) in the " +
    "capture, while nokia-os's standby keys (plan 14's STOCK_STANDBY_KEYS, after the spec's " +
    "help text) put the dialled numbers on ▼; D12 keeps that configuration; the other six " +
    "images match",
  "sms/notice-c":
    "C on the received notice: the firmware draws standby without its operator for 88 ms first " +
    "(as Exit's 83 ms); the kernel clears a notice to the whole standby at once (phone-core)",
  "sms/elsewhere":
    "image snake-level-1-then-standby: C held in a moving Snake II game, then C, reaches " +
    "standby in the capture; the kernel swallows a key held across the game's exit (plan 23's " +
    "game/snake/keys-c-hold gap), so the replay stays in the games; the other three images match",
  "sms/time-format":
    "image standby: standby's clock in the 12-hour Time format (`10:10` with its mark) is the " +
    "clock plan's; nokia-os's standby draws the host's clock as given; the Sent: pages match",
  ...Object.fromEntries(
    ["sms/sim-same-new-process", "sms/sim-same-inbox", "sms/sim-same-outbox"].map((id) => [
      id,
      "a new emulator process with the same SIM fixture: the emulator's saveflash keeps phone " +
        "flash but not its in-memory SIM overlay, so the messages are gone (Task 0 F); nokia-os " +
        "keeps them in the EEPROM record of that SIM (D7), so the replay over the saved image " +
        "still has them",
    ]),
  ),
  "text/commit-gap":
    "the 1450 ms key gap's second 2 reached the firmware after the first A's commit (1452 ms " +
    "after its redraw): the capture's gap includes key-scan latency that varies between keys, " +
    "while the replay gives every key the same (D8), so its second key cycles A to B; the " +
    "1400 ms shots match",
};
