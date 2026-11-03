import { Framebuffer } from "@hellotimber/phone-screen";
import { WIDGET_SPRITES, type WidgetFrame } from "../../resources";
import { paintPartial } from "./note";

/** A game's splash step: a full-frame image, or a partial draw toward the next one. */
export interface SplashModel {
  readonly kind: "splash";
  readonly frame: WidgetFrame;
  readonly next?: WidgetFrame;
}

function paintSplashFrame(fb: Framebuffer, frame: WidgetFrame | undefined): void {
  if (frame?.kind !== "sprite") throw new Error(`A splash cannot show "${frame?.kind}".`);
  const image = WIDGET_SPRITES[frame.sprite];
  if (image === undefined) throw new Error(`No stock widget sprite "${frame.sprite}".`);
  fb.blitBitmap(image.bitmap, image.x, image.y);
}

export function paintSplash(fb: Framebuffer, model: SplashModel, previous?: Uint8Array): void {
  const { frame } = model;
  if (frame.kind === "cut") {
    const target = new Framebuffer();
    paintSplashFrame(target, model.next);
    paintPartial(fb, frame, previous, target);
    return;
  }
  paintSplashFrame(fb, frame);
}
