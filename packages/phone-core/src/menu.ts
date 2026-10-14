import { PhoneApplication } from "./application";
import { Timeline } from "./timeline";
import type { MenuListItem } from "./types";

const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class MenuSlug {
  readonly value: string;

  constructor(value: string) {
    if (!KEBAB_CASE.test(value)) {
      throw new Error(`Menu slug "${value}" must be non-empty kebab-case.`);
    }
    this.value = value;
    Object.freeze(this);
  }

  toString(): string {
    return this.value;
  }
}

export class MenuOrder {
  readonly value: number;

  constructor(value: number) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`Menu order "${value}" must be a positive integer.`);
    }
    this.value = value;
    Object.freeze(this);
  }
}

/**
 * How a carousel slot became visible: `enter` (menu opened from standby or by path navigation),
 * `next` (▼), `previous` (▲), `return` (back from a deeper screen).
 */
export type CarouselReveal = "enter" | "next" | "previous" | "return";

const CAROUSEL_REVEALS: readonly CarouselReveal[] = ["enter", "next", "previous", "return"];

export interface MenuGraphicOptions {
  /** Timelines that replace the default one for particular reveals (requires a default). */
  reveals?: Partial<Record<CarouselReveal, Timeline>>;
}

export class MenuGraphic {
  readonly id: string;
  /** Default timeline, restarted whenever the slot is revealed; undefined = static graphic. */
  readonly timeline: Timeline | undefined;
  readonly #reveals: Partial<Record<CarouselReveal, Timeline>>;

  constructor(id: string, timeline?: Timeline, options: MenuGraphicOptions = {}) {
    if (id.trim() === "") throw new Error("Menu graphic id must be a non-empty identifier.");
    if (timeline !== undefined && !(timeline instanceof Timeline)) {
      throw new Error(`Menu graphic "${id}" timeline must be a Timeline.`);
    }
    const reveals: Partial<Record<CarouselReveal, Timeline>> = {};
    for (const [reveal, revealTimeline] of Object.entries(options.reveals ?? {})) {
      if (!CAROUSEL_REVEALS.includes(reveal as CarouselReveal)) {
        throw new Error(`Menu graphic "${id}" has an unknown reveal "${reveal}".`);
      }
      if (!(revealTimeline instanceof Timeline)) {
        throw new Error(`Menu graphic "${id}" reveal "${reveal}" must be a Timeline.`);
      }
      reveals[reveal as CarouselReveal] = revealTimeline;
    }
    if (timeline === undefined && Object.keys(reveals).length > 0) {
      throw new Error(`Menu graphic "${id}" needs a default timeline to override per reveal.`);
    }
    this.id = id;
    this.timeline = timeline;
    this.#reveals = Object.freeze(reveals);
    Object.freeze(this);
  }

  /** The timeline played when the slot is revealed by `reveal`; undefined for a static graphic. */
  timelineFor(reveal: CarouselReveal): Timeline | undefined {
    return this.#reveals[reveal] ?? this.timeline;
  }
}

export interface MenuEntryVisitor<Metadata, Result> {
  visitSubmenu(entry: SubmenuEntry<Metadata>): Result;
  visitList(entry: ListEntry<Metadata>): Result;
  visitReader(entry: ReaderEntry<Metadata>): Result;
  visitAction(entry: ActionEntry<Metadata>): Result;
  visitApplication(entry: ApplicationEntry<Metadata>): Result;
}

export abstract class MenuEntry<Metadata = unknown> {
  readonly slug: MenuSlug;
  readonly order: MenuOrder;
  readonly label: string;
  readonly metadata: Metadata | undefined;

  protected constructor(slug: MenuSlug, order: MenuOrder, label: string, metadata?: Metadata) {
    if (!(slug instanceof MenuSlug)) throw new Error("Menu entry requires a valid slug.");
    if (!(order instanceof MenuOrder)) throw new Error("Menu entry requires a valid order.");
    if (label.trim() === "") throw new Error("Menu entry label must be non-empty.");
    this.slug = slug;
    this.order = order;
    this.label = label;
    this.metadata = metadata;
  }

  abstract accept<Result>(visitor: MenuEntryVisitor<Metadata, Result>): Result;
}

