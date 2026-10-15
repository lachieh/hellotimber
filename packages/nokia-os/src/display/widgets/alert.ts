// Plan 21: the clock's alerts, drawn in the standby layout (Task 0): the ladders, the clock and
// its indicators kept, the operator line replaced by the alert's lines (and the reminder's
// icon), the bell row below them, the soft key.
import type { StandbyIndicators } from "@hellotimber/phone-core";
import { textWidth, type Framebuffer } from "@hellotimber/phone-screen";
import { STATUS_SPRITES, STOCK_FONTS, WIDGET_SPRITES, type StockSprite } from "../../resources";
import { paintClock, paintClockIndicators } from "../clock-indicators";
import { SOFTKEY_TOP } from "../standby";

export interface AlertModel {
  readonly kind: "alert";
  /** Standby's clock and indicators, as standby would draw them now. */
  readonly clock?: string;
  readonly indicators?: StandbyIndicators;
  /** Lines in the small face from top 7, 9 rows apart. */
  readonly lines: readonly string[];
  /**
   * `block`: every line from the x that centres the widest (Countdown / time up); `centre`:
   * each line centred (Alarm! / 10:11); `left`: from x 6 (a reminder's text).
   */
  readonly align: "block" | "centre" | "left";
  /** Sprite ids drawn at their captured place: the reminder's icon, the bell row. */
  readonly sprites?: readonly string[];
  readonly softkey: string;
  /** Without the ladders and their icons (Alarm postponed for 10 min). */
  readonly bare?: true;
}

const LINES_TOP = 7;
const LINE_PITCH = 9;
const LEFT_X = 6;

function paintSprites(fb: Framebuffer, sprites: readonly StockSprite[]): void {
  for (const { bitmap, x, y } of sprites) fb.blitBitmap(bitmap, x, y);
}

export function paintAlert(fb: Framebuffer, model: AlertModel): void {
  if (!model.bare) {
    paintSprites(fb, STATUS_SPRITES.signalBars);
    paintSprites(fb, [STATUS_SPRITES.signalIcon]);
    paintSprites(fb, STATUS_SPRITES.batteryBars);
    paintSprites(fb, [STATUS_SPRITES.batteryIcon]);
  }
  if (model.clock !== undefined) paintClock(fb, model.clock);
  paintClockIndicators(fb, {
    kind: "standby",
    carrier: "",
    signal: 4,
    battery: 4,
    ...(model.clock === undefined ? {} : { clock: model.clock }),
    ...(model.indicators === undefined ? {} : { indicators: model.indicators }),
  });
  const font = STOCK_FONTS.small;
  const widest = Math.max(0, ...model.lines.map((line) => textWidth(font, line)));
  model.lines.forEach((line, i) => {
    const top = LINES_TOP + i * LINE_PITCH;
    const x =
      model.align === "left"
        ? LEFT_X
        : model.align === "block"
          ? Math.floor((fb.width - widest) / 2)
          : Math.floor((fb.width - textWidth(font, line)) / 2);
    fb.drawText(font, line, x, top);
  });
  for (const id of model.sprites ?? []) {
    const sprite = WIDGET_SPRITES[id];
    if (sprite === undefined) throw new Error(`No stock widget sprite "${id}".`);
    fb.blitBitmap(sprite.bitmap, sprite.x, sprite.y);
  }
  if (model.softkey !== "") fb.drawTextCentered(font, model.softkey, SOFTKEY_TOP);
}
