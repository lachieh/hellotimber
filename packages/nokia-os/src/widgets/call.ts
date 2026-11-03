// The call screens (plan 22 D8, D9; docs/specs/stock/calls.md): Calling and its dots, the call
// (`Call 1` or the name), the ringing screen, the blank redraws between them, the in-call keys
// (Volume, DTMF digits, C's `End`/`Options`, Options), and how a call leaves the screen. One
// widget follows one call of the phone's telephone; its frames come from the call's times.
import type { PhoneKey } from "@hellotimber/phone-core";
import type { CallBody, CallModel, StandbyDrawModel, WidgetModel } from "../kit/ui/display/widgets";
import { Playback } from "../kit/ui/widgets/playback";
import { timelineById, timelineByName } from "../kit/ui/timelines";
import { CALL_TIMINGS, type StockCall, type StockTelephone } from "../calls/telephone";
import { appendDial, starCycle } from "../calls/dial-string";
import { transmittedDtmfProgram, VOLUME_TONE_MS, volumeTopProgram } from "../calls/sounds";
import { DIAL_TIMINGS } from "./dial-entry";
import type { StockSounder } from "../sound/sounder";
import type { Flow, Widget } from "../kit/ui/widgets/flow";
import { numberEntry } from "../kit/ui/widgets/number-entry";
import { note } from "../kit/ui/widgets/note";
import { OptionListWidget } from "./option-list";
import { placeholderWidget } from "../kit/ui/widgets/placeholder";

/**
 * Calling's dots: one, the number ≈100 ms later from the number entry (`dial/number-12` 81,
 * `dial/call` 101, `dial/number-thirty-two` 111) or ≈55 ms from a list (`register/options-call`
 * 48, `register/standby-up-call` 62), then a step 476 ms later and every ≈503 ms (`dial/call`).
 */
export const CALLING = {
  numberMs: 100,
  listNumberMs: 55,
  firstDotsMs: 476,
  dotsEveryMs: 503,
} as const;
/** The ringing screen's `calling` blinks 480/480 ms, shown first (`ring/screen`). */
const RING_BLINK_MS = 480;
/** Call 1 after End's blank on a locked phone (plan25/keyguard/call, frame 14). */
const KEYGUARD_END_CALL_MS = 512;
/**
 * A screen over the call (Options, the power key's list): the ladders erased first (34 ms,
 * `in-call/power`; 36 ms, `in-call/options`), then the screen, with the handset at the top left;
 * back on the call, a blank call screen (74 ms, `in-call/options-c`).
 */
const COVER = { leadMs: 35, returnMs: 74 } as const;

/** A held ▲/▼ steps Volume again 812 ms after its down, then every ≈478 ms (`in-call/down-held`). */
const VOLUME_REPEAT = { firstMs: 812, everyMs: 478 } as const;

/** The in-call Options (`in-call/options-all`), opening on End active call. */
export const IN_CALL_OPTIONS = [
  "End active call",
  "Hold",
  "New call",
  "Send DTMF",
  "Phone book",
  "Mute",
] as const;

/** `widget` opened while `key` is down: that key's release is not a key on it. */
export function afterDown(key: PhoneKey, widget: Widget): Widget {
  let released = false;
  return {
    render: (flow) => widget.render(flow),
    onKeyDown: (k, flow) => widget.onKeyDown?.(k, flow),
    onKey(k, flow) {
      if (k === key && !released) {
        released = true;
        return;
      }
      widget.onKey?.(k, flow);
    },
    tick: (dtMs, flow) => widget.tick?.(dtMs, flow),
    close: () => widget.close?.(),
    reveal: () => widget.reveal?.(),
  };
}

/** `widget`'s keys act on their key-down (the in-call Options: `in-call/options-c`). */
function onDown(widget: Widget): Widget {
  return {
    render: (flow) => widget.render(flow),
    onKeyDown: (k, flow) => widget.onKey?.(k, flow),
    tick: (dtMs, flow) => widget.tick?.(dtMs, flow),
    close: () => widget.close?.(),
    reveal: () => widget.reveal?.(),
  };
}

