// Screen text for hosts (plan 30 D11): a plain-English description of any screen a stock phone
// emits, for an accessibility mirror (`[role=status]`) and headless QA. Kernel screens are read
// from their models; a stock widget's `custom` frame carries the text its flow attached when it
// painted the frame (`attachDescription`), so snapshots and their equality do not change and
// phone-core does not change. Accessibility and QA text, not pixels: no golden asserts it.
import type { MenuIndicator, ScreenModel } from "@hellotimber/phone-core";
import type { ScreenDisplay } from "./screen-display";
import { CUT_MARK } from "./list-rows";
import type { CallBody, WidgetModel } from "./widgets";

/** The text attached to each frame object a stock flow painted. */
const DESCRIPTIONS = new WeakMap<object, string>();

/** Attaches `text` to `frame` (a stock widget's painted frame): `describeScreen` reads it. */
export function attachDescription(frame: object, text: string): void {
  DESCRIPTIONS.set(frame, text);
}

/** Lines of a screen as one sentence: the firmware's line breaks are only layout. */
const join = (lines: readonly string[]): string =>
  lines
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .join(" ");

/** `<text>` with its soft key, when it has one. */
function withSoftkey(text: string, softkey: string | undefined): string {
  return softkey === undefined || softkey === "" ? text : `${text} [${softkey}]`;
}

/** A label as a row shows it: a cut label (`CUT_MARK`) reads with its `...`. */
const rowText = (label: string): string =>
  label.endsWith(CUT_MARK) ? `${label.slice(0, -CUT_MARK.length)}...` : label;

/**
 * `Menu 2-2`: the menu number at the top right, when the screen draws one (an unnumbered menu's,
 * v6.39's SIM services, none).
 */
function menuNumber(
  indicator: MenuIndicator | undefined,
  display: ScreenDisplay,
): string | undefined {
  if (indicator === undefined || indicator.segments.length === 0) return undefined;
  if (display.unnumberedMenus?.includes(indicator.segments[0]!)) return undefined;
  return indicator.segments.join("-");
}

/** A list's selected row and its position: `Inbox (2 of 5)`. */
function selection(rows: readonly string[], selected: number | null): string {
  if (rows.length === 0) return "empty";
  if (selected === null) return `nothing selected (${rows.length} items)`;
  return `${rowText(rows[selected] ?? "")} (${selected + 1} of ${rows.length})`;
}

/** The plain-text description of a stock widget's screen (D11). */
export function describeWidget(model: WidgetModel): string {
  switch (model.kind) {
    case "options":
      return withSoftkey(`List: ${selection(model.items, model.selected)}`, model.softkey);
    case "multi":
      return withSoftkey(
        `Choices: ${selection(model.items, model.selected)}, ${model.marks[model.selected] ? "marked" : "not marked"}`,
        model.softkey,
      );
    case "note":
      // An interlude's picture without text (the `Opening` before the Inbox) still reads.
      return `Note: ${join(model.lines) || "please wait"}`;
    case "progress":
      return withSoftkey(
        `${join(typeof model.text === "string" ? [model.text] : model.text)} (in progress)`,
        model.softkey,
      );
    case "confirm":
      return withSoftkey(`Question: ${join(model.lines)}`, model.softkey);
    case "info-page":
      return withSoftkey(
        `${model.label}${model.value === undefined ? "" : `: ${model.value}`} (${model.index + 1} of ${model.count})`,
        model.softkey,
      );
    case "info-screen":
      return withSoftkey(join(model.lines) || "Blank", model.softkey);
    case "prompt": {
      const entry = model.entry;
      const value =
        entry === undefined ? "" : entry.kind === "mask" ? "*".repeat(entry.digits) : entry.text;
      const counter = model.counter === undefined ? "" : ` (${model.counter} left)`;
      return withSoftkey(`${join(model.label)} ${value}${counter}`.trim(), model.softkey);
    }
    case "level-bar":
      return withSoftkey(`Level ${model.bars}`, model.softkey);
    case "text-page":
    case "message-page":
      return withSoftkey(join(model.lines) || "Blank page", model.softkey);
    case "splash":
      return "Game title";
    case "space-impact":
      return `Space impact, score ${model.board.hud.score}`;
    case "snake":
      return `Snake II, score ${model.board.score}`;
    case "game-over":
      return `Game over: ${model.label} ${model.score}`.trim();
    case "boot-frame":
      return model.frame === 0 ? "Blank screen" : "Switching on";
    case "welcome-note":
      return `Welcome note: ${model.text}`;
    case "editor": {
      const text = join(model.lines.map((line) => line.text));
      return withSoftkey(`Editor: ${text || "empty"} (${model.counter})`, model.softkey);
    }
    case "symbols":
      return "Symbol table";
    case "placeholder":
      return `${model.label} (not implemented)`;
    case "calculator":
      return withSoftkey(
        model.screen === "display"
          ? `Calculator: ${join(model.lines)}`
          : `${model.label} ${model.text}`.trim(),
        model.softkey,
      );
    case "alert":
      return withSoftkey(`Alert: ${join(model.lines)}`, model.softkey);
    case "stopwatch":
      return withSoftkey(`Stopwatch ${model.text}`, model.softkey);
    case "composer":
      return withSoftkey(
        `Composer: ${join(model.lines) || "empty"} (${model.counter})`,
        model.softkey,
      );
    case "keyguard":
      if (model.screen === "locked-standby") return "Keypad locked";
      if (model.screen === "now-press") return "Keypad locked: now press *";
      if (model.screen === "emergency") return `Emergency call ${model.number}`;
      return model.screen === "hint"
        ? "Note: press Unlock, then *"
        : model.screen === "active-note"
          ? "Note: Keypad active"
          : "Note: Keypad locked";
    case "standby-draw":
      return "Standby";
    case "message-list":
      return withSoftkey(
        `Messages: ${selection(
          model.rows.map((row) => row.label),
          model.selected,
        )}${model.rows[model.selected]?.icon === "message/unread" ? ", unread" : ""}`,
        model.softkey,
      );
    case "name-list":
      if (model.view === "list") {
        return withSoftkey(`Names: ${selection(model.rows, model.selected)}`, model.softkey);
      }
      return withSoftkey(
        model.view === "large"
          ? `${model.name}${model.number === undefined ? "" : ` ${model.number}`}`
          : `${model.name}: ${model.value}`,
        model.softkey,
      );
    case "service-list":
      return withSoftkey(
        `Service numbers: ${selection(model.items, model.selected)}`,
        model.softkey,
      );
    case "phone-book-query":
      return withSoftkey(`Question: ${join(model.lines)}`, model.softkey);
    case "phone-book-number":
      return withSoftkey(`Number ${model.number}`, model.softkey);
    case "standby-frame":
      return describeScreen(model.screen);
    case "shortcut-choice":
      return model.label;
    case "content-list":
      return withSoftkey(`List: ${selection(model.rows, model.selected)}`, model.softkey);
    case "service-request":
      return withSoftkey(`${model.text} (in progress)`, model.softkey);
    case "dial-entry":
      return withSoftkey(`Number: ${model.text}`, model.softkey);
    case "call":
      return withSoftkey(`Call: ${describeCallBody(model.body)}`, model.softkey);
    case "call-entry":
      return withSoftkey(`${model.label} ${model.number}`, model.softkey);
    case "ringing":
      return withSoftkey(`Incoming call: ${model.name ?? model.number}`, "Answer");
    case "volume":
      return `Volume ${model.level}`;
    case "reminder-view":
      return withSoftkey(
        `Reminder ${model.number}${model.when === undefined ? "" : `, ${model.when}`}: ${model.text}`,
        model.softkey,
      );
  }
}

