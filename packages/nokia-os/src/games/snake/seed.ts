// The Snake II seed from the clock (plan 23 D4, Open question 2): the provisional fallback.
//
// Evidence (plan 23 Task 5 deviation): one seed per recorded game reproduces every placement,
// and New game reseeds from the clock. On 13.10.2026 the seeds of 07:59, 09:14, 09:56, 10:07,
// 10:10, 10:11, 10:21, 10:35, 11:07, 12:00, 12:21 and 19:48 all equal
// (seconds of the day + 7930) mod 65521. 23:59 and 10:10 on 14.10.2026 differ from that by
// 10160, which is what a 32-bit seconds count overflowing in the generator's first
// multiplication adds, but the data leave the count's epoch open (thousands of offsets fit),
// and 00:00 and 00:01 draw the same seed (7995), which no function of the shown clock gives.
// So no closed form of the clock and date ports fits every capture: the stock phone seeds from
// the minutes of the day, UNVERIFIED, and tests inject the recovered seeds.

/** The seed New game takes from the clock ("HH:MM"), or undefined when it is not set. */
export function seedFromClock(clock: string | undefined): number | undefined {
  const match = /^(\d{1,2}):(\d{2})$/.exec(clock ?? "");
  if (match === null) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return undefined;
  return hours * 60 + minutes;
}
