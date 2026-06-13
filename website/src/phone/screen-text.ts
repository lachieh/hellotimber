import type { ScreenModel } from "@hellotimber/phone-core";

/** A short spoken description of the current screen for an aria-live region. */
export function screenToText(s: ScreenModel): string {
  switch (s.kind) {
    case "off":
      return "Phone off.";
    case "boot":
      return "Starting up.";
    case "standby":
      return `Standby. ${s.carrier}.${s.clock ? ` ${s.clock}.` : ""} Press Menu.`;
    case "menu-carousel":
      return `Menu. ${s.label}, ${s.menuNumber} of ${s.total}.`;
    case "list":
      return `${s.title}. ${s.items[s.selected] ?? ""}, ${s.selected + 1} of ${s.items.length}. ${s.softkey}.`;
    case "reader":
      return `${s.title}. ${s.lines.join(" ")}`;
    case "editor":
      return `${s.title}. ${s.text || "empty"}. ${s.mode}.`;
    case "confirm":
      return `${s.text}. ${s.softkey}.`;
    case "custom":
      return `${s.appId}.`;
  }
}
