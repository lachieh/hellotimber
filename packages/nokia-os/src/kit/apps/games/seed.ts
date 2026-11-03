// The shared New-game seed (plan 24 D5): retain plan 23's minutes-of-the-day fallback.
// UNVERIFIED accepted default (Lachlan, 2026-10-27): the minutes-of-the-day fallback stays.
// Midnight route controls reject the clock/date-only fit; candidate u32s reproducing Snake II
// placements do not establish a New-game clock function. Tests inject recovered gameplay seeds.

/** The seed New game writes, from the clock ("HH:MM") and date; undefined without a clock. */
export function gameSeed(clock: string | undefined, _date: string | undefined): number | undefined {
  const match = /^(\d{1,2}):(\d{2})$/.exec(clock ?? "");
  if (match === null) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return undefined;
  return hours * 60 + minutes;
}
