// When two phone numbers are the same subscriber (plan 30 D7, Task 0 N): v6.39 names an SMS
// sender from the phone book when their last 9 digits are equal, or all digits of the shorter
// number when it has fewer than 9; the type of number (`+`) and any leading digits beyond those
// are ignored (`61412345678`, `0061412345678` and `2345678` all name Ann 0412345678; `0412345679`
// does not). Pure.

/** The digits the comparison reads. */
const MATCHED_DIGITS = 9;

const DIGITS = /^\+?([0-9]+)$/;

/** Whether `a` and `b` are the same subscriber by v6.39's rule; numbers with `* # p` must be equal. */
export function sameSubscriber(a: string, b: string): boolean {
  const x = DIGITS.exec(a)?.[1];
  const y = DIGITS.exec(b)?.[1];
  if (x === undefined || y === undefined) return a !== "" && a === b;
  const n = Math.min(MATCHED_DIGITS, x.length, y.length);
  return x.slice(-n) === y.slice(-n);
}
