// Drive plan 22's goldens as `gen_v639_plan22.py` captured them: a phone over a test network
// (the synthetic cell, an outgoing call held alerting under CAP_MO_HOLD), the setup played as
// harness tokens from a settled standby, then the recording's keys and network events.
import type { PhoneKey } from "@hellotimber/phone-core";
import { expect } from "vite-plus/test";
import {
  ALL_CALL_CASES,
  CALL_RECORDINGS,
  stillFixtureOf,
  type CallCase,
} from "../../scripts/capture-sets/22-calls.ts";
import type {
  StockCallControl,
  StockOutgoingCall,
  SyntheticRing,
} from "@hellotimber/phone-services/calls/network";
import type { StockNetworkPort } from "@hellotimber/phone-services/messaging/network";
import { createSyntheticNetwork } from "@hellotimber/phone-services/messaging/network";
import { CALL_TIMINGS } from "@hellotimber/phone-services/calls/telephone";
import { englishT9 } from "@hellotimber/nokia-kit/ui/text/t9/english";
import { expectLcd, expectTimeline, type RecordedTimeline } from "./golden.ts";
import { goldenImage, loadGolden } from "./goldens.ts";
import { standbyRig, type Rig } from "./rig.ts";
import { soundStorage } from "./sound-scenarios.ts";
import { expectSoundTimeline, loadSoundGolden } from "./sound.ts";
import { readPlanIndex } from "../../scripts/golden-index.ts";
import { GOLDENS, type Scenario } from "./acceptance.ts";
import { CALL_SCRIPTS } from "./call-scripts.ts";

/** The capture's cell: rings, the far end's hangup and answer. */
export interface CallNetwork {
  readonly network: ReturnType<typeof createSyntheticNetwork>;
  /** Every number the phone dialled. */
  readonly dialled: readonly StockOutgoingCall[];
  event(name: string): void;
}

/** A synthetic network whose outgoing calls stay alerting until `answer` when `moHold`. */
export function callNetwork(moHold = false): CallNetwork {
  const base = createSyntheticNetwork();
  const dialled: StockOutgoingCall[] = [];
  let outgoing: StockCallControl | undefined;
  const rings: SyntheticRing[] = [];
  const network = {
    ...base,
    dial(call: StockOutgoingCall, phone: StockCallControl) {
      dialled.push(call);
      outgoing = phone;
      if (!call.emergency) {
        phone.alerting();
        if (!moHold) phone.connected();
      }
      return {
        answer() {},
        hangUp() {
          outgoing = undefined;
        },
      };
    },
  };
  return {
    network,
    dialled,
    event(token) {
      const [name, arg] = token.split(":");
      if (name === "callin") {
        rings.push(base.ring(arg!));
        return;
      }
      if (name === "answer") {
        outgoing?.connected();
        return;
      }
      // hangup: a ringing or answered incoming call, else the outgoing one.
      const ring = rings.find((r) => r.state !== "ended");
      if (ring !== undefined) ring.hangUp();
      else {
        outgoing?.released(arg === undefined ? undefined : Number(arg));
        outgoing = undefined;
      }
    },
  };
}

export interface CallRig extends Rig {
  readonly net: CallNetwork;
}

/** A phone at a settled standby in `state` over a fresh test network. */
export function callRig(
  state: "virgin" | "factory" = "virgin",
  moHold = false,
  english = false,
  configure: (network: StockNetworkPort) => StockNetworkPort = (network) => network,
): CallRig {
  const net = callNetwork(moHold);
  // The editor's words are the real English dictionary's (`22` is `Cc`, not the fixture's).
  const t9 = english ? { t9: { english: englishT9 } } : {};
  if (state === "virgin")
    return Object.assign(standbyRig({ network: configure(net.network), ...t9 }), { net });
  const rig = standbyRig({
    network: configure(net.network),
    storage: soundStorage("factory"),
    ...t9,
  });
  rig.press("c", 1500);
  rig.advance(1000);
  return Object.assign(rig, { net });
}

const KEY_NAMES: Readonly<Record<string, PhoneKey>> = { menu: "navi", pwr: "power" };
const phoneKey = (name: string): PhoneKey => KEY_NAMES[name] ?? (name as PhoneKey);

