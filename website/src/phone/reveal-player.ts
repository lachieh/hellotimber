import { DRAWN, REVEAL_SECONDS, REVEALED, sampleReveal } from "./reveal";
import type { RevealFrame } from "./reveal";

/**
 * The reveal's current frame, for the drawing (PhoneSlot) and the 3D phone (PhoneStage `pose`)
 * alike. `playReveal` runs REVEAL on a clock; a tuner (DialKit's dock, dev only) can take over and
 * feed frames itself.
 */
let frame: RevealFrame = DRAWN;
const listeners = new Set<() => void>();

export function getRevealFrame(): RevealFrame {
  return frame;
}

export function subscribeReveal(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setRevealFrame(next: RevealFrame): void {
  frame = next;
  for (const listener of listeners) listener();
}

let played = false;
let clock: number | undefined;
let tuner: { replay: () => void } | undefined;

function stopClock() {
  if (clock !== undefined) cancelAnimationFrame(clock);
  clock = undefined;
}

/** Bring the phone to life (once its 3D model is ready under the drawing). */
export function playReveal(): void {
  played = true;
  if (tuner !== undefined) {
    tuner.replay();
    return;
  }
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    setRevealFrame(REVEALED);
    return;
  }
  stopClock();
  const start = performance.now();
  clock = requestAnimationFrame(function tick(now) {
    const seconds = (now - start) / 1000;
    if (seconds >= REVEAL_SECONDS) {
      clock = undefined;
      setRevealFrame(REVEALED);
      return;
    }
    setRevealFrame(sampleReveal(seconds));
    clock = requestAnimationFrame(tick);
  });
}

/** A tuner takes over the frames: it replays the reveal itself, now if it already started. */
export function attachRevealTuner(replay: () => void): () => void {
  stopClock();
  const attached = { replay };
  tuner = attached;
  if (played) replay();
  return () => {
    if (tuner === attached) tuner = undefined;
  };
}
