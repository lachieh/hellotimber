// The stock menu tree as data (plan 14 D4, D13): tree.json's structure plus the exact OCR text
// of the plan 14 captures. Pure: `import-tree.ts` does the I/O. Labels, line breaks, softkeys,
// value hints and leaf lines come from the OCR runs of the screens that show them; `tree.json`
// supplies the structure, the opening selections and the option results, and every label read
// from pixels must spell its `tree.json` label (whitespace aside) unless an override says why not.
import type {
  StockLeafKind,
  StockOption,
  StockPage,
  StockResult,
  StockScreenSpec,
  StockTreeNode,
} from "../src/firmware/generated/stock-tree.ts";
import type { FontName, TextRun } from "./harvest-glyphs.ts";
import type { TreeJsonNode, TreeJsonOption } from "./tree-capture-set.ts";

// ---------------------------------------------------------------- inputs

/** One OCR run of `plan14/text.json`. */
export interface OcrRun {
  readonly text: string;
  readonly font: string;
  readonly x: number;
  /** End of the last glyph cell (exclusive). */
  readonly x1: number;
  readonly y: number;
  readonly inverted: boolean;
}

/** The OCR'd plan 14 captures, by tree node number. */
export interface TreeText {
  /** `plan14/scroll/<number>`: runs per image, in ▼ order from the opening state. */
  scroll(number: string): readonly (readonly OcrRun[])[] | undefined;
  /** `plan14/open/<number>`: runs per recorded frame, in order (frame 0 = before the key). */
  open(number: string): readonly (readonly OcrRun[])[] | undefined;
  /** Text pages paged with More (`plan14/probe/games/instructions-<number>`), one per image. */
  pages(number: string): readonly (readonly OcrRun[])[] | undefined;
}

export interface TreeOverrides {
  /** Labels the pixels cannot give, by node number (with the capture that shows why). */
  readonly labels?: Readonly<Record<string, string>>;
  /** Page values the pixels cannot give, by node number (with the capture that shows why). */
  readonly valueHints?: Readonly<Record<string, string>>;
  /** Option labels by list number (every option of that list). */
  readonly optionLabels?: Readonly<Record<string, string>>;
  /** Leaf kinds the crawl misread, by node number. */
  readonly kinds?: Readonly<Record<string, StockLeafKind>>;
}

export class TreeModelError extends Error {
  constructor(number: string, message: string) {
    super(`tree node ${number}: ${message}`);
    this.name = "TreeModelError";
  }
}

// ---------------------------------------------------------------- fonts and layout

/** OCR face → stock font (plan 14 Task 3). */
export const OCR_FONTS: Readonly<Record<string, FontName>> = {
  bold8: "small",
  large13: "large",
  tiny6: "digits",
  plain8: "thin",
};

export function stockFont(ocrFont: string, where: string): FontName {
  const font = OCR_FONTS[ocrFont];
  if (font === undefined) throw new Error(`${where}: OCR face "${ocrFont}" has no stock font`);
  return font;
}

/** A lone `I`, `l`, `i`, `İ`, `|` or `'`: art (icons, splashes, the rail) reads as these. */
const NOISE = /^[Il|iİ']$/;

/** Runs that are text, not the softkey, the menu index or art read as a lone glyph. */
function body(runs: readonly OcrRun[]): OcrRun[] {
  return runs.filter(
    (run) =>
      run.font !== "tiny6" && run.y < 38 && run.text.trim() !== "" && !NOISE.test(run.text.trim()),
  );
}

function softkeyOf(runs: readonly OcrRun[]): string | undefined {
  const keys = runs.filter((run) => run.font === "bold8" && run.y >= 38);
  return keys.length === 0 ? undefined : keys.map((run) => run.text).join(" ");
}

/** Lines in reading order: runs sharing a top row join with a space. */
export function linesOf(runs: readonly OcrRun[]): string[] {
  const rows = new Map<number, OcrRun[]>();
  for (const run of body(runs)) rows.set(run.y, [...(rows.get(run.y) ?? []), run]);
  return [...rows.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, row]) =>
      row
        .sort((a, b) => a.x - b.x)
        .map((run) => run.text)
        .join(" "),
    );
}

/** The selected row of a rows screen (the inverted run in a row band). */
function selectedRow(runs: readonly OcrRun[]): string | undefined {
  const rows = body(runs).filter((run) => run.inverted && [8, 18, 28].includes(run.y));
  return rows.length === 1 ? rows[0]!.text : undefined;
}

