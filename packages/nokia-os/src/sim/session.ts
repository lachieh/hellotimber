// A SIM toolkit session (plan 30 D3, D6; Task 0 K): what the phone shows while the SIM applet runs
// an item's steps. nokia-os plays the applet: choosing an item (ENVELOPE MENU SELECTION) fetches
// its first command behind a `Wait` note, then shows it through stock screens; the session ends
// where the item's steps end (the level, or the list the item was chosen from). Captured: text
// pages (DISPLAY TEXT), lists (SELECT ITEM); composed (UNVERIFIED, D4): the call confirm (SET UP
// CALL never completes in the emulator), whose OK hands the number to `ToolkitDial`.
import { LONG_PRESS_MS, type PhoneKey } from "@hellotimber/phone-core";
import type { MessagePageModel, OptionsModel } from "../display/widgets";
import { messagePages } from "../messages/read";
import { confirmQuery } from "../widgets/confirm";
import type { Flow, Widget } from "../widgets/flow";
import { interlude } from "../widgets/interlude";
import { moveRows, openRows, type RowsCursor } from "../widgets/rows";
import {
  callConfirmLines,
  rowLabel,
  type StockToolkitItem,
  type StockToolkitStep,
} from "./toolkit";

/**
 * D6's seam: place a call the SIM asked for and confirmed, from inside the confirming key's
 * `send()`. Plan 22 binds it to `StockTelephone.dial` (the Calling flow and
 * `StockNetworkPort.dial`); until then it opens plan 22's placeholder.
 */
export type ToolkitDial = (number: string, flow: Flow) => void;

export interface ToolkitDeps {
  readonly dial: ToolkitDial;
}

/** The phone fetches a command for ≈20 ms plus 1.2 ms per character of its text (Task 0 K). */
const FETCH_BASE_MS = 20;
const FETCH_PER_CHAR_MS = 1.2;
/** C on a SIM screen: `Wait` while the phone answers the SIM, then the screen below (≈40 ms). */
export const TOOLKIT_END_WAIT_MS = 40;
/**
 * A clear-after-delay text clears itself this long after it shows (`stk/text/auto`: 1286 ms of
 * `open`, then 3581 ms of `wait-60s`); a wait-for-user text gives up after this long (`short`:
 * 4288 ms, then 54040 ms). Both go on as OK does.
 */
export const TEXT_CLEAR_DELAY_MS = 4867;
export const TEXT_USER_TIMEOUT_MS = 58328;

/** `Wait` on plan 14's hatched bar (`stk/text/short/open` frame 1). */
const WAIT = { kind: "progress", text: "Wait", bar: "progress-1", softkey: "" } as const;

/** How long the phone takes to fetch the command that shows `step`. */
export function fetchMs(step: StockToolkitStep): number {
  const text =
    step.kind === "text"
      ? step.text
      : step.kind === "select"
        ? [step.title ?? "", ...step.items.map((item) => item.label)].join("")
        : `${step.number}${step.confirm ?? ""}`;
  return Math.round(FETCH_BASE_MS + FETCH_PER_CHAR_MS * Array.from(text).length);
}

/**
 * Where a run of steps goes: after its last step the session ends, back on the level, however
 * deep in lists it ran (`stk/select/list/select-ok`); C answers `Wait` and goes back to the list it
 * was chosen from, or the level.
 */
interface Run {
  /** The flow's widgets while the run's screens show (each list below adds one). */
  readonly depth: number;
}

/** The session ends: every widget of the flow closes, back to the level. */
function end(run: Run): (flow: Flow) => void {
  return (flow) => flow.back(run.depth);
}

/** `Wait` for `ms`, then `next`. */
function wait(ms: number, next: (flow: Flow) => void): Widget {
  return interlude(WAIT, ms, next);
}

/** C's answer to the SIM: `Wait`, then back past this screen (and what `levels` more). */
function leave(flow: Flow): void {
  flow.replace(wait(TOOLKIT_END_WAIT_MS, (inner) => inner.back()));
}

/**
 * A SIM screen's keys: ▲/▼ and OK for the screen, C answers the SIM (`leave`), C held goes to
 * standby at the kernel's long press (the firmware's comes ≈530 ms after the down: plan 19's known
 * gap).
 */
abstract class SimScreen implements Widget {
  #heldMs: number | undefined;
  protected abstract key(key: PhoneKey, flow: Flow): void;
  abstract render(flow: Flow): MessagePageModel | OptionsModel;

  onKeyDown(key: PhoneKey): void {
    if (key === "c") this.#heldMs = 0;
  }

  onKey(key: PhoneKey, flow: Flow): void {
    if (key !== "c") this.key(key, flow);
    else if (this.#heldMs !== undefined) {
      this.#heldMs = undefined;
      leave(flow);
    }
  }

