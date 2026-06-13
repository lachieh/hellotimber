import { describe, expect, it } from "vite-plus/test";
import { FALLBACK_ICON, MENU_ICONS, menuIcon } from "../src/icons/menu-icons";

const IDS = [
  "phone-book",
  "messages",
  "chat",
  "call-register",
  "tones",
  "settings",
  "call-divert",
  "games",
  "calculator",
  "reminders",
  "clock",
  "profiles",
  "sim-services",
];

describe("menu icons", () => {
  it("has a 16×16 icon for each of the 13 menus", () => {
    expect(MENU_ICONS.size).toBe(13);
    for (const id of IDS) {
      const icon = MENU_ICONS.get(id);
      expect(icon, `missing icon '${id}'`).toBeDefined();
      expect(icon!.width, id).toBe(16);
      expect(icon!.height, id).toBe(16);
      expect(
        icon!.pixels.some((p) => p === 1),
        `icon '${id}' is blank`,
      ).toBe(true);
    }
  });

  it("icons are pairwise distinct", () => {
    const seen = new Set<string>();
    for (const id of IDS) {
      seen.add(MENU_ICONS.get(id)!.pixels.join(""));
    }
    expect(seen.size).toBe(13);
  });

  it("menuIcon falls back to the ?-box for unknown ids", () => {
    expect(menuIcon("phone-book")).toBe(MENU_ICONS.get("phone-book"));
    expect(menuIcon("does-not-exist")).toBe(FALLBACK_ICON);
    expect(FALLBACK_ICON.width).toBe(16);
    expect(FALLBACK_ICON.height).toBe(16);
  });
});
