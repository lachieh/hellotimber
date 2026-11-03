// How the 3310 draws a stored SMS (plan 30 D2, Task 0 M). Pure.

/** Extension characters v6.39 draws as `?` (`sms/read/2`: `€` and `\` draw). */
const DRAWN_AS_QUESTION = new Set(Array.from("[]{}~|^"));

/** `text` as the 3310 draws a stored SMS: the extension characters it lacks become `?`. */
export function smsDrawn(text: string): string {
  return Array.from(text, (char) => (DRAWN_AS_QUESTION.has(char) ? "?" : char)).join("");
}
