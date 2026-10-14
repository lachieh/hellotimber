// The stock tree's leaves as applications (plan 14 Task 12): each leaf, option list and info
// page opens a flow of stock widgets bound by `bindings.ts`, or the placeholder of the plan that
// owns it. Timelines and layouts are resolved when the menu is built, so a missing binding fails
// there and names its node.
import { PhoneApplication } from "@hellotimber/phone-core";
import type {
  ApplicationContext,
  PhoneApplicationSession,
  PhoneKey,
} from "@hellotimber/phone-core";
import {
  missingStockGlyphs,
  WIDGET_TIMELINE_BY_NAME,
  WIDGET_TIMELINE_BY_NODE,
  WIDGET_TIMELINES,
} from "../resources";
import type { StockWidgetTimeline } from "../resources";
import { confirmQuery } from "../widgets/confirm";
import { StockFlowApplication, type Flow, type Widget } from "../widgets/flow";
import { infoPages, type InfoPage } from "../widgets/info-pages";
import { infoScreen } from "../widgets/info-screen";
import { levelBar, snakeLevel } from "../widgets/level-bar";
import { multiSelect } from "../widgets/multi-select";
import { note, type NoteEnd, type NoteOptions } from "../widgets/note";
import { OptionListWidget } from "../widgets/option-list";
import { progress } from "../widgets/progress";
import { promptFromLayout } from "../widgets/prompt";
import { snakeGame, type StockGames } from "../widgets/snake";
import { splashIntro } from "../widgets/splash";
import { textPages } from "../widgets/text-pages";
import {
  CLUB_NOKIA_ID_BLINK,
  CLUB_NOKIA_ID_PROMPT,
  CURSOR_STYLE,
  EXIT_LEVELS,
  INVALID_SHORTCUT,
  LEVEL_BARS,
  modelNumber,
  noteEnd,
  noteMoves,
  noteTimelineId,
  numberLine,
  NUMERIC_LEVELS,
  optionListNumbering,
  PAGE_RESULTS,
  placeholderOwner,
  PROMPT_LAYOUTS,
  promptLayout,
  QUERY_RESULTS,
  REQUEST_NOT_CONFIRMED,
  settingKey,
  slugOf,
  SNAKE_LEVEL,
  type PromptLayout,
} from "./bindings";
import {
  STOCK_TREE,
  type StockLeafScreen,
  type StockOption,
  type StockPage,
  type StockResult,
  type StockScreenSpec,
  type StockTreeNode,
} from "./generated/stock-tree";
import { PlaceholderApplication } from "./placeholder";
import type { StockSettings } from "./settings";

/** The soft key of Instructions pages (P12; the tree records only their text). */
const TEXT_PAGES_SOFTKEY = "More";

/** Where a leaf sits: its path from the top level and what its notes do on ▲/▼ (P6). */
export interface LeafPlace {
  readonly path: readonly StockTreeNode[];
  /**
   * Sibling slugs ▲/▼ select after dismissing a note, in the level the flow returns to. Bound on
   * pages levels only (P6, Options); on rows levels ▲/▼ only dismiss (UNVERIFIED: the kernel's
   * `select` would put the sibling on the bottom row, not where the D3 window keeps it).
   */
  readonly moves?: NoteOptions["moves"];
}

function timelineById(id: string, what: string): StockWidgetTimeline {
  const found = WIDGET_TIMELINES[id];
  if (found === undefined) throw new Error(`No widget timeline "${id}" for ${what}.`);
  return found;
}

function named(name: string): StockWidgetTimeline {
  const id = WIDGET_TIMELINE_BY_NAME[name];
  if (id === undefined) throw new Error(`No named widget timeline "${name}".`);
  return timelineById(id, name);
}

/** The node's own recording's timeline (or its same-as model's), if any. */
function ownTimeline(number: string): StockWidgetTimeline | undefined {
  const id = WIDGET_TIMELINE_BY_NODE[modelNumber(number)];
  return id === undefined ? undefined : timelineById(id, `node ${number}`);
}

