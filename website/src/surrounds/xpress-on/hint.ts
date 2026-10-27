import type { PhoneKey } from "@hellotimber/phone-core";

export interface Hint {
  text: string;
  /** Keys the hint names, highlighted on the key guide. */
  keys: readonly PhoneKey[];
}

/** What to press next, read from the live path and LCD text. */
export function hintFor(path: string, screenText: string): Hint {
  if (screenText.startsWith("Phone off")) {
    return { text: "Phone is off. Hold P to switch it on.", keys: ["power"] };
  }
  if (screenText.startsWith("Starting up")) {
    return { text: "Starting up. Give it a few seconds.", keys: [] };
  }
  if (path === "standby") {
    return { text: "Press Menu (Enter) to open the menu.", keys: ["navi"] };
  }
  if (path.endsWith("/snake") || path.includes("/snake/")) {
    return { text: "Steer with 2 4 6 8. C (Esc) leaves.", keys: ["2", "4", "6", "8", "c"] };
  }
  if (screenText.includes("Enter another digit")) {
    return { text: "Type the next menu digit, or wait.", keys: [] };
  }
  return {
    text: "Arrows scroll, Enter selects, Esc goes back.",
    keys: ["up", "down", "navi", "c"],
  };
}