/** A harness tap (`key`): ≈42 ms down, the 250 ms settle and the 300 ms key gap. */
const TAP_DOWN_MS = 42;
const TAP_MS = 592;
const HOLD_SETTLE_MS = 250;
/** A tap's typical key-to-redraw latency in the captures (≈50-75 ms). */
const SETUP_LATENCY_MS = 60;

/** Plays harness tokens (`play`): taps, `k@ms` holds, `+ms` waits, `!event` network events. */
export function play(rig: CallRig, tokens: string): void {
  for (const token of tokens.split(/\s+/).filter(Boolean)) {
    if (token.startsWith("+")) rig.advance(Number(token.slice(1)));
    else if (token.startsWith("!")) rig.net.event(token.slice(1));
    else {
      const held = /^(.+)@(\d+)$/.exec(token);
      if (held !== null) {
        rig.press(phoneKey(held[1]!), Number(held[2]));
        rig.advance(HOLD_SETTLE_MS);
        // The captures hold C to reach standby; nokia-os's kernel swallows a key held across a
        // leaf's exit (plan 20's caseRig), so C is held again from the level it returned to.
        for (let i = 0; held[1] === "c" && i < 3 && rig.phone.path.startsWith("menu"); i++) {
          rig.press("c", Number(held[2]));
          rig.advance(HOLD_SETTLE_MS);
        }
      } else {
        // The firmware's redraw follows a tap by its latency: timers the setup's last key starts
        // (a prompt's cursor blink) run that much later in the capture than at the key.
        rig.advance(SETUP_LATENCY_MS);
        rig.press(phoneKey(token), TAP_DOWN_MS);
        rig.advance(TAP_MS - TAP_DOWN_MS - SETUP_LATENCY_MS);
      }
    }
  }
}

/**
 * A recording's raw edges (`rec_keys`): a tap 60 ms down then 240 ms, `k@ms` then 250 ms. A tap
 * is replayed down and up at once (D8: a key acts on the row its effect starts, as every plan's
 * scenarios press; the kernel opens menu entries on the release), a held key for its hold.
 */
const REC_TAP_MS = 60;
const REC_GAP_MS = 240;
/** A later key's effect is the golden's first change this soon after it (its latency). */
const KEY_SNAP_MS = 120;
const KEY_SNAP_LEAD_MS = 30;

interface Edge {
  readonly atMs: number;
  readonly run: (rig: CallRig) => void;
  /** A key's down (or up) edge and its key. */
  readonly down?: boolean;
  readonly key?: PhoneKey;
  /** A network event's token (`callin:<n>`). */
  readonly token?: string;
  /** The first redraw it causes, as the golden aligns it (a ring: its ringing screen). */
  readonly kind: "key" | "net";
}

function edges(tokens: string): Edge[] {
  const out: Edge[] = [];
  let t = 0;
  for (const token of tokens.split(/\s+/).filter(Boolean)) {
    if (token.startsWith("+")) {
      t += Number(token.slice(1));
      continue;
    }
    if (token.startsWith("!")) {
      out.push({
        atMs: t,
        kind: "net",
        token: token.slice(1),
        run: (rig) => rig.net.event(token.slice(1)),
      });
      continue;
    }
    const held = /^(.+)@(\d+)$/.exec(token);
    const key = phoneKey(held === null ? token : held[1]!);
    const holdMs = held === null ? 0 : Number(held[2]);
    out.push({ atMs: t, kind: "key", key, down: true, run: (rig) => rig.hold(key) });
    out.push({ atMs: t + holdMs, kind: "key", key, down: false, run: (rig) => rig.release(key) });
    t += held === null ? REC_TAP_MS + REC_GAP_MS : holdMs + HOLD_SETTLE_MS;
  }
  return out.sort((a, b) => a.atMs - b.atMs);
}

/** How a recording was made (`gen_v639_plan22.py`): its state, setup and recorded tokens. */
export interface CallScript {
  readonly state?: "factory";
  readonly moHold?: true;
  readonly setup: string;
  readonly keys: string;
}

/** The rig a script's recording starts from: its state, then its setup. */
export function scriptRig(script: CallScript, english = false): CallRig {
  const rig = callRig(script.state ?? "virgin", script.moHold ?? false, english);
  play(rig, script.setup);
  return rig;
}

/** When the phone shows a ring from `number` (its link time, D10). */
function ringDelayMs(number: string): number {
  const digits = number.replace(/^\+/, "").length;
  return CALL_TIMINGS.ringMs + (digits > 14 ? CALL_TIMINGS.longNumberRingMs : 0);
}

