// The stock symbol table (plan 18 D4, S5): opened by * in an entry, ▲ advances and ▼ retreats
// through its 31 cells, each wrapping (`text/symbols-down`, `-up`); Use inserts the selected
// symbol into the entry below and closes the table, C closes it without inserting
// (`text/symbols-use-*`, `-c`).
import type { PhoneKey } from "@hellotimber/phone-core";
import type { SymbolsModel } from "../display/widgets";
import { SYMBOLS } from "../text/keys";
import type { Flow, Widget } from "./flow";

class SymbolTableWidget implements Widget {
  readonly #insert: (symbol: string) => void;
  readonly #t9: boolean;
  #selected = 0;

  constructor(insert: (symbol: string) => void, t9: boolean) {
    this.#insert = insert;
    this.#t9 = t9;
  }

  render(): SymbolsModel {
    return { kind: "symbols", selected: this.#selected, ...(this.#t9 ? { t9: true } : {}) };
  }

  onKey(key: PhoneKey, flow: Flow): void {
    const count = SYMBOLS.length;
    if (key === "up") this.#selected = (this.#selected + 1) % count;
    else if (key === "down") this.#selected = (this.#selected + count - 1) % count;
    else if (key === "navi") {
      this.#insert(SYMBOLS[this.#selected]!);
      flow.back();
    } else if (key === "c") flow.back();
  }
}

/**
 * The symbol table; Use calls `insert` with the selected symbol. From the T9 editor it has the
 * T9 header (plan 18b, `t9/g-star-free/04-held-star-empty`).
 */
export function symbolTable(
  insert: (symbol: string) => void,
  options: { t9?: boolean } = {},
): Widget {
  return new SymbolTableWidget(insert, options.t9 ?? false);
}
