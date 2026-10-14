import type { PhoneKey } from "@hellotimber/phone-core";
import type { MultiModel } from "../display/widgets";
import type { StockSettings } from "../firmware/settings";
import type { Flow, Widget } from "./flow";
import { moveRows, openRows, rowsIndicator, type RowsCursor } from "./rows";

export interface MultiSelectOptions {
  /** The setting's key in `settings` (its tree slug path). */
  readonly key: string;
  readonly labels: readonly string[];
  /** Selected on entry. */
  readonly opening: number;
  readonly settings: StockSettings;
}

class MultiSelectWidget implements Widget {
  readonly #options: MultiSelectOptions;
  #cursor: RowsCursor;

  constructor(options: MultiSelectOptions) {
    this.#options = options;
    this.#cursor = openRows(options.opening, options.labels.length);
  }

  get #selected(): number {
    return this.#cursor.selected ?? 0;
  }

  render(flow: Flow): MultiModel {
    const { key, labels, settings } = this.#options;
    const marks = settings.marks(key);
    const selected = this.#selected;
    return {
      kind: "multi",
      items: labels,
      marks,
      selected,
      windowTop: this.#cursor.windowTop,
      indicator: rowsIndicator(flow.indicator(), selected),
      softkey: marks[selected] ? "Unmark" : "Mark",
    };
  }

  onKey(key: PhoneKey, flow: Flow): void {
    const { key: setting, labels, settings } = this.#options;
    if (key === "c") flow.back();
    else if (key === "navi") settings.toggle(setting, this.#selected);
    else this.#cursor = moveRows(this.#cursor, key, labels.length) ?? this.#cursor;
  }
}

/**
 * A multi-select list (Info service › Language): the stored marks, the soft key toggles the
 * selected row (`Unmark` on a marked row, `Mark` otherwise), C leaves (P14).
 */
export function multiSelect(options: MultiSelectOptions): Widget {
  return new MultiSelectWidget(options);
}