function noteTimeline(number: string, lines: readonly string[]): StockWidgetTimeline | undefined {
  const id = noteTimelineId(WIDGET_TIMELINE_BY_NODE, modelNumber(number), lines);
  return id === undefined ? undefined : timelineById(id, `the note at ${number}`);
}

/** The placeholder of a choice inside a flow (6-2-1 native languages): C goes back. */
function placeholderWidget(label: string): Widget {
  return {
    render: () => ({ kind: "placeholder", label }),
    onKey(key: PhoneKey, flow: Flow) {
      if (key === "c") flow.back();
    },
  };
}

/** A prompt's layout: the measured one, or (Rename in another profile) the model's renamed. */
function layoutOf(number: string, screen: StockLeafScreen, value?: string): PromptLayout {
  const own = PROMPT_LAYOUTS[number];
  const model = modelNumber(number);
  const layout = own ?? promptLayout(model, screen.kind);
  if (layout === undefined) throw new Error(`No prompt layout for ${number} (${screen.kind}).`);
  if (own !== undefined || model === number || layout.value === undefined || value === undefined) {
    return layout;
  }
  // Rename (12-n-2-10) edits that profile's name; the counter is what is left of its 10
  // characters (Silent: 4). Other profiles' prompts were not captured (UNVERIFIED); slot 6's
  // boxes have no large-face glyph in any golden, so its entry starts empty.
  const max = Number(layout.counter) + layout.value.length;
  const drawable = missingStockGlyphs(value, layout.font ?? "large").length === 0;
  return { ...layout, value: drawable ? value : "", counter: String(max - value.length) };
}

/** The cursor blink of a prompt: its own recording's, else the representative one (P9). */
function blinkOf(number: string, layout: PromptLayout): StockWidgetTimeline | undefined {
  if (layout.entry !== "end" && layout.entry !== "start" && layout.entry !== "text") {
    return undefined;
  }
  return ownTimeline(number) ?? timelineById(CURSOR_STYLE, `the cursor at ${number}`);
}

/** The slug of the tree node after `number` among its siblings (circular). */
function nextSibling(number: string): string {
  const segments = number.split("-");
  let level: readonly StockTreeNode[] = STOCK_TREE;
  for (const segment of segments.slice(0, -1)) {
    level = level.find((n) => n.number.split("-").at(-1) === segment)?.children ?? [];
  }
  const index = level.findIndex((n) => n.number === number);
  if (index < 0) throw new Error(`No tree node ${number}.`);
  return level[(index + 1) % level.length]!.slug;
}

/** Builds the stock leaves of one menu over one settings store and one games holder. */
export class LeafBinder {
  readonly #settings: StockSettings;
  readonly #games: StockGames;

  constructor(settings: StockSettings, games: StockGames) {
    this.#settings = settings;
    this.#games = games;
  }

  /** The application a leaf node opens. */
  application(place: LeafPlace): PhoneApplication {
    const node = place.path[place.path.length - 1]!;
    const id = `stock:${place.path.map((n) => n.slug).join("/")}`;
    if (node.number === SNAKE_LEVEL.newGame) return this.#snake(id, "new");
    const owner = placeholderOwner(node.number);
    if (owner !== undefined) {
      const path = place.path.map((n) => n.slug).join("/");
      return new PlaceholderApplication(`placeholder:${path}`, node.label, owner);
    }
    const spec = node.opens;
    if (spec.kind === "returns-immediately") {
      return new ExitApplication(id, EXIT_LEVELS[node.number] ?? 1);
    }
    return new StockFlowApplication(id, this.#root(place, spec));
  }

  /** A setter leaf (Info service On, Screen saver Off): stores its index, then its note. */
  setter(place: LeafPlace, key: string, index: number): PhoneApplication {
    const node = place.path[place.path.length - 1]!;
    const id = `stock:${place.path.map((n) => n.slug).join("/")}`;
    const spec = node.opens;
    if (!("lines" in spec)) throw new Error(`Setter ${node.number} opens no note.`);
    const make = this.#screen(node.number, spec, place.moves);
    return new StockFlowApplication(id, () => {
      this.#settings.choose(key, index);
      return make();
    });
  }

  /** Snake II's Continue (plan 23 D10): resumes the suspended game. */
  snakeContinue(levelPath: readonly StockTreeNode[]): PhoneApplication {
    const slugs = [...levelPath.map((n) => n.slug), SNAKE_LEVEL.continue.slug];
    return this.#snake(`stock:${slugs.join("/")}`, "continue");
  }

  #snake(id: string, start: "new" | "continue"): PhoneApplication {
    const games = this.#games;
    const settings = this.#settings;
    return new StockFlowApplication(id, () => snakeGame({ games, settings, start }));
  }

