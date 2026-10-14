import type { PhoneKey } from "@hellotimber/phone-core";
import type { LevelBarModel } from "../display/widgets";
import type { Flow, Widget } from "./flow";

/** Level: the bars as stored; ▲/▼ are inert in the virgin EEPROM, OK and C go back (P12). */
export function levelBar(options: { readonly bars: string; readonly softkey: string }): Widget {
  return {
    render: (): LevelBarModel => ({ kind: "level-bar", ...options }),
    onKey(key: PhoneKey, flow: Flow) {
      if (key === "navi" || key === "c") flow.back();
    },
  };
}
