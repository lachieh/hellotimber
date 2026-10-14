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
  #selected = 0;

  constructor(insert: (symbol: string) => void) {
    this.#insert = insert;
  }

  render(): SymbolsModel {
    return { kind: "symbols", selected: this.#selected };
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

/** The symbol table; Use calls `insert` with the selected symbol. */
export function symbolTable(insert: (symbol: string) => void): Widget {
  return new SymbolTableWidget(insert);
}
