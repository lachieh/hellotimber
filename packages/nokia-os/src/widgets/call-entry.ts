// The call register's entry view (plan 22 Task 9; docs/specs/stock/calls.md "Call register"):
// `Missed 1:` and the number, ▲/▼ through the list (wrapping), the soft key (`Options` from the
// menu, `Call` from standby ▲), C back. The list is read on every render, so an erase shows at once.
import type { PhoneKey } from "@hellotimber/phone-core";
import type { CallEntry, CallList } from "../services/calls/log";
import type { CallEntryModel, StandbyDrawModel } from "../kit/ui/display/widgets";
import type { Flow, Widget } from "../kit/ui/widgets/flow";

/** The label before an entry's position (`Missed 1:`, `Received 1:`, `Dialled 1:`). */
export const CALL_LIST_LABELS: Readonly<Record<CallList, string>> = {
  missed: "Missed",
  received: "Received",
  dialled: "Dialled",
};

export interface CallEntryOptions {
  readonly list: CallList;
  /** The list now (newest first). */
  readonly entries: () => readonly CallEntry[];
  readonly softkey: string;
  /** The soft key on entry `index`. */
  readonly act: (index: number, entry: CallEntry, flow: Flow) => void;
  /** The list emptied (the last entry erased): default back. */
  readonly empty?: (flow: Flow) => void;
  /**
   * Standby ▲'s list: C leaves for standby, drawn first without the operator for
   * STANDBY_DRAW_MS (`register/standby-up-c`); the clock for that frame.
   */
  readonly standby?: { readonly clock: () => string | undefined };
}

/** Standby without the operator before standby itself (`register/standby-up-c`: 72 ms). */
export const STANDBY_DRAW_MS = 72;

export class CallEntryWidget implements Widget {
  readonly #o: CallEntryOptions;
  #index = 0;
  /** Leaving for standby: standby without the operator until then. */
  #leaving: number | undefined;
  #now = 0;
  /** Keys that went down on the list (the release of the key that opened it is not one). */
  readonly #down = new Set<PhoneKey>();

  constructor(options: CallEntryOptions) {
    this.#o = options;
  }

  /** The entry shown (clamped to the list). */
  get index(): number {
    const count = this.#o.entries().length;
    return count === 0 ? 0 : Math.min(this.#index, count - 1);
  }

  render(): CallEntryModel | StandbyDrawModel {
    if (this.#leaving !== undefined) {
      const clock = this.#o.standby?.clock();
      return { kind: "standby-draw", ...(clock === undefined ? {} : { clock }) };
    }
    const entries = this.#o.entries();
    const index = this.index;
    const entry = entries[index];
    return {
      kind: "call-entry",
      label: `${CALL_LIST_LABELS[this.#o.list]} ${index + 1}:`,
      number: entry?.name ?? entry?.number ?? "",
      softkey: this.#o.softkey,
    };
  }

  /** The list emptied under it (its last entry erased): the screen below. */
  tick(dtMs: number, flow: Flow): void {
    this.#now += dtMs;
    if (this.#leaving !== undefined) {
      if (this.#now >= this.#leaving) flow.standby();
      return;
    }
    if (this.#o.entries().length > 0) return;
    if (this.#o.empty !== undefined) this.#o.empty(flow);
    else flow.back();
  }

  onKeyDown(key: PhoneKey, flow: Flow): void {
    // C leaves on its key-down (`register/standby-up-c-held`: standby at once).
    if (key === "c" && this.#leaving === undefined) {
      if (this.#o.standby !== undefined) this.#leaving = this.#now + STANDBY_DRAW_MS;
      else flow.back();
      return;
    }
    this.#down.add(key);
  }

  onKey(key: PhoneKey, flow: Flow): void {
    if (!this.#down.delete(key)) return;
    const count = this.#o.entries().length;
    if (this.#leaving !== undefined || count === 0) return;
    // From standby ▲ the keys run the other way: ▲ to older numbers (`register/standby-up-list`).
    const older = this.#o.standby === undefined ? "down" : "up";
    if (key === "up" || key === "down") {
      this.#index = (this.index + (key === older ? 1 : count - 1)) % count;
    } else if (key === "navi") this.#o.act(this.index, this.#o.entries()[this.index]!, flow);
  }
}

export function callEntry(options: CallEntryOptions): CallEntryWidget {
  return new CallEntryWidget(options);
}
