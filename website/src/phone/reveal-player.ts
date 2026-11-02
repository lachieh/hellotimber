import { DRAWN, REVEAL_MS, REVEALED, revealAt } from "./reveal";
import type { RevealFrame } from "./reveal";

/**
 * The reveal's current frame, for the drawing (PhoneSlot) and the 3D phone (PhoneStage `pose`)
 * alike. `playReveal` runs it on a clock.
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

function setRevealFrame(next: RevealFrame): void {
  frame = next;
  for (const listener of listeners) listener();
}

let clock: number | undefined;

/** Turn the drawing into the phone (once its 3D model is ready under the drawing). */
export function playReveal(): void {
  if (clock !== undefined) cancelAnimationFrame(clock);
  clock = undefined;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    setRevealFrame(REVEALED);
    return;
  }
  const start = performance.now();
  clock = requestAnimationFrame(function tick(now) {
    const ms = now - start;
    if (ms >= REVEAL_MS) {
      clock = undefined;
      setRevealFrame(REVEALED);
      return;
    }
    setRevealFrame(revealAt(ms));
    clock = requestAnimationFrame(tick);
  });
}
