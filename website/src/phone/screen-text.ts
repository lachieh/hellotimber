import type { MenuIndicator, ScreenModel } from "@hellotimber/phone-core";

function describeMenu(indicator: MenuIndicator): string {
  const hierarchy = `Menu ${indicator.segments.join(" then ")}.`;
  return indicator.awaitingNext ? `${hierarchy} Enter another digit.` : hierarchy;
}

/** A short spoken description of the current screen for an aria-live region. */
export function screenToText(s: ScreenModel): string {
  switch (s.kind) {
    case "off":
      return "Phone off.";
    case "boot":
      return "Starting up.";
    case "standby":
      if (s.notice !== undefined) {
        return `Standby. ${s.carrier}. ${s.notice.text}. ${s.notice.softkey}.`;
      }
      return `Standby. ${s.carrier}.${s.clock ? ` ${s.clock}.` : ""} Press Menu.`;
    case "menu-carousel":
      return `${describeMenu(s.menuIndicator)} ${s.label}, ${s.menuNumber} of ${s.total}.`;
    case "list":
      return `${s.menuIndicator === undefined ? "" : `${describeMenu(s.menuIndicator)} `}${s.title}. ${s.items[s.selected] ?? ""}, ${s.selected + 1} of ${s.items.length}. ${s.softkey}.`;
    case "reader":
      return `${s.menuIndicator === undefined ? "" : `${describeMenu(s.menuIndicator)} `}${s.title}. ${s.lines.join(" ")}`;
    case "editor":
      return `${s.title}. ${s.text || "empty"}. ${s.mode}.`;
    case "confirm":
      return `${s.text}. ${s.softkey}.`;
    case "custom":
      return `${s.appId}.`;
  }
}