/** Plan 22: what a call screen shows (`Calling 0412345678`, `Call 1, muted`). */
function describeCallBody(body: CallBody): string {
  switch (body.kind) {
    case "calling":
      return `Calling${body.name !== undefined ? ` ${body.name}` : body.number === undefined ? "" : ` ${body.number}`}`;
    case "emergency":
      return "Attempting emergency call";
    case "call":
      return `${body.label}${body.ended === true ? ", ended" : ""}${body.muted === true ? ", muted" : ""}`;
    case "sending":
      return `Sending ${body.text}`;
    case "digits":
      return body.text;
    case "blank":
      return "connecting";
  }
}

/** Standby: operator, clock, the profile line, indicators, a notice and the soft key. */
function standby(screen: Extract<ScreenModel, { kind: "standby" }>): string {
  const parts = [`Standby: ${screen.carrier}`];
  if (screen.line !== undefined) parts.push(screen.line);
  if (screen.clock !== undefined) parts.push(screen.clock);
  const indicators = Object.entries(screen.indicators ?? {})
    .filter(([, on]) => on === true)
    .map(([name]) => (name === "message" ? "unread messages" : name));
  if (indicators.length > 0) parts.push(indicators.join(", "));
  if (screen.notice !== undefined) {
    return withSoftkey(
      `${parts.join(", ")}. ${join(screen.notice.text.split("\n"))}`,
      screen.notice.softkey,
    );
  }
  return withSoftkey(parts.join(", "), "Menu");
}

/**
 * Plan 30 D11: a plain-text description of `screen` (any snapshot's screen of a phone running a
 * firmware with `display`), for accessibility mirrors and headless QA. Never empty. The stock
 * firmware's is `describeStockScreen` (src/firmware/display.ts).
 */
export function describeScreen(screen: ScreenModel, display: ScreenDisplay = {}): string {
  switch (screen.kind) {
    case "off":
      return "Off";
    case "boot":
      return screen.phase === "welcome" ? "Switching on: welcome" : "Switching on";
    case "standby":
      return standby(screen);
    case "menu-carousel":
      return withSoftkey(
        `Menu ${screen.menuNumber}: ${screen.label}`,
        screen.opening ? undefined : "Select",
      );
    case "list": {
      const shown = rowText(screen.items[screen.selected] ?? "");
      const where = menuNumber(screen.menuIndicator, display);
      const position =
        screen.presentation === "pages"
          ? `${shown}${screen.detail === undefined ? "" : `: ${screen.detail}`}`
          : `${shown} (${screen.selected + 1} of ${screen.items.length})`;
      const title = screen.title === "" ? "" : `${screen.title}: `;
      return withSoftkey(
        `${title}${position}${where === undefined ? "" : ` [Menu ${where}]`}`,
        screen.opening ? undefined : screen.softkey,
      );
    }
    case "reader":
      return `${screen.title}: ${join(screen.lines)}`;
    case "editor":
      return `${screen.title}: ${screen.text || "empty"}`;
    case "confirm":
      return withSoftkey(`Question: ${screen.text}`, screen.softkey);
    case "custom":
      return DESCRIPTIONS.get(screen.frame) ?? `Screen of ${screen.appId}`;
  }
}
