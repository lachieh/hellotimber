// The SIM's toolkit menu as data (plan 30 D3, D5, D12; Task 0 K): what the applet's SET UP MENU
// lists and what each item does, validated by the faces that draw it, and how the 3310 shows its
// title and labels. Pure.
import { CAROUSEL_TITLE_WIDTH } from "../kit/ui/display/carousel";
import { CUT_MARK, cutDotsX, ROW_TEXT_LEFT, ROW_TEXT_WIDTH } from "../kit/ui/display/list-rows";
import { missingStockGlyphs, type StockFontName } from "../kit/ui/resources";
import { textWidth, wrapText } from "../kit/ui/text/layout";
import { simNumberProblem } from "../phone-book/sim-card";
import { gsmSeptets } from "./messages";
import { SIM_SERVICES_SLUG } from "./slot";
import type { StockSimToolkit, StockToolkitItem, StockToolkitStep } from "../services/sim/toolkit";

export type { StockSimToolkit, StockToolkitItem, StockToolkitStep };

/** A list holds at most this many items (an item identifier is one byte, GSM 11.14). */
export const TOOLKIT_LIST_ITEMS = 255;
/** Nested lists: the menu's items are depth 1, a list inside an item depth 2, … (D12). */
export const TOOLKIT_DEPTH = 4;
/**
 * A text page holds what one proactive command carries: GSM 11.14 caps a command at 255 bytes,
 * 239 of them DISPLAY TEXT's text, which packs 273 septets of the GSM 7-bit alphabet (D12).
 */
export const TOOLKIT_TEXT_SEPTETS = 273;

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const quoted = (chars: readonly string[]) => chars.map((ch) => JSON.stringify(ch)).join(", ");

class ToolkitError extends Error {}

function fail(path: string, message: string): never {
  throw new ToolkitError(`${path} ${message}`);
}

/** A non-empty string every glyph of which `face` draws. */
function drawn(value: unknown, path: string, face: StockFontName): string {
  if (typeof value !== "string" || value === "") fail(path, "must be a non-empty string");
  const missing = missingStockGlyphs(value, face);
  if (missing.length > 0)
    fail(path, `has characters the stock ${face} font lacks: ${quoted(missing)}`);
  return value;
}

/**
 * The carousel label of a toolkit titled `title`: as many of its words as fit the carousel's
 * line (`Portfolio menu` shows `Portfolio`, Task 0 K); undefined when its first word does not.
 */
export function carouselLabel(title: string): string | undefined {
  let label: string | undefined;
  for (const word of title.split(" ")) {
    const next = label === undefined ? word : `${label} ${word}`;
    if (textWidth("large", next) > CAROUSEL_TITLE_WIDTH) break;
    label = next;
  }
  return label === "" ? undefined : label;
}

/**
 * A label as a toolkit row shows it: whole when it fits its row, else cut (ending in `CUT_MARK`)
 * to the characters that leave a space's width before the `...` the row draws at its end
 * (`Sixteen char ...`, `Twenty-four ...`, Task 0 K).
 */
export function rowLabel(label: string): string {
  if (textWidth("small", label) <= ROW_TEXT_WIDTH) return label;
  const room = cutDotsX() - ROW_TEXT_LEFT - textWidth("small", " ");
  const chars = Array.from(label);
  let n = chars.length;
  while (n > 0 && textWidth("small", chars.slice(0, n).join("")) > room) n--;
  return `${chars.slice(0, n).join("").trimEnd()}${CUT_MARK}`;
}

/** The composed call confirm without an alpha identifier (firmware string 0x3ec, UNVERIFIED). */
export const ALLOW_CALL = "Allow SIM card to call?";

/** A confirm query's lines wrap to the LCD's 84 columns (the editor's word rule), at most 3. */
const CONFIRM_WIDTH = 84;
const CONFIRM_LINES = 3;

/** The lines of a call step's composed confirm (D4, D6): its alpha identifier or ALLOW_CALL. */
export function callConfirmLines(confirm: string | undefined): readonly string[] {
  const text = confirm ?? ALLOW_CALL;
  const chars = Array.from(text);
  return wrapText(text, "small", CONFIRM_WIDTH).map((line) =>
    chars.slice(line.start, line.end).join("").trimEnd(),
  );
}

