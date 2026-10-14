import type { MenuIndicator, PhoneKey } from "@hellotimber/phone-core";
import type { InfoPageModel } from "../display/widgets";
import type { Flow, Widget } from "./flow";

export interface InfoPage {
  /** Firmware lines joined with `\n`. */
  readonly label: string;
  /** `Back`, or `Select`/`OK` on a page that opens something. */
  readonly softkey: string;
  /** Read on every render: a choice made from the page shows at once. */
  readonly value?: () => string | undefined;
}

export interface InfoPagesOptions {
  readonly pages: readonly InfoPage[];
  /** The widget page `index`'s soft key opens; undefined = back (a `Back` page). */
  readonly open?: (index: number) => Widget | undefined;
}

/**
 * Info pages (Show call duration, Prepaid credit, Score IDs): one page per screen, ▲/▼ move
 * circularly, the soft key opens the page's result (the flow comes back to the pages after it)
 * or goes back, C goes back. The indicator reads `<path>-<page>`; a result's own indicator
 * continues from the page (`4-8-1-2`).
 */
class InfoPagesWidget implements Widget {
  readonly #options: InfoPagesOptions;
  #index = 0;

  constructor(options: InfoPagesOptions) {
    if (options.pages.length === 0) throw new Error("Info pages need at least one page.");
    this.#options = options;
  }

  render(flow: Flow): InfoPageModel {
    const { pages } = this.#options;
    const page = pages[this.#index]!;
    const value = page.value?.();
    return {
      kind: "info-page",
      label: page.label,
      ...(value === undefined ? {} : { value }),
      index: this.#index,
      count: pages.length,
      indicator: pageIndicator(flow.indicator(), this.#index + 1),
      softkey: page.softkey,
    };
  }

  onKey(key: PhoneKey, flow: Flow): void {
    const count = this.#options.pages.length;
    if (key === "down") this.#index = (this.#index + 1) % count;
    else if (key === "up") this.#index = (this.#index + count - 1) % count;
    else if (key === "c") flow.back();
    else if (key === "navi") {
      const result = this.#options.open?.(this.#index);
      if (result === undefined) flow.back();
      else flow.push(atPage(result, this.#index + 1));
    }
  }
}

/** The indicator one level deeper (the awaiting form is kept as the kernel reports it). */
function pageIndicator(position: MenuIndicator, number: number): MenuIndicator {
  if (position.typed !== undefined || position.awaitingFirst) return position;
  return { ...position, segments: [...position.segments, number] };
}

/** `widget` (and what it opens) positioned at page `number`: its flow's indicator adds it. */
function atPage(widget: Widget, number: number): Widget {
  const deeper = (flow: Flow): Flow => ({
    push: (next) => flow.push(atPage(next, number)),
    replace: (next) => flow.replace(atPage(next, number)),
    back: (levels, options) => flow.back(levels, options),
    standby: () => flow.standby(),
    indicator: () => pageIndicator(flow.indicator(), number),
  });
  return {
    render: (flow) => widget.render(deeper(flow)),
    onKey: (key, flow) => widget.onKey?.(key, deeper(flow)),
    onKeyDown: (key, flow) => widget.onKeyDown?.(key, deeper(flow)),
    tick: (dtMs, flow) => widget.tick?.(dtMs, deeper(flow)),
  };
}

export function infoPages(options: InfoPagesOptions): Widget {
  return new InfoPagesWidget(options);
}
