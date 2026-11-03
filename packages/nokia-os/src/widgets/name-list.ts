// The phone book's name list (plan 19 D6): the SIM's names in the view Options › Type of view
// selects, opened on the first name or a given one, moved by ▲/▼ (wrapping; plan 14's rows window
// in Name list view) and by letter keys, and handing the highlighted entry to its flow's soft key.
// Assign tone shows the same list as pages of a name and its tone.
//
// Letter keys (Task 0 L): 2-9 type a one-letter query from the key's upper-case multi-tap cycle
// (`J K L 5 £`; the same key within plan 18's commit timeout cycles it); the list lands on the
// first name at or after it (`searchIndex`). In Name list view a target inside the window keeps
// the window, else the highlight keeps its row (`phone-book/letters-list`). 0, 1, * and # do
// nothing.
import { rowsWindowTop, type PhoneKey } from "@hellotimber/phone-core";
import type { NameListModel } from "../kit/ui/display/widgets";
import { searchIndex, shownName, type PhoneBookEntry } from "../services/phone-book/entries";
import { TEXT_TIMINGS } from "../kit/ui/resources";
import { MULTITAP_KEYS, type TextKey } from "../kit/ui/text/keys";
import type { Flow, Widget } from "../kit/ui/widgets/flow";

/** Options › Type of view's setting and its choices, in list order (`1-8-1`). */
export const TYPE_OF_VIEW_KEY = "phone-book/options/type-of-view";
export const TYPE_OF_VIEW = ["list", "number", "large"] as const;
export type NameListView = (typeof TYPE_OF_VIEW)[number];

/** Rows on screen in Name list view. */
const ROWS = 3;

const LETTER_KEYS: ReadonlySet<string> = new Set("23456789");

/** What a flow can ask of the list it opened. */
export interface NameListControl {
  /** The highlighted entry (undefined when the list is empty). */
  readonly entry: PhoneBookEntry | undefined;
  /** Highlights the entry at `location`, or the one now at the highlight's index, on its row. */
  select(location?: number): void;
}

export interface NameListOptions {
  /** The SIM's names in the firmware's order, re-read on every render (edits show at once). */
  readonly entries: () => readonly PhoneBookEntry[];
  /** The view: Type of view's when the list opens, or `page` (Assign tone). */
  readonly view: NameListView | "page";
  /** A page's value (`page` view: the tone; Name, number: the number). */
  readonly value?: (entry: PhoneBookEntry) => string;
  readonly softkey: string;
  /** The index the list opens on (on the top row). Default 0. */
  readonly start?: number;
  /** The soft key: the highlighted entry. */
  readonly choose: (entry: PhoneBookEntry, flow: Flow, list: NameListControl) => void;
  /**
   * C, at its down (the firmware leaves while C is still held: `phone-book/standby-list-hold-c`
   * closes the list 48 ms after the down): default the screen below.
   */
  readonly back?: (flow: Flow) => void;
}

class NameListWidget implements Widget, NameListControl {
  readonly #options: NameListOptions;
  #selected: number;
  #top: number | undefined;
  #now = 0;
  /** The letter key cycling: its key, the cycle index, since when. */
  #letter: { key: TextKey; index: number; sinceMs: number } | undefined;

  constructor(options: NameListOptions) {
    this.#options = options;
    this.#selected = options.start ?? 0;
    this.#fit();
  }

  get #entries(): readonly PhoneBookEntry[] {
    return this.#options.entries();
  }

  get entry(): PhoneBookEntry | undefined {
    return this.#entries[this.#selected];
  }

  /** Keeps the selection inside the list and sets the window as a list opening does. */
  #fit(): void {
    const count = this.#entries.length;
    this.#selected = count === 0 ? 0 : Math.min(Math.max(0, this.#selected), count - 1);
    this.#top = count === 0 ? 0 : rowsWindowTop(undefined, this.#selected, count, ROWS);
  }

  /** The highlight's row in the window. */
  #row(): number {
    const count = this.#entries.length;
    return count === 0 ? 0 : (this.#selected - this.#top! + count) % count;
  }

  select(location?: number): void {
    const entries = this.#entries;
    const count = entries.length;
    const row = this.#row();
    const found = location === undefined ? -1 : entries.findIndex((e) => e.location === location);
    this.#selected = found >= 0 ? found : count === 0 ? 0 : this.#selected % count;
    this.#top =
      count <= ROWS ? 0 : (((this.#selected - Math.min(row, count - 1)) % count) + count) % count;
  }

  #move(direction: "up" | "down"): void {
    const count = this.#entries.length;
    if (count === 0) return;
    this.#selected = (this.#selected + (direction === "down" ? 1 : count - 1)) % count;
    this.#top = rowsWindowTop(this.#top, this.#selected, count, ROWS, direction);
  }

  #jump(target: number): void {
    const count = this.#entries.length;
    if (count === 0) return;
    const row = this.#row();
    this.#selected = target;
    const offset = (target - this.#top! + count) % count;
    if (count <= ROWS) this.#top = 0;
    else if (offset >= ROWS) this.#top = (target - row + count) % count;
  }

  #typeLetter(key: TextKey): void {
    const cycle = MULTITAP_KEYS[key].upper;
    const pending = this.#letter;
    const index =
      pending?.key === key && this.#now < pending.sinceMs + TEXT_TIMINGS.commitMs
        ? (pending.index + 1) % cycle.length
        : 0;
    this.#letter = { key, index, sinceMs: this.#now };
    this.#jump(searchIndex(this.#entries, cycle[index]!));
  }

  render(): NameListModel {
    const { softkey, view, value } = this.#options;
    const entries = this.#entries;
    const entry = entries[this.#selected];
    if (view === "list") {
      const count = entries.length;
      const rows = Array.from({ length: Math.min(ROWS, count) }, (_, r) =>
        shownName(entries[(this.#top! + r) % count]!),
      );
      return { kind: "name-list", view: "list", rows, selected: this.#row(), softkey };
    }
    const name = entry === undefined ? "" : shownName(entry);
    if (view === "large" && entry !== undefined && entry.name === "") {
      return { kind: "name-list", view: "large", name: "", number: entry.number, softkey };
    }
    if (view === "large") return { kind: "name-list", view: "large", name, softkey };
    const shown =
      entry === undefined ? "" : (value?.(entry) ?? (entry.name === "" ? "" : entry.number));
    return {
      kind: "name-list",
      view: "page",
      name: entry === undefined ? "" : entry.name === "" ? entry.number : entry.name,
      value: shown,
      softkey,
    };
  }

  onKeyDown(key: PhoneKey, flow: Flow): void {
    if (key === "c") (this.#options.back ?? ((inner: Flow) => inner.back()))(flow);
    else if (key === "up" || key === "down") this.#move(key);
    else if (LETTER_KEYS.has(key)) this.#typeLetter(key as TextKey);
  }

  onKey(key: PhoneKey, flow: Flow): void {
    if (key !== "navi") return;
    const entry = this.entry;
    if (entry !== undefined) this.#options.choose(entry, flow, this);
  }

  tick(dtMs: number): void {
    this.#now += dtMs;
  }
}

/** The name list (D6). */
export function nameList(options: NameListOptions): Widget & NameListControl {
  return new NameListWidget(options);
}