/**
 * A timeline golden from its script: the setup, then the recorded tokens from the trigger on, the
 * golden aligned on the trigger's first redraw (a key's at the key: its latency is not
 * reproduced; an interruption's on the ringing screen).
 */
export function callRecording(id: string, script: CallScript, suppliedRig?: CallRig): void {
  const golden = loadGolden(id);
  const rows = golden.timeline!;
  const t = golden.triggerFrame as number;
  const rig = suppliedRig ?? scriptRig(script, id.includes("-editor-"));
  const recorded = CALL_RECORDINGS.find((r) => `calls/${r.dir.replace(/\//g, "-")}` === id);
  // A golden cut from the middle of its recording (Snake II's game) starts at the ringing screen.
  const cut = (recorded?.frames?.from ?? 0) > 0;
  // The recording's first frame is the screen the setup left.
  if (!cut) expectLcd(rig.paint(), goldenImage(id, rows[0]!.image), `${id}: before the recording`);
  const all = edges(script.keys);
  const [first, ...rest] = all;
  // A ring is aligned on its ringing screen: the cell's paging delay is not the phone's, so the
  // recorded events after it keep their time from the golden's ringing screen.
  const callinEdge = all.find((e) => e.kind === "net" && e.token?.startsWith("callin:"));
  const ringAligned = recorded?.triggerFrame === "ring" || callinEdge === first;
  const ringAt =
    callinEdge === undefined || !ringAligned
      ? undefined
      : callinEdge.atMs - first!.atMs + ringDelayMs(callinEdge.token!.slice("callin:".length));
  const shift = ringAt === undefined || (t === 0 && !cut) ? 0 : ringAt - rows[t]!.startMs;
  const netFirst = first?.kind === "net";
  const last = rows[rows.length - 1]!;
  const lead = netFirst ? 3000 : 0;
  const span = last.startMs + last.durationMs + 200 + lead + Math.max(0, shift);
  // D8: a later key goes down on the golden row its effect starts (the first change within
  // KEY_SNAP_MS of the key), its latency not reproduced; one that changes nothing keeps its time.
  const offset = ringAt !== undefined ? shift : -(rows[t]?.startMs ?? 0);
  const snap = (e: Edge): number => {
    const after = callinEdge !== undefined && e.atMs >= callinEdge.atMs && e !== callinEdge;
    const unsnapped = e.atMs - first!.atMs + (after ? shift : 0);
    if (
      e.kind !== "key" ||
      e.down !== true ||
      (t === 0 && !cut) ||
      (netFirst && ringAt === undefined)
    ) {
      return unsnapped;
    }
    const row = rows.find(
      (r, i) => i > t && r.startMs >= e.atMs && r.startMs <= e.atMs + KEY_SNAP_MS,
    );
    // Just ahead of the row: a timer of the screen due within it (the ringing screen's blink)
    // is pre-empted by the key, as the firmware's key-down did.
    return row === undefined
      ? unsnapped
      : Math.max(unsnapped, row.startMs - KEY_SNAP_LEAD_MS + offset);
  };
  const downAt = new Map<string, number>();
  const schedule = rest.map((e) => {
    let atMs = snap(e);
    if (e.kind === "key" && e.down === true)
      downAt.set(e.key!, atMs - (e.atMs - first!.atMs + shift));
    else if (e.kind === "key") atMs += downAt.get(e.key!) ?? 0;
    return { atMs: Math.max(1, atMs), run: () => e.run(rig) };
  });
  const recording = rig.record(
    span,
    first === undefined ? undefined : () => first.run(rig),
    schedule,
  );
  // A golden whose trigger changes nothing at once starts with the screen already shown.
  let aligned: RecordedTimeline =
    t === 0 ? { ...recording, triggerMs: recording.frames[0]!.startMs } : recording;
  if ((t > 0 || cut) && ringAt !== undefined) {
    aligned = { ...recording, triggerMs: recording.triggerMs + ringAt };
  } else if (netFirst && t > 0) {
    // Another network event's first redraw is the cell's timing: aligned on it.
    const shown = recording.frames.find((f) => f.startMs > recording.triggerMs);
    expect(shown, `${id}: no redraw after the network's event`).toBeDefined();
    aligned = { ...recording, triggerMs: shown!.startMs };
  }
  // A golden cut from a longer recording (`frames`) ends where the cut is, not where its last
  // frame did: its last frame's duration is a lower bound.
  const compared =
    recorded?.frames === undefined
      ? golden
      : {
          ...golden,
          timeline: rows.map((row, i) =>
            i === rows.length - 1 ? { ...row, lowerBound: true } : row,
          ),
        };
  expectTimeline(
    aligned,
    compared,
    `${id}: ${script.setup ? `${script.setup}, then ` : ""}${script.keys}`,
  );
}

