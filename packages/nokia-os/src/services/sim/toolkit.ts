// The SIM's toolkit menu as data (plan 30 D3, D5, D12; Task 0 K): what the applet's SET UP MENU
// lists and what each item does. Its validation against the stock display and how the 3310 shows
// it are src/sim/toolkit.ts.

/** Plan 30: what the SIM applet does when an item is chosen (D3). */
export type StockToolkitStep =
  /** `DISPLAY TEXT`: a text page; OK goes on to the next step, C ends the session. */
  | {
      readonly kind: "text";
      readonly text: string;
      /** "user" (default): until a key or the ≈54 s timeout; "delay": clears itself after ≈3.58 s. */
      readonly clear?: "user" | "delay";
    }
  /** `SELECT ITEM`: a list; choosing an item runs its steps. The 3310 does not draw `title`. */
  | {
      readonly kind: "select";
      readonly title?: string;
      readonly items: readonly StockToolkitItem[];
    }
  /** `SET UP CALL`: the phone confirms (with `confirm` as the alpha identifier) and dials `number`. */
  | { readonly kind: "call"; readonly number: string; readonly confirm?: string };

export interface StockToolkitItem {
  /** Kebab-case, unique among its siblings; top-level items are route keys (`menu/sim-services/<id>`). */
  readonly id: string;
  /** Small face; cut with ` ...` where wider than its row. */
  readonly label: string;
  /** Run in order; the session ends after the last (back to the item's list). */
  readonly steps: readonly StockToolkitStep[];
}

/** Plan 30: the SIM's toolkit menu (`SET UP MENU`). */
export interface StockSimToolkit {
  /** The alpha identifier: Menu 14's carousel label (the words that fit its line; large face). */
  readonly title: string;
  readonly items: readonly StockToolkitItem[];
}