/** How a submenu level is drawn: a list of rows, or one item per screen. */
export type MenuPresentation = "rows" | "pages";

export interface SubmenuOptions<Metadata = unknown> {
  presentation?: MenuPresentation; // default "rows"
  /**
   * Current-value text for a child (e.g. "Off"); undefined = none. Opaque host function.
   * Method syntax keeps SubmenuEntry covariant in Metadata, like the other entry kinds.
   */
  detail?(child: MenuEntry<Metadata>): string | undefined;
  /** Softkey label on this level. Default "Select"; must be non-empty. */
  softkey?: string;
  /**
   * The child selected when the level is entered by Select, a shortcut digit or a path that ends
   * at the level; re-read on every entry. Undefined or not a child = the first child.
   */
  opening?(): MenuEntry<Metadata> | undefined;
  /**
   * Runs when the level is entered with Select (and when a `shortcutEntry` digit selects it),
   * before its list. While it runs the path is the level's path; its exit() reveals the list.
   * Paths that land on the level, per-digit shortcuts and returns from a child skip it. Must not
   * be the level's own child application.
   */
  intro?: PhoneApplication;
  /**
   * For this long after the level is entered with Select, its menu indicator shows the level's
   * own path as `entering` instead of the selection's number; any key ends it early. Paths that
   * land on the level, shortcuts, intros and returns from a child do not show it. Default 0
   * (none); a non-negative integer.
   */
  entryIndicatorMs?: number;
  /**
   * Whether `child` is shown; re-read when the level's list is built and on every tick. Hidden
   * children are skipped by display, ▲/▼, the rows window, shortcuts and `opening()`, and a path
   * that lands on one falls back to the level. A level with `shown` numbers its shown children by
   * position (1..n) instead of by MenuOrder. At least one child must be shown. Default: every
   * child shown, numbered by order. Method syntax keeps SubmenuEntry covariant in Metadata.
   */
  shown?(child: MenuEntry<Metadata>): boolean;
}

export class SubmenuEntry<Metadata = unknown> extends MenuEntry<Metadata> {
  readonly children: MenuLevel<Metadata>;
  readonly presentation: MenuPresentation;
  /** Softkey label on this level's list. */
  readonly softkey: string;
  /** Application run before the list on Select-entry; undefined = none. */
  readonly intro: PhoneApplication | undefined;
  /** How long the entering indicator shows after Select-entry; 0 = never. */
  readonly entryIndicatorMs: number;
  readonly #options: SubmenuOptions<Metadata>;

  constructor(
    slug: MenuSlug,
    order: MenuOrder,
    label: string,
    children: MenuLevel<Metadata>,
    metadata?: Metadata,
    options: SubmenuOptions<Metadata> = {},
  ) {
    super(slug, order, label, metadata);
    if (!(children instanceof MenuLevel)) throw new Error("Submenu entry requires a menu level.");
    const presentation = options.presentation ?? "rows";
    if (presentation !== "rows" && presentation !== "pages") {
      throw new Error(`Submenu presentation "${String(presentation)}" must be "rows" or "pages".`);
    }
    if (options.detail !== undefined && typeof options.detail !== "function") {
      throw new Error("Submenu detail must be a function.");
    }
    const softkey = options.softkey ?? "Select";
    if (typeof softkey !== "string" || softkey.trim() === "") {
      throw new Error("Submenu softkey must be a non-empty string.");
    }
    if (options.opening !== undefined && typeof options.opening !== "function") {
      throw new Error("Submenu opening must be a function.");
    }
    const { intro } = options;
    if (intro !== undefined) {
      if (!(intro instanceof PhoneApplication)) {
        throw new Error("Submenu intro must be an application definition.");
      }
      const own = children.entries.some(
        (child) => child instanceof ApplicationEntry && child.application === intro,
      );
      if (own) throw new Error("Submenu intro must not be one of the level's own applications.");
    }
    if (options.shown !== undefined && typeof options.shown !== "function") {
      throw new Error("Submenu shown must be a function.");
    }
    const entryIndicatorMs = options.entryIndicatorMs ?? 0;
    if (!Number.isInteger(entryIndicatorMs) || entryIndicatorMs < 0) {
      throw new Error(
        `Submenu entryIndicatorMs must be a non-negative integer (received ${entryIndicatorMs}).`,
      );
    }
    this.children = children;
    this.presentation = presentation;
    this.entryIndicatorMs = entryIndicatorMs;
    this.softkey = softkey;
    this.intro = intro;
    this.#options = { ...options };
    Object.freeze(this);
  }

