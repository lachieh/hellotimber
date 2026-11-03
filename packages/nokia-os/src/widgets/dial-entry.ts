// Standby number entry (plan 22 D2, D6; docs/specs/stock/calls.md "Standby number entry"): the
// characters typed at standby, the `*` cycle and its commit, C and held C, ▲/▼ cycling the soft
// key (`Call`, `Save`, `Convert`), held `1` (the voice mailbox), `#` answering location numbers
// and codes at once, DTMF while a key is held, and Call.
import type { PhoneKey } from "@hellotimber/phone-core";
import { appendDial, DIAL_CYCLE, immediateCode, starCycle } from "../calls/dial-string";
import type { DialEntryModel, StandbyDrawModel, WidgetModel } from "../kit/ui/display/widgets";
import type { StockSounder } from "../sound/sounder";
import type { Flow, Widget } from "../kit/ui/widgets/flow";
import { LEVEL_REPEAT } from "./level-bar";

/**
 * The entry's timings, from its first redraw (the key's latency is not reproduced): the `*`
 * commits ≈1440 ms after its key and vanishes 480 ms (`entry/star-commit`: 1485 - 58, then 480);
 * held C clears at ≥ 490 ms (`entry/c-held-475`: no, `-500`: yes, drawn at 521 - 46); held `1`
 * calls the voice mailbox as long (`hold/one-475`: no, `-500`: Calling at 551 - 58); leaving for
 * standby draws it without the operator first (`entry/c-last`: 88 ms, `c-held-500`: 93 ms).
 */
export const DIAL_TIMINGS = {
  commitMs: 1440,
  commitBlinkMs: 480,
  heldMs: 490,
  standbyDrawMs: 88,
  /** `#` completing a code: its note or page draws ≈20 ms after the entry's redraw (16-36 ms). */
  codeDrawMs: 20,
} as const;

export const ENTRY_SOFTKEYS = ["Call", "Save", "Convert"] as const;
export type EntrySoftkey = (typeof ENTRY_SOFTKEYS)[number];

export interface DialEntryOptions {
  readonly sounder: StockSounder;
  readonly clock: () => string | undefined;
  /** The soft key's action on the characters (Call, Save, Convert). */
  readonly act: (softkey: EntrySoftkey, text: string, flow: Flow) => void;
  /** Held `1` on an empty entry: the voice mailbox. */
  readonly voiceMailbox: (flow: Flow) => void;
  /** Held 2-9 on an empty entry: dial when Speed dialling is On. */
  readonly speedDial?: (key: string, flow: Flow) => void;
  /** `#` completed a code or location number: what it shows (undefined: nothing). */
  readonly code: (text: string, flow: Flow) => void;
  /** Starts with these characters (Edit number), the soft key Call. */
  readonly text?: string;
  /** The power key: plan 17's profile list over the entry (absent: nothing). */
  readonly powerList?: () => Widget;
  /** While shown, the entry's characters for a call answered over it. */
  readonly register?: (entry: DialEntryWidget | undefined) => void;
}

