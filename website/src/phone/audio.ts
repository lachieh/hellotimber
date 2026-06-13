import { getSettings } from "../settings";
import { parseComposer } from "./composer";
import { TONES } from "./tones";

/**
 * WebAudio singleton. The context is created LAZILY on first use, and every
 * entry point is reached from a user gesture (key handlers / button clicks),
 * which satisfies browser autoplay policy. SSR-safe: no-ops without window.
 */
let ctx: AudioContext | null = null;
let stopCurrentTone: (() => void) | null = null;

function ensureContext(): AudioContext | null {
  if (typeof window === "undefined" || typeof AudioContext === "undefined") return null;
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Square-wave blip with 5 ms ramps (no clicks). */
function scheduleNote(
  ac: AudioContext,
  out: AudioNode,
  freq: number,
  at: number,
  ms: number,
  gain: number,
): void {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = "square";
  osc.frequency.value = freq;
  const end = at + ms / 1000;
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.005);
  g.gain.setValueAtTime(gain, Math.max(at + 0.005, end - 0.005));
  g.gain.linearRampToValueAtTime(0, end);
  osc.connect(g).connect(out);
  osc.start(at);
  osc.stop(end);
}

/** Keypad beep: 1800 Hz square, 30 ms, quiet (spec §8 "Key beeps"). */
export function playKeyBeep(): void {
  const settings = getSettings();
  if (settings.muted || !settings.keypadTones) return;
  const ac = ensureContext();
  if (ac === null) return;
  scheduleNote(ac, ac.destination, 1800, ac.currentTime, 30, 0.04);
}

/** Play one ringtone by id (preview from the Tones menu/panel). */
export function playTone(id: string): void {
  if (getSettings().muted) return;
  const tone = TONES.find((t) => t.id === id);
  const ac = ensureContext();
  if (tone === undefined || ac === null) return;
  stopTone();
  const master = ac.createGain();
  master.gain.value = 1;
  master.connect(ac.destination);
  stopCurrentTone = () => {
    master.disconnect();
    stopCurrentTone = null;
  };
  let at = ac.currentTime + 0.05;
  for (const note of parseComposer(tone.notation, tone.bpm)) {
    if (note.freq !== null) {
      // 90% of the slot sounds; 10% gap keeps repeated notes articulated.
      scheduleNote(ac, master, note.freq, at, note.ms * 0.9, 0.06);
    }
    at += note.ms / 1000;
  }
}

export function stopTone(): void {
  stopCurrentTone?.();
}

/** Sink for phone-core 'sound' events — and the same entry point the
 *  website-registered picker apps call for previews (deviation 3). */
export function handleSound(sound: { kind: "key" | "tone"; id: string }): void {
  if (sound.kind === "key") playKeyBeep();
  else playTone(sound.id);
}