  /** A game level's splash intro (D12). */
  intro(node: StockTreeNode, path: string): PhoneApplication {
    const timeline = ownTimeline(node.number);
    if (timeline === undefined) throw new Error(`No splash timeline for ${node.number}.`);
    return splashIntro(`stock:intro:${path}`, timeline);
  }

  #root(place: LeafPlace, spec: StockScreenSpec): () => Widget {
    const node = place.path[place.path.length - 1]!;
    const number = node.number;
    switch (spec.kind) {
      case "submenu":
        throw new Error(`${number} is a submenu, not a leaf.`);
      case "option-list":
        return this.#optionList(place, spec);
      case "info-pages":
        return this.#infoPages(place, spec.pages);
      case "text-pages": {
        const { pages } = spec;
        return () => textPages({ pages, softkey: TEXT_PAGES_SOFTKEY });
      }
      default:
        return this.#screen(number, spec, place.moves, node.valueHint);
    }
  }

  /** The widget a leaf screen (or an option's or page's result) shows. */
  #screen(
    number: string,
    screen: StockLeafScreen,
    moves?: NoteOptions["moves"],
    value?: string,
  ): () => Widget {
    const { lines, softkey } = screen;
    const need = (what: string): string => {
      if (softkey === undefined) throw new Error(`${number}: ${what} without a soft key.`);
      return softkey;
    };
    switch (screen.kind) {
      case "timed-note":
      case "static-note": {
        const timeline = noteTimeline(number, lines);
        if (timeline === undefined && screen.kind === "timed-note") {
          throw new Error(`No widget timeline for the note at ${number}.`);
        }
        const end: NoteEnd = noteEnd(number) ?? (screen.after === "standby" ? "standby" : "back");
        const keys = moves ?? noteMoves(number);
        // Snake II's notes return to the first entry: Continue while a game is suspended
        // (Task 0 C8: Top score → `Score IDs / Instructions / Continue`).
        const games = this.#games;
        const endNow = (): NoteEnd =>
          typeof end === "object" &&
          end.select !== undefined &&
          number.startsWith(`${SNAKE_LEVEL.number}-`) &&
          games.snake !== undefined
            ? { ...end, select: SNAKE_LEVEL.continue.slug }
            : end;
        // A line that shows a numeric setting (Top score) reads it when the note opens.
        const shown = numberLine(number);
        const settings = this.#settings;
        const linesNow = (): readonly string[] =>
          shown === undefined
            ? lines
            : lines.map((line, i) =>
                i === shown.line ? String(settings.number(shown.key)) : line,
              );
        return () =>
          note({
            lines: linesNow(),
            ...(timeline === undefined ? {} : { timeline }),
            end: endNow(),
            ...(keys === undefined ? {} : { moves: keys }),
          });
      }
      case "progress-note": {
        const timeline = noteTimeline(number, lines);
        if (timeline === undefined) throw new Error(`No widget timeline for ${number}.`);
        const text = lines[0]!;
        const sk = need("a progress note");
        const notConfirmed = named(REQUEST_NOT_CONFIRMED.timeline);
        const quit =
          text === "Requesting"
            ? (flow: Flow) =>
                flow.replace(
                  note({
                    lines: REQUEST_NOT_CONFIRMED.lines,
                    timeline: notConfirmed,
                    end: "standby",
                  }),
                )
            : undefined;
        return () =>
          progress({ text, softkey: sk, timeline, ...(quit === undefined ? {} : { quit }) });
      }
      case "confirm-query": {
        const sk = need("a confirm query");
        const confirm = this.#queryResult(number, lines, () => {});
        return () => confirmQuery({ lines, softkey: sk, confirm: (flow) => confirm(flow, false) });
      }
      case "info-screen": {
        const sk = need("an info screen");
        return () => infoScreen({ lines: () => lines, softkey: sk });
      }
      case "text-input":
      case "number-input":
      case "code-prompt": {
        const layout = layoutOf(number, screen, value);
        const blink = blinkOf(number, layout);
        return () => promptFromLayout(layout, screen, blink);
      }
      case "level-bar": {
        const sk = need("a level bar");
        const key = NUMERIC_LEVELS[number];
        if (key !== undefined) {
          const settings = this.#settings;
          const games = this.#games;
          // OK while a game is suspended discards it; the selection stays on Level's row,
          // now the next entry (Task 0 C8: `8-1-3`, Mazes).
          const after = nextSibling(number);
          const discard = (): string | undefined => {
            if (games.snake === undefined) return undefined;
            games.snake = undefined;
            return after;
          };
          return () => snakeLevel({ settings, key, softkey: sk, onStore: discard });
        }
        const bars = LEVEL_BARS[modelNumber(number)];
        if (bars === undefined) throw new Error(`No level bars for ${number}.`);
        return () => levelBar({ bars, softkey: sk });
      }
      default:
        throw new Error(`${number}: no stock widget for a ${screen.kind} screen.`);
    }
  }

  /**
   * What OK on a confirm query does (`QUERY_RESULTS`): `store` runs first. A query pushed above
   * an option list (`pushed`) closes before its result replaces the list.
   */
  #queryResult(
    number: string,
    lines: readonly string[],
    store: () => void,
  ): (flow: Flow, pushed: boolean) => void {
    const result = QUERY_RESULTS[lines[0] ?? ""];
    if (result === undefined) throw new Error(`No result for the query at ${number}.`);
    let make: () => Widget;
    if (result.kind === "note") {
      const timeline = named(result.timeline);
      make = () => note({ lines: result.lines, timeline });
    } else {
      const blink = timelineById(CLUB_NOKIA_ID_BLINK, `the prompt after ${number}`);
      const screen = { lines: result.lines, softkey: result.softkey };
      make = () => promptFromLayout(CLUB_NOKIA_ID_PROMPT, screen, blink);
    }
    return (flow, pushed) => {
      store();
      if (pushed) flow.back();
      flow.replace(make());
    };
  }

  #optionList(
    place: LeafPlace,
    spec: Extract<StockScreenSpec, { kind: "option-list" }>,
  ): () => Widget {
    const node = place.path[place.path.length - 1]!;
    const number = node.number;
    const key = settingKey(place.path);
    const settings = this.#settings;
    const labels = spec.options.map((option) => option.label);
    if (spec.multi) {
      const opening = spec.opening ?? 0;
      // A row whose OK had no response in the crawl stays as it is (Polish).
      const inert = spec.options.flatMap((option, i) =>
        option.result.kind === "no-response" ? [i] : [],
      );
      return () => multiSelect({ key, labels, opening, settings, inert });
    }
    const exitLevels = EXIT_LEVELS[number];
    const choices = spec.options.map((option, i): ((flow: Flow) => void) => {
      const store = () => settings.choose(key, i);
      if (exitLevels === undefined)
        return this.#choice(`${number}-${i + 1}`, option, place.moves, store);
      return (flow) => {
        store();
        flow.back(exitLevels);
      };
    });
    const numbering = optionListNumbering(number);
    return () =>
      new OptionListWidget({
        labels,
        softkey: spec.softkey,
        opening: settings.choice(key),
        numbering,
        choose: (index, flow) => choices[index]!(flow),
      });
  }

  /**
   * OK on one option: notes, progress notes and returns store the choice and replace the list;
   * a confirm query is pushed (C returns to the list, P8) and stores only on OK; prompts replace
   * the list without storing (the value needs entry first); placeholder choices store nothing.
   */
  #choice(
    number: string,
    option: StockOption,
    moves: NoteOptions["moves"],
    store: () => void,
  ): (flow: Flow) => void {
    const owner = placeholderOwner(number);
    if (owner !== undefined) return (flow) => flow.replace(placeholderWidget(option.label));
    const result: StockResult = option.result;
    if (!("lines" in result)) {
      if (result.kind === "returns-immediately") {
        return (flow) => {
          store();
          flow.back();
        };
      }
      throw new Error(`${number}: no binding for a ${result.kind} option result.`);
    }
    if (result.kind === "confirm-query") {
      const softkey = result.softkey;
      if (softkey === undefined) throw new Error(`${number}: a confirm query without a soft key.`);
      const confirm = this.#queryResult(number, result.lines, store);
      return (flow) =>
        flow.push(
          confirmQuery({ lines: result.lines, softkey, confirm: (inner) => confirm(inner, true) }),
        );
    }
    const prompt =
      result.kind === "text-input" ||
      result.kind === "number-input" ||
      result.kind === "code-prompt";
    const make = this.#screen(number, result, moves);
    return (flow) => {
      if (!prompt) store();
      flow.replace(make());
    };
  }

  #infoPages(place: LeafPlace, specPages: readonly StockPage[]): () => Widget {
    const node = place.path[place.path.length - 1]!;
    const key = settingKey(place.path);
    const settings = this.#settings;
    const pages: InfoPage[] = specPages.map((page) => {
      const pageKey = `${key}/${slugOf(page.label)}`;
      return {
        label: page.label,
        softkey: page.softkey,
        ...(page.value === undefined ? {} : { value: () => settings.text(pageKey) }),
      };
    });
    const results = specPages.map((page, i) =>
      this.#pageResult(`${node.number}-${i + 1}`, page, `${key}/${slugOf(page.label)}`),
    );
    return () => infoPages({ pages, open: (index) => results[index]?.() });
  }

  /** What a page's soft key opens; undefined = back (`Back` pages). */
  #pageResult(number: string, page: StockPage, pageKey: string): (() => Widget) | undefined {
    const result = page.result;
    if (result === undefined) return undefined;
    if ("lines" in result) return this.#screen(number, result);
    if (number === "4-8-1") {
      // P15: an On/Off list on the page's value. Whether a choice changes the page is UNVERIFIED
      // (the probe only scrolled it), so OK goes back without storing.
      const list = PAGE_RESULTS["4-8-1"];
      const settings = this.#settings;
      return () => {
        const value = settings.text(pageKey);
        const opening = list.labels.findIndex((label) => label === value);
        return new OptionListWidget({
          labels: list.labels,
          softkey: list.softkey,
          opening: opening < 0 ? null : opening,
          choose: (_index, flow) => flow.back(),
        });
      };
    }
    if (number === "4-8-4") {
      const pages = PAGE_RESULTS["4-8-4"].pages.map((p) => ({ ...p, value: () => p.value }));
      return () => infoPages({ pages });
    }
    throw new Error(`${number}: no binding for a ${result.kind} page result.`);
  }
}

/**
 * A leaf with nothing to show (View all): it leaves inside `createSession`, closing `levels`
 * levels, so the kernel never renders it (Task 5).
 */
class ExitApplication extends PhoneApplication {
  readonly #levels: number;

  constructor(id: string, levels: number) {
    super(id);
    this.#levels = levels;
    Object.freeze(this);
  }

  createSession(context: ApplicationContext): PhoneApplicationSession {
    context.exit(this.#levels === 1 ? undefined : { levels: this.#levels });
    return {
      onKey() {},
      tick() {},
      render() {
        throw new Error("A leaf that exits at once has nothing to show.");
      },
    };
  }
}

/** The note digits that match no menu number open; the kernel goes to standby after it (P5). */
export function invalidShortcut(): PhoneApplication {
  const timeline = named(INVALID_SHORTCUT.timeline);
  return new StockFlowApplication("stock:invalid-shortcut", () =>
    note({ lines: INVALID_SHORTCUT.lines, timeline }),
  );
}
