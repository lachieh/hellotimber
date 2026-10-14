// The stock widget host (plan 14 D1): a nokia-os application that runs a small stack of widgets
// (an option list, the note it replaces itself with, a query it pushes) and paints the top one.
import { PhoneApplication } from "@hellotimber/phone-core";
import type {
  ApplicationContext,
  MenuIndicator,
  PhoneApplicationSession,
  PhoneKey,
  ScreenModel,
} from "@hellotimber/phone-core";
import { Framebuffer } from "@hellotimber/phone-screen";
import { paintWidget, type WidgetModel } from "../display/widgets";

/** What a widget may do to the flow that hosts it. */
export interface Flow {
  /** Show `widget` above the current one; its `back()` returns here. */
  push(widget: Widget): void;
  /** Show `widget` instead of the current one (an option list becomes its `Done` note). */
  replace(widget: Widget): void;
  /**
   * Close `levels` widgets (default 1). Past the last one the flow exits to the menu, closing
   * the remaining levels there too (`back(2)` from a list opened by a submenu: two levels up).
   */
  back(levels?: number): void;
  /** Leave the menus for standby. */
  standby(): void;
  /** The menu indicator for the flow's position, as the kernel reports it. */
  indicator(): MenuIndicator;
}

/** One stock screen in a flow. Keys arrive on short-press release; ticks only reach the top. */
export interface Widget {
  render(flow: Flow): WidgetModel;
  onKey?(key: PhoneKey, flow: Flow): void;
  tick?(dtMs: number, flow: Flow): void;
}

const NO_INDICATOR: MenuIndicator = { segments: [], awaitingNext: false };

/**
 * A stock leaf: a flow of widgets starting with `root()`, built afresh for every session. It
 * renders `custom` frames, repainted only when the top widget's model changes.
 */
export class StockFlowApplication extends PhoneApplication {
  readonly #root: () => Widget;

  constructor(id: string, root: () => Widget) {
    super(id);
    this.#root = root;
    Object.freeze(this);
  }

  createSession(context: ApplicationContext): PhoneApplicationSession {
    return new FlowSession(this.id, context, this.#root());
  }
}

class FlowSession implements PhoneApplicationSession, Flow {
  readonly #appId: string;
  readonly #context: ApplicationContext;
  readonly #stack: Widget[];
  #closed = false;
  #shown: { model: string; screen: Extract<ScreenModel, { kind: "custom" }> } | undefined;

  constructor(appId: string, context: ApplicationContext, root: Widget) {
    this.#appId = appId;
    this.#context = context;
    this.#stack = [root];
  }

  get #top(): Widget | undefined {
    return this.#closed ? undefined : this.#stack[this.#stack.length - 1];
  }

  onKey(event: { type: "down" | "up"; key: PhoneKey }): void {
    if (event.type === "up") this.#top?.onKey?.(event.key, this);
  }

  tick(dtMs: number): void {
    this.#top?.tick?.(dtMs, this);
  }

  render(): ScreenModel {
    const top = this.#top;
    if (top === undefined && this.#shown !== undefined) return this.#shown.screen;
    if (top === undefined) throw new Error(`Stock flow ${this.#appId} has nothing to show.`);
    const model = top.render(this);
    const key = JSON.stringify(model);
    if (this.#shown?.model !== key) {
      const fb = new Framebuffer();
      paintWidget(fb, model);
      const frame = { width: fb.width, height: fb.height, pixels: fb.pixels };
      this.#shown = { model: key, screen: { kind: "custom", appId: this.#appId, frame } };
    }
    return this.#shown.screen;
  }

  onDeactivate(): void {
    this.#closed = true;
  }

  push(widget: Widget): void {
    if (!this.#closed) this.#stack.push(widget);
  }

  replace(widget: Widget): void {
    if (this.#closed) return;
    this.#stack.pop();
    this.#stack.push(widget);
  }

  back(levels = 1): void {
    if (this.#closed) return;
    if (!Number.isInteger(levels) || levels < 1) {
      throw new Error(`back levels must be a positive integer (received ${levels}).`);
    }
    const popped = Math.min(levels, this.#stack.length);
    this.#stack.length -= popped;
    if (this.#stack.length > 0) return;
    const beyond = levels - popped;
    this.#context.exit(beyond === 0 ? undefined : { levels: beyond + 1 });
    this.#closed = true;
  }

  standby(): void {
    if (this.#closed) return;
    this.#context.exit({ to: "standby" });
    this.#closed = true;
  }

  indicator(): MenuIndicator {
    return this.#context.menuIndicator?.() ?? NO_INDICATOR;
  }
}
