import type { ScreenModel } from "@hellotimber/phone-core";
import { formatMenuIndicator, LINE_CHARS, truncate, wrapText } from "@hellotimber/phone-screen";

/** One text row the LCD draws; `selected` is the inverted (highlighted) row. */
export interface LcdRow {
  text: string;
  selected?: true;
}

/**
 * The words the LCD is showing, laid out as phone-screen draws them: the top line, the body rows
 * actually on screen, and the soft key. Pixels-only screens (Snake) carry `pixels` instead of rows.
 */
export interface LcdCopy {
  head?: string;
  rows: LcdRow[];
  softkey?: string;
  pixels?: string;
}

/** phone-screen's list/reader body: three rows under the title. */
const VISIBLE_ROWS = 3;
/** phone-screen's editor body: four rows of hard-wrapped text. */
const EDITOR_ROWS = 4;

const rows = (lines: readonly string[]): LcdRow[] => lines.map((text) => ({ text }));

/** Same window as phone-screen's renderList: keep the selection on the middle row when it can. */
function listWindowTop(selected: number, count: number): number {
  return Math.min(Math.max(0, selected - 1), Math.max(0, count - VISIBLE_ROWS));
}

export function lcdCopy(screen: ScreenModel, welcomeText = "Welcome!"): LcdCopy {
  switch (screen.kind) {
    case "off":
      return { rows: [] };
    case "boot":
      return { rows: rows([screen.phase === "welcome" ? welcomeText : "NOKIA"]) };
    case "standby":
      if (screen.notice !== undefined) {
        return {
          rows: rows(wrapText(screen.notice.text, 11).slice(0, 3)),
          softkey: screen.notice.softkey,
        };
      }
      return {
        ...(screen.clock === undefined ? {} : { head: screen.clock }),
        rows: rows([screen.carrier]),
        softkey: "Menu",
      };
    case "menu-carousel":
      return {
        head: formatMenuIndicator(screen.menuIndicator),
        rows: rows([screen.label]),
        softkey: "Select",
      };
    case "list": {
      const top = listWindowTop(screen.selected, screen.items.length);
      return {
        head:
          screen.menuIndicator === undefined
            ? screen.title
            : formatMenuIndicator(screen.menuIndicator),
        rows: screen.items
          .slice(top, top + VISIBLE_ROWS)
          .map((text, offset) =>
            top + offset === screen.selected ? { text, selected: true } : { text },
          ),
        softkey: screen.softkey,
      };
    }
    case "reader":
      return {
        head: screen.title,
        rows: rows(screen.lines.slice(screen.scrollTop, screen.scrollTop + VISIBLE_ROWS)),
        softkey: "Back",
      };
    case "editor": {
      const chars = Array.from(screen.text);
      const lines: string[] = [];
      for (let i = 0; i < chars.length; i += LINE_CHARS) {
        lines.push(chars.slice(i, i + LINE_CHARS).join(""));
      }
      const cursorRow = Math.floor(screen.cursor / LINE_CHARS);
      const top = Math.max(0, cursorRow - (EDITOR_ROWS - 1));
      const remaining =
        screen.limit === undefined ? "" : ` ${Math.max(0, screen.limit - screen.text.length)}`;
      return {
        head: `${truncate(screen.title, 9)}${remaining} ${screen.mode}`,
        rows: rows(lines.slice(top, top + EDITOR_ROWS)),
        softkey: "Options",
      };
    }
    case "confirm":
      return { rows: rows(wrapText(screen.text).slice(0, 3)), softkey: screen.softkey };
    case "custom":
      return { rows: [], pixels: screen.appId };
  }
}

/** What to press next, in the voice of the sticky note. */
export function deskHint(path: string, screen: ScreenModel): string {
  if (path.startsWith("menu/games/snake")) return "Enter to play, steer with 2 4 6 8";
  switch (screen.kind) {
    case "off":
      return "it's off. Hold P to switch it on";
    case "boot":
      return "it's starting up, give it a sec";
    case "standby":
      if (screen.notice !== undefined) return `press ${screen.notice.softkey} (Enter)`;
      return "press Menu (Enter)";
    case "menu-carousel":
      return "up/down to flick through, Enter to open one";
    case "list":
      if (screen.softkey === "Options") return "Enter for Options, up/down to pick one";
      return `up/down to pick, Enter = ${screen.softkey}, Esc to go back`;
    case "reader":
      return "up/down to read on, Esc to go back";
    case "editor":
      return "type on 0-9, # for case, Enter for Options";
    case "confirm":
      return `Enter = ${screen.softkey}, Esc to back out`;
    case "custom":
      return "Esc to go back";
  }
}
