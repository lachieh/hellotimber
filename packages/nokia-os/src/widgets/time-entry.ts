// The stock time and date entry (plan 21 D6): Set alarm time, Time, Date, Set timer, Reminder
// date and Reminder time. The prompt's first screen (plan 14) with an overwrite mask: digits
// replace the value from its first digit on, skipping the separators, the cursor before the next
// digit (after the last it returns to the first); a digit a position cannot take is ignored
// (the hour's tens take 0-2, ...). C goes back at once; OK checks the whole value: a mask still
// holding a placeholder, or no such time or date, shows `Invalid time` / `Invalid date` and
// returns to the entry as it was. The cursor blinks on its own timer (≈480 ms), which keys do
// not restart (plan21 settings/set-time-keys).
import type { PhoneKey } from "@hellotimber/phone-core";
import type { PromptModel } from "@hellotimber/nokia-kit/ui/display/widgets";
import { isDate } from "@hellotimber/nokia-kit/system/clock/time";
import type { StockWidgetTimeline } from "@hellotimber/nokia-kit/ui/resources";
import type { Flow, Widget } from "@hellotimber/nokia-kit/ui/widgets/flow";
import { note, type NoteSound } from "@hellotimber/nokia-kit/ui/widgets/note";
import { Playback } from "@hellotimber/nokia-kit/ui/widgets/playback";

export type EntryMask = "hh:mm" | "dd.mm.yyyy";

const DIGIT_KEYS: ReadonlySet<PhoneKey> = new Set([
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
]);

/** The positions of a mask that take digits (the others are separators). */
function digitPositions(mask: EntryMask): number[] {
  return Array.from(mask).flatMap((ch, i) => (/[a-z]/.test(ch) ? [i] : []));
}

/**
 * Whether `digit` may go at `pos` of `chars` (the value as shown): each position's range, given
 * the digit before it (plan21 date/*, settings/set-time-*, countdown/*). Placeholders count as
 * unknown.
 */
export function accepts(
  mask: EntryMask,
  chars: readonly string[],
  pos: number,
  digit: number,
): boolean {
  const field = mask[pos];
  const before = pos > 0 && /\d/.test(chars[pos - 1] ?? "") ? Number(chars[pos - 1]) : undefined;
  const first = pos === 0 || !/[a-z]/.test(mask[pos - 1] ?? "") || mask[pos - 1] !== field;
  switch (field) {
    case "h":
      if (first) return digit <= 2;
      return before === 2 ? digit <= 3 : true;
    case "m":
      if (mask === "hh:mm") return first ? digit <= 5 : true;
      // month: tens 0-1; units 1-9 after 0, 0-2 after 1
      if (first) return digit <= 1;
      return before === 1 ? digit <= 2 : before === 0 ? digit >= 1 : true;
    case "d":
      if (first) return digit <= 3;
      return before === 3 ? digit <= 1 : before === 0 ? digit >= 1 : true;
    case "y":
      // the year's first digit: 1 or 2 (UNVERIFIED for 1: plan21 date/00002026 rejects 6)
      return pos === mask.indexOf("y") ? digit === 1 || digit === 2 : true;
    default:
      return false;
  }
}

/**
 * Where an entry's value is wrong: its first placeholder, else the start of its first field
 * that is out of range (plan21 countdown/0: `0h:mm` → 1; date/3210: `31.00.2026` → 3, the
 * month; date/31022026 → 0, the day); undefined for a real time or date.
 */
export function invalidAt(mask: EntryMask, value: string): number | undefined {
  const placeholder = value.search(/[a-z]/);
  if (placeholder >= 0) return placeholder;
  if (mask === "hh:mm") {
    const [h, m] = value.split(":").map(Number);
    return h! > 23 ? 0 : m! > 59 ? 3 : undefined;
  }
  const [d, mo, y] = value.split(".").map(Number);
  if (mo! < 1 || mo! > 12) return 3;
  return isDate(d!, mo!, y!) ? undefined : 0;
}

/** The start of the field holding position `at` (`hh`, `mm`; `dd`, `mm`, `yyyy`). */
function fieldStart(mask: EntryMask, at: number): number {
  let start = at;
  while (start > 0 && /[a-z]/.test(mask[start - 1]!)) start--;
  return start;
}

/** Whether a complete value is a real time (`hh:mm`) or date (`dd.mm.yyyy`). */
export function validValue(mask: EntryMask, value: string): boolean {
  return invalidAt(mask, value) === undefined;
}