/** A page screen: label lines (small, x ≤ 3, tops 7/16/25) and the value (thin, top 29). */
function pageOf(runs: readonly OcrRun[]): { lines: string[]; value?: string } {
  const lines = body(runs)
    .filter(
      (run) => run.font === "bold8" && !run.inverted && run.x <= 3 && [7, 16, 25].includes(run.y),
    )
    .sort((a, b) => a.y - b.y)
    .map((run) => run.text);
  const value = body(runs).find((run) => run.font === "plain8" && run.y === 29 && run.x > 20);
  return value ? { lines, value: value.text } : { lines };
}

function isRowsScreen(runs: readonly OcrRun[]): boolean {
  return selectedRow(runs) !== undefined;
}

function norm(text: string): string {
  return text.replace(/-\n/g, "-").replace(/\s+/g, " ").trim();
}

/** Characters whose stock glyphs are identical, so the OCR cannot tell them apart. */
const SAME_GLYPH: Readonly<Record<string, string>> = { I: "l" };

function glyphs(text: string): string {
  // One code point per glyph: firmware text is all in the Basic Multilingual Plane.
  return Array.from(text.replace(/\s+/g, ""), (ch) => SAME_GLYPH[ch] ?? ch).join("");
}

/** Whether lines read from pixels spell `label` (whitespace, line breaks and I/l aside). */
export function spells(lines: readonly string[], label: string): boolean {
  return glyphs(lines.join("")) === glyphs(label);
}

/**
 * The label's own characters broken where the pixels break it: each line takes as many
 * non-space characters as its reading has (the readings may confuse I and l).
 */
export function breakLike(lines: readonly string[], label: string): string[] {
  const chars = Array.from(norm(label));
  let at = 0;
  return lines.map((line) => {
    let need = Array.from(line.replace(/\s+/g, "")).length;
    let out = "";
    while (at < chars.length && chars[at] === " ") at++;
    while (at < chars.length && need > 0) {
      const ch = chars[at++]!;
      out += ch;
      if (ch !== " ") need--;
    }
    return out.trim();
  });
}

// ---------------------------------------------------------------- results

const RESULT = /^([a-z-]+(?: [a-z]+)?)(?: "([^"]*)")?(?: \[([^\]]+)\])?(?:, then (back|standby))?$/;

export const LEAF_KINDS: readonly StockLeafKind[] = [
  "timed-note",
  "static-note",
  "progress-note",
  "confirm-query",
  "info-screen",
  "text-input",
  "number-input",
  "code-prompt",
  "level-bar",
  "text-editor",
  "application",
  "symbol-table",
  "no-response",
  "returns-immediately",
  "standby",
];

/**
 * A `tree.json` result summary (`timed-note "Done", then back`, `confirm-query "…" [OK]`,
 * `returns immediately`, `not probed`, `option-list`) as a StockResult. Its text is split on
 * tree.json's ` / ` line breaks only; `buildStockTree` replaces the lines with the captured line
 * breaks when a recording shows them.
 */
export function parseResult(summary: string, where: string): StockResult {
  if (summary === "returns immediately") return { kind: "returns-immediately" };
  if (summary === "not probed") return { kind: "not-probed" };
  if (summary === "option-list" || summary === "info-pages") return { kind: summary };
  const match = RESULT.exec(summary);
  const kind = match?.[1] as StockLeafKind | undefined;
  if (!match || kind === undefined || !LEAF_KINDS.includes(kind)) {
    throw new Error(`${where}: cannot read the result "${summary}"`);
  }
  const text = match[2];
  return {
    kind,
    lines: text === undefined || text === "" ? [] : text.split(" / "),
    ...(match[3] !== undefined ? { softkey: match[3] } : {}),
    ...(match[4] !== undefined ? { after: match[4] as "back" | "standby" } : {}),
  };
}

// ---------------------------------------------------------------- slugs

/** Plan 13's slug rule: line breaks become spaces, apostrophes vanish (`send-bcard`). */
export function slugOf(label: string): string {
  return label
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Plan 13's slugs that do not follow the label (the website's `write`, `snake`), and Profiles
 * slot 6, whose captured label is two undefined-character boxes (plan 13 `empty-2`, D10).
 */
export const SLUG_OVERRIDES: Readonly<Record<string, string>> = {
  "2-1": "write",
  "8-1": "snake",
  "12-6": "empty-2",
};

/** Sibling slugs: the label's slug, `-2`, `-3`, … on collisions (plan 13's `empty-2`). */
export function siblingSlugs(nodes: readonly { number: string; label: string }[]): string[] {
  const used = new Map<string, number>();
  return nodes.map(({ number, label }) => {
    const base = SLUG_OVERRIDES[number] ?? (slugOf(label) || "entry");
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  });
}

// ---------------------------------------------------------------- the model

