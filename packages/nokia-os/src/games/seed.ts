// The shared New-game seed (plan 24 D5): retain plan 23's minutes-of-the-day fallback.
// A clock/date fit still needs informative LCD evidence, including hour 0 and overflow cases.
// The inherited u32 comparison table contains candidates equivalent to Snake II's recovered
// placements; it does not establish the u32 actually written at every capture clock.
// Tests inject recovered seeds while the clock rule remains UNVERIFIED.

/** The seed New game writes, from the clock ("HH:MM") and date; undefined without a clock. */
export function gameSeed(clock: string | undefined, _date: string | undefined): number | undefined {
  const match = /^(\d{1,2}):(\d{2})$/.exec(clock ?? "");
  if (match === null) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return undefined;
  return hours * 60 + minutes;
}
