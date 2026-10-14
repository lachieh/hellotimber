// A demo panel: one feature's controls and wiring around the phone (demo/panels/<slug>.ts,
// registered in demo/panels/index.ts). The shell (main.ts) owns the LCD, the keys and the
// phone's lifecycle; panels add controls, contribute to the phone's config and hear about it.
import type { Phone, ScreenModel } from "@hellotimber/phone-core";
import type { StockPhoneConfig } from "../src/index";

/** Where a panel puts its elements. */
export interface DemoSlots {
  /** Beside the LCD (the vibrator lamp). */
  readonly screenRow: HTMLElement;
  /** The LCD itself (overlays). */
  readonly lcd: HTMLElement;
  /** Adds `element` to the phone column, below the status line. */
  phone(element: HTMLElement): void;
  /** Adds `element` as one cell of the controls grid. */
  control(element: HTMLElement): void;
  /** Adds `element` as a full-width row below the controls' cells. */
  wideControl(element: HTMLElement): void;
  /** Adds a section of its own below the controls (the dev-only golden overlay). */
  section(element: HTMLElement): void;
}

/** What a panel can ask of the shell. */
export interface DemoHost {
  /** The running phone; undefined while it failed to start (a malformed EEPROM record). */
  readonly phone: Phone | undefined;
  /** Starts a new phone with every panel's config (the old one is dropped). */
  restart(): void;
}

export interface DemoPanel {
  readonly name: string;
  /** The plan that added it; panels mount in plan order. */
  readonly plan: number;
  /** Builds the panel's elements; called once, before the first phone starts. */
  mount(slots: DemoSlots, host: DemoHost): void;
  /** What the panel sets on each new phone's config. */
  config?(): Partial<StockPhoneConfig>;
  /** A phone started, or failed to (`error`), at first and on every restart. */
  started?(error: Error | undefined): void;
  /** The phone is about to be replaced: silence what it started. */
  beforeRestart?(): void;
  /** Every animation frame, before the phone ticks to `nowMs`. */
  frame?(nowMs: number): void;
  /** The phone's screen changed (or the phone did). */
  screen?(screen: ScreenModel): void;
  /** A part of the status line (`EEPROM: settings`), shown after the path and screen. */
  status?(): string;
}

/** An element from an HTML fragment with one root element. */
export function html<ElementType extends HTMLElement = HTMLElement>(fragment: string): ElementType {
  const template = document.createElement("template");
  template.innerHTML = fragment.trim();
  const element = template.content.firstElementChild;
  if (element === null) throw new Error("Empty HTML fragment.");
  return element as ElementType;
}

/** The element `#id` inside `root`. */
export function byId<ElementType extends HTMLElement>(root: ParentNode, id: string): ElementType {
  const found = root.querySelector<ElementType>(`#${id}`);
  if (found === null) throw new Error(`Missing #${id}`);
  return found;
}
