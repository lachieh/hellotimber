import type { ScreenModel } from "@hellotimber/phone-core";
import { describeStockScreen } from "@hellotimber/nokia-os";

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
    case "custom": {
      const text = describeStockScreen(screen);
      const softkey = text.match(/\[([^\]]+)\]$/)?.[1];
      if (text.startsWith("Editor:")) return "type on 0-9, # for case, Enter for Options";
      if (softkey) return `Enter = ${softkey}, up/down to scroll, Esc to go back`;
      return text.startsWith("Switching on") ? "it's starting up, give it a sec" : "Esc to go back";
    }
  }
}