function screenOf(node: TreeJsonNode): string {
  return node.kind === "submenu" ? "submenu" : (node.opens.screen ?? "");
}

function openingIndex(node: TreeJsonNode): number | null {
  if (node.opens.no_highlight_on_entry) return null;
  const options = node.opens.options ?? [];
  const i = options.findIndex((option) => option.highlighted_on_entry);
  return i < 0 ? 0 : i;
}

/** The scroll image that shows entry `i` selected (unset lists start with an empty screen). */
function imageFor(opening: number | null, count: number, i: number): number {
  return opening === null ? i + 1 : (i - opening + count) % count;
}

/**
 * The recorded frame with the most text between the key and the return: frames after frame 0 up
 * to the first that shows a menu index (a list, the carousel) or standby's `Menu`.
 */
function richestFrame(frames: readonly (readonly OcrRun[])[]): readonly OcrRun[] | undefined {
  let best: readonly OcrRun[] | undefined;
  let size = -1;
  for (const frame of frames.slice(1)) {
    if (frame.some((run) => run.font === "tiny6") || softkeyOf(frame) === "Menu") break;
    const n = body(frame).reduce((sum, run) => sum + run.text.length, 0);
    if (n > size) {
      size = n;
      best = frame;
    }
  }
  return best;
}

export function buildStockTree(
  tops: readonly TreeJsonNode[],
  text: TreeText,
  overrides: TreeOverrides = {},
): StockTreeNode[] {
  /** Captured line breaks of a result, by its kind and one-line text (equal results share). */
  const resultLines = new Map<string, readonly string[]>();

  const scrollOf = (node: TreeJsonNode): readonly (readonly OcrRun[])[] => {
    const images = text.scroll(node.number);
    if (images === undefined || images.length === 0) {
      throw new TreeModelError(node.number, `no OCR for plan14/scroll/${node.number}`);
    }
    return images;
  };

  const leafScreen = (
    number: string,
    kind: StockLeafKind,
  ): { lines: string[]; softkey?: string } => {
    const frames = text.open(number);
    if (frames === undefined) throw new TreeModelError(number, `no OCR for plan14/open/${number}`);
    const frame = richestFrame(frames);
    if (frame === undefined || kind === "no-response") return { lines: [] };
    const softkey = softkeyOf(frame);
    return { lines: linesOf(frame), ...(softkey !== undefined ? { softkey } : {}) };
  };

  const optionResult = (option: TreeJsonOption): StockResult => {
    const result = parseResult(option.result, `tree node ${option.number}`);
    if (!("lines" in result)) return result;
    const key = `${result.kind} ${result.lines.join(" ")}`;
    const frames = text.open(option.number);
    const frame = frames === undefined ? undefined : richestFrame(frames);
    if (frame !== undefined) {
      const lines = linesOf(frame);
      if (lines.length > 0 && spells(lines, result.lines.join(" "))) {
        resultLines.set(key, breakLike(lines, result.lines.join(" ")));
      }
    }
    const lines = resultLines.get(key);
    return lines === undefined ? result : { ...result, lines };
  };

  const labelOf = (
    node: { number: string; label: string },
    lines: readonly string[] | undefined,
    where: string,
  ): string => {
    const override = overrides.labels?.[node.number];
    if (override !== undefined) return override;
    if (lines === undefined || lines.length === 0) {
      throw new TreeModelError(node.number, `no text for its label "${node.label}" in ${where}`);
    }
    if (!spells(lines, node.label)) {
      throw new TreeModelError(
        node.number,
        `the captured text "${lines.join(" / ")}" (${where}) does not spell its label "${node.label}"`,
      );
    }
    return breakLike(lines, node.label).join("\n");
  };

  const listSpec = (node: TreeJsonNode, screen: "option-list" | "info-pages"): StockScreenSpec => {
    const options = node.opens.options ?? [];
    const opening = openingIndex(node);
    const images = scrollOf(node);
    const where = `plan14/scroll/${node.number}`;
    const read = (i: number): readonly OcrRun[] => {
      const image = images[imageFor(opening, options.length, i)];
      if (image === undefined) throw new TreeModelError(options[i]!.number, `no image in ${where}`);
      return image;
    };
    if (screen === "info-pages") {
      const pages: StockPage[] = options.map((option, i) => {
        const page = pageOf(read(i));
        const result = option.result === "returns immediately" ? undefined : optionResult(option);
        return {
          label: labelOf(option, page.lines, where),
          ...(page.value !== undefined ? { value: page.value } : {}),
          softkey: option.softkey ?? softkeyOf(read(i)) ?? "Back",
          ...(result !== undefined ? { result } : {}),
        };
      });
      return { kind: "info-pages", pages };
    }
    const multi = options.some(
      (option) => option.softkey === "Mark" || option.softkey === "Unmark",
    );
    const fixed = overrides.optionLabels?.[node.number];
    const list: StockOption[] = options.map((option, i) => {
      const row = selectedRow(read(i));
      return {
        label: fixed ?? labelOf(option, row === undefined ? undefined : [row], where),
        ...(multi && option.softkey === "Unmark" ? { marked: true as const } : {}),
        result: optionResult(option),
      };
    });
    return {
      kind: "option-list",
      softkey: multi ? "Mark" : (options.find((option) => option.softkey)?.softkey ?? "OK"),
      opening,
      ...(multi ? { multi: true as const } : {}),
      options: list,
    };
  };

  const visit = (
    node: TreeJsonNode,
    label: string,
    valueHint: string | undefined,
    slug: string,
  ): StockTreeNode => {
    const screen = screenOf(node);
    let opens: StockScreenSpec;
    let children: StockTreeNode[] | undefined;
    if (screen === "submenu") {
      const kids = node.children ?? [];
      const images = scrollOf(node);
      const opening = Math.max(
        0,
        kids.findIndex((kid) => kid.label === node.opens.highlighted_on_entry),
      );
      const rows = images.some(isRowsScreen);
      const slugs = siblingSlugs(kids);
      const where = `plan14/scroll/${node.number}`;
      children = kids.map((kid, i) => {
        const image = images[imageFor(opening, kids.length, i)] ?? [];
        if (rows) {
          const row = selectedRow(image);
          return visit(
            kid,
            labelOf(kid, row === undefined ? undefined : [row], where),
            undefined,
            slugs[i]!,
          );
        }
        const page = pageOf(image);
        return visit(kid, labelOf(kid, page.lines, where), page.value, slugs[i]!);
      });
      opens = {
        kind: "submenu",
        presentation: rows ? "rows" : "pages",
        softkey: softkeyOf(images[0]!) ?? softkeyOf(images[1] ?? []) ?? "Select",
        ...(opening > 0 ? { opening: slugs[opening]! } : {}),
        ...(node.opens.splash_first ? { intro: true as const } : {}),
      };
    } else if (screen === "option-list" || screen === "info-pages") {
      opens = listSpec(node, screen);
    } else if (screen === "text-pages") {
      const images = text.pages(node.number);
      if (images === undefined) throw new TreeModelError(node.number, "no OCR for its text pages");
      const pages: string[][] = [];
      for (const image of images) {
        const lines = linesOf(image);
        if (pages.some((page) => page.join("\n") === lines.join("\n"))) break; // the pages cycle
        pages.push(lines);
      }
      opens = { kind: "text-pages", pages };
    } else {
      const kind = overrides.kinds?.[node.number] ?? (screen as StockLeafKind);
      if (!LEAF_KINDS.includes(kind)) {
        throw new TreeModelError(node.number, `unknown leaf kind "${screen}"`);
      }
      const after = node.opens.then?.to_standby
        ? ("standby" as const)
        : node.opens.then?.back_to_list
          ? ("back" as const)
          : undefined;
      opens = { kind, ...leafScreen(node.number, kind), ...(after !== undefined ? { after } : {}) };
    }
    const hint = overrides.valueHints?.[node.number] ?? valueHint;
    return {
      number: node.number,
      slug,
      label,
      ...(hint !== undefined ? { valueHint: hint } : {}),
      opens,
      ...(children !== undefined ? { children } : {}),
    };
  };

  const slugs = siblingSlugs(tops);
  return tops.map((top, i) =>
    visit(top, overrides.labels?.[top.number] ?? top.label, undefined, slugs[i]!),
  );
}

// ---------------------------------------------------------------- harvester runs (D13)

/**
 * Art the OCR reads as text: a run with no letter or digit (splash and gameplay dots, the
 * uninitialised-EEPROM boxes U+E000) or made only of `I`/`l`/`i`/`'` readings (the Clock pages'
 * icon reads `' '`). No stock text is either.
 */
function isArt(text: string): boolean {
  return !/[\p{L}\p{N}]/u.test(text) || /^[Il|iİ' ]+$/.test(text);
}

/** Harvester text runs for one golden image from its OCR runs, with exact column bounds. */
export function harvestRuns(runs: readonly OcrRun[], where: string): TextRun[] {
  return runs
    .filter((run) => !isArt(run.text))
    .map((run) => ({
      font: stockFont(run.font, where),
      text: run.text,
      top: run.y,
      ...(run.inverted ? { inverted: true } : {}),
      left: run.x,
      right: Math.min(83, run.x1 - 1),
    }));
}