  tick(dtMs: number, flow: Flow): void {
    if (this.#heldMs === undefined) return;
    this.#heldMs += dtMs;
    if (this.#heldMs < LONG_PRESS_MS) return;
    this.#heldMs = undefined;
    flow.standby();
  }
}

/** DISPLAY TEXT: four lines a page, `OK`, ▼/▲ page (no wrap); OK, its timer or timeout go on. */
class TextScreen extends SimScreen {
  readonly #pages: readonly (readonly string[])[];
  readonly #next: (flow: Flow) => void;
  #page = 0;
  #shownMs = 0;
  readonly #giveUpMs: number;

  constructor(step: Extract<StockToolkitStep, { kind: "text" }>, next: (flow: Flow) => void) {
    super();
    this.#pages = messagePages({ text: step.text, read: true });
    this.#next = next;
    this.#giveUpMs = step.clear === "delay" ? TEXT_CLEAR_DELAY_MS : TEXT_USER_TIMEOUT_MS;
  }

  render(): MessagePageModel {
    return { kind: "message-page", lines: this.#pages[this.#page]!, softkey: "OK" };
  }

  protected key(key: PhoneKey, flow: Flow): void {
    if (key === "down") this.#page = Math.min(this.#page + 1, this.#pages.length - 1);
    else if (key === "up") this.#page = Math.max(this.#page - 1, 0);
    else if (key === "navi") this.#next(flow);
  }

  override tick(dtMs: number, flow: Flow): void {
    super.tick(dtMs, flow);
    this.#shownMs += dtMs;
    if (this.#shownMs >= this.#giveUpMs) {
      this.#shownMs = -Infinity;
      this.#next(flow);
    }
  }
}

/** SELECT ITEM: the level's rows list with `OK` (its title is not drawn); OK runs the item. */
class ListScreen extends SimScreen {
  readonly #items: readonly StockToolkitItem[];
  readonly #deps: ToolkitDeps;
  readonly #run: Run;
  #cursor: RowsCursor;

  constructor(step: Extract<StockToolkitStep, { kind: "select" }>, deps: ToolkitDeps, run: Run) {
    super();
    this.#items = step.items;
    this.#deps = deps;
    this.#run = run;
    this.#cursor = openRows(0, step.items.length);
  }

  /**
   * Back from the chosen item's steps (C): the SIM issues the list again, which opens on its
   * first item.
   */
  reveal(): void {
    this.#cursor = openRows(0, this.#items.length);
  }

  render(): OptionsModel {
    return {
      kind: "options",
      items: this.#items.map((item) => rowLabel(item.label)),
      selected: this.#cursor.selected,
      windowTop: this.#cursor.windowTop,
      indicator: { segments: [], awaitingNext: false },
      softkey: "OK",
    };
  }

  protected key(key: PhoneKey, flow: Flow): void {
    if (key === "navi") {
      // The chosen item's steps run above the list and come back to it (D3).
      const item = this.#items[this.#cursor.selected ?? 0]!;
      flow.push(stepsOf(item, this.#deps, { depth: this.#run.depth + 1 }));
      return;
    }
    this.#cursor = moveRows(this.#cursor, key, this.#items.length) ?? this.#cursor;
  }
}

/** The screen of step `i` of `steps`; OK on it goes to the next, or ends the run. */
function screenOf(
  steps: readonly StockToolkitStep[],
  i: number,
  deps: ToolkitDeps,
  run: Run,
): Widget {
  const step = steps[i]!;
  const next = (flow: Flow): void => {
    if (i + 1 < steps.length) flow.replace(screenOf(steps, i + 1, deps, run));
    else end(run)(flow);
  };
  switch (step.kind) {
    case "text":
      return new TextScreen(step, next);
    case "select":
      return new ListScreen(step, deps, run);
    case "call":
      // Composed (D4, D6): the confirm query; OK dials inside its key's `send()`, C answers no.
      return confirmQuery({
        lines: callConfirmLines(step.confirm),
        softkey: "OK",
        confirm: (flow) => deps.dial(step.number, flow),
        cancel: leave,
      });
  }
}

/** An item's steps: `Wait` while the first command is fetched, then its screens. */
function stepsOf(item: StockToolkitItem, deps: ToolkitDeps, run: Run): Widget {
  const first = item.steps[0]!;
  return wait(fetchMs(first), (flow) => flow.replace(screenOf(item.steps, 0, deps, run)));
}

/**
 * The session of a `SET UP MENU` item: the root of its stock flow. It ends where its steps end,
 * back on the level (D3).
 */
export function toolkitSession(item: StockToolkitItem, deps: ToolkitDeps): Widget {
  return stepsOf(item, deps, { depth: 1 });
}