// ---------------------------------------------------------------- stills

/** The rig a still case starts from: its state and the setup its section played. */
function caseRig(c: CallCase): CallRig {
  const rig = callRig(c.state ?? "virgin");
  if (c.setup !== undefined) play(rig, c.setup);
  return rig;
}

/** Every image of still fixture `id`: its case replayed from a settled standby, then compared. */
export function callStill(id: string): void {
  const golden = loadGolden(id);
  const cases = ALL_CALL_CASES.filter((c) => stillFixtureOf(c).id === id);
  expect(cases.map((c) => stillFixtureOf(c).image)).toEqual(golden.images.map((i) => i.name));
  for (const c of cases) {
    const rig = caseRig(c);
    play(rig, c.keys);
    expectLcd(rig.paint(), goldenImage(id, stillFixtureOf(c).image), `${c.name}: ${c.keys}`);
  }
}

// ---------------------------------------------------------------- sound

/** A sound golden from its script: the setup, then the golden's keys and the script's events. */
export function callSound(id: string, script: CallScript): void {
  const golden = loadSoundGolden(id);
  const rig = scriptRig(script);
  const all = edges(script.keys);
  // A ring's sound starts with its ringing screen, whose paging delay is the cell's: the ring
  // reaches the phone so that its first event falls on the golden's (as LCD rings align).
  const callin = all[0]?.token?.startsWith("callin:") === true ? all[0] : undefined;
  const onset = golden.rows[0]?.ms;
  const ringShift =
    callin === undefined || onset === undefined
      ? 0
      : onset - ringDelayMs(callin.token!.slice("callin:".length));
  const origin = rig.now + Math.max(0, -ringShift);
  const seen = rig.sounds.length;
  const actions: { ms: number; run: () => void }[] = [];
  for (const k of golden.keys ?? []) {
    const key = k.key as PhoneKey;
    actions.push({ ms: k.ms, run: () => rig.hold(key) });
    actions.push({ ms: k.ms + (k.holdMs ?? 0), run: () => rig.release(key) });
  }
  // Network events at their script times (from the first token, as the golden's keys).
  for (const e of all) {
    if (e.kind === "net") {
      actions.push({ ms: e === callin ? e.atMs + ringShift : e.atMs, run: () => e.run(rig) });
    }
  }
  actions.sort((a, b) => a.ms - b.ms);
  const end = Math.max(golden.rows.at(-1)?.ms ?? 0, (actions.at(-1)?.ms ?? 0) + 100) + 500;
  for (const action of actions) {
    rig.advance(Math.max(0, origin + action.ms - rig.now));
    action.run();
  }
  rig.advance(origin + end - rig.now);
  expectSoundTimeline(
    { originMs: origin, endMs: rig.now, events: rig.sounds.slice(seen) },
    golden,
    `${id}: ${script.setup}, then ${golden.note ?? ""}`,
  );
}

// ---------------------------------------------------------------- acceptance (Task 10)

const PLAN_22_INDEX = readPlanIndex(GOLDENS, "22");

/** Every plan 22 golden's scenario: stills replay their case, the rest their script. */
export const CALLS_SCENARIOS: Readonly<Record<string, Scenario>> = Object.fromEntries(
  // Plan 19's and 22b's goldens wait for their plans' scenarios.
  PLAN_22_INDEX.filter((e) => e.status === "asserted").map((e) => {
    if (e.kind === "still") return [e.id, (id: string) => callStill(id)];
    const script = CALL_SCRIPTS[e.id];
    if (script === undefined) throw new Error(`No script for ${e.id}.`);
    const run = e.id.startsWith("sound/") ? callSound : callRecording;
    return [e.id, (id: string) => run(id, script)];
  }),
);

