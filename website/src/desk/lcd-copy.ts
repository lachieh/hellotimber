import type { ScreenModel } from "@hellotimber/phone-core";
import { describeStockScreen } from "@hellotimber/nokia-os";

/** How the visitor presses the phone's keys: a keyboard, or tapping the 3D keys. */
export type KeyInput = "keyboard" | "touch";

/** The keys a hint names, in the visitor's own terms. */
const KEYS = {
  keyboard: { select: "Enter", back: "Esc", scroll: "up/down", power: "Hold P" },
  touch: {
    select: "the middle key",
    back: "C",
    scroll: "the arrow key",
    power: "Hold the button on top",
  },
} as const;

/** What to press next, in the voice of the sticky note, for keyboard or touch. */
export function deskHint(path: string, screen: ScreenModel, input: KeyInput = "keyboard"): string {
  const k = KEYS[input];
  const press = input === "touch" ? "tap" : "press";
  if (path.startsWith("menu/games/snake")) return `${k.select} to play, steer with 2 4 6 8`;
  switch (screen.kind) {
    case "off":
      return `it's off. ${k.power} to switch it on`;
    case "boot":
      return "it's starting up, give it a sec";
    case "standby": {
      const softkey = screen.notice?.softkey ?? "Menu";
      return input === "touch" ? `tap ${softkey}, the big middle key` : `press ${softkey} (Enter)`;
    }
    case "menu-carousel":
      return `${k.scroll} to flick through, ${k.select} to open one`;
    case "list":
      if (screen.softkey === "Options") return `${k.select} for Options, ${k.scroll} to pick one`;
      return `${k.scroll} to pick, ${k.select} = ${screen.softkey}, ${k.back} to go back`;
    case "reader":
      return `${k.scroll} to read on, ${k.back} to go back`;
    case "editor":
      return `type on 0-9, # for case, ${k.select} for Options`;
    case "confirm":
      return `${k.select} = ${screen.softkey}, ${k.back} to back out`;
    case "custom": {
      const text = describeStockScreen(screen);
      const softkey = text.match(/\[([^\]]+)\]$/)?.[1];
      if (text.startsWith("Editor:")) return `type on 0-9, # for case, ${k.select} for Options`;
      if (text.startsWith("Phone number:"))
        return `${press} a number on 0-9, then ${k.select} = ${softkey ?? "OK"}`;
      if (text.startsWith("Name:"))
        return `spell a name on 0-9 (2 twice for B), then ${k.select} = ${softkey ?? "OK"}`;
      if (softkey) return `${k.select} = ${softkey}, ${k.scroll} to scroll, ${k.back} to go back`;
      return text.startsWith("Switching on")
        ? "it's starting up, give it a sec"
        : `${k.back} to go back`;
    }
  }
}
