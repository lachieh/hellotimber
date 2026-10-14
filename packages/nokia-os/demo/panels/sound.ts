// The phone's sound port (plan 16 D4) through WebAudio: the buzzer and the tone generator, a
// VIBRA lamp and a shake of the LCD for the vibrator, a mute box, and the last events logged for
// headless checks.
import type { StockSoundEvent, StockSoundPort } from "../../src/index";
import { byId, html, type DemoPanel } from "../panel";

/** The panel's elements, once mounted. */
let elements: { lamp: HTMLElement; log: HTMLElement; lcd: HTMLElement } | undefined;

/**
 * Buzzer volume register (MAD2 PUP 0x1E, 0-194 captured; higher is louder) → gain, linear
 * between these points. The demo's choice: the emulator renders neither volume register and the
 * phone's loudness is not captured (plan 16 Open question 2). Captured registers:
 * Level 1 tables ≈4, Level 4 ≈16, Level 5 ≈61, Snake II 3-6, `Code error` 22.
 *
 * | register | 0 | 4    | 16   | 61   | 194  |
 * | gain     | 0 | 0.05 | 0.10 | 0.18 | 0.25 |
 */
const BUZZER_GAIN: readonly (readonly [register: number, gain: number])[] = [
  [0, 0],
  [4, 0.05],
  [16, 0.1],
  [61, 0.18],
  [194, 0.25],
];

/**
 * Tone-generator level word (0x91LN) → gain by its low nibble N (0 loudest; 0xF mutes): the
 * earpiece path, a quiet sine (the emulator renders it as a sine; the earpiece's sound is not
 * captured). Keypad Level 1/2/3 = 0x9108/0x9104/0x9100, warning tones 0x9105.
 */
const TONE_GAIN: readonly number[] = Array.from({ length: 16 }, (_, n) =>
  n === 15 ? 0 : 0.06 * (1 - n / 15),
);

/** Scheduling headroom: events play this long after their kernel time. */
const SOUND_LATENCY_S = 0.03;
/** The event log's length. */
const SOUND_LOG_LENGTH = 8;

function buzzerGain(register: number): number {
  for (let i = 1; i < BUZZER_GAIN.length; i++) {
    const [r1, g1] = BUZZER_GAIN[i]!;
    if (register > r1) continue;
    const [r0, g0] = BUZZER_GAIN[i - 1]!;
    return g0 + ((g1 - g0) * (register - r0)) / (r1 - r0);
  }
  return BUZZER_GAIN.at(-1)![1];
}

/** `atMs output state`, as the sound goldens write rows. */
function describeSound(event: StockSoundEvent): string {
  if (event.output === "vibrator") return `${event.atMs} vibrator ${event.on ? "on" : "off"}`;
  if (event.hz === null) return `${event.atMs} ${event.output} off`;
  const volume =
    event.output === "tone" ? `0x${event.volume.toString(16).toUpperCase()}` : event.volume;
  return `${event.atMs} ${event.output} ${event.hz} v=${volume}`;
}

interface Voice {
  readonly oscillator: OscillatorNode;
  readonly gain: GainNode;
}

/**
 * The phone's sound port: one AudioContext (made on the first user gesture, as browsers
 * require), the buzzer as a square and the tone generator as a sine, each through its gain;
 * every event scheduled at `currentTime + (atMs - phoneNow) / 1000 + SOUND_LATENCY_S`.
 */
class WebAudioSound implements StockSoundPort {
  /** The kernel time of the tick emitting events (the demo's clock). */
  phoneNow = 0;
  #audio: { ctx: AudioContext; master: GainNode; buzzer: Voice; tone: Voice } | undefined;
  #muted = false;
  #log: string[] = [];

  /** Creates or resumes the AudioContext (call from a user gesture). */
  start(): void {
    if (this.#audio !== undefined) {
      void this.#audio.ctx.resume();
      return;
    }
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = this.#muted ? 0 : 1;
    master.connect(ctx.destination);
    const voice = (type: OscillatorType): Voice => {
      const oscillator = ctx.createOscillator();
      oscillator.type = type;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      oscillator.connect(gain).connect(master);
      oscillator.start();
      return { oscillator, gain };
    };
    this.#audio = { ctx, master, buzzer: voice("square"), tone: voice("sine") };
  }

  set muted(muted: boolean) {
    this.#muted = muted;
    if (this.#audio !== undefined) this.#audio.master.gain.value = muted ? 0 : 1;
  }

  change(event: StockSoundEvent): void {
    this.#log = [...this.#log, describeSound(event)].slice(-SOUND_LOG_LENGTH);
    elements?.log.replaceChildren(
      ...this.#log.map((line) =>
        Object.assign(document.createElement("li"), { textContent: line }),
      ),
    );
    const delayS = (event.atMs - this.phoneNow) / 1000 + SOUND_LATENCY_S;
    if (event.output === "vibrator") {
      setTimeout(() => vibrate(event.on), Math.max(0, delayS * 1000));
      return;
    }
    const audio = this.#audio;
    if (audio === undefined) return;
    const at = audio.ctx.currentTime + delayS;
    const voice = audio[event.output];
    if (event.hz === null) {
      voice.gain.gain.setValueAtTime(0, at);
      return;
    }
    voice.oscillator.frequency.setValueAtTime(event.hz, at);
    const gain =
      event.output === "buzzer" ? buzzerGain(event.volume) : TONE_GAIN[event.volume & 0xf]!;
    voice.gain.gain.setValueAtTime(gain, at);
  }

  /** Silences everything (a restarted phone emits nothing for its predecessor's sounds). */
  reset(): void {
    const audio = this.#audio;
    if (audio !== undefined) {
      for (const voice of [audio.buzzer, audio.tone]) {
        voice.gain.gain.cancelScheduledValues(0);
        voice.gain.gain.value = 0;
      }
    }
    vibrate(false);
  }
}

function vibrate(on: boolean): void {
  elements?.lamp.classList.toggle("on", on);
  elements?.lcd.classList.toggle("shaking", on);
}

const sound = new WebAudioSound();

export const soundPanel: DemoPanel = {
  name: "sound",
  plan: 16,
  mount(slots) {
    const lamp = html(`<span id="vibra" class="vibra" aria-label="Vibrator">VIBRA</span>`);
    const log = html(
      `<ol id="sound-log" class="sound-log" aria-label="Sound events (the last 8)"></ol>`,
    );
    const mute = html<HTMLLabelElement>(`
      <label class="check">
        <input id="mute" type="checkbox" />
        Mute
      </label>`);
    const muteBox = byId<HTMLInputElement>(mute, "mute");
    muteBox.addEventListener("change", () => {
      sound.muted = muteBox.checked;
    });
    elements = { lamp, log, lcd: slots.lcd };
    slots.screenRow.append(lamp);
    slots.phone(log);
    slots.control(mute);
    // Browsers start audio only from a user gesture: the first key or click starts it.
    for (const type of ["pointerdown", "keydown"] as const) {
      window.addEventListener(type, () => sound.start(), { capture: true });
    }
  },
  config: () => ({ sound }),
  // A restarted phone emits nothing for its predecessor's sounds.
  beforeRestart: () => sound.reset(),
  frame(nowMs) {
    sound.phoneNow = nowMs;
  },
};
