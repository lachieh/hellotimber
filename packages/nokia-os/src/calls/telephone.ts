// The phone's telephone (plan 22 D5, D8-D12): one call at a time, placed through or rung by the
// host's network port, with the phone's own link times. It keeps each call's state and times for
// the call screens (widgets/call.ts), sounds the ringback, the ringing and the network's end,
// writes the call register and the durations, and queues a ring that comes during a call.
import type { StockNetworkPort } from "../messages/network";
import type { StockSettings } from "../firmware/settings";
import type { SoundPlay } from "../sound/sequencer";
import type { StockSounder } from "../sound/sounder";
import type { StockCallLog } from "./log";
import type {
  StockCallControl,
  StockCallLink,
  StockIncomingCall,
  StockOutgoingCall,
} from "./network";
import {
  EARPIECE_STEPS,
  EMERGENCY_BEEP_AFTER_MS,
  emergencyProgram,
  earpieceWord,
  NET_END_BEEPS_AFTER_MS,
  netEndProgram,
  RINGBACK_AFTER_ALERTING_MS,
  ringbackProgram,
} from "./sounds";
import type { CallClock } from "./timestamp";

/**
 * The phone's link times (D10), from the captures' synthetic cell, each from the call's first
 * redraw (the key's latency is not reproduced): alerting's blank 2200 ms after Calling
 * (`dial/call`: 2253 - 53, five calls alike), the connect's blank 2845 ms after it (the traffic
 * channel's assignment), the ringing screen ≈1.9 s after the network's ring (`ring/screen`:
 * 1866-1873 ms at standby; the paging occasion varies it, 1958-2115 ms over other screens), 240 ms
 * more for a number of 15 digits or more (`ring/number-123456789012345`: two SETUP blocks).
 */
export const CALL_TIMINGS = {
  alertingMs: 2200,
  /** A resolved SIM name: ≈2065 ms from Calling (plan 19 hold/on-2). */
  namedAlertingMs: 2100,
  connectMs: 2845,
  /** A host's `connected` shows ≈94 ms later (`dial/alerting`: `answer` at 6301, the blank at 6395). */
  hostConnectMs: 94,
  ringMs: 1870,
  /** A ring that came during a call shows this long after that call left the screen (2506 ms). */
  queuedRingMs: 2506,
  longNumberRingMs: 240,
  /** Each blank redraw: alerting's 76, the connect's 73, End's 80, the network's end's 87 ms. */
  alertingBlankMs: 76,
  connectBlankMs: 73,
  endBlankMs: 80,
  netEndBlankMs: 87,
  /** `Menu` without the operator before standby (`dial/end-connected`: 85 ms). */
  standbyDrawMs: 85,
  /** End before the call alerts: Calling runs on until the release (`dial/end-calling`: 3000 - 53). */
  releaseBeforeAlertMs: 2947,
  /** The network's end: the checkered `Call 1` (`dial/net-end-connected`: 1471 ms). */
  netEndMs: 1471,
  /** A ring the caller abandons: the checkered `Call 1` (`ring/missed`: 664 ms). */
  missedMs: 664,
  /** The network's release shows after the host's event (`dial/net-end-connected`: 74 ms). */
  releaseMs: 74,
  /** A missed call's release (`ring/missed`: the blank 268 ms after the hangup). */
  missedReleaseMs: 268,
  /** The ringing stops this long after the caller's hangup (`sound/calls/ring-missed`: 167 ms). */
  ringStopMs: 167,
  /**
   * Answer: a blank (71 ms), the call, and the traffic channel's blank ≈870 ms after the key
   * (859-949 ms: `ring/answer` 859, `interrupt/menu-answer-end` 873, `-calculator-` 895,
   * `-option-list-` 949).
   */
  answerBlankMs: 71,
  answerConnectMs: 870,
  /** End on a call answered over the number entry: the call stays this long (`entry-answer-end`). */
  endOverEntryMs: 146,
  /** Reject at standby: the blank, `Call 1` (`ring/reject`: 76 ms, then 401 ms). */
  rejectBlankMs: 76,
  rejectCallMs: 401,
  /**
   * A call over another screen leaves it with the handset drawn on it this long: rejected
   * (444-520 ms: `interrupt/menu-reject` 444, `calculator-reject` 496, `option-list-reject` 520)
   * or missed (`interrupt/menu-missed`: 710 ms); over the number entry its characters stay with
   * End as long (`interrupt/entry-reject`: 446 ms).
   */
  handsetAfterRejectMs: 482,
  handsetAfterMissedMs: 710,
  /**
   * The DTMF digits keep `Options` 5684 ms after the first (`in-call/digit-5`, `-digit-held`) and
   * 4551 ms after the last (`in-call/digits`: 18 keys, End at 9662 ms).
   */
  digitsOptionsMs: 5684,
  digitsOptionsAfterLastMs: 4551,
  /** Volume shows this long after its last redraw, 42 ms after the last ▲/▼ (`ring/key-up`: 1905 ms). */
  volumeMs: 1903,
  volumeEraseMs: 42,
} as const;

