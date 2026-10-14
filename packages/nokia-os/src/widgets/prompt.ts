import type { PhoneKey } from "@hellotimber/phone-core";
import type { PromptEntry, PromptModel } from "../display/widgets";
import { splitPromptLines, type PromptLayout } from "../firmware/bindings";
import type { StockWidgetTimeline } from "../resources";
import type { Flow, Widget } from "./flow";
import { Playback } from "./playback";

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
 * A prompt from its measured layout (`PROMPT_LAYOUTS`) and its tree screen: the label and value
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
