// The stock tree's leaves as applications (plan 14 Task 12): each leaf, option list and info
// page opens a flow of stock widgets read from the tree and the features' tables (`stock.ts`), a
// screen a feature implements, or the placeholder of the plan that owns it. Timelines and layouts are resolved when the menu is built, so a missing binding fails
// there and names its node.
import { PhoneApplication } from "@hellotimber/phone-core";
import type {
  ApplicationContext,
  PhoneApplicationSession,
  PhoneKey,
} from "@hellotimber/phone-core";
import { missingStockGlyphs, WIDGET_TIMELINE_BY_NODE } from "../resources";
import type { StockWidgetTimeline } from "../resources";
import { confirmQuery } from "../widgets/confirm";
import { StockFlowApplication, type Flow, type Widget } from "../widgets/flow";
import { infoPages, type InfoPage } from "../widgets/info-pages";
import { infoScreen } from "../widgets/info-screen";
import { levelBar } from "../widgets/level-bar";
import { multiSelect } from "../widgets/multi-select";
import { note, type NoteEnd, type NoteOptions } from "../widgets/note";
import { OptionListWidget } from "../widgets/option-list";
import { progress } from "../widgets/progress";
import { promptFromLayout, type PromptLayout } from "../widgets/prompt";
import { splashIntro } from "../widgets/splash";
import { textPages } from "../widgets/text-pages";
import { composerOf } from "./features/composer";
import type { LeadEntry, ScreenPlace, StockServices } from "./features/feature";
import type {
  StockLeafScreen,
  StockOption,
  StockPage,
  StockResult,
  StockScreenSpec,
  StockTreeNode,
} from "./generated/stock-tree";
import { PlaceholderApplication } from "./placeholder";
import {
  EXIT_LEVELS,
  LEVEL_BARS,
  LEVEL_LABELS,
  modelNumber,
  noteEnd,
  noteMoves,
  noteTimelineId,
  numberLine,
  optionListHooks,
  optionListNumbering,
  placeholderOwner,
  PROGRESS_QUITS,
  PROMPT_LAYOUTS,
  promptLayout,
  QUERY_RESULTS,
  SCREENS,
} from "./stock";
import { timelineById, timelineByName } from "./timelines";
import { settingKey, slugOf } from "./tree";
import type { StockSounder } from "../sound/sounder";

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

/** The node's own recording's timeline (or its same-as model's), if any. */
function ownTimeline(number: string): StockWidgetTimeline | undefined {
  const id = WIDGET_TIMELINE_BY_NODE[modelNumber(number)];
  return id === undefined ? undefined : timelineById(id, `node ${number}`);
}

function noteTimeline(number: string, lines: readonly string[]): StockWidgetTimeline | undefined {
  const id = noteTimelineId(WIDGET_TIMELINE_BY_NODE, modelNumber(number), lines);
  return id === undefined ? undefined : timelineById(id, `the note at ${number}`);
}

/**
 * The cursor blink of prompts whose own recording has none (a cursor every ≈480 ms, P9): the
 * Voice mailbox number prompt's.
 */
const CURSOR_STYLE = "2-9";

/** The note digits that match no menu number open (P5); the kernel then goes to standby. */
const INVALID_SHORTCUT = { lines: ["Invalid", "shortcut"], timeline: "invalid-shortcut" };

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

/** The application id of the node at `path`. */
function idOf(path: readonly StockTreeNode[]): string {
  return `stock:${path.map((n) => n.slug).join("/")}`;
}

/**
 * Builds the stock leaves of one menu over one phone's services: its settings store, games
 * holder, security code, sounder (previews and note tones, plan 16) and host ports.
 */
export class LeafBinder {
  readonly #services: StockServices;

  constructor(services: StockServices) {
    this.#services = services;
  }

  /** The application a leaf node opens. */
  application(place: LeafPlace): PhoneApplication {
    const node = place.path[place.path.length - 1]!;
    const id = idOf(place.path);
    const bound = this.#bound(node.number, node.opens, settingKey(place.path));
    if (bound !== undefined) return new StockFlowApplication(id, bound);
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
    const spec = node.opens;
    if (!("lines" in spec)) throw new Error(`Setter ${node.number} opens no note.`);
    const make = this.#screen(node.number, spec, place.moves);
    const settings = this.#services.settings;
    return new StockFlowApplication(idOf(place.path), () => {
      settings.choose(key, index);
      return make();
    });
  }

