// Plan 18's message screens: the Inbox and Outbox lists and a message's pages.
import type { MenuIndicator } from "@hellotimber/phone-core";
import type { Framebuffer } from "@hellotimber/phone-screen";
import { missingStockGlyphs, STOCK_FONTS, WIDGET_SPRITES } from "../../resources";
import { paintIndicator } from "../indicator";
import { VISIBLE_ROWS } from "../list-rows";
import { SOFTKEY_TOP } from "../standby";

/**
 * Text from the network as the small face can draw it: characters it lacks are left out (D6:
 * network text may hold any character; `missingStockGlyphs` reports them).
 */
export function drawable(text: string): string {
  const missing = new Set(missingStockGlyphs(text, "small"));
  return missing.size === 0 ? text : Array.from(text, (ch) => (missing.has(ch) ? "" : ch)).join("");
}

/** Rows as a rows list's: 10-row slots from y 7, text one row below the slot's top. */
const BAND_TOP = 7;
const ROW_PITCH = 10;
/** The selected row's band runs from x 8 to the right edge; the label starts 2 columns in. */
const BAND_LEFT = 8;
const LABEL_LEFT = 10;
/**
 * The icons sit left of the band, below the slot's top: the closed envelope 2 rows down, the
 * open one 1 (`sms/inbox-list-one-read`).
 */
const ICON_DROPS: Readonly<Record<MessageRowIcon, number>> = {
  "message/unread": 2,
  "message/read": 1,
};

export type MessageRowIcon = "message/unread" | "message/read";

/** The Inbox or Outbox list (`sms/inbox-list`, `sms/outbox-list`). */
export interface MessageListModel {
  readonly kind: "message-list";
  readonly rows: readonly { readonly label: string; readonly icon: MessageRowIcon }[];
  readonly selected: number;
  /** The row on top of the circular window (D3). */
  readonly windowTop: number;
  readonly indicator: MenuIndicator;
  readonly softkey: string;
}

export function paintMessageList(fb: Framebuffer, model: MessageListModel): void {
  const { rows, selected, windowTop } = model;
  const shown = Math.min(VISIBLE_ROWS, rows.length);
  for (let slot = 0; slot < shown; slot++) {
    const index = (windowTop + slot) % rows.length;
    const { label, icon } = rows[index]!;
    const top = BAND_TOP + slot * ROW_PITCH;
    const inverted = index === selected;
    if (inverted) fb.fillRect(BAND_LEFT, top, fb.width - BAND_LEFT, ROW_PITCH, 1);
    fb.drawText(STOCK_FONTS.small, drawable(label), LABEL_LEFT, top + 1, {
      color: inverted ? 0 : 1,
    });
    const sprite = WIDGET_SPRITES[icon];
    if (sprite === undefined) throw new Error(`No stock widget sprite "${icon}".`);
    fb.blitBitmap(sprite.bitmap, sprite.x, top + ICON_DROPS[icon]);
  }
  paintIndicator(fb, model.indicator);
  fb.drawTextCentered(STOCK_FONTS.small, model.softkey, SOFTKEY_TOP);
}

/** A message's page lines: small from x 0, 9 rows apart from the top (`sms/inbox-view-1`). */
const PAGE_PITCH = 9;
export const MESSAGE_PAGE_LINES = 4;

/** One page of a message (its text, Sender, Sent) or of its Details. */
export interface MessagePageModel {
  readonly kind: "message-page";
  readonly lines: readonly string[];
  readonly softkey: string;
}

export function paintMessagePage(fb: Framebuffer, model: MessagePageModel): void {
  if (model.lines.length > MESSAGE_PAGE_LINES) {
    throw new Error(`A message page holds ${MESSAGE_PAGE_LINES} lines, not ${model.lines.length}.`);
  }
  model.lines.forEach((line, i) =>
    fb.drawText(STOCK_FONTS.small, drawable(line), 0, i * PAGE_PITCH),
  );
  fb.drawTextCentered(STOCK_FONTS.small, model.softkey, SOFTKEY_TOP);
}