/** The register's tree nodes these goldens cover (with content; plan 14's cover them empty). */
export const CALLS_COVERS: Readonly<Record<string, readonly string[]>> = {
  "calls/register-missed-open": ["4-1"],
  "calls/register-received-open": ["4-2"],
  "calls/register-dialled-open": ["4-3"],
  "calls/register-erase-lists-all": ["4-4"],
  "calls/durations": ["4-5"],
  "calls/durations-clear-timers": ["4-5-5"],
};

/** Asserted plan 22 goldens whose scenario cannot pass, with the reason. */
export const CALLS_KNOWN_GAPS: Readonly<Record<string, string>> = {
  ...Object.fromEntries(
    [
      "calls/interrupt-editor-reject",
      "calls/interrupt-editor-answer-end",
      "calls/interrupt-editor-missed",
    ].map((id) => [
      id,
      "the editor's `22` reads `Cc` in the firmware's T9 dictionary and `Ac` in nokia-os's " +
        "English dictionary (plan 18b), so the screen below the ring differs from the first frame",
    ]),
  ),
  "calls/interrupt-note-reject":
    "the handset over the screen below a rejected call stays until the cell's release: 684 ms " +
    "here, 444-520 ms over the menu, calculator and option list (CALL_TIMINGS.handsetAfterRejectMs " +
    "482 ms); the cell's timing, not the phone's (D10)",
  "calls/interrupt-option-list-missed":
    "the caller's hangup shows 109 ms after it here and 244-265 ms in the other missed calls (the " +
    "cell's paging cycle paces the release; CALL_TIMINGS.missedReleaseMs 268 ms)",
  ...Object.fromEntries(
    ["calls/interrupt-snake-reject", "calls/interrupt-snake-answer-end"].map((id) => [
      id,
      "the ringing screen's erase before Snake II's game menu lasts 35 ms (one millisecond over a " +
        "partial redraw) and the menu then shows with the handset: nokia-os suspends the game " +
        "when the call leaves the screen, without that frame",
    ]),
  ),
  "calls/register-edit-number-c":
    "the number prompt's cursor blinks from its opening (plan 18's number entry); C's redraw in " +
    "the capture came 139 ms after the key, so the blink lands 124 ms early against the aligned C",
  "calls/register-standby-up-c-held":
    "C held past the list's exit: the firmware redraws standby again ≈460 ms later (86 ms without " +
    "the operator); phone-core swallows a key held across an exit",
  "calls/register-standby-up-call":
    "the synthetic cell alerted this call 2107 ms after Call, 150 ms sooner than every other " +
    "capture (2253-2262 ms, CALL_TIMINGS.alertingMs); the link times are the cell's (D10)",
  "calls/ring-notice-c":
    "C on the missed-call notice: the firmware draws standby without its operator for 75 ms " +
    "first; phone-core clears a notice to the whole standby at once (as plan 18's sms/notice-c)",
  "calls/ring-notice-navi-held":
    "Navi held on the notice opens List at its key-down in the firmware; phone-core opens a " +
    "notice's application on a short press only",
  "sound/calls/dtmf-hold-1":
    "1 held into the voice mailbox call: the firmware sounds a 1750 Hz tone (524-816 ms, keypad " +
    "then earpiece words) before Calling; nokia-os sounds the DTMF pair and the call's tones only",
  "sound/calls/end":
    "End in a call: after the key's beep in the earpiece the firmware sounds 900 Hz at the keypad " +
    "word for 13 ms and at 0x7000 for 54 ms; nokia-os sounds the key's beep only",
  ...Object.fromEntries(
    ["sound/calls/ring-ascending-vibrator-off", "sound/calls/ring-ascending-vibrator-on"].map(
      (id) => [
        id,
        "Ascending's ramp: the ring's passes step the volume v=4, 7, 10…; plan 16's ascendingAt " +
          "positions (measured on the preview) ramp within the first pass",
      ],
    ),
  ),
  "sound/calls/ring-keys":
    "keys while ringing: the firmware stops the ring at ▲ and starts it again 2.7 s later (after " +
    "Volume); nokia-os keeps it ringing",
};

/** Scenarios that replay long setups (21 calls, 12 missed calls). */
export const CALLS_TIMEOUTS_MS: Readonly<Record<string, number>> = Object.fromEntries(
  PLAN_22_INDEX.map((e) => [e.id, 30_000]),
);
