// Clock (menu 11; plan 21 implements the alarm, the settings, the stopwatch and the countdown):
// the host's clock and date on their pages, the prompts' layouts and the setters' returns.
import type { PromptLayout } from "../../widgets/prompt";
import type { StockFeature } from "./feature";

const PEN_BOX_START: PromptLayout = { icons: ["pen"], entry: "start" };

/**
 * The Clock settings page under 12-hour Time format: `10:10` reads `10:10 am`
 * (`tree/11-clock/11-2-3-2.choose` image e). Other hours are UNVERIFIED (12-hour clock rules).
 */
export function twelveHourClock(hhmm: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (match === null) return hhmm;
  const hours = Number(match[1]);
  const shown = hours % 12 === 0 ? 12 : hours % 12;
  return `${String(shown).padStart(2, "0")}:${match[2]} ${hours < 12 ? "am" : "pm"}`;
}

/** The Time format setting and its 12-hour option (11-2-3, option 2). */
export const TIME_FORMAT = { key: "clock/clock-settings/time-format", twelveHour: 1 } as const;

export const clockFeature: StockFeature = {
  name: "clock",
  placeholders: {
    "11-4": "21", // Stopwatch
  },
  widgets: {
    promptLayouts: {
      "11-1": PEN_BOX_START,
      "11-2-2": PEN_BOX_START,
      "11-3": PEN_BOX_START,
      "11-5": PEN_BOX_START,
    },
    // Clock settings returns to its page (`tree/11-clock/11-2-1.leaf` and `11-2-3-1.choose`
    // image e).
    noteEnds: { "11-2-1": { levels: 2 }, "11-2-3-*": { levels: 2 } },
  },
  settings: {
    // The Clock pages show the host's values (plan 13 D6): the clock in the chosen Time format.
    hostValues: {
      "clock/clock-settings": (ports, settings) => {
        const value = ports.clock?.();
        const twelveHour = settings.choice(TIME_FORMAT.key) === TIME_FORMAT.twelveHour;
        return twelveHour && value !== undefined ? twelveHourClock(value) : value;
      },
      "clock/date-setting": (ports) => ports.date?.(),
    },
  },
};
