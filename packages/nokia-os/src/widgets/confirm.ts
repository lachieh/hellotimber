import type { PhoneKey } from "@hellotimber/phone-core";
import type { ConfirmModel } from "../display/widgets";
import type { Flow, Widget } from "./flow";

export interface ConfirmOptions {
  readonly lines: readonly string[];
  /** `OK`, `Yes`. */
  readonly softkey: string;
  /** The soft key: run the query's result (P8). */
  readonly confirm: (flow: Flow) => void;
  /** C. Default: back to the screen below, unchanged (P8). */
  readonly cancel?: (flow: Flow) => void;
}

/** A confirm query: the soft key runs its result, C goes back unchanged (P8). */
class ConfirmWidget implements Widget {
  readonly #options: ConfirmOptions;

  constructor(options: ConfirmOptions) {
    this.#options = options;
  }

  render(): ConfirmModel {
    return { kind: "confirm", lines: this.#options.lines, softkey: this.#options.softkey };
  }

  onKey(key: PhoneKey, flow: Flow): void {
    const { confirm, cancel } = this.#options;
    if (key === "navi") confirm(flow);
    else if (key === "c" && cancel !== undefined) cancel(flow);
    else if (key === "c") flow.back();
  }
}

export function confirmQuery(options: ConfirmOptions): Widget {
  return new ConfirmWidget(options);
}