  /** The entry a feature heads the level at `levelPath` with (Snake II's Continue). */
  lead(levelPath: readonly StockTreeNode[], lead: LeadEntry): PhoneApplication {
    const id = `${idOf(levelPath)}/${lead.slug}`;
    return new StockFlowApplication(id, lead.open(this.#services));
  }

  /** Whether the lead entry is listed now. */
  leadShown(lead: LeadEntry): boolean {
    return lead.shown(this.#services);
  }

  /** The reader of the level at `number`'s children's labels, if a feature has one (plan 27). */
  levelLabel(number: string): ((order: number) => string | undefined) | undefined {
    return LEVEL_LABELS[number]?.(this.#services);
  }

  /**
   * Option `index` of setting `key` where it is not the tree's label: a ringing-tone list's
   * saved Composer tone (options 35-41, plan 27 D8).
   */
  optionLabel(key: string, index: number): string | undefined {
    if (!key.endsWith("/ringing-tone")) return undefined;
    return composerOf(this.#services).ringingToneLabel(index);
  }

  /** A page's value where an option's label is not the tree's (see `optionLabel`). */
  pageValue(key: string): string | undefined {
    if (!key.endsWith("/ringing-tone")) return undefined;
    const chosen = this.#services.settings.choice(key);
    return chosen === null ? undefined : this.optionLabel(key, chosen);
  }

  /** A game level's splash intro (D12). */
  intro(node: StockTreeNode, path: string): PhoneApplication {
    const timeline = ownTimeline(node.number);
    if (timeline === undefined) throw new Error(`No splash timeline for ${node.number}.`);
    return splashIntro(`stock:intro:${path}`, timeline);
  }

  /** The screen a feature implements at node `number` (`SCREENS`), if one does. */
  #bound(
    number: string,
    screen: StockScreenSpec | StockResult,
    key: string,
  ): (() => Widget) | undefined {
    const binding = SCREENS[number];
    if (binding === undefined) return undefined;
    const place: ScreenPlace = { number, screen, key, numbering: optionListNumbering(number) };
    return binding(this.#services, place);
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
    const services = this.#services;
    const sound = services.noteSound;
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
        const fallback: NoteEnd = screen.after === "standby" ? "standby" : "back";
        const end = noteEnd(number);
        // A bound end may depend on the phone (Snake II's Top score returns to Continue while a
        // game is suspended), so it is read when the note opens.
        const endNow = (): NoteEnd =>
          end === undefined ? fallback : typeof end === "function" ? end(services) : end;
        const keys = moves ?? noteMoves(number);
        // A line that shows a numeric setting (Top score) reads it when the note opens.
        const shown = numberLine(number);
        const settings = services.settings;
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
            sound,
          });
      }
      case "progress-note": {
        const timeline = noteTimeline(number, lines);
        if (timeline === undefined) throw new Error(`No widget timeline for ${number}.`);
        const text = lines[0]!;
        const sk = need("a progress note");
        const quitNote = PROGRESS_QUITS[text];
        const quitTimeline = quitNote === undefined ? undefined : timelineByName(quitNote.timeline);
        const quit =
          quitNote === undefined
            ? undefined
            : (flow: Flow) =>
                flow.replace(
                  note({
                    lines: quitNote.lines,
                    timeline: quitTimeline!,
                    end: "standby",
                    sound,
                  }),
                );
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
      case "code-prompt":
      // PIN, PIN2 and barring prompts keep plan 14's first screen (plan 15 D7); the security
      // code's are the security feature's screens.
      case "text-input":
      case "number-input": {
        const layout = layoutOf(number, screen, value);
        const blink = blinkOf(number, layout);
        return () => promptFromLayout(layout, screen, blink);
      }
      case "level-bar": {
        const sk = need("a level bar");
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
      const timeline = timelineByName(result.timeline);
      const sound = this.#services.noteSound;
      make = () => note({ lines: result.lines, timeline, sound });
    } else {
      const blink = timelineById(result.blink, `the prompt after ${number}`);
      const screen = { lines: result.lines, softkey: result.softkey };
      make = () => promptFromLayout(result.layout, screen, blink);
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
    const settings = this.#services.settings;
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
        return this.#choice(`${number}-${i + 1}`, option, key, place.moves, store);
      return (flow) => {
        store();
        flow.back(exitLevels);
      };
    });
    const numbering = optionListNumbering(number);
    // Plan 16: key beeps and previews, from the feature that hooks this setting (tones).
    const hooks = optionListHooks(key, this.#services);
    return () =>
      new OptionListWidget({
        // Plan 27 (D8): a ringing-tone list names the Composer's saved tones as it opens.
        labels: labels.map((label, i) => this.optionLabel(key, i) ?? label),
        softkey: spec.softkey,
        opening: settings.choice(key),
        numbering,
        choose: (index, flow) => choices[index]!(flow),
        ...hooks,
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
    key: string,
    moves: NoteOptions["moves"],
    store: () => void,
  ): (flow: Flow) => void {
    const owner = placeholderOwner(number);
    if (owner !== undefined) return (flow) => flow.replace(placeholderWidget(option.label));
    const result: StockResult = option.result;
    const bound = this.#bound(number, result, key);
    if (bound !== undefined) return (flow) => flow.replace(bound());
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
    const settings = this.#services.settings;
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
    const bound = this.#bound(number, result, pageKey);
    if (bound !== undefined) return bound;
    if ("lines" in result) return this.#screen(number, result);
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

/**
 * The note digits that match no menu number open; the kernel goes to standby after it (P5). It
 * sounds its warning tone through `sounder` (D12).
 */
export function invalidShortcut(sounder: StockSounder): PhoneApplication {
  const timeline = timelineByName(INVALID_SHORTCUT.timeline);
  return new StockFlowApplication("stock:invalid-shortcut", () =>
    note({ lines: INVALID_SHORTCUT.lines, timeline, sound: (lines) => sounder.note(lines) }),
  );
}
