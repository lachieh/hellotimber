import type { Framebuffer } from "@hellotimber/phone-screen";

/** A packed 84×48 frame: one bit a pixel, no padding between rows. */
export const GAME_FRAME_BYTES = 504;

/**
 * A game's own screen (plan 28): the whole LCD as a packed frame, row-major, MSB first, 1 = ink,
 * as base64 so the model is plain data a flow compares by value.
 */
export interface GameFrameModel {
  readonly kind: "game-frame";
  readonly frame: string;
}

/** The model of a packed frame of `GAME_FRAME_BYTES` bytes. */
export function gameFrame(packed: Uint8Array): GameFrameModel {
  if (packed.length !== GAME_FRAME_BYTES) {
    throw new Error(`A game frame is ${GAME_FRAME_BYTES} bytes, not ${packed.length}.`);
  }
  return { kind: "game-frame", frame: btoa(String.fromCharCode(...packed)) };
}

function unpack(frame: string): string {
  let bytes: string;
  try {
    bytes = atob(frame);
  } catch {
    throw new Error("A game frame is not base64.");
  }
  if (bytes.length !== GAME_FRAME_BYTES) {
    throw new Error(`A game frame is ${GAME_FRAME_BYTES} bytes, not ${bytes.length}.`);
  }
  return bytes;
}

/** Sets every pixel of the LCD, clear ones too. */
export function paintGameFrame(fb: Framebuffer, model: GameFrameModel): void {
  const bytes = unpack(model.frame);
  for (let i = 0; i < fb.pixels.length; i++) {
    fb.pixels[i] = (bytes.charCodeAt(i >> 3) >> (7 - (i & 7))) & 1;
  }
}