export type CallDirection = "out" | "in";

/** One call and its times (kernel ms); undefined times have not happened. */
export interface StockCall {
  readonly direction: CallDirection;
  readonly number: string;
  readonly name?: string;
  readonly emergency: boolean;
  /** Out: the Call key; in: the ringing screen. */
  readonly startedAt: number;
  link: StockCallLink | undefined;
  hostAlerting?: number;
  hostConnected?: number;
  hostReleased?: number;
  answeredAt?: number;
  rejectedAt?: number;
  /** The user ended it (End, End active call). */
  endedAt?: number;
  /** Digits typed in the call (or, answered over the number entry, its characters). */
  digits: string;
  muted: boolean;
  /** Sounds playing for this call. */
  ringing?: SoundPlay;
  ringback?: SoundPlay;
  /** The call has left the screen and the register. */
  done: boolean;
  /** A call widget shows it (false: the screen below shows, with the handset). */
  onScreen: boolean;
  /** A screen of the call's own flow (Options, the power list) covers it: the handset shows. */
  covered?: boolean;
}

/** A call's phase at `now`, from its times and the link times. */
export type CallPhase =
  | "calling"
  | "alerting"
  | "connected"
  | "ringing"
  /** The user ended or rejected it. */
  | "ending"
  /** The network or the far end ended it. */
  | "released";

export interface TelephoneDeps {
  readonly network: StockNetworkPort | undefined;
  readonly sounder: StockSounder;
  readonly settings: StockSettings;
  readonly log: StockCallLog;
  readonly clock: CallClock;
  readonly now: () => number;
  /** Plan 19's seam: the phone book's name for a number (none until the phone book lands). */
  readonly nameOf?: (number: string) => string | undefined;
}

/** What a ring the host placed is waiting for. */
interface Ring {
  readonly call: StockIncomingCall;
  readonly link: StockCallLink;
  /** When it reached the phone. */
  readonly at: number;
  /** It came during a call: it waits for the call to end (`interrupt/ring-during-call`). */
  readonly queued: boolean;
  released: boolean;
}

export class StockTelephone {
  readonly #deps: TelephoneDeps;
  #call: StockCall | undefined;
  #rings: Ring[] = [];
  /** When the last call left the screen (a queued ring waits for it). */
  #lastFinish = -Infinity;
  /** Earpiece Volume, 1-10 (factory and virgin: 10, `in-call/up`). */
  #volume = EARPIECE_STEPS;
  #on = false;

  constructor(deps: TelephoneDeps) {
    this.#deps = deps;
  }

  get call(): StockCall | undefined {
    return this.#call;
  }

  /** The call register this telephone writes. */
  get log(): StockCallLog {
    return this.#deps.log;
  }

  get volume(): number {
    return this.#volume;
  }

  set volume(level: number) {
    this.#volume = Math.min(EARPIECE_STEPS, Math.max(1, level));
  }

