// The stock widget host (plan 14 D1): a nokia-os application that runs a small stack of widgets
// (an option list, the note it replaces itself with, a query it pushes) and paints the top one.
import { PhoneApplication } from "@hellotimber/phone-core";
import type {
  ApplicationContext,
  MenuIndicator,
  PhoneApplicationSession,
  PhoneKey,
  ScreenModel,
  ShortcutLevel,
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
   * the remaining levels there too (`back(2)` from a list opened by a submenu: two levels up),
   * and selecting the child `select` (a slug) in the level it returns to, placed on the window's
   * bottom row or, with `row: "top"`, its top row. `select` is ignored when the flow does not
   * exit.
   */
  back(levels?: number, options?: { select?: string; row?: "top" | "bottom" }): void;
  /** Leave the menus for standby. */
  standby(): void;
  /** Switch the phone off (plan 17: the power key's Switch off!); absent outside a phone. */
  powerOff?(): void;
  /** The menu indicator for the flow's position, as the kernel reports it. */
  indicator(): MenuIndicator;
}

/**
 * One stock screen in a flow. Keys arrive on release (`onKey`); a widget that acts on key-down
 * (game keys, the Level page's ▲/▼, plan 23 D7) also declares `onKeyDown`. Ticks only reach the
 * top.
 */
export interface Widget {
  render(flow: Flow): WidgetModel;
  onKey?(key: PhoneKey, flow: Flow): void;
  onKeyDown?(key: PhoneKey, flow: Flow): void;
  tick?(dtMs: number, flow: Flow): void;
  /**
   * The widget left the flow: popped by `back`, replaced, or the session ended (C held,
   * power-off, navigate). Called once; not while the widget waits below a push (plan 16: a list
   * stops its preview).
   */
  close?(): void;
  /** The widget is on top again: the screens pushed above it closed (`back`). */
  reveal?(): void;
  /**
   * The widget's options while it is a menu level to the stock shortcut (an option list): the
   * kernel then matches digits typed in the shortcut window among them (phone-core
   * `PhoneApplicationSession.shortcutLevel`). Asked of the top widget.
   */
  shortcutLevel?(flow: Flow): ShortcutLevel | undefined;
}

const NO_INDICATOR: MenuIndicator = { segments: [], awaitingNext: false };

/**
 * A stock leaf: a flow of widgets starting with `root()`, built afresh for every session. It
 * renders `custom` frames, repainted only when the top widget's model changes; the painter sees
 * the frame shown before (a widget's partial draws start from it, D8).
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
  /** The model last painted (and its JSON, which decides a repaint), and its screen. */
  #shown:
    | {
        readonly model: WidgetModel;
        readonly json: string;
        readonly screen: Extract<ScreenModel, { kind: "custom" }>;
      }
    | undefined;

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
    else this.#top?.onKeyDown?.(event.key, this);
  }

  tick(dtMs: number): void {
    this.#top?.tick?.(dtMs, this);
  }

  shortcutLevel(): ShortcutLevel | undefined {
    return this.#top?.shortcutLevel?.(this);
  }

  render(): ScreenModel {
    const top = this.#top;
    if (top === undefined && this.#shown !== undefined) return this.#shown.screen;
    if (top === undefined) throw new Error(`Stock flow ${this.#appId} has nothing to show.`);
    const model = top.render(this);
    // The kernel renders every tick: a widget that returns the model it returned before (the
    // game board between steps) skips the comparison.
    const shown = this.#shown;
    if (shown?.model === model) return shown.screen;
    const json = JSON.stringify(model);
    if (shown?.json === json) {
      this.#shown = { ...shown, model };
      return shown.screen;
    }
    const fb = new Framebuffer();
    paintWidget(fb, model, shown?.screen.frame.pixels);
    const frame = { width: fb.width, height: fb.height, pixels: fb.pixels };
    this.#shown = { model, json, screen: { kind: "custom", appId: this.#appId, frame } };
    return this.#shown.screen;
  }

  onDeactivate(): void {
    this.#closed = true;
    this.#closeAll();
  }

  /** Closes the widgets still on the stack, top first. */
  #closeAll(): void {
    const left = this.#stack.splice(0).reverse();
    for (const widget of left) widget.close?.();
  }

  /** Paints the outgoing widget's current state first: the next one may draw over it. */
  #leaving(): void {
    if (this.#top !== undefined) this.render();
  }

  push(widget: Widget): void {
    if (this.#closed) return;
    this.#leaving();
    this.#stack.push(widget);
  }

  replace(widget: Widget): void {
    if (this.#closed) return;
    this.#leaving();
    this.#stack.pop()?.close?.();
    this.#stack.push(widget);
  }

  back(levels = 1, options: { select?: string; row?: "top" | "bottom" } = {}): void {
    if (this.#closed) return;
    if (!Number.isInteger(levels) || levels < 1) {
      throw new Error(`back levels must be a positive integer (received ${levels}).`);
    }
    this.#leaving();
    const popped = Math.min(levels, this.#stack.length);
    for (const widget of this.#stack.splice(this.#stack.length - popped).reverse()) {
      widget.close?.();
    }
    if (this.#stack.length > 0) {
      this.#top?.reveal?.();
      return;
    }
    const beyond = levels - popped;
    const exit = {
      ...(beyond === 0 ? {} : { levels: beyond + 1 }),
      ...(options.select === undefined ? {} : { select: options.select }),
      ...(options.row === undefined ? {} : { row: options.row }),
    };
    this.#context.exit(Object.keys(exit).length === 0 ? undefined : exit);
    this.#closed = true;
  }

  standby(): void {
    if (this.#closed) return;
    this.#context.exit({ to: "standby" });
    this.#closed = true;
    this.#closeAll();
  }

  powerOff(): void {
    if (this.#closed) return;
    this.#context.powerOff?.();
  }

  indicator(): MenuIndicator {
    return this.#context.menuIndicator?.() ?? NO_INDICATOR;
  }
}
