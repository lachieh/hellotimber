// The stock calculator's widgets (plan 20 D4, D7, D8): the calculator screen over the pure engine
// (src/calculator/engine.ts), its Options list, the exchange-rate pages and entry, and its notes.
// Every widget here acts as a key goes down (D8: a held digit, `*` or `#` draws before release)
// and ignores the release of a key it did not see go down, so a key that changes the screen
// never acts again on the screen it opened.
import type { MenuIndicator, PhoneKey } from "@hellotimber/phone-core";
import type { OptionsModel } from "../display/widgets";
import type { CalculatorModel } from "../display/widgets/calculator";
import {
  CALCULATOR_START,
  chooseOption,
  clearHeld,
  displayLines,
  OPTION_LABELS,
  optionsFor,
  pressKey,
  type CalculatorKey,
  type CalculatorNote,
  type CalculatorState,
} from "../calculator/engine";
import type { CalculatorRate, RateDirection } from "../calculator/rate";
import {
  clearRateEntry,
  openRateEntry,
  pressRateKey,
  rateToSave,
  type RateEntry,
  type RateKey,
} from "../calculator/rate-entry";
import type { StockWidgetTimeline } from "../resources";
import type { Flow, Widget } from "./flow";
import { infoPages } from "./info-pages";
import { note, type NoteSound } from "./note";
import { Playback } from "./playback";
import { moveRows, openRows, rowsIndicator, type RowsCursor } from "./rows";

/**
 * How long C is held before it clears (D8): the captured clears redraw 532.1 and 544.0 ms after
 * C goes down, 471 and 478 ms after the redraw of the deletion C makes at its down; keys act at
 * their down here (no redraw latency), so the clear comes this long after it. The firmware's
 * internal timer is UNVERIFIED.
 */
export const CALCULATOR_HOLD_MS = 475;

/** Options' indicator position of Exchange rate (the 8-entry list): its pages read `8-k`. */
const EXCHANGE_RATE_POSITION = 8;

const CALCULATOR_KEYS: ReadonlySet<PhoneKey> = new Set([
  ..."0123456789".split(""),
  "#",
  "*",
  "c",
] as PhoneKey[]);
const RATE_KEYS: ReadonlySet<PhoneKey> = new Set([
  ..."0123456789".split(""),
  "#",
  "*",
  "c",
  "up",
  "down",
] as PhoneKey[]);

/** The stores and outputs the calculator uses. */
export interface CalculatorServices {
  readonly rate: CalculatorRate;
  /** Notes' warning tones (plan 16 D12). */
  readonly noteSound: NoteSound;
  /** Note timelines by note. */
  readonly notes: Readonly<Record<CalculatorNote | "rate-saved", StockWidgetTimeline>>;
  /** The rate entry's cursor blink. */
  readonly blink: StockWidgetTimeline;
}

const NOTE_LINES: Readonly<Record<CalculatorNote | "rate-saved", readonly string[]>> = {
  "out-of-range": ["Out of", "range"],
  "divide-by-zero": ["Dividing", "by zero", "not allowed"],
  "rate-saved": ["Rate", "saved"],
};

/** Tracks a key held down since `atMs` of a widget's ticks. */
class HeldKey {
  #heldMs: number | undefined;

  start(): void {
    this.#heldMs = 0;
  }

  stop(): void {
    this.#heldMs = undefined;
  }