/** Where the call leaves the screen to, once it has ended. */
export type CallExit =
  /** Standby (a call from the number entry or a list; an answered call). */
  | "standby"
  /** The screen the ring interrupted (a rejected or missed call, or the entry's answered call). */
  | "below";

export interface CallWidgetOptions {
  readonly telephone: StockTelephone;
  readonly call: StockCall;
  readonly sounder: StockSounder;
  readonly now: () => number;
  readonly clock: () => string | undefined;
  /**
   * An incoming call: what the ring interrupted. `standby` shows the call screen at Answer,
   * `entry` (with its characters) keeps them on the call screen, `other` keeps the screen below
   * (with the handset) until the call connects. `keyguard` returns through the lock note (K8).
   */
  readonly below?:
    | { readonly kind: "standby" | "other" | "keyguard" }
    | { readonly kind: "entry"; readonly text: string };
  /** The call is over: leave for standby or the screen below. */
  readonly done: (exit: CallExit, flow: Flow) => void;
  /** Plan 17's profile list for the power key in a call (none: the key does nothing). */
  readonly powerList?: () => Widget;
  /** Plan 19's phone book for Options › Phone book (none: its placeholder). */
  readonly phoneBook?: () => Widget;
  /** Calling's number shows this long after Calling (default CALLING.numberMs). */
  readonly numberMs?: number;
  readonly callingSoftkey?: string;
  readonly newCall?: (number: string, flow: Flow) => void;
  readonly pickNumber?: (flow: Flow, done: (number: string, flow: Flow) => void) => void;
}

/** A time span's start and the frames it shows, in order. */
type Screen =
  | { readonly model: WidgetModel }
  /** The call leaves the screen; `live`: it goes on below it (answered over another screen). */
  | { readonly leave: CallExit; readonly live?: true };

export class CallWidget implements Widget {
  readonly #o: CallWidgetOptions;
  /** The soft key reads Options (C toggles it; DTMF digits set it for a while). */
  #options = false;
  /** When C last toggled the soft key (its blank redraw). */
  #toggledAt: number | undefined;
  /** Until when the digits keep Options, and the first digit of that run. */
  #digitsOptionsUntil: number | undefined;
  #digitsFirstAt: number | undefined;
  /** The `*` cycle's pending character (as the number entry's), and its vanishing redraw. */
  #starSince: number | undefined;
  #blinkUntil: number | undefined;
  /** Volume: when the last ▲/▼ went down, and when Volume first showed (its erase). */
  #volumeAt: number | undefined;
  #volumeShownAt: number | undefined;
  /** When Volume's tone stops. */
  #volumeToneEnd = -Infinity;
  /** A held ▲/▼ repeats (`in-call/down-held`: 812 ms, then every ≈478 ms). */
  #volumeRepeat: { readonly key: "up" | "down"; at: number } | undefined;
  #left = false;
  #postShown = false;
  /** A screen opens over the call (its lead: the ladders erased). */
  #cover:
    | { readonly at: number; readonly key: PhoneKey; readonly open: () => Widget; shown: boolean }
    | undefined;
  /** The screen over the call closed: the blank redraw until then. */
  #coverBackUntil: number | undefined;
  /** An answered call shown again once connected (it had left for the screen below). */
  readonly #resumed: boolean;

  constructor(options: CallWidgetOptions) {
    this.#o = options;
    this.#resumed = options.call.direction === "in" && options.call.answeredAt !== undefined;
    if (options.call.direction === "in" && options.below?.kind === "entry") {
      options.call.digits = options.below.text;
    }
  }