  /** The host detail reader's text for `child`; undefined without a reader or a string value. */
  detailOf(child: MenuEntry<Metadata>): string | undefined {
    const value = this.#options.detail?.(child);
    return typeof value === "string" ? value : undefined;
  }

  /** The child selected on entry: the opening reader's child if shown, else the first shown. */
  openingChild(): MenuEntry<Metadata> | undefined {
    const child = this.#options.opening?.();
    const shown = this.shownChildren();
    return child !== undefined && shown.includes(child) ? child : shown[0];
  }

  /** True when the level has a `shown` reader: its children are numbered by position. */
  get numbersByPosition(): boolean {
    return this.#options.shown !== undefined;
  }

  /** The children shown now (all of them without a `shown` reader); throws when none is. */
  shownChildren(): readonly MenuEntry<Metadata>[] {
    const all = this.children.entries;
    if (this.#options.shown === undefined || all.length === 0) return all;
    const shown = all.filter((child) => this.#options.shown!(child) === true);
    if (shown.length === 0) {
      throw new Error(`Submenu "${this.slug.value}" shows none of its children.`);
    }
    return shown;
  }

  /**
   * The menu number of `child` in this level: its order, or with `shown` its position among the
   * shown children (a hidden child counts as if shown, after the shown ones before it).
   */
  numberOf(child: MenuEntry<Metadata>): number {
    if (this.#options.shown === undefined) return child.order.value;
    const shown = this.shownChildren();
    return shown.filter((entry) => entry.order.value < child.order.value).length + 1;
  }

  accept<Result>(visitor: MenuEntryVisitor<Metadata, Result>): Result {
    return visitor.visitSubmenu(this);
  }
}

export class ListEntry<Metadata = unknown> extends MenuEntry<Metadata> {
  readonly source: MenuListSource;

  constructor(
    slug: MenuSlug,
    order: MenuOrder,
    label: string,
    source: MenuListSource,
    metadata?: Metadata,
  ) {
    super(slug, order, label, metadata);
    if (source === null || typeof source?.read !== "function") {
      throw new Error("List entry requires a menu list source.");
    }
    this.source = source;
    Object.freeze(this);
  }

  accept<Result>(visitor: MenuEntryVisitor<Metadata, Result>): Result {
    return visitor.visitList(this);
  }
}

export class ReaderEntry<Metadata = unknown> extends MenuEntry<Metadata> {
  readonly body: string;

  constructor(slug: MenuSlug, order: MenuOrder, label: string, body: string, metadata?: Metadata) {
    super(slug, order, label, metadata);
    this.body = body;
    Object.freeze(this);
  }

  accept<Result>(visitor: MenuEntryVisitor<Metadata, Result>): Result {
    return visitor.visitReader(this);
  }
}

type MenuAction = { kind: "href"; value: string };

export class ActionEntry<Metadata = unknown> extends MenuEntry<Metadata> {
  readonly action: MenuAction;

  constructor(
    slug: MenuSlug,
    order: MenuOrder,
    label: string,
    action: MenuAction,
    metadata?: Metadata,
  ) {
    super(slug, order, label, metadata);
    if (action?.kind !== "href" || typeof action.value !== "string") {
      throw new Error("Action entry requires an href action.");
    }
    this.action = Object.freeze({ kind: "href", value: action.value });
    Object.freeze(this);
  }

  accept<Result>(visitor: MenuEntryVisitor<Metadata, Result>): Result {
    return visitor.visitAction(this);
  }
}

export class ApplicationEntry<Metadata = unknown> extends MenuEntry<Metadata> {
  readonly application: PhoneApplication;

  constructor(
    slug: MenuSlug,
    order: MenuOrder,
    label: string,
    application: PhoneApplication,
    metadata?: Metadata,
  ) {
    super(slug, order, label, metadata);
    if (!(application instanceof PhoneApplication)) {
      throw new Error("Application entry requires an application definition.");
    }
    this.application = application;
    Object.freeze(this);
  }

  accept<Result>(visitor: MenuEntryVisitor<Metadata, Result>): Result {
    return visitor.visitApplication(this);
  }
}

/**
 * Sorts siblings by order and rejects duplicates. A submenu level may skip a number: the
 * firmware keeps a hidden entry's menu number (Call divert shows 1-4 then 6). Top-level orders
 * stay contiguous because the carousel's position is its menu number.
 */
function canonicalEntries<Metadata>(
  entries: readonly MenuEntry<Metadata>[],
  { contiguous }: { contiguous: boolean },
): readonly MenuEntry<Metadata>[] {
  for (const entry of entries) {
    const concrete =
      entry instanceof SubmenuEntry ||
      entry instanceof ListEntry ||
      entry instanceof ReaderEntry ||
      entry instanceof ActionEntry ||
      entry instanceof ApplicationEntry;
    if (!concrete) throw new Error("Menu levels may contain only concrete phone-core entries.");
  }
  const sorted = [...entries].sort((left, right) => left.order.value - right.order.value);
  const slugs = new Set<string>();
  const orders = new Set<number>();

  for (const entry of sorted) {
    if (slugs.has(entry.slug.value)) {
      throw new Error(`Duplicate sibling menu slug "${entry.slug.value}".`);
    }
    if (orders.has(entry.order.value)) {
      throw new Error(`Duplicate sibling menu order ${entry.order.value}.`);
    }
    slugs.add(entry.slug.value);
    orders.add(entry.order.value);
  }

  for (const [index, entry] of sorted.entries()) {
    if (!contiguous) break;
    const expected = index + 1;
    if (entry.order.value !== expected) {
      throw new Error(
        `Sibling menu orders must be contiguous from 1; expected ${expected}, received ${entry.order.value}.`,
      );
    }
  }
  return Object.freeze(sorted);
}

export class MenuLevel<Metadata = unknown> implements Iterable<MenuEntry<Metadata>> {
  readonly entries: readonly MenuEntry<Metadata>[];

  constructor(entries: readonly MenuEntry<Metadata>[]) {
    this.entries = canonicalEntries(entries, { contiguous: false });
    Object.freeze(this);
  }

  bySlug(slug: string): MenuEntry<Metadata> | undefined {
    return this.entries.find((entry) => entry.slug.value === slug);
  }

  byOrder(order: number): MenuEntry<Metadata> | undefined {
    return this.entries.find((entry) => entry.order.value === order);
  }

  [Symbol.iterator](): Iterator<MenuEntry<Metadata>> {
    return this.entries[Symbol.iterator]();
  }
}

export class TopLevelEntry<Metadata = unknown> {
  readonly entry: MenuEntry<Metadata>;
  readonly graphic: MenuGraphic;

  constructor(entry: MenuEntry<Metadata>, graphic: MenuGraphic) {
    if (!(entry instanceof MenuEntry)) throw new Error("Top-level slot requires a menu entry.");
    if (!(graphic instanceof MenuGraphic)) {
      throw new Error("Top-level menu entry requires a graphic.");
    }
    this.entry = entry;
    this.graphic = graphic;
    Object.freeze(this);
  }
}

function childEntries<Metadata>(entry: MenuEntry<Metadata>): readonly MenuEntry<Metadata>[] {
  return entry instanceof SubmenuEntry ? entry.children.entries : [];
}

function validateTopology<Metadata>(roots: readonly MenuEntry<Metadata>[]): void {
  const active = new Set<MenuEntry<Metadata>>();
  const visited = new Set<MenuEntry<Metadata>>();

  const visit = (entry: MenuEntry<Metadata>): void => {
    if (active.has(entry)) {
      throw new Error(`Menu topology contains a cycle at entry "${entry.slug.value}".`);
    }
    if (visited.has(entry)) {
      throw new Error(`Menu entry "${entry.slug.value}" is reused in multiple locations.`);
    }
    active.add(entry);
    visited.add(entry);
    for (const child of childEntries(entry)) visit(child);
    active.delete(entry);
  };

  for (const root of roots) visit(root);
}

function normalizedSegments(path: string): string[] | null {
  const normalized = path.trim().replace(/^\/+|\/+$/g, "");
  if (normalized === "" || normalized === "standby") return null;
  const segments = normalized.split("/");
  if (segments[0] !== "menu" || segments.some((segment) => segment === "")) return null;
  return segments;
}

export class PhoneMenu<Metadata = unknown> {
  readonly entries: readonly TopLevelEntry<Metadata>[];
  readonly #paths: readonly string[];

  constructor(entries: readonly TopLevelEntry<Metadata>[]) {
    if (entries.some((slot) => !(slot instanceof TopLevelEntry))) {
      throw new Error("Phone menu requires top-level entry slots with graphics.");
    }
    const byEntry = new Map(entries.map((slot) => [slot.entry, slot]));
    const canonical = canonicalEntries(
      entries.map((slot) => slot.entry),
      { contiguous: true },
    );
    this.entries = Object.freeze(canonical.map((entry) => byEntry.get(entry)!));
    validateTopology(canonical);

    const paths = ["menu"];
    const collect = (level: readonly MenuEntry<Metadata>[], prefix: string): void => {
      for (const entry of level) {
        const path = `${prefix}/${entry.slug.value}`;
        paths.push(path);
        collect(childEntries(entry), path);
      }
    };
    collect(canonical, "menu");
    this.#paths = Object.freeze(paths);
    Object.freeze(this);
  }

  resolve(path: string): readonly MenuEntry<Metadata>[] | null {
    const segments = normalizedSegments(path);
    if (segments === null) return null;
    const chain: MenuEntry<Metadata>[] = [];
    let level = this.entries.map((slot) => slot.entry);
    for (const segment of segments.slice(1)) {
      const entry = level.find((candidate) => candidate.slug.value === segment);
      if (entry === undefined) return null;
      chain.push(entry);
      level = [...childEntries(entry)];
    }
    return Object.freeze(chain);
  }

  paths(): readonly string[] {
    return this.#paths;
  }

  isValidPath(path: string): boolean {
    const normalized = path.trim().replace(/^\/+|\/+$/g, "");
    return normalized === "" || normalized === "standby" || this.resolve(path) !== null;
  }

  walk<Result>(visitor: MenuEntryVisitor<Metadata, Result>): readonly Result[] {
    const results: Result[] = [];
    const visit = (entry: MenuEntry<Metadata>): void => {
      results.push(entry.accept(visitor));
      for (const child of childEntries(entry)) visit(child);
    };
    for (const slot of this.entries) visit(slot.entry);
    return Object.freeze(results);
  }
}

export interface MenuListSource {
  read(): readonly MenuListItem[];
}

function listSnapshot(items: readonly MenuListItem[]): readonly MenuListItem[] {
  if (!Array.isArray(items)) throw new Error("Menu list source must return an item array.");
  const ids = new Set<string>();
  const snapshot = items.map((item) => {
    if (typeof item?.id !== "string" || item.id.trim() === "") {
      throw new Error("Menu list item id must be non-empty.");
    }
    if (ids.has(item.id)) throw new Error(`Duplicate menu list item id "${item.id}".`);
    ids.add(item.id);
    return Object.freeze({ id: item.id, label: item.label, body: item.body });
  });
  return Object.freeze(snapshot);
}

export class StaticMenuListSource implements MenuListSource {
  readonly #snapshot: readonly MenuListItem[];

  constructor(items: readonly MenuListItem[]) {
    this.#snapshot = listSnapshot(items);
    Object.freeze(this);
  }

  read(): readonly MenuListItem[] {
    return this.#snapshot;
  }
}

export class DynamicMenuListSource implements MenuListSource {
  readonly #reader: () => readonly MenuListItem[];

  constructor(reader: () => readonly MenuListItem[]) {
    if (typeof reader !== "function")
      throw new Error("Dynamic menu list source requires a reader.");
    this.#reader = reader;
    Object.freeze(this);
  }

  read(): readonly MenuListItem[] {
    return listSnapshot(this.#reader());
  }
}
