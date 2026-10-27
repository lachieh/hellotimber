// The seed New game takes from the clock (plan 24 D5; plan 23 D4): the provisional fallback.
//
// Evidence (plan 24 Task 0 S7, plan 23 Task 5): New game writes a u32 whose first draw, in
// 32-bit arithmetic (`random.ts`), is the first draw of every seed plan 23 recovered from the
// LCD, the 23:59 and 14.10.2026 overflows and the seed 00:00 and 00:01 share included. That u32
// is 0xd452fe80 + the seconds of the day + 86400 × the days since 13.10.2026 at every captured
// clock except hour 0, where 00:00 and 00:01 write the same value, 65 s and 5 s above it.
// So no function of the shown clock and date reproduces every Snake II seed golden, and the
// u32 counts seconds the clock port does not give. Every game seeds from the minutes of the day,
// UNVERIFIED; tests inject the recovered seeds.

/** The seed New game writes, from the clock ("HH:MM") and date; undefined without a clock. */
export function gameSeed(clock: string | undefined, _date: string | undefined): number | undefined {
  const match = /^(\d{1,2}):(\d{2})$/.exec(clock ?? "");
  if (match === null) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return undefined;
  return hours * 60 + minutes;
}
