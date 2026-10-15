// The active profile (plan 17): the status line names it, with the standby line and the silent
// icon the phone shows. Activate a profile in Menu › Profiles, or with the power key's short press
// at standby; Rename it in its Personalise.
import { StockEeprom } from "../../src/firmware/eeprom";
import { activeProfile, profileName } from "../../src/firmware/features/profiles";
import { createStockSettings } from "../../src/firmware/settings";
import type { DemoHost, DemoPanel } from "../panel";

let shell: DemoHost | undefined;

export const profilesPanel: DemoPanel = {
  name: "profiles",
  plan: 17,
  mount(_slots, host) {
    shell = host;
  },
  status() {
    const screen = shell?.phone?.screen;
    const standby = screen?.kind === "standby" ? screen : undefined;
    const settings = createStockSettings(new StockEeprom(window.localStorage));
    const parts = [`profile: ${profileName(settings, activeProfile(settings))}`];
    if (standby?.line !== undefined) parts.push(`standby line: ${standby.line}`);
    if (standby?.indicators?.silent) parts.push("silent icon");
    return parts.join(", ");
  },
};
