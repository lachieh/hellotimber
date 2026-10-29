import type { StockSoundEvent, StockSoundPort } from "@hellotimber/nokia-os";
const BUZZER_GAIN = [
  [0, 0],
  [4, 0.05],
  [16, 0.1],
  [61, 0.18],
  [194, 0.25],
] as const;
function buzzerGain(register: number): number {
  for (let i = 1; i < BUZZER_GAIN.length; i++) {
    const [r1, g1] = BUZZER_GAIN[i]!;
    if (register > r1) continue;
    const [r0, g0] = BUZZER_GAIN[i - 1]!;
    return g0 + ((g1 - g0) * (register - r0)) / (r1 - r0);
  }
  return 0.25;
}
interface Voice {
  oscillator: OscillatorNode;
  gain: GainNode;
}
export class WebAudioSound implements StockSoundPort {
  phoneNow = 0;
  #muted = false;
  #vibration: ReturnType<typeof setInterval> | undefined;
  #audio:
    | { ctx: AudioContext; master: GainNode; buzzer: Voice; tone: Voice; tone2: Voice }
    | undefined;
  start(): void {
    if (this.#audio) {
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
    this.#audio = {
      ctx,
      master,
      buzzer: voice("square"),
      tone: voice("sine"),
      tone2: voice("sine"),
    };
  }
  set muted(value: boolean) {
    this.#muted = value;
    if (this.#audio) this.#audio.master.gain.value = value ? 0 : 1;
    if (value) this.#vibrate(false);
  }
  #vibrate(on: boolean): void {
    clearInterval(this.#vibration);
    this.#vibration = undefined;
    if (typeof navigator === "undefined" || !navigator.vibrate) return;
    if (!on) {
      navigator.vibrate(0);
      return;
    }
    navigator.vibrate(200);
    this.#vibration = setInterval(() => navigator.vibrate(200), 150);
  }
  change(event: StockSoundEvent): void {
    const delay = (event.atMs - this.phoneNow) / 1000 + 0.03;
    if (event.output === "vibrator") {
      setTimeout(
        () => {
          if (!event.on || !this.#muted) this.#vibrate(event.on);
        },
        Math.max(0, delay * 1000),
      );
      return;
    }
    const audio = this.#audio;
    if (!audio) return;
    const at = audio.ctx.currentTime + delay;
    const voice = audio[event.output];
    if (event.hz === null) {
      voice.gain.gain.setValueAtTime(0, at);
      if (event.output === "tone") audio.tone2.gain.gain.setValueAtTime(0, at);
      return;
    }
    const nibble = event.volume & 0xf;
    const gain =
      event.output === "buzzer"
        ? buzzerGain(event.volume)
        : nibble === 15
          ? 0
          : 0.06 * (1 - nibble / 15);
    voice.oscillator.frequency.setValueAtTime(event.hz, at);
    voice.gain.gain.setValueAtTime(gain, at);
    if (event.output === "tone") {
      if (event.hz2 !== undefined) audio.tone2.oscillator.frequency.setValueAtTime(event.hz2, at);
      audio.tone2.gain.gain.setValueAtTime(event.hz2 === undefined ? 0 : gain, at);
    }
  }
}