const DIAL_KEYS = /^[0-9#*]$/;

export class DialEntryWidget implements Widget {
  readonly #o: DialEntryOptions;
  #text: string;
  #softkey = 0;
  #now = 0;
  /** The pending `*` cycle (the last character), until it commits. */
  #pending: { since: number } | undefined;
  /** The committed `*`'s vanishing redraw. */
  #blinkUntil: number | undefined;
  /** Held C: when it went down (the clear is due `heldMs` later). */
  #heldC: number | undefined;
  /** A digit held on an empty entry. */
  #heldDigit: { key: string; at: number } | undefined;
  /** ▲/▼ held: the key and when it next repeats. */
  #repeat: { key: "up" | "down"; at: number } | undefined;
  /** A code `#` completed: what it shows, due then. */
  #code: { at: number; text: string } | undefined;
  /** Leaving for standby: standby without the operator until then. */
  #leaving: number | undefined;

  constructor(options: DialEntryOptions) {
    this.#o = options;
    this.#text = options.text ?? "";
    options.register?.(this);
  }

  /** The characters typed (a pending `*` cycle included). */
  get text(): string {
    return this.#text;
  }

  render(): WidgetModel {
    const clock = this.#o.clock();
    if (this.#leaving !== undefined) {
      const draw: StandbyDrawModel = {
        kind: "standby-draw",
        ...(clock === undefined ? {} : { clock }),
      };
      return draw;
    }
    const blink = this.#blinkUntil !== undefined && this.#now < this.#blinkUntil;
    const model: DialEntryModel = {
      kind: "dial-entry",
      // The vanishing `*` leaves a space's width (`hold/inside-star` c).
      text: blink ? `${this.#text.slice(0, -1)} ` : this.#text,
      softkey: ENTRY_SOFTKEYS[this.#softkey]!,
      ...(clock === undefined ? {} : { clock }),
    };
    return model;
  }

  close(): void {
    this.#o.register?.(undefined);
  }

  reveal(): void {
    this.#o.register?.(this);
  }

  onKeyDown(key: PhoneKey, flow: Flow): void {
    if (this.#leaving !== undefined) return;
    if (DIAL_KEYS.test(key)) {
      this.#o.sounder.keyDtmf();
      this.#dialKey(key);
      return;
    }
    if (key === "c") {
      this.#commit();
      this.#text = this.#text.slice(0, -1);
      this.#blinkUntil = undefined;
      if (this.#text === "") this.#leave();
      else this.#heldC = this.#now;
      return;
    }
    if (key === "up" || key === "down") {
      this.#cycleSoftkey(key);
      this.#repeat = { key, at: this.#now + LEVEL_REPEAT.firstMs };
      return;
    }
    if (key === "navi") {
      this.#commit();
      const softkey = ENTRY_SOFTKEYS[this.#softkey]!;
      // Save and Convert return to the entry with Call (`entry/convert-after`).
      this.#softkey = 0;
      this.#o.act(softkey, this.#text, flow);
      return;
    }
    if (key === "power" && this.#o.powerList !== undefined) flow.push(this.#o.powerList());
  }

  onKey(key: PhoneKey): void {
    if (key === "c") this.#heldC = undefined;
    if (key === this.#heldDigit?.key) this.#heldDigit = undefined;
    if (key === this.#repeat?.key) this.#repeat = undefined;
  }

  #dialKey(key: PhoneKey): void {
    const now = this.#now;
    if (key === "*") {
      const pending = this.#pending;
      if (pending !== undefined && now < pending.since + DIAL_TIMINGS.commitMs) {
        const last = this.#text.slice(-1);
        this.#text = this.#text.slice(0, -1) + starCycle(last);
        pending.since = now;
        return;
      }
      this.#commit();
      this.#text = appendDial(this.#text, DIAL_CYCLE[0]!);
      this.#pending = { since: now };
      this.#blinkUntil = undefined;
      return;
    }
    this.#commit();
    this.#blinkUntil = undefined;
    if (/^[1-9]$/.test(key) && this.#text === "") this.#heldDigit = { key, at: now };
    this.#text = appendDial(this.#text, key);
    if (key === "#" && immediateCode(this.#text) !== undefined) {
      this.#code = { at: now + DIAL_TIMINGS.codeDrawMs, text: this.#text };
    }
  }

  /** A pending `*` commits (a digit, C or Call: at once, without its vanishing redraw). */
  #commit(): void {
    this.#pending = undefined;
  }

  #cycleSoftkey(key: "up" | "down"): void {
    // ▲ and ▼ cycle the same way (`entry/softkey-up`, `-down`).
    void key;
    this.#softkey = (this.#softkey + 1) % ENTRY_SOFTKEYS.length;
  }

  #leave(): void {
    this.#leaving = this.#now + DIAL_TIMINGS.standbyDrawMs;
    this.#heldC = undefined;
  }

  tick(dtMs: number, flow: Flow): void {
    this.#now += dtMs;
    const now = this.#now;
    if (this.#leaving !== undefined) {
      if (now >= this.#leaving) flow.standby();
      return;
    }
    const code = this.#code;
    if (code !== undefined && now >= code.at) {
      this.#code = undefined;
      this.#o.code(code.text, flow);
      return;
    }
    const pending = this.#pending;
    if (pending !== undefined && now >= pending.since + DIAL_TIMINGS.commitMs) {
      this.#pending = undefined;
      this.#blinkUntil = pending.since + DIAL_TIMINGS.commitMs + DIAL_TIMINGS.commitBlinkMs;
    }
    if (this.#heldC !== undefined && now >= this.#heldC + DIAL_TIMINGS.heldMs) {
      this.#heldC = undefined;
      this.#text = "";
      this.#leave();
      return;
    }
    const held = this.#heldDigit;
    if (held !== undefined && now >= held.at + DIAL_TIMINGS.heldMs) {
      this.#heldDigit = undefined;
      if (this.#text === held.key) {
        if (held.key === "1") this.#o.voiceMailbox(flow);
        else this.#o.speedDial?.(held.key, flow);
      }
      return;
    }
    const repeat = this.#repeat;
    if (repeat !== undefined && now >= repeat.at) {
      this.#cycleSoftkey(repeat.key);
      repeat.at += LEVEL_REPEAT.everyMs;
    }
  }
}

export function dialEntry(options: DialEntryOptions): DialEntryWidget {
  return new DialEntryWidget(options);
}
