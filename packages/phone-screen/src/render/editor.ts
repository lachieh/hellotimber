import type { ScreenModel } from "@hellotimber/phone-core";
import { FONT } from "../font/font";
import type { Framebuffer } from "../framebuffer";
import { drawSoftkey, drawTextRight, LINE_CHARS, truncate, wrapText } from "./layout";

type EditorScreen = Extract<ScreenModel, { kind: "editor" }>;
type ConfirmScreen = Extract<ScreenModel, { kind: "confirm" }>;

/** 4 text rows at 8px pitch: glyph rows y…y+6, underline cursor row y+7. */
const EDITOR_ROWS = 4;
const EDITOR_TOP = 8;
const ADVANCE = 6;

export function renderEditor(fb: Framebuffer, screen: EditorScreen): void {
  fb.clear(0);
  fb.drawText(FONT, truncate(screen.title, 9), 1, 0);
  drawTextRight(fb, screen.mode, 83, 0); // input-mode indicator top-right (spec §2)

  // Hard character wrap (not word wrap) keeps cursor↔pixel math exact.
  const chars = [...screen.text];
  const rows: string[] = [];
  for (let i = 0; i < chars.length; i += LINE_CHARS) {
    rows.push(chars.slice(i, i + LINE_CHARS).join(""));
  }
  const cursorRow = Math.floor(screen.cursor / LINE_CHARS);
  const cursorCol = screen.cursor % LINE_CHARS;
  while (rows.length <= cursorRow) rows.push("");

  const top = Math.max(0, cursorRow - (EDITOR_ROWS - 1));
  for (let i = 0; i < EDITOR_ROWS; i++) {
    const row = rows[top + i];
    if (row === undefined) break;
    fb.drawText(FONT, row, 0, EDITOR_TOP + i * 8);
  }
  if (cursorRow >= top && cursorRow < top + EDITOR_ROWS) {
    const y = EDITOR_TOP + (cursorRow - top) * 8 + 7;
    fb.fillRect(cursorCol * ADVANCE, y, 5, 1, 1); // underscore cursor
  }
  drawSoftkey(fb, "Options");
}

export function renderConfirm(fb: Framebuffer, screen: ConfirmScreen): void {
  fb.clear(0);
  const lines = wrapText(screen.text).slice(0, 3);
  const top = Math.floor((41 - lines.length * 8) / 2);
  lines.forEach((line, i) => {
    fb.drawTextCentered(FONT, line, top + i * 8);
  });
  drawSoftkey(fb, screen.softkey);
}
