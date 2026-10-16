// Plan 21: one reminder on its own screen (plan21 reminders/view-*, erase-one*): its number top
// left and its alarm (`hh:mm dd.mm`) top right in the digits face, the alarm or note icon, the
// text in the thin face, and the soft key (`Options`, `Erase`).
import { textWidth, type Framebuffer } from "@hellotimber/phone-screen";
import { STOCK_FONTS, WIDGET_SPRITES } from "../../resources";
import { SOFTKEY_TOP } from "../standby";

export interface ReminderViewModel {
  readonly kind: "reminder-view";
  /** Its place in View all's order, from 1. */
  readonly number: number;
  /** `hh:mm dd.mm`, without an alarm absent. */
  readonly when?: string;
  readonly text: string;
  readonly softkey: string;
}

const TEXT_X = 15;
const TEXT_TOP = 8;
/** Later lines of a long text (UNVERIFIED: no capture shows one). */
const LINE_PITCH = 9;

/** `text` broken into lines `first` px wide, then `rest` px wide (at spaces where it can). */
function wrap(text: string, first: number, rest: number): string[] {
  const font = STOCK_FONTS.thin;
  const lines: string[] = [];
  let line = "";
  for (const ch of Array.from(text)) {
    const width = lines.length === 0 ? first : rest;
    if (line !== "" && textWidth(font, line + ch) > width) {
      lines.push(line);
      line = ch === " " ? "" : ch;
    } else line += ch;
  }
  if (line !== "") lines.push(line);
  return lines;
}

export function paintReminderView(fb: Framebuffer, model: ReminderViewModel): void {
  const digits = STOCK_FONTS.digits;
  fb.drawText(digits, String(model.number), 0, 0);
  if (model.when !== undefined) {
    fb.drawText(digits, model.when, fb.width - textWidth(digits, model.when), 0);
  }
  const icon = WIDGET_SPRITES[model.when === undefined ? "reminder/note" : "reminder/alarm"]!;
  fb.blitBitmap(icon.bitmap, icon.x, icon.y);
  wrap(model.text, fb.width - TEXT_X, fb.width).forEach((line, i) => {
    fb.drawText(STOCK_FONTS.thin, line, i === 0 ? TEXT_X : 0, TEXT_TOP + i * LINE_PITCH);
  });
  fb.drawTextCentered(STOCK_FONTS.small, model.softkey, SOFTKEY_TOP);
}
