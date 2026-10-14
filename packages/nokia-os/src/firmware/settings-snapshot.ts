// The current-value lines stock pages show, as captured (plan 13 "Page values"). The emulator
// ran with a virgin EEPROM, so these are its settings; the storage plan (15) replaces this static
// snapshot with real state. Keys are `<submenu slug>/<child slug>`.

/** Host ports whose text appears on stock pages. */
export interface StockPorts {
  /** "HH:MM"; shown on Clock → Clock settings (and on standby). */
  clock?: () => string | undefined;
  /** Date text in the firmware's format (captured: `13.10.2026`); shown on Clock → Date setting. */
  date?: () => string | undefined;
}

const SNAPSHOT: Readonly<Record<string, string>> = {
  "messages/info-service": "Off",
  "tones/ringing-volume": "Level 1",
  "tones/message-alert-tone": "No tone",
  "tones/keypad-tones": "Level 1",
  "tones/screen-saver": "Off",
  "clock/alarm-clock": "Off",
  "clock/countdown-timer": "Off",
  "clock/auto-update-of-date-and-time": "Off",
};

/** The value a stock page shows for `child` of `submenu`; undefined when the page has none. */
export function stockDetail(submenu: string, child: string, ports: StockPorts): string | undefined {
  if (submenu === "clock" && child === "clock-settings") return ports.clock?.();
  if (submenu === "clock" && child === "date-setting") return ports.date?.();
  return SNAPSHOT[`${submenu}/${child}`];
}
