// The phone's sounder (plan 16 D5): the stock firmware's use of the buzzer, the tone generator
// and the vibrator, over one sequencer and the phone's settings. The phone wrapper tells it about
// keys and power; widgets reach it through `LeafBinder` (previews, note tones).
import type { PhoneKey } from "@hellotimber/phone-core";
import type { StockCue, StockCueSink } from "../firmware/cues";
import type { StockSettings } from "../firmware/settings";
import { LEVEL_REPEAT } from "../widgets/level-bar";
import {
  BEEP_ONCE_LEVELS,
  BOOT_TONE,
  GAME_CUES,
  KEYPAD_BEEP,
  MESSAGE_PREVIEW_DELAY_MS,
  MESSAGE_TONES,
  NOTE_SOUNDS,
  PREVIEW_DELAY_MS,
  RINGING_TONES,
  UNSET_MESSAGE_VOLUMES,
  VOLUME_RULE,
} from "../resources";
import { noteStarts, type SoundProgram } from "./program";
import type { SoundPlay, SoundSequencer, SoundVolume } from "./sequencer";

/**
 * The option lists that preview what they highlight (plan 16 D9), by setting slug, in Tones and
 * every Personalise. Incoming call alert, Keypad tones, Warning tones and Vibrating alert
 * preview nothing (Task 0).
 */
export const PREVIEW_LISTS = ["ringing-tone", "ringing-volume", "message-alert-tone"] as const;
export type PreviewList = (typeof PREVIEW_LISTS)[number];

/** Tones › Keypad tones (through `settingAlias`: the active profile's). Options: Off, Level 1-3. */
export const KEYPAD_TONES_KEY = "tones/keypad-tones";

/**
 * A held C beeps again at its long press (Task 0: 505-511 ms after the key-down, less the median
 * key-to-beep latency of 28 ms that nokia-os does not reproduce, D8).
 */
export const C_HOLD_BEEP_MS = 480;

/** Tones › Warning tones (the active profile's): On, Off; unset in the virgin EEPROM. */
const WARNING_TONES_KEY = "tones/warning-tones";
const WARNING_TONES_ON = 0;

/** Games › Settings › Sounds and Shakes (shared by the games): Off, On. */
const SOUNDS_KEY = "games/settings/sounds";
const SHAKES_KEY = "games/settings/shakes";
const GAMES_ON = 1;

/** Incoming call alert's options (5-3, 12-n-2-3). */
const ALERT = { ringing: 0, ascending: 1, ringOnce: 2, beepOnce: 3, off: 4 } as const;
/** Message alert tone's options (5-5, 12-n-2-5); No tone is silent. */
const MESSAGE_TONE_SLUGS = [undefined, "standard", "special", "beep-once", "ascending"] as const;
/** Vibrating alert's options: On, Off. */
const VIBRATING_ON = 0;

type RingingTone = (typeof RINGING_TONES)[number];

/**
 * Plan 27 (D8, D10 a): the Ringing tone options `RINGING_TONES` lacks (the Composer's saved tones,
 * 35-41), each with its own preview delay; undefined: an `(empty)` slot.
 */
export type UserRingingTones = (
  index: number,
) => (RingingTone & { readonly previewDelayMs?: number }) | undefined;

/** The Ringing volume level (1-5) from `atMs` into a program on. */
interface LevelStep {
  readonly atMs: number;
  readonly level: number;
}

/** A buzzer volume register from VOLUME_RULE's table for `level`. */
function tableVolume(level: number, hz: number): number {
  const table = VOLUME_RULE.tables[String(level)];
  const exact = table?.[String(hz)];
  if (exact !== undefined) return exact;
  // UNVERIFIED: a frequency not captured at this level (Standard's 1499.9 Hz at Levels 1-3)
  // takes the nearest captured frequency's register.
  const nearest = Object.keys(table ?? {})
    .map(Number)
    .sort((a, b) => Math.abs(a - hz) - Math.abs(b - hz))[0];
  if (nearest === undefined) throw new Error(`No volume table for Level ${level}.`);
  return table![String(nearest)]!;
}

/** The message `Beep once` tone's DSP word at `level` (captured: 1, 4, 5). */
function beepOnceWord(level: number): number {
  const exact = BEEP_ONCE_LEVELS[String(level)];
  if (exact !== undefined) return exact;
  // UNVERIFIED: Levels 2 and 3 were not captured; the word steps one per level between Level
  // 1's 0x9107 and Level 4's 0x9104.
  const low = BEEP_ONCE_LEVELS["1"]!;
  const high = BEEP_ONCE_LEVELS["4"]!;
  return low - Math.round(((low - high) * (level - 1)) / 3);
}

