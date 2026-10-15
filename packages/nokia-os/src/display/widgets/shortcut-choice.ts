import { textWidth, type Framebuffer } from "@hellotimber/phone-screen";
import { STOCK_FONTS, type WidgetFrame } from "../../resources";
import { SOFTKEY_TOP } from "../standby";
import { paintPartial, standbyEdges } from "./note";

const LCD_WIDTH = 84;

/**
 * The screen after a stock shortcut digit chose an option (2026-10-14 probes,
 * `probe/shortcut-m8-6-3-then-1`): only the option's label, in the thin face at the soft key's
 * top, its last cell ending at the LCD's right edge (`Off`'s ink ends at x 82), or the partial
 * draw toward standby that closes it.
 */
export interface ShortcutChoiceModel {
  readonly kind: "shortcut-choice";
  readonly label: string;
  /** The closing partial draw (an `edges` step), while it shows. */
  readonly partial?: Extract<WidgetFrame, { kind: "edges" }>;
}

export function paintShortcutChoice(
  fb: Framebuffer,
  model: ShortcutChoiceModel,
  previous?: Uint8Array,
): void {
  if (model.partial !== undefined) {
    paintPartial(fb, model.partial, previous, standbyEdges());
    return;
  }
  const { label } = model;
  fb.drawText(STOCK_FONTS.thin, label, LCD_WIDTH - textWidth(STOCK_FONTS.thin, label), SOFTKEY_TOP);
}
