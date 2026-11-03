// The host ports the stock firmware reads (plan 13 D6): values the phone shows but does not keep.

/** Host ports whose text appears on stock pages (and the clock on standby). */
export interface StockPorts {
  /** "HH:MM"; shown on Clock → Clock settings (and on standby). */
  clock?: () => string | undefined;
  /** Date text in the firmware's format (captured: `13.10.2026`); shown on Clock → Date setting. */
  date?: () => string | undefined;
}
