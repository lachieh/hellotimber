import type { Framebuffer } from "@hellotimber/phone-screen";
import { STOCK_FONTS, WIDGET_SPRITES, type WidgetFrame } from "../../resources";

/** The note's lines: the large face from x 0 at tops 3, 18 and 33, like every note. */
const LINE_TOPS = [3, 18, 33] as const;
const TITLE = "Game over!";

/**
 * A game's game-over screen (plan 23 D13, shared with plan 24): a new top score's full-screen
 * fireworks, then the note `Game over!` / label / score on a cleared screen (H14).
 */
export interface GameOverModel {
  readonly kind: "game-over";
  /** The timeline step: a `fireworks-<n>` picture, or `game-over/title` for the note. */
  readonly frame: WidgetFrame;
  /** `Your score:` or `TOP SCORE:`. */
  readonly label: string;
  readonly score: string;
}

export function paintGameOver(fb: Framebuffer, model: GameOverModel): void {
  const { frame } = model;
  if (frame.kind !== "sprite") throw new Error(`A game-over screen cannot show "${frame.kind}".`);
  if (frame.sprite.startsWith("fireworks")) {
    const picture = WIDGET_SPRITES[frame.sprite];
    if (picture === undefined) throw new Error(`No stock widget sprite "${frame.sprite}".`);
    fb.blitBitmap(picture.bitmap, picture.x, picture.y);
    return;
  }
  [TITLE, model.label, model.score].forEach((line, i) =>
    fb.drawText(STOCK_FONTS.large, line, 0, LINE_TOPS[i]!),
  );
}
