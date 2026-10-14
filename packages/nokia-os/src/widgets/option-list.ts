import type { PhoneKey } from "@hellotimber/phone-core";
import type { OptionsModel } from "../display/widgets";
import type { StockSettings } from "../firmware/settings";
import type { Flow, Widget } from "./flow";
import { moveRows, openRows, rowsIndicator, type ListNumbering, type RowsCursor } from "./rows";

/** Shown instead of the soft key while nothing is selected (P10). */
const UNSET_SOFTKEY = "Quit";

export interface OptionListOptions {
  readonly labels: readonly string[];
  /** Highlighted on entry; null opens unset (no rows, `-0`, `Quit`). */
  readonly opening: number | null;
  /** The soft key once an option is selected (`OK`). */
  readonly softkey: string;
  /** What the indicator shows before the option's number (default: the list's path). */
  readonly numbering?: ListNumbering;
  /** OK on option `index`. */
  choose(index: number, flow: Flow): void;
  /**
   * Every key-down, with the option ▲/▼ is about to highlight (other keys: the highlighted one;
   * null while unset). Plan 16: the Keypad tones list beeps ▲/▼ at that option's level.
   */
  keyDown?(key: PhoneKey, highlighted: number | null): void;
  /**
   * ▲/▼ moved the selection to `index` from `previous` (null: the list was unset). Never called
   * on opening. Plan 16: preview lists arm a preview.
   */
  highlight?(index: number, previous: number | null): void;
  /** The list left the flow (plan 16: its preview stops). */
  close?(): void;
}

/**
 * A single-choice option list (plan 14 widget catalogue): the circular rows window, the current
 * value highlighted, OK runs `choose`, C (and Quit while unset) goes back without a choice.
 */
export class OptionListWidget implements Widget {
  readonly #options: OptionListOptions;
  #cursor: RowsCursor;

  constructor(options: OptionListOptions) {
    const { labels, opening } = options;
    if (opening !== null && (opening < 0 || opening >= labels.length)) {
      throw new Error(`Option list opening ${opening} is not one of ${labels.length} options.`);
    }
    this.#options = options;
    this.#cursor = openRows(opening, labels.length);
  }

  render(flow: Flow): OptionsModel {
    const { selected, windowTop } = this.#cursor;
    return {
      kind: "options",
      items: this.#options.labels,
      selected,
      windowTop,
      indicator: rowsIndicator(flow.indicator(), selected, this.#options.numbering),
      softkey: selected === null ? UNSET_SOFTKEY : this.#options.softkey,
    };
  }

  onKeyDown(key: PhoneKey): void {
    const next = moveRows(this.#cursor, key, this.#options.labels.length) ?? this.#cursor;
    this.#options.keyDown?.(key, next.selected);
  }

  onKey(key: PhoneKey, flow: Flow): void {
    const { selected } = this.#cursor;
    if (key === "c" || (key === "navi" && selected === null)) {
      flow.back();
    } else if (key === "navi" && selected !== null) {
      this.#options.choose(selected, flow);
    } else {
      const moved = moveRows(this.#cursor, key, this.#options.labels.length);
      if (moved === undefined) return;
      this.#cursor = moved;
      if (moved.selected !== null) this.#options.highlight?.(moved.selected, selected);
    }
  }

  close(): void {
    this.#options.close?.();
  }
}

export interface SettingOptionListOptions {
  /** The setting's key in `settings` (its tree slug path). */
  readonly key: string;
  readonly labels: readonly string[];
  readonly softkey: string;
  readonly settings: StockSettings;
  readonly numbering?: ListNumbering;
  /** What a choice shows next (its `Done` note); undefined = back to the page. */
  readonly result?: (index: number) => Widget | undefined;
}

/**
 * The option list of a stored single-choice setting: opens on the stored choice (unset while
 * the virgin EEPROM holds none), and OK stores the choice, then replaces the list with the
 * choice's result or goes back.
 */
export function settingOptionList(options: SettingOptionListOptions): OptionListWidget {
  const { key, labels, softkey, settings, result, numbering } = options;
  return new OptionListWidget({
    labels,
    softkey,
    ...(numbering === undefined ? {} : { numbering }),
    opening: settings.choice(key),
    choose(index, flow) {
      settings.choose(key, index);
      const next = result?.(index);
      if (next === undefined) flow.back();
      else flow.replace(next);
    },
  });
}