export interface TimeEntryOptions {
  /** Mode icons by sprite id (`prompt/pen`), the label lines and the soft key (plan 14). */
  readonly icons: readonly string[];
  readonly label: readonly string[];
  readonly softkey: string;
  readonly mask: EntryMask;
  /** The value shown first (the cursor before it); absent = the mask's placeholders. */
  readonly initial?: string;
  /** The cursor's blink: a timeline started here, or the previous entry's (Reminder time). */
  readonly blink: StockWidgetTimeline | Playback;
  /** The `Invalid time` / `Invalid date` note's timeline. */
  readonly invalid: StockWidgetTimeline;
  /** A complete, real value the caller still refuses: the note's lines (shown like Invalid). */
  readonly validate?: (value: string) => readonly string[] | undefined;
  /**
   * Plan 21: after `Invalid` the cursor goes to the start of the field holding the first
   * placeholder, not to the placeholder (Reminder time: plan21 reminders/add-time-0, -2500).
   */
  readonly invalidAtField?: boolean;
  readonly sound?: NoteSound;
  /** OK on a valid value. */
  readonly done: (value: string, flow: Flow) => void;
}

class TimeEntryWidget implements Widget {
  readonly #options: TimeEntryOptions;
  readonly #positions: readonly number[];
  readonly #timeline: StockWidgetTimeline;
  readonly #chars: string[];
  #cursor = 0;
  /** The cursor's blink; a note pushed over the entry restarts it on its return (Task 0). */
  blink: Playback;
  #restart = false;

  constructor(options: TimeEntryOptions) {
    this.#options = options;
    const initial = options.initial ?? options.mask;
    if (initial.length !== options.mask.length) {
      throw new Error(`Entry value "${initial}" does not fit the mask ${options.mask}.`);
    }
    this.#positions = digitPositions(options.mask);
    this.#chars = Array.from(initial);
    this.blink = options.blink instanceof Playback ? options.blink : new Playback(options.blink);
    this.#timeline = this.blink.timeline;
  }

  get value(): string {
    return this.#chars.join("");
  }

  render(): PromptModel {
    this.#restarted();
    const { icons, label, softkey } = this.#options;
    return {
      kind: "prompt",
      icons,
      label,
      entry: { kind: "number", text: this.value, cursor: this.#cursor },
      cursor: this.blink.frame.kind === "cursor",
      softkey,
    };
  }

  tick(dtMs: number): void {
    this.#restarted();
    this.blink.advance(dtMs);
  }

  /**
   * Back from a note: the cursor's timer ran on under it; the entry is redrawn in the phase it
   * reached, which then lasts a whole step (plan21 countdown/0, countdown/2400).
   */
  #restarted(): void {
    if (!this.#restart) return;
    this.#restart = false;
    const shown = this.blink.frame.kind === "cursor";
    this.blink = new Playback(this.#timeline);
    if (!shown) this.blink.advance(this.#timeline.timeline.steps[0]?.durationMs ?? 0);
  }

  onKey(key: PhoneKey, flow: Flow): void {
    if (key === "c") {
      flow.back();
      return;
    }
    if (key === "navi") {
      this.#ok(flow);
      return;
    }
    if (!DIGIT_KEYS.has(key)) return;
    const pos = this.#cursor;
    if (!accepts(this.#options.mask, this.#chars, pos, Number(key))) return;
    this.#chars[pos] = key;
    const next = this.#positions.find((p) => p > pos);
    this.#cursor = next ?? this.#positions[0]!;
  }

  #ok(flow: Flow): void {
    const { mask, validate, invalid, sound } = this.#options;
    const value = this.value;
    const lines = !validValue(mask, value)
      ? ["Invalid", mask === "hh:mm" ? "time" : "date"]
      : validate?.(value);
    if (lines === undefined) {
      this.#options.done(value, flow);
      return;
    }
    // The entry comes back with its cursor where the value is wrong (`invalidAt`).
    const at = invalidAt(mask, value);
    this.#cursor =
      at === undefined
        ? this.#positions[0]!
        : this.#options.invalidAtField
          ? fieldStart(mask, at)
          : at;
    const inner = note({ lines, timeline: invalid, ...(sound === undefined ? {} : { sound }) });
    flow.push({
      render: (f) => inner.render(f),
      onKey: (key, f) => inner.onKey?.(key, f),
      onKeyDown: (key, f) => inner.onKeyDown?.(key, f),
      tick: (dtMs, f) => {
        this.blink.advance(dtMs);
        inner.tick?.(dtMs, f);
      },
    });
    this.#restart = true;
  }
}

/** A time or date entry; `entry.blink` is its blink (a following entry may continue it). */
export function timeEntry(options: TimeEntryOptions): Widget & { readonly blink: Playback } {
  return new TimeEntryWidget(options);
}
