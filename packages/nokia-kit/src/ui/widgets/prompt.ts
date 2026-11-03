import type { PhoneKey } from "@hellotimber/phone-core";
import type { PromptEntry, PromptModel } from "../display/widgets";
import type { StockWidgetTimeline } from "../resources";
import type { Flow, Widget } from "./flow";
import { Playback } from "./playback";

/** How a prompt's first screen is laid out, measured on its golden (plan 14 D11). */
export interface PromptLayout {
  /** Mode icons: `pen`, `abc` (`Abc`), `abc-lower`, `phone-book`. */
  readonly icons: readonly ("pen" | "abc" | "abc-lower" | "phone-book")[];
  /** Characters left, top right (prompts whose tree node has no lines, Task 8). */
  readonly counter?: string;
  /** Label lines when the tree node has none. */
  readonly label?: readonly string[];
  /** The value when the tree node has no lines. */
  readonly value?: string;
  /** `none`: a code prompt; `value`: below the label; else a box (see `PromptEntry`). */
  readonly entry: "none" | "value" | "text" | "end" | "start" | "box";
  /** The value's face in a box (default large). */
  readonly font?: "small";
  /** When the tree node has none. */
  readonly softkey?: string;
}

/**
 * Splits a prompt's firmware lines (D10): the label runs through the last line ending in `:`
 * (`Group` / `number:`), the rest is the value (`793000333`).
 */
export function splitPromptLines(lines: readonly string[]): {
  label: readonly string[];
  value: string;
} {
  let end = lines.length;
  while (end > 0 && !lines[end - 1]!.endsWith(":")) end--;
  return { label: lines.slice(0, end), value: lines.slice(end).join(" ") };
}

export interface PromptOptions {
  readonly icons: readonly string[];
  readonly counter?: string;
  readonly label: readonly string[];
  readonly entry?: PromptEntry;
  readonly softkey: string;
  /** The cursor's blink (P9); absent = no cursor is drawn (Search, Speed dials, code prompts). */
  readonly blink?: StockWidgetTimeline;
}

/**
 * An input prompt's first screen (D11): icons, label, the entry with its blinking cursor and
 * the soft key. C goes back; every other key is inert until the owning plans add entry.
 */
class PromptWidget implements Widget {
  readonly #options: PromptOptions;
  readonly #blink: Playback | undefined;

  constructor(options: PromptOptions) {
    this.#options = options;
    this.#blink = options.blink === undefined ? undefined : new Playback(options.blink);
  }

  render(): PromptModel {
    const { icons, counter, label, entry, softkey } = this.#options;
    return {
      kind: "prompt",
      icons,
      ...(counter === undefined ? {} : { counter }),
      label,
      ...(entry === undefined ? {} : { entry }),
      cursor: this.#blink?.frame.kind === "cursor",
      softkey,
    };
  }

  tick(dtMs: number): void {
    this.#blink?.advance(dtMs);
  }

  onKey(key: PhoneKey, flow: Flow): void {
    if (key === "c") flow.back();
  }
}

export function prompt(options: PromptOptions): Widget {
  return new PromptWidget(options);
}

/**
 * A prompt from its measured layout (a feature's `promptLayouts`) and its tree screen: the label and value
 * come from the screen's firmware lines unless the layout records them (prompts with a counter).
 */
export function promptFromLayout(
  layout: PromptLayout,
  screen: { readonly lines: readonly string[]; readonly softkey?: string },
  blink?: StockWidgetTimeline,
): Widget {
  const split = splitPromptLines(screen.lines);
  const label = layout.label ?? split.label;
  const value = layout.value ?? split.value;
  const softkey = screen.softkey ?? layout.softkey;
  if (softkey === undefined) throw new Error(`Prompt ${JSON.stringify(label)} has no soft key.`);
  const entry: PromptEntry | undefined =
    layout.entry === "none"
      ? undefined
      : layout.entry === "value"
        ? { kind: "value", text: value }
        : {
            kind: "box",
            text: value,
            font: layout.font ?? "large",
            cursor: layout.entry === "box" ? "none" : layout.entry,
          };
  return prompt({
    icons: layout.icons.map((icon) => `prompt/${icon}`),
    ...(layout.counter === undefined ? {} : { counter: layout.counter }),
    label,
    ...(entry === undefined ? {} : { entry }),
    softkey,
    ...(blink === undefined ? {} : { blink }),
  });
}
