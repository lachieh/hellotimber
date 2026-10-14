import type { PhoneKey } from "@hellotimber/phone-core";
import type { InfoScreenModel } from "../display/widgets";
import type { Flow, Widget } from "./flow";

export interface InfoScreenOptions {
  /** Read on every render (Memory status: `SIM card:`, `50 free`, `0 in use`). */
  readonly lines: () => readonly string[];
  readonly softkey: string;
}

/** An info screen: its lines and `Back`; the soft key and C go back. */
export function infoScreen(options: InfoScreenOptions): Widget {
  return {
    render: (): InfoScreenModel => ({
      kind: "info-screen",
      lines: options.lines(),
      softkey: options.softkey,
    }),
    onKey(key: PhoneKey, flow: Flow) {
      if (key === "navi" || key === "c") flow.back();
    },
  };
}