  /** Advances; true once, on the tick the hold reaches CALCULATOR_HOLD_MS. */
  reached(dtMs: number): boolean {
    if (this.#heldMs === undefined) return false;
    this.#heldMs += dtMs;
    if (this.#heldMs < CALCULATOR_HOLD_MS) return false;
    this.#heldMs = undefined;
    return true;
  }
}

/** `widget`, acting as each key goes down (its release-time action runs then) and never again. */
function onKeyDown(widget: Widget): Widget {
  return {
    render: (flow) => widget.render(flow),
    tick: (dtMs, flow) => widget.tick?.(dtMs, flow),
    close: () => widget.close?.(),
    onKeyDown(key, flow) {
      widget.onKeyDown?.(key, flow);
      widget.onKey?.(key, flow);
    },
  };
}

/** `widget` with its flow's indicator rooted at `segments` (D5: Options, not the kernel's 9). */
function rootedAt(widget: Widget, segments: readonly number[]): Widget {
  const indicator: MenuIndicator = { segments: [...segments], awaitingNext: false };
  const rooted = (flow: Flow): Flow => ({
    push: (next) => flow.push(rootedAt(next, segments)),
    replace: (next) => flow.replace(rootedAt(next, segments)),
    back: (levels, options) => flow.back(levels, options),
    standby: () => flow.standby(),
    indicator: () => indicator,
  });
  return {
    render: (flow) => widget.render(rooted(flow)),
    onKey: (key, flow) => widget.onKey?.(key, rooted(flow)),
    onKeyDown: (key, flow) => widget.onKeyDown?.(key, rooted(flow)),
    tick: (dtMs, flow) => widget.tick?.(dtMs, rooted(flow)),
    close: () => widget.close?.(),
  };
}

/** The calculator screen: the operands and operator over `Options`. */
class CalculatorWidget implements Widget {
  readonly #services: CalculatorServices;
  #state: CalculatorState = CALCULATOR_START;
  /** Keys seen going down here (a release acts only after its own down). */
  readonly #down = new Set<PhoneKey>();
  /** C held after it deleted (clears), or after it dismissed a note (standby). */
  readonly #clearing = new HeldKey();
  readonly #leaving = new HeldKey();

  constructor(services: CalculatorServices) {
    this.#services = services;
  }

  render(): CalculatorModel {
    return {
      kind: "calculator",
      screen: "display",
      lines: displayLines(this.#state),
      softkey: "Options",
    };
  }

  onKeyDown(key: PhoneKey, flow: Flow): void {
    this.#down.add(key);
    if (CALCULATOR_KEYS.has(key)) this.press(key as CalculatorKey, flow);
  }

  onKey(key: PhoneKey, flow: Flow): void {
    if (!this.#down.delete(key)) return;
    if (key === "c") {
      this.#clearing.stop();
      this.#leaving.stop();
    }
    if (key === "navi") flow.push(this.#options());
  }

  tick(dtMs: number, flow: Flow): void {
    if (this.#clearing.reached(dtMs)) this.#state = clearHeld(this.#state);
    if (this.#leaving.reached(dtMs)) flow.standby();
  }

  /** A calculator key going down: here, or forwarded by the note it dismissed. */
  press(key: CalculatorKey, flow: Flow): void {
    const step = pressKey(this.#state, key);
    this.#state = step.state;
    if (step.leave) {
      flow.back();
      return;
    }
    if (step.note !== undefined) {
      flow.push(this.#note(step.note));
      return;
    }
    if (key === "c") this.#clearing.start();
  }

  /** C went down on a note and stays held: past the hold, the phone goes to standby. */
  heldFromNote(): void {
    this.#down.add("c");
    this.#leaving.start();
  }

  #note(which: CalculatorNote): Widget {
    return new CalculatorNoteWidget(this, which, this.#services);
  }

  #options(): Widget {
    const ids = optionsFor(this.#state);
    return new OptionsWidget(
      ids.map((id) => OPTION_LABELS[id]),
      (index, flow) => {
        const id = ids[index]!;
        if (id === "exchange-rate") {
          flow.push(rateList(this.#services));
          return;
        }
        const step = chooseOption(this.#state, id, (amount, to) =>
          this.#services.rate.convert(amount, to),
        );
        this.#state = step.state;
        if (step.note === undefined) flow.back();
        else flow.replace(this.#note(step.note));
      },
    );
  }
}

/**
 * Options (D4, D5): a rows list opening on its first entry, numbered by position, soft key OK;
 * keys act as they go down. ▲/▼ move circularly in the shared rows window (D3), so ▲ from the
 * first of four entries puts the last on the top row (`options/operator-up`).
 */
class OptionsWidget implements Widget {
  readonly #labels: readonly string[];
  readonly #choose: (index: number, flow: Flow) => void;
  #cursor: RowsCursor;

  constructor(labels: readonly string[], choose: (index: number, flow: Flow) => void) {
    this.#labels = labels;
    this.#choose = choose;
    this.#cursor = openRows(0, labels.length);
  }

  /** Options always has a selection: it opens on its first entry. */
  get #selected(): number {
    return this.#cursor.selected ?? 0;
  }

  render(flow: Flow): OptionsModel {
    return {
      kind: "options",
      items: this.#labels,
      selected: this.#selected,
      windowTop: this.#cursor.windowTop,
      indicator: rowsIndicator(flow.indicator(), this.#selected, "option"),
      softkey: "OK",
    };
  }

  onKeyDown(key: PhoneKey, flow: Flow): void {
    const moved = moveRows(this.#cursor, key, this.#labels.length);
    if (moved !== undefined) this.#cursor = moved;
    else if (key === "navi") this.#choose(this.#selected, flow);
    else if (key === "c") flow.back();
    // D9: digits, `*` and `#` leave for standby number entry with their DTMF pairs. That
    // handoff is plan 22's (`calculator/keys-options-*`, `options-dtmf-confirm-*`,
    // pending:22); until it lands Options does not act on them.
  }
}

/**
 * Out of range / Dividing by zero not allowed: plays its timeline and returns to the state
 * before the action. A key going down dismisses it (Task 0 N): a digit, `#` or `*` then acts on
 * the calculator, ▲/▼ and OK only dismiss, and C held on goes to standby.
 */
class CalculatorNoteWidget implements Widget {
  readonly #calculator: CalculatorWidget;
  readonly #note: Widget;

  constructor(calculator: CalculatorWidget, which: CalculatorNote, services: CalculatorServices) {
    this.#calculator = calculator;
    this.#note = note({
      lines: NOTE_LINES[which],
      timeline: services.notes[which],
      sound: services.noteSound,
    });
  }

  render(flow: Flow) {
    return this.#note.render(flow);
  }

  tick(dtMs: number, flow: Flow): void {
    this.#note.tick?.(dtMs, flow);
  }

  onKeyDown(key: PhoneKey, flow: Flow): void {
    flow.back();
    if (key === "c") this.#calculator.heldFromNote();
    else if (CALCULATOR_KEYS.has(key)) this.#calculator.press(key as CalculatorKey, flow);
  }
}

/** Exchange rate's pages, `8-1` Foreign unit and `8-2` Domestic unit, each opening its entry. */
function rateList(services: CalculatorServices): Widget {
  const directions: readonly RateDirection[] = ["foreign", "domestic"];
  const pages = infoPages({
    pages: [
      { label: "Foreign unit\nexpressed in\ndomestic units", softkey: "OK" },
      { label: "Domestic unit\nexpressed in\nforeign units", softkey: "OK" },
    ],
    open: (index) => new RateEntryWidget(directions[index]!, services),
  });
  return rootedAt(onKeyDown(pages), [EXCHANGE_RATE_POSITION]);
}

/**
 * The exchange-rate entry (D7): `Exchange rate:`, the shown rate in a box with a blinking cursor
 * that runs on through keys. OK stores the rate and shows `Rate saved`, then the calculator; C
 * on an empty field returns to the pages.
 */
class RateEntryWidget implements Widget {
  readonly #direction: RateDirection;
  readonly #services: CalculatorServices;
  readonly #blink: Playback;
  #entry: RateEntry;
  readonly #down = new Set<PhoneKey>();
  readonly #clearing = new HeldKey();
  /** C went down on an empty field: its release returns to the pages. */
  #cOnEmpty = false;

  constructor(direction: RateDirection, services: CalculatorServices) {
    this.#direction = direction;
    this.#services = services;
    this.#blink = new Playback(services.blink);
    this.#entry = openRateEntry(services.rate.shown(direction));
  }

  render(): CalculatorModel {
    return {
      kind: "calculator",
      screen: "rate",
      label: "Exchange rate:",
      text: this.#entry.text,
      cursorAt: this.#entry.cursor,
      cursor: this.#blink.frame.kind === "cursor",
      softkey: "OK",
    };
  }

  tick(dtMs: number): void {
    this.#blink.advance(dtMs);
    if (this.#clearing.reached(dtMs)) this.#entry = clearRateEntry();
  }

  onKeyDown(key: PhoneKey): void {
    this.#down.add(key);
    if (key === "c" && this.#entry.text === "") {
      this.#cOnEmpty = true;
      return;
    }
    if (!RATE_KEYS.has(key)) return;
    this.#entry = pressRateKey(this.#entry, key as RateKey);
    if (key === "c") this.#clearing.start();
  }

  onKey(key: PhoneKey, flow: Flow): void {
    if (!this.#down.delete(key)) return;
    if (key === "c") {
      this.#clearing.stop();
      if (this.#cOnEmpty) flow.back();
      this.#cOnEmpty = false;
    }
    if (key === "navi") {
      // OK on the untouched shown value keeps the stored rate (`rate/after/ok-unchanged-*`:
      // OK on Domestic 0.6666667 leaves Foreign 1.5, not its rounded reciprocal).
      if (!this.#entry.prefilled) this.#services.rate.set(this.#direction, rateToSave(this.#entry));
      // Rate saved, then the calculator: past the entry, the pages and Options.
      flow.replace(
        onKeyDown(
          note({
            lines: NOTE_LINES["rate-saved"],
            timeline: this.#services.notes["rate-saved"],
            end: { levels: 3 },
            sound: this.#services.noteSound,
          }),
        ),
      );
    }
  }
}

/** The calculator's first screen; a new one (at `0`) on every entry. */
export function calculator(services: CalculatorServices): Widget {
  return new CalculatorWidget(services);
}