  get #call(): StockCall {
    return this.#o.call;
  }

  render(): WidgetModel {
    const screen = this.#screen(this.#o.now());
    return "model" in screen ? screen.model : this.#standbyDraw();
  }

  onKey(key: PhoneKey): void {
    if (key === this.#volumeRepeat?.key) this.#volumeRepeat = undefined;
  }

  reveal(): void {
    if (this.#cover === undefined) return;
    this.#cover = undefined;
    this.#call.covered = false;
    this.#coverBackUntil = this.#o.now() + COVER.returnMs;
  }

  /** Opens `open` over the call after the lead. */
  #coverWith(key: PhoneKey, open: () => Widget): void {
    this.#cover ??= { at: this.#o.now(), key, open, shown: false };
  }

  tick(_dtMs: number, flow: Flow): void {
    if (this.#left) return;
    const now = this.#o.now();
    const post = this.#call.postDial;
    const connected = this.#o.telephone.connectedAt(this.#call);
    if (
      !this.#postShown &&
      post !== undefined &&
      connected !== undefined &&
      now >= connected + (post.mode === "p" ? 2500 : 175)
    ) {
      this.#postShown = true;
      this.#call.covered = true;
      if (post.mode === "p") {
        post.sent = true;
        flow.push(this.#sending(post.text));
      } else
        flow.push({
          render: () => ({
            kind: "call",
            body: { kind: "digits", text: post.text },
            softkey: "Send",
            handset: true,
            ladders: false,
            ...(this.#o.clock() === undefined ? {} : { clock: this.#o.clock() }),
          }),
          onKey: (key, inner) => {
            if (key === "navi") {
              post.sent = true;
              inner.replace(this.#sending(post.text));
            } else if (key === "c") inner.back();
          },
        });
      return;
    }
    const repeat = this.#volumeRepeat;
    if (repeat !== undefined && now >= repeat.at) {
      repeat.at += VOLUME_REPEAT.everyMs;
      this.#volumeKey(repeat.key);
    }
    const cover = this.#cover;
    if (cover !== undefined && !cover.shown && now >= cover.at + COVER.leadMs) {
      cover.shown = true;
      this.#call.covered = true;
      flow.push(afterDown(cover.key, cover.open()));
      return;
    }
    const screen = this.#screen(now);
    if (!("leave" in screen)) return;
    this.#left = true;
    if (screen.live !== true) this.#o.telephone.finish(this.#call);
    this.#o.done(screen.leave, flow);
  }

  // ---------------------------------------------------------------- keys

  onKeyDown(key: PhoneKey): void {
    const { telephone } = this.#o;
    const call = this.#call;
    const phase = telephone.phase(call);
    const now = this.#o.now();
    if (phase === "ringing") {
      if (key === "navi") {
        // Answer beeps in the earpiece (`sound/calls/ring-answer`).
        this.#o.sounder.keyBeepWord(telephone.earpieceWord);
        telephone.answer(call);
      } else if (key === "c") telephone.reject(call);
      else if (key === "up" || key === "down") this.#volumeKey(key);
      return;
    }
    if (phase === "ending" || phase === "released") return;
    // In a call keys beep in the earpiece; ▲/▼ sound Volume's tone instead.
    if (!/^[0-9*#]$/.test(key)) this.#o.sounder.keyBeepWord(telephone.earpieceWord);
    if (key === "up" || key === "down") {
      this.#volumeKey(key);
      this.#volumeRepeat = { key, at: now + VOLUME_REPEAT.firstMs };
      return;
    }
    if (/^[0-9*#]$/.test(key)) {
      // DTMF digits (S15): shown in the entry's layout with Options for a while.
      if (phase === "calling") return;
      this.#o.sounder.keyDtmf(telephone.earpieceWord);
      this.#digit(key, now);
      this.#options = true;
      this.#digitsFirstAt = this.#digitsOptionsUntil === undefined ? now : this.#digitsFirstAt;
      this.#digitsOptionsUntil = Math.max(
        (this.#digitsFirstAt ?? now) + CALL_TIMINGS.digitsOptionsMs,
        now + CALL_TIMINGS.digitsOptionsAfterLastMs,
      );
      return;
    }
    if (key === "c") {
      // C while calling does nothing (`dial/c-calling`); otherwise it toggles End and Options.
      if (phase === "calling") return;
      this.#options = !this.#optionsShown(now);
      this.#digitsOptionsUntil = undefined;
      this.#toggledAt = now;
      return;
    }
    if (key === "navi") {
      if (this.#optionsShown(now) && phase !== "calling")
        this.#coverWith(key, () => onDown(this.#optionsList()));
      else telephone.end(call);
      return;
    }
    const power = this.#o.powerList;
    if (key === "power" && power !== undefined && phase !== "calling") this.#coverWith(key, power);
  }

  /** A digit typed in the call; `*` cycles `* + p w` and commits as in the number entry. */
  #digit(key: PhoneKey, now: number): void {
    const call = this.#call;
    this.#commitStar(now);
    this.#blinkUntil = undefined;
    if (key === "*") {
      if (this.#starSince !== undefined) {
        call.digits = call.digits.slice(0, -1) + starCycle(call.digits.slice(-1));
      } else {
        call.digits = appendDial(call.digits, "*");
      }
      this.#starSince = now;
      return;
    }
    this.#starSince = undefined;
    call.digits = appendDial(call.digits, key);
  }

  /** A pending `*` commits after DIAL_TIMINGS.commitMs, then vanishes for a blink. */
  #commitStar(now: number): void {
    const since = this.#starSince;
    if (since === undefined || now < since + DIAL_TIMINGS.commitMs) return;
    this.#starSince = undefined;
    this.#blinkUntil = since + DIAL_TIMINGS.commitMs + DIAL_TIMINGS.commitBlinkMs;
  }

  #volumeKey(key: "up" | "down"): void {
    const { telephone } = this.#o;
    const now = this.#o.now();
    const t = CALL_TIMINGS;
    if (this.#volumeAt === undefined || now >= this.#volumeAt + t.volumeEraseMs + t.volumeMs) {
      this.#volumeShownAt = now;
    }
    const before = telephone.volume;
    telephone.volume = before + (key === "up" ? 1 : -1);
    // ▲ at the top and every ▼ sound 1125 Hz at the new level's word, ▲ that raises the level
    // nothing (`sound/calls/volume-top`, `in-call-keys`); neither beeps. A tone still sounding
    // ends the new one with it (one tone generator).
    this.#o.sounder.keySilent();
    if (key === "down" || before === telephone.volume) {
      // ▲ at the top restarts it; ▼ ends with a tone still sounding.
      const ms =
        key === "down" && this.#volumeToneEnd > now ? this.#volumeToneEnd - now : VOLUME_TONE_MS;
      this.#o.sounder.callSound(volumeTopProgram(telephone.earpieceWord, ms));
      this.#volumeToneEnd = now + ms;
    }
    this.#volumeAt = now;
  }

  #optionsShown(now: number): boolean {
    if (this.#digitsOptionsUntil !== undefined && now >= this.#digitsOptionsUntil) {
      this.#options = false;
      this.#digitsOptionsUntil = undefined;
    }
    return this.#options;
  }

  #optionsList(): Widget {
    const { telephone } = this.#o;
    const call = this.#call;
    return new OptionListWidget({
      labels: IN_CALL_OPTIONS.map((label) => (label === "Hold" && call.held ? "Retrieve" : label)),
      opening: 0,
      softkey: "Select",
      numbering: "none",
      choose: (index, flow) => {
        const label = IN_CALL_OPTIONS[index]!;
        if (label === "End active call") {
          flow.back();
          telephone.end(call);
          return;
        }
        if (label === "Mute") {
          call.muted = !call.muted;
          this.#options = false;
          // The handset is drawn over lists, not over the note; the call comes back at once.
          call.covered = false;
          this.#cover = undefined;
          flow.replace(note({ lines: ["Muted"], timeline: timelineByName("muted") }));
          return;
        }
        if (label === "Phone book" && this.#o.phoneBook !== undefined) {
          flow.replace(afterDown("navi", this.#o.phoneBook()));
          return;
        }
        if (label === "Hold") {
          telephone.hold(call);
          flow.back();
          return;
        }
        if (label === "New call" || label === "Send DTMF") {
          const prompt = (text = ""): Widget =>
            this.#duringCall(
              numberEntry({
                label: ["Phone number:"],
                icons: ["calls-services/in-call-pen"],
                counter: false,
                number: text,
                filledSoftkey: label === "New call" ? "Call" : "Send",
                search: (inner) =>
                  this.#o.pickNumber?.(inner, (number, next) => next.replace(prompt(number))),
                done: (number, inner) => {
                  if (label === "New call") this.#o.newCall?.(number, inner);
                  else inner.replace(this.#sending(number));
                },
              }),
            );
          if (label === "New call") flow.replace(afterDown("navi", prompt()));
          else {
            let elapsed = 0;
            call.covered = false;
            const entry = prompt();
            flow.replace({
              render: (inner) => {
                if (elapsed < 215)
                  return {
                    ...this.#model({ kind: "blank" }, ""),
                    ...(elapsed >= 176 ? { ladders: false as const } : {}),
                  };
                return entry.render(inner);
              },
              tick: (dtMs, inner) => {
                elapsed += dtMs;
                if (elapsed >= 215) {
                  call.covered = true;
                  inner.replace(entry);
                }
              },
            });
          }
          return;
        }
        // Phone book is supplied by the phone-book feature.
        flow.replace(placeholderWidget(label, label === "Phone book" ? "19" : "22b"));
      },
      close: () => {
        this.#options = false;
      },
    });
  }

  #duringCall(widget: Widget): Widget {
    return {
      render: (flow) => widget.render(flow),
      onKey: (key, flow) => widget.onKey?.(key, flow),
      onKeyDown: (key, flow) => widget.onKeyDown?.(key, flow),
      tick: (dtMs, flow) => {
        if (this.#call.done || this.#call.hostReleased !== undefined) flow.back();
        else widget.tick?.(dtMs, flow);
      },
      close: () => widget.close?.(),
    };
  }

  #sending(text: string): Widget {
    const abort = new AbortController();
    this.#call.covered = false;
    const bar = new Playback(timelineById("7-6", "DTMF progress"));
    let tone: ReturnType<StockSounder["callSound"]> | undefined;
    let completed = false;
    let elapsed = 0;
    this.#o.telephone.sendDtmf(this.#call, text, abort.signal, () => {
      completed = true;
      elapsed = 0;
      tone = this.#o.sounder.callSound(
        transmittedDtmfProgram(text, this.#o.telephone.earpieceWord),
      );
    });
    return {
      render: () => {
        const frame = bar.frame;
        if (frame.kind !== "sprite") throw Error("DTMF needs a progress sprite");
        return this.#model({ kind: "sending", text, bar: frame.sprite }, "Exit");
      },
      tick: (dtMs, flow) => {
        elapsed += dtMs;
        bar.advance(dtMs);
        if (
          this.#call.hostReleased !== undefined ||
          this.#call.done ||
          (completed && elapsed >= 264 + Math.max(0, text.length - 1) * 295 + 146)
        )
          flow.back();
      },
      onKey: (key, flow) => {
        if (key === "navi" || key === "c") flow.back();
      },
      close: () => {
        abort.abort();
        if (tone !== undefined) this.#o.sounder.stopRing(tone);
      },
    };
  }

  // ---------------------------------------------------------------- frames

  #model(body: CallBody, softkey: string, handset = true): CallModel {
    const clock = this.#o.clock();
    return {
      kind: "call",
      body,
      softkey,
      handset,
      ...(clock === undefined ? {} : { clock }),
    };
  }

  #standbyDraw(): StandbyDrawModel {
    const clock = this.#o.clock();
    return { kind: "standby-draw", ...(clock === undefined ? {} : { clock }) };
  }

  /** The call's own screen: its icon and label, or the typed digits. */
  #callBody(ended = false): CallBody {
    const call = this.#call;
    if (call.digits !== "") {
      const now = this.#o.now();
      this.#commitStar(now);
      const blink = this.#blinkUntil !== undefined && now < this.#blinkUntil;
      return { kind: "digits", text: blink ? `${call.digits.slice(0, -1)} ` : call.digits };
    }
    return {
      kind: "call",
      label: call.name ?? "Call 1",
      ...(ended ? { ended: true } : {}),
      ...(call.held ? { held: true } : {}),
      ...(call.muted ? { muted: true } : {}),
    };
  }

  #softkey(now: number): string {
    return this.#optionsShown(now) ? "Options" : "End";
  }

  #screen(now: number): Screen {
    const { telephone } = this.#o;
    const call = this.#call;
    const t = CALL_TIMINGS;
    // The network's (or the far end's) release.
    const released = telephone.releasedAt(call);
    if (released !== undefined && now >= released) {
      const ringing = call.direction === "in" && call.answeredAt === undefined;
      const shown = ringing ? t.missedMs : t.netEndMs;
      const end = released + t.netEndBlankMs + shown;
      const below = this.#o.below?.kind ?? "standby";
      if (ringing && below === "other") {
        this.#o.telephone.leaveScreen(call, released + t.handsetAfterMissedMs);
        return { leave: "below" };
      }
      if (ringing && below === "entry") {
        if (now < released + t.handsetAfterMissedMs) {
          return { model: this.#model(this.#callBody(), "End") };
        }
        return { leave: "below" };
      }
      if (now < released + t.netEndBlankMs) return { model: this.#model({ kind: "blank" }, "End") };
      if (now < end) return { model: this.#model(this.#callBody(true), "End") };
      if (now < end + t.standbyDrawMs) return { model: this.#standbyDraw() };
      return { leave: ringing ? "below" : this.#afterCall() };
    }
    if (call.direction === "in") return this.#incoming(now);
    return this.#outgoing(now);
  }

  /** Where an ended call goes: standby, or back to the number entry it was answered over. */
  #afterCall(): CallExit {
    return this.#call.direction === "in" && this.#o.below?.kind === "entry" ? "below" : "standby";
  }

  #outgoing(now: number): Screen {
    const { telephone } = this.#o;
    const call = this.#call;
    const t = CALL_TIMINGS;
    const alerting = telephone.alertingAt(call);
    const ended = call.endedAt;
    if (ended !== undefined && (alerting === undefined || ended < alerting)) {
      // End before the call alerts: Calling runs on until the release.
      const release = call.startedAt + t.releaseBeforeAlertMs;
      if (now >= release + t.standbyDrawMs) return { leave: "standby" };
      if (now >= release) return { model: this.#standbyDraw() };
      return { model: this.#calling(now) };
    }
    if (ended !== undefined) return this.#ending(now, ended);
    if (alerting === undefined || now < alerting) return { model: this.#calling(now) };
    if (call.emergency) return { model: this.#calling(now) };
    if (now < alerting + t.alertingBlankMs) return { model: this.#model({ kind: "blank" }, "End") };
    const connected = telephone.connectedAt(call);
    if (connected !== undefined && now >= connected && now < connected + t.connectBlankMs) {
      return { model: this.#model({ kind: "blank" }, this.#softkey(now)) };
    }
    return { model: this.#inCall(now) };
  }

  #calling(now: number): WidgetModel {
    const call = this.#call;
    const t = now - call.startedAt;
    if (call.emergency) return this.#model({ kind: "emergency" }, "End");
    const numberMs = this.#o.numberMs ?? CALLING.numberMs;
    if (t < numberMs)
      return this.#model({ kind: "calling", dots: 1 }, this.#o.callingSoftkey ?? "End", false);
    const steps =
      t < numberMs + CALLING.firstDotsMs
        ? 0
        : 1 + Math.floor((t - numberMs - CALLING.firstDotsMs) / CALLING.dotsEveryMs);
    const dots = [1, 2, 3, 0][steps % 4]!;
    // The SIM lookup replaces the number while Calling still animates (plan 19's
    // hold/on-2: 1003 ms; standby/list-call's two-line number: 1772 ms).
    const nameMs = call.number.length > 14 ? 1770 : 1000;
    return this.#model(
      call.name !== undefined && t >= nameMs
        ? { kind: "calling", dots, name: call.name }
        : { kind: "calling", dots, number: call.number },
      this.#o.callingSoftkey ?? "End",
    );
  }

  /** The connected (or alerting) call: Volume over it, C's blank, or the call's screen. */
  #inCall(now: number): WidgetModel {
    const t = CALL_TIMINGS;
    if (this.#cover !== undefined) {
      return { ...this.#model(this.#callBody(), this.#softkey(now)), ladders: false };
    }
    if (this.#coverBackUntil !== undefined && now < this.#coverBackUntil) {
      return this.#model({ kind: "blank" }, this.#softkey(now));
    }
    if (this.#volumeAt !== undefined && now < this.#volumeAt + t.volumeEraseMs + t.volumeMs) {
      if (now < (this.#volumeShownAt ?? this.#volumeAt) + t.volumeEraseMs) {
        return { ...this.#model(this.#callBody(), this.#softkey(now)), ladders: false };
      }
      return { kind: "volume", level: this.#o.telephone.volume };
    }
    if (this.#toggledAt !== undefined && now < this.#toggledAt + t.connectBlankMs) {
      return this.#model({ kind: "blank" }, this.#softkey(now));
    }
    return this.#model(this.#callBody(), this.#softkey(now));
  }

  /** The user ended the call: a blank End, standby without the operator, standby. */
  #ending(now: number, ended: number): Screen {
    const t = CALL_TIMINGS;
    if (this.#call.direction === "in" && this.#o.below?.kind === "entry") {
      // Over the number entry the call stays, then the entry comes back (no blank).
      if (now < ended + t.endOverEntryMs) return { model: this.#inCall(now) };
      return { leave: "below" };
    }
    if (now < ended + t.endBlankMs) return { model: this.#model({ kind: "blank" }, "End") };
    if (this.#o.below?.kind === "keyguard") {
      if (now < ended + t.endBlankMs + KEYGUARD_END_CALL_MS) return { model: this.#inCall(now) };
      return { leave: "standby" };
    }
    const exit = this.#afterCall();
    if (exit === "below") return { leave: "below" };
    if (now < ended + t.endBlankMs + t.standbyDrawMs) return { model: this.#standbyDraw() };
    return { leave: exit };
  }

  #incoming(now: number): Screen {
    const { telephone } = this.#o;
    const call = this.#call;
    const t = CALL_TIMINGS;
    const below = this.#o.below?.kind ?? "standby";
    const answered = call.answeredAt;
    if (call.rejectedAt !== undefined) {
      const r = call.rejectedAt;
      if (below === "entry") {
        if (now < r + t.handsetAfterRejectMs)
          return { model: this.#model(this.#callBody(), "End") };
        return { leave: "below" };
      }
      if (below === "other") {
        telephone.leaveScreen(call, r + t.handsetAfterRejectMs);
        return { leave: "below" };
      }
      if (now < r + t.rejectBlankMs) return { model: this.#model({ kind: "blank" }, "End") };
      if (now < r + t.rejectBlankMs + t.rejectCallMs) {
        return { model: this.#model(this.#callBody(), "End") };
      }
      if (
        this.#o.below?.kind !== "keyguard" &&
        now < r + t.rejectBlankMs + t.rejectCallMs + t.standbyDrawMs
      ) {
        return { model: this.#standbyDraw() };
      }
      return { leave: "below" };
    }
    if (call.endedAt !== undefined) return this.#ending(now, call.endedAt);
    if (answered === undefined) {
      // `calling` blinks from the ringing screen, and again from Volume's end (`ring/key-up`).
      const volumeEnd =
        this.#volumeAt === undefined ? undefined : this.#volumeAt + t.volumeEraseMs + t.volumeMs;
      const blinkFrom = volumeEnd !== undefined && now >= volumeEnd ? volumeEnd : call.startedAt;
      const calling = Math.floor((now - blinkFrom) / RING_BLINK_MS) % 2 === 0;
      const ringing: WidgetModel = {
        kind: "ringing",
        number: call.number,
        ...(call.name === undefined ? {} : { name: call.name }),
        calling,
      };
      if (volumeEnd !== undefined && now < volumeEnd) {
        if (now < (this.#volumeShownAt ?? this.#volumeAt!) + t.volumeEraseMs) {
          return { model: { ...ringing, ladders: false } };
        }
        return { model: { kind: "volume", level: this.#o.telephone.volume } };
      }
      return { model: ringing };
    }
    // Answered over the number entry: its characters with End for the whole call.
    if (below === "entry") return { model: this.#inCall(now) };
    const connected = telephone.connectedAt(call);
    if (below === "other" && !this.#resumed) {
      // Over another screen it stays (with the handset) until the call connects, then the call
      // screen comes back through the telephone's interruption.
      telephone.leaveScreen(call);
      return { leave: "below", live: true };
    }
    if (!this.#resumed && now < answered + t.answerBlankMs) {
      return { model: this.#model({ kind: "blank" }, "End") };
    }
    if (connected !== undefined && now >= connected && now < connected + t.connectBlankMs) {
      return { model: this.#model({ kind: "blank" }, this.#softkey(now)) };
    }
    return { model: this.#inCall(now) };
  }
}