/** The volume rule over a level timeline (D10): the buzzer from the tables, the tone's word. */
function levelVolume(levels: readonly LevelStep[]): SoundVolume {
  const levelAt = (offsetMs: number): number =>
    levels.filter((step) => step.atMs <= offsetMs).at(-1)?.level ?? levels[0]!.level;
  return {
    changesAtMs: levels.slice(1).map((step) => step.atMs),
    of: (output, hz, _stored, offsetMs) =>
      output === "buzzer" ? tableVolume(levelAt(offsetMs), hz) : beepOnceWord(levelAt(offsetMs)),
  };
}

/** A tone's note position (`level5At`, `ascendingAt`) as a time into `program`. */
function positionMs(
  program: SoundProgram,
  position: { readonly note: number; readonly offsetMs: number },
): number {
  const start = noteStarts(program)[position.note];
  if (start === undefined) throw new Error(`${program.id} has no note ${position.note}.`);
  return start + position.offsetMs;
}

/** How many of a tone's preview steps make one cycle (its first pass, `cycleMs` long). */
function cycleSteps(tone: RingingTone): number {
  if (tone.cycleMs === undefined) return tone.program.steps.length;
  let t = 0;
  let best = { steps: tone.program.steps.length, off: Infinity };
  tone.program.steps.forEach((step, i) => {
    t += step.ms;
    const off = Math.abs(t - tone.cycleMs!);
    if (off < best.off) best = { steps: i + 1, off };
  });
  return best.steps;
}