  /** The earpiece's tone word at the current Volume (DTMF and call sounds in a call). */
  get earpieceWord(): number {
    return earpieceWord(this.#volume);
  }

  /** A call shows (or is on its way out). */
  get active(): boolean {
    return this.#call !== undefined && !this.#call.done;
  }

  powerOn(): void {
    this.#on = true;
  }

  /** Power-off hangs every call up (D5 rules); the lists are RAM (Task 0 F). */
  powerOff(): void {
    this.#on = false;
    const call = this.#call;
    if (call !== undefined && !call.done) {
      call.link?.hangUp();
      this.#stopSounds(call);
      call.done = true;
    }
    this.#call = undefined;
    for (const ring of this.#rings) ring.link.hangUp();
    this.#rings = [];
    this.#deps.log.powerOff();
  }

  /** Places an outgoing call now: Calling shows; the host hears of it at once. */
  dial(number: string, emergency = false): StockCall {
    const now = this.#deps.now();
    const name = emergency ? undefined : this.#deps.nameOf?.(number);
    const call: StockCall = {
      direction: "out",
      number,
      ...(name === undefined ? {} : { name }),
      emergency,
      startedAt: now,
      link: undefined,
      digits: "",
      muted: false,
      done: false,
      onScreen: true,
    };
    this.#call = call;
    const stamp = this.#deps.clock.stamp();
    if (!emergency) {
      this.#deps.log.add("dialled", {
        number,
        ...(name === undefined ? {} : { name }),
        ...(stamp === undefined ? {} : { at: stamp }),
      });
    }
    if (emergency) {
      this.#deps.sounder.callSound(
        emergencyProgram(this.earpieceWord),
        now + EMERGENCY_BEEP_AFTER_MS,
      );
    }
    const outgoing: StockOutgoingCall = {
      number,
      ...(name === undefined ? {} : { name }),
      emergency,
    };
    const control = this.#control(call);
    const network = this.#deps.network;
    try {
      call.link = network?.dial?.(outgoing, control);
    } catch {
      call.link = undefined;
    }
    if (network?.dial === undefined && !emergency) {
      // A port without `dial` behaves as the synthetic network: alerting and connected at once.
      control.alerting();
      control.connected();
    }
    return call;
  }

  /** The host rings the phone (StockNetworkPort.subscribeCalls). */
  ring(call: StockIncomingCall, link: StockCallLink): StockCallControl {
    const ring: Ring = { call, link, at: this.#deps.now(), released: false, queued: this.active };
    if (!this.#on) {
      // A ring while the phone is off is released at once (D5 rules).
      link.hangUp();
      ring.released = true;
    } else {
      this.#rings.push(ring);
    }
    return {
      alerting: () => {},
      connected: () => {},
      released: () => {
        if (ring.released) return;
        ring.released = true;
        const answered = this.#call;
        if (answered !== undefined && answered.direction === "in" && answered.link === link) {
          this.#release(answered);
        }
      },
    };
  }

  /**
   * The ring due now, if the phone can show it (no call up; a ring during a call waits, S22):
   * it becomes the current call and its ringing starts.
   */
  takeRing(): StockCall | undefined {
    if (this.active) return undefined;
    const now = this.#deps.now();
    this.#rings = this.#rings.filter((r) => !r.released);
    const due = this.#rings.find((r) => {
      const digits = r.call.number.replace(/^\+/, "").length;
      const linkMs = CALL_TIMINGS.ringMs + (digits > 14 ? CALL_TIMINGS.longNumberRingMs : 0);
      const afterCall = r.queued ? this.#lastFinish + CALL_TIMINGS.queuedRingMs : -Infinity;
      return now >= Math.max(r.at + linkMs, afterCall);
    });
    if (due === undefined) return undefined;
    this.#rings = this.#rings.filter((r) => r !== due);
    const name = this.#deps.nameOf?.(due.call.number);
    const call: StockCall = {
      direction: "in",
      number: due.call.number,
      ...(name === undefined ? {} : { name }),
      emergency: false,
      startedAt: now,
      link: due.link,
      digits: "",
      muted: false,
      done: false,
      onScreen: true,
    };
    this.#call = call;
    call.ringing = this.#deps.sounder.ring("tones");
    return call;
  }

  /** The phase of `call` at `now`. */
  phase(call: StockCall, now = this.#deps.now()): CallPhase {
    if (call.hostReleased !== undefined && now >= this.releasedAt(call)!) return "released";
    if (call.endedAt !== undefined || call.rejectedAt !== undefined) return "ending";
    if (call.direction === "in") return call.answeredAt === undefined ? "ringing" : "connected";
    const connected = this.connectedAt(call);
    if (connected !== undefined && now >= connected) return "connected";
    const alerting = this.alertingAt(call);
    if (alerting !== undefined && now >= alerting) return "alerting";
    return "calling";
  }

  /** When an outgoing call's alerting redraw comes (max of the link time and the host's event). */
  alertingAt(call: StockCall): number | undefined {
    if (call.hostAlerting === undefined) return undefined;
    const delay = call.name === undefined ? CALL_TIMINGS.alertingMs : CALL_TIMINGS.namedAlertingMs;
    return Math.max(call.startedAt + delay, call.hostAlerting);
  }

  /** When the call connects: out, the connect's redraw; in, the traffic channel after Answer. */
  connectedAt(call: StockCall): number | undefined {
    if (call.direction === "in") {
      return call.answeredAt === undefined
        ? undefined
        : call.answeredAt + CALL_TIMINGS.answerConnectMs;
    }
    if (call.hostConnected === undefined) return undefined;
    const alerting = this.alertingAt(call) ?? call.startedAt + CALL_TIMINGS.alertingMs;
    return Math.max(
      call.startedAt + CALL_TIMINGS.connectMs,
      call.hostConnected + CALL_TIMINGS.hostConnectMs,
      alerting + CALL_TIMINGS.alertingBlankMs,
    );
  }

  /** When the network's release shows. */
  releasedAt(call: StockCall): number | undefined {
    if (call.hostReleased === undefined) return undefined;
    const ringing = call.direction === "in" && call.answeredAt === undefined;
    return call.hostReleased + (ringing ? CALL_TIMINGS.missedReleaseMs : CALL_TIMINGS.releaseMs);
  }

  /** The user answers the ringing call. */
  answer(call: StockCall): void {
    if (call.answeredAt !== undefined || call.hostReleased !== undefined) return;
    call.answeredAt = this.#deps.now();
    this.#deps.sounder.stopRing(call.ringing);
    call.ringing = undefined;
    call.link?.answer();
  }

  /**
   * The user rejects the ringing call (C). It is not listed in Received calls
   * (`register/received`: a received and a rejected call list one); whether Missed calls lists it
   * is UNVERIFIED (not listed).
   */
  reject(call: StockCall): void {
    if (call.rejectedAt !== undefined || call.answeredAt !== undefined) return;
    call.rejectedAt = this.#deps.now();
    this.#deps.sounder.stopRing(call.ringing);
    call.ringing = undefined;
    call.link?.hangUp();
  }

  /** The user ends the call (End, End active call). */
  end(call: StockCall): void {
    if (call.endedAt !== undefined || call.hostReleased !== undefined) return;
    call.endedAt = this.#deps.now();
    call.link?.hangUp();
    this.#stopSounds(call);
    this.#addDuration(call, call.endedAt);
  }

  /**
   * The call has left the screen: received calls are listed (a missed one counted for the
   * notice), and the next ring may come.
   */
  finish(call: StockCall): void {
    if (call.done) return;
    call.done = true;
    this.#lastFinish = this.#deps.now();
    this.#stopSounds(call);
    if (call.direction === "in" && call.answeredAt === undefined && call.rejectedAt === undefined) {
      this.#list(call, "missed");
    }
    if (this.#call === call) this.#call = undefined;
  }

  /** The handset is drawn over the screen below a call until then (kernel ms). */
  #handsetUntil = -Infinity;

  /** The handset shows over whatever is on screen now (a call off its own screen). */
  handsetOverlay(now = this.#deps.now()): boolean {
    const call = this.#call;
    if (call !== undefined && !call.done && (!call.onScreen || call.covered === true)) return true;
    return now < this.#handsetUntil;
  }

  /** The call leaves its screen for the screen below: the handset stays on that until `untilMs`. */
  leaveScreen(call: StockCall, untilMs?: number): void {
    call.onScreen = false;
    if (untilMs !== undefined) this.#handsetUntil = Math.max(this.#handsetUntil, untilMs);
  }

  /**
   * The current call when it is off its screen and due back on it: an answered call over another
   * screen returns once connected (`interrupt/menu-answer-end`).
   */
  callToShow(now = this.#deps.now()): StockCall | undefined {
    const call = this.#call;
    if (call === undefined || call.done || call.onScreen) return undefined;
    const connected = this.connectedAt(call);
    if (connected === undefined || now < connected) return undefined;
    call.onScreen = true;
    return call;
  }

  /** Called each tick: the ringback follows the call's phase. */
  tick(): void {
    const call = this.#call;
    if (call === undefined || call.done) return;
    const now = this.#deps.now();
    if (call.direction === "out" && call.ringback === undefined) {
      const alerting = this.alertingAt(call);
      const connected = this.connectedAt(call);
      if (
        alerting !== undefined &&
        now >= alerting + RINGBACK_AFTER_ALERTING_MS &&
        (connected === undefined || now < connected) &&
        call.endedAt === undefined &&
        call.hostReleased === undefined
      ) {
        call.ringback = this.#deps.sounder.callSound(
          ringbackProgram(this.earpieceWord),
          alerting + RINGBACK_AFTER_ALERTING_MS,
        );
      }
    }
    if (call.ringback !== undefined) {
      const connected = this.connectedAt(call);
      if (connected !== undefined && now >= connected) {
        this.#deps.sounder.stopRing(call.ringback);
        call.ringback = undefined;
      }
    }
  }

  #control(call: StockCall): StockCallControl {
    return {
      alerting: () => {
        if (call.done || call.hostAlerting !== undefined || call.hostConnected !== undefined)
          return;
        call.hostAlerting = this.#deps.now();
      },
      connected: () => {
        if (call.done || call.hostConnected !== undefined) return;
        call.hostAlerting ??= this.#deps.now();
        call.hostConnected = this.#deps.now();
      },
      released: () => {
        if (call.done || call.endedAt !== undefined) return;
        if (call.hostAlerting === undefined) call.hostAlerting = this.#deps.now();
        this.#release(call);
      },
    };
  }

  #release(call: StockCall): void {
    if (call.hostReleased !== undefined || call.done) return;
    call.hostReleased = this.#deps.now();
    const ringing = call.direction === "in" && call.answeredAt === undefined;
    if (ringing && call.ringing !== undefined) {
      // The caller's hangup silences the ringing a little later (`sound/calls/ring-missed`).
      this.#deps.sounder.stopRing(call.ringing, call.hostReleased + CALL_TIMINGS.ringStopMs);
      call.ringing = undefined;
    }
    this.#stopSounds(call);
    if (!ringing) {
      // The network's end: three beeps (S14).
      this.#deps.sounder.callSound(
        netEndProgram(this.earpieceWord),
        call.hostReleased + NET_END_BEEPS_AFTER_MS,
      );
      this.#addDuration(call, this.releasedAt(call)!);
    }
  }

  #stopSounds(call: StockCall): void {
    if (call.ringing !== undefined) this.#deps.sounder.stopRing(call.ringing);
    if (call.ringback !== undefined) this.#deps.sounder.stopRing(call.ringback);
    call.ringing = undefined;
    call.ringback = undefined;
  }

  #list(call: StockCall, list: "missed" | "received"): void {
    const stamp = this.#deps.clock.stamp();
    this.#deps.log.add(list, {
      number: call.number,
      ...(call.name === undefined ? {} : { name: call.name }),
      ...(stamp === undefined ? {} : { at: stamp }),
    });
  }

  #addDuration(call: StockCall, endAt: number): void {
    const connected = this.connectedAt(call);
    if (call.direction === "in") {
      if (call.answeredAt === undefined) return;
      this.#list(call, "received");
      this.#deps.log.addDuration("received", Math.max(0, endAt - (connected ?? endAt)));
      return;
    }
    if (connected === undefined || endAt < connected) return;
    this.#deps.log.addDuration("dialled", endAt - connected);
  }
}
