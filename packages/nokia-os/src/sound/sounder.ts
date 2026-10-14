// The phone's sounder (plan 16 D5): the stock firmware's use of the buzzer, the tone generator
// and the vibrator, over one sequencer and the phone's settings. The phone wrapper tells it about
// keys and power; widgets reach it through `LeafBinder` (previews, note tones).
import type { PhoneKey } from "@hellotimber/phone-core";
import type { StockCue, StockCueSink } from "../firmware/cues";
import { LEVEL_REPEAT } from "../firmware/bindings";
import type { StockSettings } from "../firmware/settings";
import { BOOT_TONE, KEYPAD_BEEP } from "../resources";
import type { SoundProgram } from "./program";
import type { SoundPlay, SoundSequencer } from "./sequencer";

/** Tones › Keypad tones (through `settingAlias`: the active profile's). Options: Off, Level 1-3. */
export const KEYPAD_TONES_KEY = "tones/keypad-tones";

/**
 * A held C beeps again at its long press (Task 0: 505-511 ms after the key-down, less the median
 * key-to-beep latency of 28 ms that nokia-os does not reproduce, D8).
 */
export const C_HOLD_BEEP_MS = 480;

/** How a key-down beeps (the wrapper knows where the phone is). */
export interface KeyDownOptions {
  /** False when the key makes no sound (the power key away from standby). Default true. */
  readonly beeps?: boolean;
  /**
   * False when the key has no long press or auto-repeat to beep at: C in the menu carousel
   * leaves the menu at its key-down (`sound/keypad/level-*`). Default true.
   */
  readonly holdBeeps?: boolean;
}

interface HeldKey {
  /** When the next held beep is due; undefined: none. */
  next: number | undefined;
  readonly repeats: boolean;
}

/** One tone program: 900 Hz at the keypad level's DSP word, for `ms`. */
function beepProgram(volume: number, ms: number): SoundProgram {
  return { id: "keypad", steps: [{ ms, tone: { hz: KEYPAD_BEEP.hz, volume } }] };
}

export class StockSounder implements StockCueSink {
  readonly #sequencer: SoundSequencer;
  readonly #settings: StockSettings;
  readonly #now: () => number;
  readonly #held = new Map<PhoneKey, HeldKey>();
  /** Programs started for later that power-off must cancel (the boot tone). */
  #scheduled: SoundPlay[] = [];
  /** The Keypad tones option the next key-down beeps at, instead of the stored one. */
  #keyLevel: { readonly option: number | null } | undefined;

  constructor(sequencer: SoundSequencer, settings: StockSettings, now: () => number) {
    this.#sequencer = sequencer;
    this.#settings = settings;
    this.#now = now;
  }

  /**
   * A key went down while the phone is on (D8): 900 Hz at the Keypad tones level (Off: nothing),
   * ≈145 ms while the DSP is awake and ≈124 ms when this key wakes it. A beep that sounds already
   * runs on to this key's end. ▲/▼ held beep again at each auto-repeat, C at its long press.
   */
  keyDown(key: PhoneKey, options: KeyDownOptions = {}): void {
    const now = this.#now();
    const level = this.#keyLevel;
    this.#keyLevel = undefined;
    if (options.beeps ?? true) this.#keyBeep(now, level?.option);
    const repeats = key === "up" || key === "down";
    const first = repeats ? LEVEL_REPEAT.firstMs : key === "c" ? C_HOLD_BEEP_MS : undefined;
    const next = (options.holdBeeps ?? true) && first !== undefined ? now + first : undefined;
    this.#held.set(key, { next, repeats });
  }

  /**
   * The key going down beeps at Keypad tones option `option` (0 Off, 1-3 Levels, null unset), not
   * the stored level: ▲/▼ in the Keypad tones list beep at the option they highlight (D8).
   */
  keyBeepLevel(option: number | null): void {
    this.#keyLevel = { option };
  }

  keyUp(key: PhoneKey): void {
    this.#held.delete(key);
  }

  /** Beeps the held keys due by now; the wrapper calls it before advancing the sequencer. */
  tick(): void {
    const now = this.#now();
    for (const held of this.#held.values()) {
      while (held.next !== undefined && held.next <= now) {
        this.#keyBeep(held.next);
        held.next = held.repeats ? held.next + LEVEL_REPEAT.everyMs : undefined;
      }
    }
  }

  /** The phone turned on: with the boot animation, the power-on tone (D13: a boot tone). */
  powerOn(options: { readonly boot: boolean }): void {
    if (!options.boot) return;
    this.#scheduled.push(this.#sequencer.play(BOOT_TONE.program, this.#now() + BOOT_TONE.atMs));
  }

  /**
   * The phone turned off (the power key's long press): everything stops, the vibrator included,
   * and the power-off tone plays (the power-on tone's program, Task 0 B).
   */
  powerOff(): void {
    const now = this.#now();
    for (const play of this.#scheduled) this.#sequencer.cancel(play, now);
    this.#scheduled = [];
    this.#held.clear();
    this.#keyLevel = undefined;
    this.#sequencer.stop(["buzzer", "tone", "vibrator"], now);
    this.#sequencer.play(BOOT_TONE.program, now);
  }

  /** Plays `program` now (plan 27's Composer). */
  play(program: SoundProgram): SoundPlay {
    return this.#sequencer.play(program, this.#now());
  }

  /** Game cues (plan 23 D8): plan 16 Task 8 plays them. */
  cue(_cue: StockCue, _atMs: number): void {}

  /** The DSP word of Keypad tones option `level` (default: the stored one); null: Off. */
  #keypadWord(level: number | null = this.#settings.choice(KEYPAD_TONES_KEY)): number | null {
    if (level === 0) return null;
    const word = KEYPAD_BEEP.levels[level === null ? "unset" : String(level)];
    if (word === undefined) throw new Error(`No keypad beep for Keypad tones option ${level}.`);
    return word;
  }

  /**
   * Whether the DSP is powered at `atMs`: it powers down `sleepAfterMs` after the tone
   * generator's last output ends (D8 deviation).
   */
  #dspAwake(atMs: number): boolean {
    const last = this.#sequencer.last("tone");
    if (last === undefined) return false;
    if (last.output === "tone" && last.hz !== null) return true;
    return atMs - last.atMs < KEYPAD_BEEP.sleepAfterMs;
  }

  #keyBeep(atMs: number, level?: number | null): void {
    const word = level === undefined ? this.#keypadWord() : this.#keypadWord(level);
    if (word === null) return;
    const ms = this.#dspAwake(atMs) ? KEYPAD_BEEP.awakeMs : KEYPAD_BEEP.wokenMs;
    this.#sequencer.play(beepProgram(word, ms), atMs);
  }
}