/** `program` without its vibrator track (Vibrating alert Off). */
function withoutVibrator(program: SoundProgram): SoundProgram {
  return {
    ...program,
    steps: program.steps.map(({ vibrator: _vibrator, ...step }) => step),
  };
}

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
  /** The preview playing or armed. */
  #preview: SoundPlay | undefined;
  /** When the last key went down (a preview counts its delay from it). */
  #lastKeyMs: number | undefined;
  /**
   * When a note with a warning tone last opened, or a game-over screen silenced a key: the key
   * going down then makes no beep.
   */
  #silentAtMs: number | undefined;
  /** The last key's beep and when it started. */
  #beep: { readonly play: SoundPlay; readonly atMs: number } | undefined;
  /** The Keypad tones option the next key-down beeps at, instead of the stored one. */
  #keyLevel: { readonly option: number | null } | undefined;

  readonly #userTones: UserRingingTones | undefined;

  constructor(
    sequencer: SoundSequencer,
    settings: StockSettings,
    now: () => number,
    options: { readonly userTones?: UserRingingTones } = {},
  ) {
    this.#sequencer = sequencer;
    this.#settings = settings;
    this.#now = now;
    this.#userTones = options.userTones;
  }

  /**
   * A key went down while the phone is on (D8): 900 Hz at the Keypad tones level (Off: nothing),
   * ≈145 ms while the DSP is awake and ≈124 ms when this key wakes it. A beep that sounds already
   * runs on to this key's end. ▲/▼ held beep again at each auto-repeat, C at its long press.
   */
  keyDown(key: PhoneKey, options: KeyDownOptions = {}): void {
    const now = this.#now();
    this.#lastKeyMs = now;
    const level = this.#keyLevel;
    this.#keyLevel = undefined;
    // A note's warning tone opened by this key replaces its beep (D12); a game-over screen
    // silences it.
    const silenced = this.#silentAtMs === now;
    if ((options.beeps ?? true) && !silenced) this.#keyBeep(now, level?.option);
    const repeats = key === "up" || key === "down";
    const first = repeats ? LEVEL_REPEAT.firstMs : key === "c" ? C_HOLD_BEEP_MS : undefined;
    // Plan 27 (D10 c): a key silenced at its key-down (the Composer's) has no held beeps either.
    const holds = (options.holdBeeps ?? true) && !silenced;
    const next = holds && first !== undefined ? now + first : undefined;
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
    this.#preview = undefined;
    this.#held.clear();
    this.#keyLevel = undefined;
    this.#beep = undefined;
    this.#sequencer.stop(["buzzer", "tone", "vibrator"], now);
    this.#sequencer.play(BOOT_TONE.program, now);
  }

  /**
   * ▲/▼ highlighted option `index` of a preview list of the profile whose settings start with
   * `prefix` (`tones` or `profiles/<profile>/personalise`), D9: the preview playing stops, and
   * the highlighted one starts `PREVIEW_DELAY_MS` after the key (message tones:
   * `MESSAGE_PREVIEW_DELAY_MS`). A preview reads that profile's Incoming call alert and Ringing
   * volume, and the active profile's Vibrating alert.
   */
  preview(list: PreviewList, index: number, prefix: string): void {
    this.stopPreview();
    const key = this.#lastKeyMs ?? this.#now();
    if (list === "message-alert-tone") {
      this.#preview = this.#message(
        index,
        prefix,
        key + MESSAGE_PREVIEW_DELAY_MS,
        this.#vibrates(),
      );
      return;
    }
    if (list === "ringing-tone") {
      const tone = this.#toneAt(index);
      if (tone === undefined) return; // an `(empty)` slot
      const at = key + (tone.previewDelayMs ?? PREVIEW_DELAY_MS);
      this.#preview = this.#ringing(tone, prefix, this.#level(prefix), at, this.#vibrates());
      return;
    }
    // Ringing volume: the stored tone at the highlighted level, to its first cycle mark.
    const tone = this.#tone(prefix);
    if (tone === undefined) return;
    this.#preview = this.#ringing(
      tone,
      prefix,
      index + 1,
      key + (tone.previewDelayMs ?? PREVIEW_DELAY_MS),
      this.#vibrates(),
      tone.firstMarkStep,
    );
  }

  /** Stops the preview (C, OK, leaving the list, another ▲/▼). */
  stopPreview(): void {
    if (this.#preview !== undefined) this.#sequencer.cancel(this.#preview, this.#now());
    this.#preview = undefined;
  }

  /**
   * Plan 22: the incoming call's ringing for the profile at `prefix`: one cycle of its ringing
   * tone (the preview's first pass, to `cycleMs`) repeated for Ringing and Ascending, once for
   * Ring once, nothing for Beep once and Off (their ringing is not captured, D11), at its Ringing
   * volume (Level 5 and Ascending as in previews), with its own Vibrating alert. The five tones
   * whose preview ends inside its first pass (no `cycleMs`) repeat what was captured (UNVERIFIED:
   * plan 22 captures them whole).
   */
  ring(prefix: string): SoundPlay | undefined {
    const tone = this.#tone(prefix);
    if (tone === undefined) return undefined;
    const alert = this.#settings.choice(`${prefix}/incoming-call-alert`);
    const pass: SoundProgram = {
      id: `ring/${tone.slug}`,
      steps: tone.program.steps.slice(0, cycleSteps(tone)),
      ...(alert === ALERT.ringOnce ? {} : { loopFrom: 0 }),
    };
    const vibrates = this.#settings.choice(`${prefix}/vibrating-alert`) === VIBRATING_ON;
    return this.#ringing(
      { ...tone, program: pass },
      prefix,
      this.#level(prefix),
      this.#now(),
      vibrates,
    );
  }

  /** Plan 18: a received message's alert for the profile at `prefix` (its Message alert tone). */
  messageAlert(prefix: string): SoundPlay | undefined {
    const index = this.#settings.choice(`${prefix}/message-alert-tone`) ?? 0;
    const vibrates = this.#settings.choice(`${prefix}/vibrating-alert`) === VIBRATING_ON;
    return this.#message(index, prefix, this.#now(), vibrates);
  }

  /**
   * A note opened, or a key went down on it (D12): a note with a warning tone (`NOTE_SOUNDS`, by
   * its text) replaces the beep of the key that opened it, and plays the tone when Warning tones
   * is On; with it Off (or unset) that key is silent. Other notes change nothing.
   */
  note(lines: readonly string[]): void {
    const program = NOTE_SOUNDS[lines.join(" ")];
    if (program === undefined) return;
    const now = this.#now();
    this.#silenceKey(now);
    if (this.#settings.choice(WARNING_TONES_KEY) === WARNING_TONES_ON) {
      this.#sequencer.play(program, now);
    }
  }

  /** Plays `program` now (plan 27's Composer). */
  play(program: SoundProgram): SoundPlay {
    return this.#sequencer.play(program, this.#now());
  }

  /** Plan 27 (D10 b): ends `play` at `atMs` (default now): the Composer's Stop and C. */
  cancel(play: SoundPlay, atMs: number = this.#now()): void {
    this.#sequencer.cancel(play, atMs);
  }

  /**
   * A game cue at kernel time `atMs` (D13, Task 0 G): the meal, the crash and the top score play
   * their captured programs with Warning tones On and Games › Settings › Sounds On; a shake runs
   * the vibrator for its `ms` with Shakes On and the active profile's Vibrating alert On; a
   * silent key makes the key going down then beep nothing.
   */
  cue(cue: StockCue, atMs: number): void {
    if (cue.kind === "silent-key") {
      this.#silenceKey(atMs);
      return;
    }
    if (cue.kind === "vibrate") {
      if (this.#settings.choice(SHAKES_KEY) !== GAMES_ON || !this.#vibrates()) return;
      this.#sequencer.play({ id: "game/vibrate", steps: [{ ms: cue.ms, vibrator: true }] }, atMs);
      return;
    }
    if (this.#settings.choice(WARNING_TONES_KEY) !== WARNING_TONES_ON) return;
    if (this.#settings.choice(SOUNDS_KEY) !== GAMES_ON) return;
    const program = { eat: GAME_CUES.eat, crash: GAME_CUES.crash, "top-score": GAME_CUES.topScore };
    this.#sequencer.play(program[cue.kind], atMs);
  }

  /** The key going down at `atMs` makes no beep (its beep, if it has started, stops). */
  #silenceKey(atMs: number): void {
    this.#silentAtMs = atMs;
    if (this.#beep !== undefined && this.#beep.atMs === atMs) {
      this.#sequencer.cancel(this.#beep.play, atMs);
    }
  }

  /** The active profile's Vibrating alert (Tones, through `settingAlias`) is On. */
  #vibrates(): boolean {
    return this.#settings.choice("tones/vibrating-alert") === VIBRATING_ON;
  }

  /** The profile's Ringing volume level (1-5); null while unset (the virgin EEPROM). */
  #level(prefix: string): number | null {
    const index = this.#settings.choice(`${prefix}/ringing-volume`);
    return index === null ? null : index + 1;
  }

  /** The profile's stored ringing tone, if one is set (and built in or saved). */
  #tone(prefix: string): (RingingTone & { readonly previewDelayMs?: number }) | undefined {
    const index = this.#settings.choice(`${prefix}/ringing-tone`);
    return index === null ? undefined : this.#toneAt(index);
  }

  /** Ringing tone option `index`: a built-in tone, else a saved one (plan 27 D8). */
  #toneAt(index: number): (RingingTone & { readonly previewDelayMs?: number }) | undefined {
    return RINGING_TONES[index] ?? this.#userTones?.(index);
  }

  /**
   * A ringing tone at `level` (unset: Level 1's table, D7), gated by the profile's Incoming call
   * alert: Ringing and Ring once play, Ascending ramps from Level 1, Beep once, Off and unset are
   * silent (Task 0). Level 5 plays Level 4's table up to the tone's `level5At` (D10).
   */
  #ringing(
    tone: RingingTone,
    prefix: string,
    level: number | null,
    atMs: number,
    vibrates: boolean,
    endStep?: number,
  ): SoundPlay | undefined {
    const alert = this.#settings.choice(`${prefix}/incoming-call-alert`);
    if (alert === null || alert === ALERT.beepOnce || alert === ALERT.off) return undefined;
    const stored = level ?? 1;
    const program = vibrates ? tone.program : withoutVibrator(tone.program);
    const at = (position: { readonly note: number; readonly offsetMs: number }): number =>
      positionMs(tone.program, position);
    const levels: LevelStep[] =
      alert === ALERT.ascending
        ? [
            { atMs: 0, level: 1 },
            ...tone.ascendingAt.map((position, i) => ({ atMs: at(position), level: i + 2 })),
          ].filter((step) => step.level <= stored)
        : stored === 5
          ? [
              { atMs: 0, level: 4 },
              { atMs: at(tone.level5At), level: 5 },
            ]
          : [{ atMs: 0, level: stored }];
    return this.#sequencer.play(program, atMs, {
      volume: levelVolume(levels),
      ...(endStep === undefined ? {} : { endStep }),
    });
  }

  /** Message alert tone option `index` at the profile's Ringing volume (no alert-type gate). */
  #message(index: number, prefix: string, atMs: number, vibrates: boolean): SoundPlay | undefined {
    const slug = MESSAGE_TONE_SLUGS[index];
    if (slug === undefined) return undefined;
    const captured = MESSAGE_TONES[slug];
    if (captured === undefined) throw new Error(`No message tone "${slug}".`);
    const program = vibrates ? captured : withoutVibrator(captured);
    // Ascending was captured at Level 4 only: it plays as captured (UNVERIFIED at other levels).
    if (slug === "ascending") return this.#sequencer.play(program, atMs);
    const level = this.#level(prefix);
    if (level !== null) {
      return this.#sequencer.play(program, atMs, { volume: levelVolume([{ atMs: 0, level }]) });
    }
    // Ringing volume unset (virgin): the buzzer at its captured registers, not Level 1's table;
    // the Beep once tone at Level 1's word (UNVERIFIED: not captured unset).
    const unset: SoundVolume = {
      changesAtMs: [],
      of: (output, hz) =>
        output === "tone"
          ? beepOnceWord(1)
          : (UNSET_MESSAGE_VOLUMES[String(hz)] ?? tableVolume(1, hz)),
    };
    return this.#sequencer.play(program, atMs, { volume: unset });
  }

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
    this.#beep = { play: this.#sequencer.play(beepProgram(word, ms), atMs), atMs };
  }
}