function step(value: unknown, path: string, depth: number): StockToolkitStep {
  if (!isObject(value)) fail(path, "must be a step");
  switch (value.kind) {
    case "text": {
      const text = drawn(value.text, `${path}.text`, "small");
      const septets = gsmSeptets(text);
      if (septets === undefined) {
        const outside = Array.from(new Set(Array.from(text))).filter(
          (c) => gsmSeptets(c) === undefined,
        );
        fail(`${path}.text`, `has characters outside the GSM 7-bit alphabet: ${quoted(outside)}`);
      }
      if (septets > TOOLKIT_TEXT_SEPTETS) {
        fail(
          `${path}.text`,
          `takes ${septets} septets, more than one command's ${TOOLKIT_TEXT_SEPTETS}`,
        );
      }
      const { clear } = value;
      if (clear !== undefined && clear !== "user" && clear !== "delay") {
        fail(`${path}.clear`, 'must be "user" or "delay"');
      }
      return clear === "delay" ? { kind: "text", text, clear } : { kind: "text", text };
    }
    case "select": {
      if (depth >= TOOLKIT_DEPTH) fail(path, `nests lists deeper than ${TOOLKIT_DEPTH}`);
      const { title } = value;
      if (title !== undefined && typeof title !== "string")
        fail(`${path}.title`, "must be a string");
      const items = itemList(value.items, `${path}.items`, depth + 1);
      return { kind: "select", ...(title === undefined ? {} : { title }), items };
    }
    case "call": {
      const { number, confirm } = value;
      if (typeof number !== "string" || number === "")
        fail(`${path}.number`, "must be a non-empty string");
      const problem = simNumberProblem(number);
      if (problem !== undefined) fail(path, problem);
      if (confirm === undefined) return { kind: "call", number };
      const lines = callConfirmLines(drawn(confirm, `${path}.confirm`, "small")).length;
      if (lines > CONFIRM_LINES) {
        fail(
          `${path}.confirm`,
          `takes ${lines} lines, more than a confirm query's ${CONFIRM_LINES}`,
        );
      }
      return { kind: "call", number, confirm: confirm as string };
    }
    default:
      return fail(`${path}.kind`, 'must be "text", "select" or "call"');
  }
}

function itemList(value: unknown, path: string, depth: number): StockToolkitItem[] {
  if (!Array.isArray(value) || value.length === 0) fail(path, "must be a non-empty array");
  if (value.length > TOOLKIT_LIST_ITEMS) {
    fail(path, `has ${value.length} items, more than a list's ${TOOLKIT_LIST_ITEMS}`);
  }
  const ids = new Set<string>();
  return value.map((item: unknown, i): StockToolkitItem => {
    const at = `${path}[${i}]`;
    if (!isObject(item)) fail(at, "must be an item");
    const { id, steps } = item;
    if (typeof id !== "string" || !KEBAB.test(id))
      fail(`${at}.id`, `${JSON.stringify(id)} must be kebab-case`);
    if (ids.has(id)) fail(`${at}.id`, `"${id}" is used twice in one list`);
    ids.add(id);
    const label = drawn(item.label, `${at}.label`, "small");
    if (!Array.isArray(steps) || steps.length === 0)
      fail(`${at}.steps`, "must be a non-empty array");
    return { id, label, steps: steps.map((s: unknown, k) => step(s, `${at}.steps[${k}]`, depth)) };
  });
}

/**
 * `StockSimCard.toolkit` validated (D12): throws naming the field path under `where`
 * (`SIM card "sim-1": toolkit.items[1].steps[0].text has characters …`). Undefined: no toolkit.
 */
export function normaliseToolkit(toolkit: unknown, where: string): StockSimToolkit | undefined {
  if (toolkit === undefined) return undefined;
  try {
    if (!isObject(toolkit)) fail("toolkit", "must be an object");
    const title = drawn(toolkit.title, "toolkit.title", "large");
    if (carouselLabel(title) === undefined) {
      fail(
        "toolkit.title",
        `${JSON.stringify(title)}: its first word is wider than the carousel's line`,
      );
    }
    return { title, items: itemList(toolkit.items, "toolkit.items", 1) };
  } catch (error) {
    if (error instanceof ToolkitError) throw new Error(`${where}: ${error.message}.`);
    throw error;
  }
}

/** The paths of a toolkit's Menu 14: the level and one per `SET UP MENU` item, in order. */
export function toolkitPaths(toolkit: StockSimToolkit): readonly string[] {
  const level = `menu/${SIM_SERVICES_SLUG}`;
  return [level, ...toolkit.items.map((item) => `${level}/${item.id}`)];
}
