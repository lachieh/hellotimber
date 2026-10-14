import type { PhoneKey } from "@hellotimber/phone-core";
import type { MultiModel } from "../display/widgets";
import type { StockSettings } from "../firmware/settings";
import { confirmQuery } from "./confirm";
import type { Flow, Widget } from "./flow";
import { moveRows, openRows, rowsIndicator, type RowsCursor } from "./rows";

export interface MultiSelectOptions {
  /** The setting's key in `settings` (its tree slug path). */
  readonly key: string;
  readonly labels: readonly string[];
  /** Selected on entry. */
  readonly opening: number;
  readonly settings: StockSettings;
  /** Rows the soft key does not toggle (Language › Polish: `tree/02-messages/2-8-5-17.choose`). */
  readonly inert?: readonly number[];
}

/** Asked by C after a change (probe/multiselect image after-c). */
const SAVE_QUERY = { lines: ["Save", "changes?"], softkey: "Yes" } as const;

class MultiSelectWidget implements Widget {
  readonly #options: MultiSelectOptions;
  readonly #stored: readonly boolean[];
  /** The marks as toggled here; stored only when `Save changes?` is answered Yes. */
  readonly #marks: boolean[];
  #cursor: RowsCursor;

  constructor(options: MultiSelectOptions) {
    this.#options = options;
    this.#stored = options.settings.marks(options.key);
    this.#marks = [...this.#stored];
    this.#cursor = openRows(options.opening, options.labels.length);
  }

  get #selected(): number {
    return this.#cursor.selected ?? 0;
  }

  render(flow: Flow): MultiModel {
    const marks = [...this.#marks];
    const selected = this.#selected;
    return {
      kind: "multi",
      items: this.#options.labels,
      marks,
      selected,
      windowTop: this.#cursor.windowTop,
      indicator: rowsIndicator(flow.indicator(), selected),
      softkey: marks[selected] ? "Unmark" : "Mark",
    };
  }

  onKey(key: PhoneKey, flow: Flow): void {
    if (key === "c") this.#leave(flow);
    else if (key === "navi") {
      if (!this.#options.inert?.includes(this.#selected)) {
        this.#marks[this.#selected] = !this.#marks[this.#selected];
      }
    } else this.#cursor = moveRows(this.#cursor, key, this.#options.labels.length) ?? this.#cursor;
  }

  #leave(flow: Flow): void {
    if (this.#marks.every((mark, i) => mark === this.#stored[i])) {
      flow.back();
      return;
    }
    const { key, settings } = this.#options;
    flow.push(
      confirmQuery({
        ...SAVE_QUERY,
        confirm: (inner) => {
          this.#marks.forEach((mark, i) => {
            if (mark !== settings.marks(key)[i]) settings.toggle(key, i);
          });
          inner.back(2);
        },
        // UNVERIFIED (P14 stops at the query): C leaves without saving.
        cancel: (inner) => inner.back(2),
      }),
    );
  }
}

/**
 * A multi-select list (Info service › Language): the stored marks, the soft key toggles the
 * selected row (`Unmark` on a marked row, `Mark` otherwise). C leaves; after a change it asks
 * `Save changes?` [Yes] first, and only Yes stores the marks (P14).
 */
export function multiSelect(options: MultiSelectOptions): Widget {
  return new MultiSelectWidget(options);
}
