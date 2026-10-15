import { PhoneApplication } from "./application";
import type {
  ApplicationContext,
  DeactivationReason,
  ExitOptions,
  PhoneApplicationSession,
} from "./application";
import { SubmenuEntry } from "./menu";
import type {
  ActionEntry,
  ApplicationEntry,
  CarouselReveal,
  ListEntry,
  MenuEntry,
  MenuEntryVisitor,
  ReaderEntry,
} from "./menu";
import { normalizePath, parsePath, resolveIds } from "./paths";
import { Timeline } from "./timeline";
import { rowsWindowTop } from "./window";
import type {
  BootGate,
  KeyEvent,
  MenuIndicator,
  MenuListItem,
  Phone,
  PhoneConfig,
  PhoneEventMap,
  PhoneKey,
  PhoneSnapshot,
  ScreenModel,
  StandbyIndicators,
} from "./types";

export const LONG_PRESS_MS = 800;
export const SHORTCUT_WINDOW_MS = 3000;
export const BOOT_FRAME_MS = 200;
export const DEFAULT_BOOT_MS = 3000;
export const READER_VISIBLE_LINES = 3;
export const READER_LINE_CHARS = 14;

/**
 * The carousel slot on screen. Its graphic's timeline (chosen by `reveal`) runs from `revealedAt`;
 * every reveal restarts it.
 */
interface CarouselFrame {
  kind: "carousel";
  index: number;
  reveal: CarouselReveal;
  revealedAt: number;
}

/** One level of the navigation stack. stack[0] is always the menu carousel. */
type NavFrame<Metadata> =
  | CarouselFrame
  | {
      kind: "submenu";
      entry: SubmenuEntry<Metadata>;
      selected: number;
      /** First visible row; set only for rows levels when PhoneConfig.rowsWindow is on. */
      windowTop: number | undefined;
      /** Until when the entering indicator shows (SubmenuOptions.entryIndicatorMs). */
      enteringUntil: number;
      /** The shown children's slugs when `selected` and `windowTop` were last fitted to them. */
      shownKey: string;
    }
  | {
      kind: "list";
      entry: ListEntry<Metadata>;
      selectedId: string | null;
      fallbackIndex: number;
    }
  | { kind: "item"; entry: ListEntry<Metadata>; item: MenuListItem; scrollTop: number }
  | { kind: "reader"; entry: ReaderEntry<Metadata>; scrollTop: number }
  | { kind: "action"; entry: ActionEntry<Metadata> };

type DisplayNavFrame<Metadata> = Exclude<NavFrame<Metadata>, { kind: "action" }>;
type SubmenuFrame<Metadata> = Extract<NavFrame<Metadata>, { kind: "submenu" }>;

/**
 * What launched an application: a menu entry (its slug ends the path), a level's intro (the
 * level's frame tops the stack, so the path is the level's) or the stock invalid-shortcut note.
 */
type ActivationOrigin<Metadata> =
  | { kind: "entry"; entry: ApplicationEntry<Metadata> }
  | { kind: "intro"; viaShortcut: boolean }
  | { kind: "invalid" }
  | { kind: "gate"; boot: HeldBoot }
  /** Plan 18: a standby notice's application (PhoneConfig setNotice `open`). */
  | { kind: "notice" }
  /** Plan 17: the power key's standby application (PhoneConfig.standbyPower). */
  | { kind: "power" };

/** A boot held by a gate (PhoneConfig.bootGates): where it resumes and what follows. */
interface HeldBoot {
  /** The boot offset the gate holds; exit() resumes the boot clock here. */
  atMs: number;
  /** Index of the next gate to ask. */
  nextGate: number;
  /** A navigate() target recorded during the boot, applied when it ends. */
  targetPath: string | null;
}

interface AppActivation<Metadata> {
  origin: ActivationOrigin<Metadata>;
  definition: PhoneApplication;
  session: PhoneApplicationSession | null;
  activationToken: object;
  stack: NavFrame<Metadata>[];
  deactivationReason: DeactivationReason | null;
  deactivated: boolean;
}

type Mode<Metadata> =
  | { kind: "off" }
  | { kind: "boot"; startedAt: number; targetPath: string | null; nextGate: number }
  | { kind: "standby" }
  | { kind: "nav"; stack: NavFrame<Metadata>[] }
  | { kind: "app"; activation: AppActivation<Metadata> };

interface HeldKey {
  downAt: number;
  longFired: boolean;
  shortcutCaptured: boolean;
}

type Notice = { text: string; softkey: string; path?: string; open?: PhoneApplication };

/** A level's entries with their menu numbers (orders, or positions under SubmenuOptions.shown). */
type Numbered<Metadata> = readonly { entry: MenuEntry<Metadata>; number: number }[];

/** Plan 13 shortcuts: one digit (1-9) per level, each entering its entry at once. */
interface DigitShortcut<Metadata> {
  kind: "digits";
  entries: MenuEntry<Metadata>[];
  nextLevel: Numbered<Metadata>;
  deadline: number;
}

/** PhoneConfig.shortcutEntry: digits form menu numbers; a selected entry opens after a delay. */
interface StockShortcut<Metadata> {
  kind: "stock";
  /** Digits typed toward the next menu number at the current level. */
  digits: string;
  /** End of the digit window. */
  deadline: number;
  /** The typed entry (the selection of the shown level) and when it opens. */
  pending: { entry: MenuEntry<Metadata>; openAt: number } | null;
  /** Digits resolved at the window end, still shown until their entry opens. */
  resolvedDigits: string | undefined;
}

type Shortcut<Metadata> = DigitShortcut<Metadata> | StockShortcut<Metadata>;

/** Clamp an index into [0, length-1] (0 for an empty list). */
function clampIndex(index: number, length: number): number {
  return length === 0 ? 0 : Math.min(Math.max(0, index), length - 1);
}

interface Machine<Metadata> {
  config: PhoneConfig<Metadata>;
  carrier: string;
  bootMs: number;
  bootTimeline: Timeline | undefined;
  bootGates: readonly BootGate[];
  menuOpenDelayMs: number;
  shortcutWindowMs: number;
  /** Rows per circular window (PhoneConfig.rowsWindow); undefined = no window state. */
  rowsWindow: number | undefined;
  /** Last time seen via tick(nowMs). The machine's ONLY clock. */
  now: number;
  mode: Mode<Metadata>;
  /** Standby-scoped notice — survives menu round-trips until read/cleared. */
  notice: Notice | null;
  /**
   * The standby mode object last seen and when it was entered (PhoneConfig.standbyLine's
   * `shownMs`): every entry into standby makes a new mode object.
   */
  standbyMode: Mode<Metadata> | null;
  standbySince: number;
  held: Map<PhoneKey, HeldKey>;
  shortcut: Shortcut<Metadata> | null;
  shortcutEntry: { openDelayMs: number; invalid: PhoneApplication } | undefined;
  runDepth: number;
  notifying: boolean;
  deferredRuns: (() => void)[];
  dirty: boolean;
  /** tickSignature() at the last snapshot; a tick that changes it emits a new snapshot. */
  shownSignature: string;
  subscribers: Set<(snap: PhoneSnapshot) => void>;
  listeners: { [K in keyof PhoneEventMap]: Set<PhoneEventMap[K]> };
}

function emit<Metadata, K extends keyof PhoneEventMap>(
  m: Machine<Metadata>,
  ev: K,
  arg: Parameters<PhoneEventMap[K]>[0],
): void {
  const set = m.listeners[ev] as Set<(value: Parameters<PhoneEventMap[K]>[0]) => void>;
  const wasNotifying = m.notifying;
  m.notifying = true;
  try {
    for (const cb of set) {
      try {
        cb(arg);
      } catch {
        // Host listeners cannot be allowed to corrupt firmware state.
      }
    }
  } finally {
    m.notifying = wasNotifying;
  }
}

function run<Metadata>(m: Machine<Metadata>, fn: () => void): void {
  if (m.notifying) {
    m.deferredRuns.push(fn);
    return;
  }
  if (m.runDepth > 0) {
    fn();
    return;
  }
  runOnce(m, fn);
  while (m.deferredRuns.length > 0) runOnce(m, m.deferredRuns.shift()!);
}

function runOnce<Metadata>(m: Machine<Metadata>, fn: () => void): void {
  const before = currentPath(m);
  m.runDepth += 1;
  try {
    fn();
  } finally {
    m.runDepth -= 1;
  }
  noteStandbyEntry(m);
  const after = currentPath(m);
  if (after !== before) {
    m.dirty = true;
    emit(m, "pathchange", after);
  }
  const signature = tickSignature(m);
  if (signature !== m.shownSignature) m.dirty = true;
  if (!m.dirty) return;
  m.dirty = false;
  m.shownSignature = signature;
  const snap = snapshot(m);
  const wasNotifying = m.notifying;
  m.notifying = true;
  try {
    for (const cb of m.subscribers) {
      try {
        cb(snap);
      } catch {
        // Host subscribers cannot be allowed to corrupt firmware state.
      }
    }
  } finally {
    m.notifying = wasNotifying;
  }
}

/** Records when standby was entered: a standby mode object not seen before. */
function noteStandbyEntry<Metadata>(m: Machine<Metadata>): void {
  if (m.mode.kind !== "standby" || m.mode === m.standbyMode) return;
  m.standbyMode = m.mode;
  m.standbySince = m.now;
}

/** Re-enters standby (a notice cleared): the standby line's time restarts. */
function reenterStandby<Metadata>(m: Machine<Metadata>): void {
  if (m.mode.kind === "standby") m.mode = { kind: "standby" };
  m.dirty = true;
}

/**
 * Screen state that changes with time or host values but has no other change trigger: timeline
 * frames, the carousel opening after its delay, the standby clock and a submenu detail. Comparing
 * it after every run emits a snapshot exactly when one of them changes, never on idle ticks.
 */
function tickSignature<Metadata>(m: Machine<Metadata>): string {
  switch (m.mode.kind) {
    case "boot":
      return m.bootTimeline === undefined
        ? ""
        : `boot:${m.bootTimeline.frameAt(m.now - m.mode.startedAt)}`;
    case "standby":
      return `standby:${standbySignature(m)}`;
    case "nav": {
      const frame = shownNavFrame(m.mode.stack);
      if (frame?.kind === "carousel") {
        if (m.now < frame.revealedAt) {
          return `opening:${standbySignature(m)}`;
        }
        const iconFrame = carouselIconFrame(m, frame);
        return iconFrame === undefined ? "" : `icon:${frame.index}:${iconFrame}`;
      }
      if (frame?.kind === "submenu") {
        const shown = shownKeyOf(frame.entry);
        const labels = shownChildrenOf(m, frame).map((child) => labelIn(frame.entry, child));
        return `detail:${JSON.stringify(submenuDetail(frame))}:${entering(m)}:${shown}:${JSON.stringify(labels)}:${frameTitle(m.mode.stack, frame)}`;
      }
      return frame === undefined ? "" : `title:${frameTitle(m.mode.stack, frame)}`;
    }
    default:
      return "";
  }
}

/** The frame drawn for a navigation stack: its top, or the parent of a top action frame. */
function shownNavFrame<Metadata>(
  stack: readonly NavFrame<Metadata>[],
): DisplayNavFrame<Metadata> | undefined {
  const top = stack[stack.length - 1];
  const shown = top?.kind === "action" ? stack[stack.length - 2] : top;
  return shown?.kind === "action" ? undefined : shown;
}

/** The text `child` shows in `level` (SubmenuOptions.label); a failing reader shows its own. */
function labelIn<Metadata>(level: SubmenuEntry<Metadata>, child: MenuEntry<Metadata>): string {
  try {
    return level.labelOf(child);
  } catch {
    return child.label;
  }
}

/** The label a level, list or reader frame shows as its title: as its parent level labels it. */
function frameTitle<Metadata>(
  stack: readonly NavFrame<Metadata>[],
  frame: DisplayNavFrame<Metadata>,
): string {
  if (frame.kind === "carousel") return "";
  if (frame.kind === "item") return frame.item.label;
  const parent = stack[stack.indexOf(frame) - 1];
  return parent?.kind === "submenu" ? labelIn(parent.entry, frame.entry) : frame.entry.label;
}

/** The selected child's value from the submenu's detail reader, when it returns a string. */
function submenuDetail<Metadata>(frame: SubmenuFrame<Metadata>): string | undefined {
  const child = frame.entry.children.entries[frame.selected];
  return child === undefined ? undefined : frame.entry.detailOf(child);
}

function shownKeyOf<Metadata>(entry: SubmenuEntry<Metadata>): string {
  return entry.numbersByPosition
    ? entry
        .shownChildren()
        .map((child) => child.slug.value)
        .join("/")
    : "";
}

/**
 * The level's shown children, after fitting the frame to them (SubmenuOptions.shown is re-read):
 * a selected child that became hidden gives way to the first shown child, and a change in the
 * shown children rebuilds the rows window at the selection.
 */
function shownChildrenOf<Metadata>(
  m: Machine<Metadata>,
  frame: SubmenuFrame<Metadata>,
): readonly MenuEntry<Metadata>[] {
  const shown = frame.entry.shownChildren();
  const key = shownKeyOf(frame.entry);
  if (key === frame.shownKey) return shown;
  frame.shownKey = key;
  const all = frame.entry.children.entries;
  if (shown.length > 0 && !shown.includes(all[frame.selected]!)) {
    frame.selected = all.indexOf(shown[0]!);
  }
  if (frame.windowTop !== undefined && m.rowsWindow !== undefined) {
    frame.windowTop = rowsWindowTop(
      undefined,
      shown.indexOf(all[frame.selected]!),
      shown.length,
      m.rowsWindow,
    );
  }
  return shown;
}

/** The menu number of `entry` in the level shown by `parent` (the carousel: its order). */
function numberIn<Metadata>(
  parent: NavFrame<Metadata> | undefined,
  entry: MenuEntry<Metadata>,
): number {
  return parent?.kind === "submenu" ? parent.entry.numberOf(entry) : entry.order.value;
}

/** An entry's children with their menu numbers; none for leaves. */
function numberedChildren<Metadata>(entry: MenuEntry<Metadata>): Numbered<Metadata> {
  if (!(entry instanceof SubmenuEntry)) return [];
  return entry.shownChildren().map((child) => ({ entry: child, number: entry.numberOf(child) }));
}

function numberedTopLevel<Metadata>(m: Machine<Metadata>): Numbered<Metadata> {
  return m.config.menu.entries.map((slot) => ({
    entry: slot.entry,
    number: slot.entry.order.value,
  }));
}

function carouselIconFrame<Metadata>(
  m: Machine<Metadata>,
  frame: CarouselFrame,
): number | undefined {
  const timeline = m.config.menu.entries[frame.index]!.graphic.timelineFor(frame.reveal);
  return timeline?.frameAt(m.now - frame.revealedAt);
}

function carouselFrame<Metadata>(
  m: Machine<Metadata>,
  index: number,
  reveal: CarouselReveal,
): CarouselFrame {
  return { kind: "carousel", index, reveal, revealedAt: m.now };
}

/** A submenu level as entered: its window starts at the selection (plan 14 D3). */
function submenuFrame<Metadata>(
  m: Machine<Metadata>,
  entry: SubmenuEntry<Metadata>,
  selected: number,
): SubmenuFrame<Metadata> {
  const frame: SubmenuFrame<Metadata> = {
    kind: "submenu",
    entry,
    selected,
    windowTop: undefined,
    enteringUntil: 0,
    shownKey: "",
  };
  shownChildrenOf(m, frame); // a hidden `selected` gives way to the first shown child
  enterWindow(m, frame);
  return frame;
}

/** Rebuild a rows level's window with the entry rule (the selection on the top row). */
function enterWindow<Metadata>(m: Machine<Metadata>, frame: SubmenuFrame<Metadata>): void {
  if (m.rowsWindow === undefined || frame.entry.presentation !== "rows") return;
  const shown = shownChildrenOf(m, frame);
  const selected = shown.indexOf(frame.entry.children.entries[frame.selected]!);
  frame.windowTop = rowsWindowTop(undefined, selected, shown.length, m.rowsWindow);
}

/** Move a level's selection `step` shown children on (wrapping), keeping its window. */
function stepSelection<Metadata>(
  m: Machine<Metadata>,
  frame: SubmenuFrame<Metadata>,
  step: number,
): void {
  const shown = shownChildrenOf(m, frame);
  const all = frame.entry.children.entries;
  const selected = wrapIndex(shown.indexOf(all[frame.selected]!) + step, shown.length);
  frame.selected = all.indexOf(shown[selected]!);
  if (frame.windowTop !== undefined && m.rowsWindow !== undefined) {
    frame.windowTop = rowsWindowTop(
      frame.windowTop,
      selected,
      shown.length,
      m.rowsWindow,
      step > 0 ? "down" : "up",
    );
  }
  m.dirty = true;
}

function revealCarousel<Metadata>(
  m: Machine<Metadata>,
  frame: CarouselFrame,
  reveal: CarouselReveal,
): void {
  frame.reveal = reveal;
  frame.revealedAt = m.now;
  m.dirty = true;
}

/** Make `stack` the navigation state after a deeper screen closes. */
function returnToStack<Metadata>(m: Machine<Metadata>, stack: NavFrame<Metadata>[]): void {
  m.mode = { kind: "nav", stack };
  const top = stack[stack.length - 1];
  if (top?.kind === "carousel") revealCarousel(m, top, "return");
  m.dirty = true;
}

function snapshot<Metadata>(m: Machine<Metadata>): PhoneSnapshot {
  return { path: currentPath(m), screen: renderScreen(m), poweredOn: m.mode.kind !== "off" };
}

function stackSlugs<Metadata>(stack: readonly NavFrame<Metadata>[]): string[] {
  const slugs: string[] = [];
  for (const frame of stack) {
    if (
      frame.kind === "submenu" ||
      frame.kind === "list" ||
      frame.kind === "reader" ||
      frame.kind === "action"
    ) {
      slugs.push(frame.entry.slug.value);
    }
  }
  return slugs;
}

/** Menu numbers of the stack's entries, each in the level that shows it. */
function stackOrders<Metadata>(stack: readonly NavFrame<Metadata>[]): number[] {
  const orders: number[] = [];
  stack.forEach((frame, index) => {
    if (
      frame.kind === "submenu" ||
      frame.kind === "list" ||
      frame.kind === "reader" ||
      frame.kind === "action"
    ) {
      orders.push(numberIn(stack[index - 1], frame.entry));
    }
  });
  return orders;
}

function originSlugs<Metadata>(origin: ActivationOrigin<Metadata>): string[] {
  return origin.kind === "entry" ? [origin.entry.slug.value] : [];
}

function originOrders<Metadata>(
  stack: readonly NavFrame<Metadata>[],
  origin: ActivationOrigin<Metadata>,
): number[] {
  return origin.kind === "entry" ? [numberIn(stack[stack.length - 1], origin.entry)] : [];
}

/** Menu numbers from the root to the shown level (or application), without the carousel's. */
function levelOrders<Metadata>(m: Machine<Metadata>): number[] {
  if (m.mode.kind === "app") {
    const { stack, origin } = m.mode.activation;
    return [...stackOrders(stack), ...originOrders(stack, origin)];
  }
  return m.mode.kind === "nav" ? stackOrders(m.mode.stack) : [];
}

/** levelOrders, or the carousel slot's number when the carousel is shown. */
function positionOrders<Metadata>(m: Machine<Metadata>): number[] {
  const segments = levelOrders(m);
  if (m.mode.kind !== "nav" || segments.length > 0) return segments;
  const carousel = m.mode.stack[0];
  if (carousel?.kind !== "carousel") throw new Error("Navigation stack has no carousel.");
  return [m.config.menu.entries[carousel.index]!.entry.order.value];
}

function menuIndicator<Metadata>(m: Machine<Metadata>): MenuIndicator {
  const shortcut = m.shortcut;
  if (shortcut?.kind === "stock") return stockIndicator(m, shortcut);
  if (shortcut === null && entering(m)) {
    return { segments: levelOrders(m), awaitingNext: false, entering: true };
  }
  return {
    segments: positionOrders(m),
    awaitingNext: shortcut !== null && shortcut.entries.length > 0,
    ...(shortcut !== null && shortcut.entries.length === 0 ? { awaitingFirst: true as const } : {}),
  };
}

/** The shown level was entered with Select less than its entryIndicatorMs ago. */
function entering<Metadata>(m: Machine<Metadata>): boolean {
  if (m.mode.kind !== "nav") return false;
  const top = m.mode.stack[m.mode.stack.length - 1];
  return top?.kind === "submenu" && m.now < top.enteringUntil;
}

/**
 * The stock indicator: the typed path (`8`, `8-6`), the awaiting form `<segments>-<typed>` and
 * dots while a digit is awaited (`1`, `12-`, `11-0`), or the first-digit dots after Menu.
 */
function stockIndicator<Metadata>(m: Machine<Metadata>, s: StockShortcut<Metadata>): MenuIndicator {
  if (s.resolvedDigits !== undefined) {
    return { segments: levelOrders(m), awaitingNext: true, typed: s.resolvedDigits };
  }
  if (s.pending !== null) {
    if (s.digits === "") return { segments: positionOrders(m), awaitingNext: false };
    const top = m.mode.kind === "nav" ? m.mode.stack[m.mode.stack.length - 1] : undefined;
    return {
      segments: [...levelOrders(m), numberIn(top, s.pending.entry)],
      awaitingNext: true,
      typed: s.digits,
    };
  }
  const top = m.mode.kind === "nav" ? m.mode.stack[m.mode.stack.length - 1] : undefined;
  if (s.digits === "" && top?.kind === "carousel") {
    return { segments: positionOrders(m), awaitingNext: false, awaitingFirst: true };
  }
  return { segments: levelOrders(m), awaitingNext: true, typed: s.digits };
}

function currentPath<Metadata>(m: Machine<Metadata>): string {
  let slugs: string[];
  if (m.mode.kind === "nav") slugs = stackSlugs(m.mode.stack);
  else if (m.mode.kind === "app" && !isStandbyApplication(m.mode.activation)) {
    const { stack, origin } = m.mode.activation;
    slugs = [...stackSlugs(stack), ...originSlugs(origin)];
  } else return "standby";
  return slugs.length === 0 ? "menu" : `menu/${slugs.join("/")}`;
}

/** Greedy word-wrap at `width` chars; hard-breaks longer words; '\n' = paragraph. */
export function wrapLines(body: string, width = READER_LINE_CHARS): string[] {
  const lines: string[] = [];
  for (const para of body.split("\n")) {
    let line = "";
    for (const word of para.split(" ")) {
      let remaining = word;
      while (remaining.length > width) {
        if (line !== "") {
          lines.push(line);
          line = "";
        }
        lines.push(remaining.slice(0, width));
        remaining = remaining.slice(width);
      }
      if (line === "") line = remaining;
      else if (line.length + 1 + remaining.length <= width) line = `${line} ${remaining}`;
      else {
        lines.push(line);
        line = remaining;
      }
    }
    lines.push(line);
  }
  return lines;
}

function selectedListItem<Metadata>(
  frame: Extract<NavFrame<Metadata>, { kind: "list" }>,
  items: readonly MenuListItem[],
): { item: MenuListItem | undefined; index: number } {
  let index =
    frame.selectedId === null ? -1 : items.findIndex((item) => item.id === frame.selectedId);
  if (index < 0) index = clampIndex(frame.fallbackIndex, items.length);
  const item = items[index];
  frame.selectedId = item?.id ?? null;
  frame.fallbackIndex = index;
  return { item, index };
}

function renderScreen<Metadata>(m: Machine<Metadata>): ScreenModel {
  switch (m.mode.kind) {
    case "off":
      return { kind: "off" };
    case "boot": {
      const elapsed = m.now - m.mode.startedAt;
      if (m.bootTimeline !== undefined) {
        return { kind: "boot", phase: "hands", frame: m.bootTimeline.frameAt(elapsed) };
      }
      const handsMs = Math.floor((m.bootMs * 2) / 3);
      if (elapsed < handsMs) {
        return { kind: "boot", phase: "hands", frame: Math.floor(elapsed / BOOT_FRAME_MS) };
      }
      return {
        kind: "boot",
        phase: "welcome",
        frame: Math.floor((elapsed - handsMs) / BOOT_FRAME_MS),
      };
    }
    case "standby":
      return standbyScreen(m, false);
    case "nav": {
      const frame = shownNavFrame(m.mode.stack);
      return frame === undefined ? { kind: "off" } : renderFrame(m, m.mode.stack, frame);
    }
    case "app": {
      const { session } = m.mode.activation;
      const title = activationLabel(m.mode.activation);
      if (session === null) {
        return {
          kind: "reader",
          title,
          lines: ["App error"],
          scrollTop: 0,
          menuIndicator: menuIndicator(m),
        };
      }
      try {
        return session.render();
      } catch {
        return {
          kind: "reader",
          title,
          lines: ["App error"],
          scrollTop: 0,
          menuIndicator: menuIndicator(m),
        };
      }
    }
  }
}

function activationLabel<Metadata>(activation: AppActivation<Metadata>): string {
  const { origin, stack, definition } = activation;
  if (origin.kind === "entry") {
    const parent = stack[stack.length - 1];
    return parent?.kind === "submenu" ? labelIn(parent.entry, origin.entry) : origin.entry.label;
  }
  const top = stack[stack.length - 1];
  return origin.kind === "intro" && top?.kind === "submenu" ? top.entry.label : definition.id;
}

/** A stock shortcut's typed entry is about to open: the shown level drops its soft key. */
function stockOpening<Metadata>(m: Machine<Metadata>): { opening?: true } {
  return m.shortcut?.kind === "stock" && m.shortcut.pending !== null ? { opening: true } : {};
}

/** The host's standby indicators, only the fields that are true (undefined when none is). */
function standbyIndicators<Metadata>(m: Machine<Metadata>): StandbyIndicators | undefined {
  const read = m.config.standbyIndicators?.();
  if (read === undefined) return undefined;
  const shown: StandbyIndicators = {};
  if (read.voicemail === true) shown.voicemail = true;
  if (read.message === true) shown.message = true;
  if (read.silent === true) shown.silent = true;
  return Object.keys(shown).length === 0 ? undefined : shown;
}

/** The host's second standby line (PhoneConfig.standbyLine); a failing reader shows none. */
function standbyLine<Metadata>(m: Machine<Metadata>): string | undefined {
  const reader = m.config.standbyLine;
  if (reader === undefined) return undefined;
  try {
    const line = reader(m.now - m.standbySince);
    return typeof line === "string" ? line : undefined;
  } catch {
    return undefined;
  }
}

/** Standby's host values that change with time: the clock, the indicators and the line. */
function standbySignature<Metadata>(m: Machine<Metadata>): string {
  const values = [m.config.clock?.(), standbyIndicators(m), standbyLine(m)];
  return JSON.stringify(values);
}

/**
 * Applications that run at standby with the path `standby` and an empty stack: plan 15's boot
 * gates, plan 18's notice applications and plan 17's power key application.
 */
function isStandbyApplication<Metadata>(activation: AppActivation<Metadata>): boolean {
  return activation.origin.kind === "gate" || isStandbyOverlay(activation.origin);
}

/** A standby application outside the boot (a notice's, the power key's): exit() is standby. */
function isStandbyOverlay<Metadata>(origin: ActivationOrigin<Metadata>): boolean {
  return origin.kind === "notice" || origin.kind === "power";
}

function standbyScreen<Metadata>(m: Machine<Metadata>, leaving: boolean): ScreenModel {
  const indicators = standbyIndicators(m);
  const line = standbyLine(m);
  return {
    kind: "standby",
    carrier: m.carrier,
    clock: m.config.clock?.(),
    signal: 4,
    battery: 4,
    ...(indicators === undefined ? {} : { indicators }),
    ...(line === undefined ? {} : { line }),
    ...(m.notice === null ? {} : { notice: { text: m.notice.text, softkey: m.notice.softkey } }),
    ...(leaving ? { leaving: true as const } : {}),
  };
}

function renderFrame<Metadata>(
  m: Machine<Metadata>,
  stack: readonly NavFrame<Metadata>[],
  frame: DisplayNavFrame<Metadata>,
): ScreenModel {
  switch (frame.kind) {
    case "carousel": {
      // Until the menu-open delay has passed, standby is still on screen.
      if (m.now < frame.revealedAt) return standbyScreen(m, true);
      const slot = m.config.menu.entries[frame.index]!;
      const iconFrame = carouselIconFrame(m, frame);
      return {
        kind: "menu-carousel",
        label: slot.entry.label,
        menuNumber: slot.entry.order.value,
        total: m.config.menu.entries.length,
        iconId: slot.graphic.id,
        ...(iconFrame === undefined ? {} : { iconFrame }),
        menuIndicator: menuIndicator(m),
        ...stockOpening(m),
      };
    }
    case "submenu": {
      const shown = shownChildrenOf(m, frame);
      const detail = submenuDetail(frame);
      const orders = shown.map((entry) => entry.order.value);
      const positional =
        frame.entry.numbersByPosition || orders.every((value, index) => value === index + 1);
      return {
        kind: "list",
        title: frameTitle(stack, frame),
        items: shown.map((entry) => labelIn(frame.entry, entry)),
        ...(positional ? {} : { itemOrders: orders }),
        selected: shown.indexOf(frame.entry.children.entries[frame.selected]!),
        softkey: frame.entry.softkey,
        menuIndicator: menuIndicator(m),
        ...(frame.entry.presentation === "pages" ? { presentation: "pages" as const } : {}),
        ...(detail === undefined ? {} : { detail }),
        ...(frame.windowTop === undefined ? {} : { windowTop: frame.windowTop }),
        ...stockOpening(m),
      };
    }
    case "list": {
      const items = frame.entry.source.read();
      const { index } = selectedListItem(frame, items);
      return {
        kind: "list",
        title: frameTitle(stack, frame),
        items: items.map((item) => item.label),
        selected: index,
        softkey: "Select",
        menuIndicator: menuIndicator(m),
      };
    }
    case "item":
      return {
        kind: "reader",
        title: frame.item.label,
        lines: wrapLines(frame.item.body),
        scrollTop: frame.scrollTop,
        menuIndicator: menuIndicator(m),
      };
    case "reader":
      return {
        kind: "reader",
        title: frameTitle(stack, frame),
        lines: wrapLines(frame.entry.body),
        scrollTop: frame.scrollTop,
        menuIndicator: menuIndicator(m),
      };
  }
}

function swallowHeldReleases<Metadata>(m: Machine<Metadata>): void {
  for (const held of m.held.values()) held.longFired = true;
}

function deactivate<Metadata>(
  activation: AppActivation<Metadata>,
  reason: DeactivationReason,
): void {
  activation.deactivationReason ??= reason;
  if (activation.session === null || activation.deactivated) return;
  activation.deactivated = true;
  try {
    activation.session.onDeactivate?.(activation.deactivationReason);
  } catch {
    // A failed cleanup cannot prevent the requested transition.
  }
}

function deactivateActive<Metadata>(m: Machine<Metadata>, reason: DeactivationReason): void {
  if (m.mode.kind !== "app") return;
  swallowHeldReleases(m);
  deactivate(m.mode.activation, reason);
}

function isActive<Metadata>(
  m: Machine<Metadata>,
  activation: AppActivation<Metadata>,
  token: object,
): boolean {
  return (
    m.mode.kind === "app" &&
    m.mode.activation === activation &&
    activation.activationToken === token &&
    activation.deactivationReason === null &&
    !activation.deactivated
  );
}

function startApplication<Metadata>(
  m: Machine<Metadata>,
  origin: ActivationOrigin<Metadata>,
  definition: PhoneApplication,
  stack: NavFrame<Metadata>[],
): void {
  const token = {};
  const activation: AppActivation<Metadata> = {
    origin,
    definition,
    session: null,
    activationToken: token,
    stack,
    deactivationReason: null,
    deactivated: false,
  };
  m.mode = { kind: "app", activation };
  m.dirty = true;
  const context: ApplicationContext = {
    exit(options?: ExitOptions): void {
      if (origin.kind === "gate") {
        const toStandby = gateExitsToStandby(options);
        run(m, () => {
          if (!isActive(m, activation, token)) return;
          swallowHeldReleases(m);
          deactivate(activation, "exit");
          if (toStandby) finishBoot(m, origin.boot.targetPath);
          else resumeBoot(m, origin.boot);
        });
        return;
      }
      if (isStandbyOverlay(origin)) {
        gateExitsToStandby(
          options,
          origin.kind === "notice" ? "a notice's application" : "the power key's application",
        );
        run(m, () => {
          if (!isActive(m, activation, token)) return;
          swallowHeldReleases(m);
          deactivate(activation, "exit");
          m.mode = { kind: "standby" };
          m.dirty = true;
        });
        return;
      }
      const plan = exitPlan(m, activation, options);
      run(m, () => {
        if (!isActive(m, activation, token)) return;
        swallowHeldReleases(m);
        deactivate(activation, "exit");
        if (plan === "standby") {
          m.mode = { kind: "standby" };
          m.shortcut = null;
          m.dirty = true;
          return;
        }
        if (plan.plain && origin.kind === "intro" && origin.viaShortcut) {
          if (m.shortcut?.kind === "stock") {
            endShortcutIntro(m, m.shortcut, activation.stack);
            return;
          }
        }
        cancelShortcut(m);
        plan.apply();
        returnToStack(m, plan.stack);
      });
    },
    open(nextDefinition: PhoneApplication): void {
      run(m, () => {
        if (!isActive(m, activation, token)) return;
        swallowHeldReleases(m);
        deactivate(activation, "replace");
        startApplication(m, activation.origin, nextDefinition, activation.stack);
      });
    },
    powerOff(): void {
      run(m, () => {
        if (isActive(m, activation, token)) switchOff(m);
      });
    },
    menuIndicator(): MenuIndicator {
      if (m.mode.kind === "app" && m.mode.activation === activation) return menuIndicator(m);
      return {
        segments: [
          ...stackOrders(activation.stack),
          ...originOrders(activation.stack, activation.origin),
        ],
        awaitingNext: false,
      };
    },
  };

  try {
    const session = definition.createSession(context);
    activation.session = session;
    if (activation.deactivationReason !== null) {
      deactivate(activation, activation.deactivationReason);
    }
  } catch {
    // A current activation renders its null session as App error.
  }
}

/**
 * Validates a standby application's exit options (a boot gate's, a notice's): only
 * `to: "standby"` (for a gate, end the boot) is allowed.
 */
function gateExitsToStandby(options: ExitOptions = {}, who = "a boot gate"): boolean {
  if (options.to !== undefined && options.to !== "standby") {
    throw new Error(`exit "to" must be "standby" (received ${String(options.to)}).`);
  }
  if (options.levels !== undefined || options.select !== undefined || options.row !== undefined) {
    throw new Error(`exit levels, select and row are not available to ${who}.`);
  }
  return options.to === "standby";
}

/**
 * Validates exit options against the activation's stack (throwing at the caller) and returns
 * where the exit goes: standby, or a stack `levels - 1` frames shorter, with `apply` selecting
 * `select` in its top level.
 */
function exitPlan<Metadata>(
  m: Machine<Metadata>,
  activation: AppActivation<Metadata>,
  options: ExitOptions = {},
): "standby" | { stack: NavFrame<Metadata>[]; apply: () => void; plain: boolean } {
  if (options.to !== undefined && options.to !== "standby") {
    throw new Error(`exit "to" must be "standby" (received ${String(options.to)}).`);
  }
  if (activation.origin.kind === "invalid" || options.to === "standby") return "standby";
  const base = activation.stack;
  const levels = options.levels ?? 1;
  if (!Number.isInteger(levels) || levels < 1 || levels > base.length) {
    throw new Error(
      `exit levels must be an integer from 1 to ${base.length} (received ${levels}).`,
    );
  }
  const stack = levels === 1 ? base : base.slice(0, base.length - levels + 1);
  const { select, row = "bottom" } = options;
  if (row !== "top" && row !== "bottom") {
    throw new Error(`exit row must be "top" or "bottom" (received ${String(row)}).`);
  }
  if (options.row !== undefined && select === undefined) {
    throw new Error("exit row needs select (the child to place).");
  }
  let apply = (): void => {};
  if (select !== undefined) {
    const top = stack[stack.length - 1]!;
    const entries =
      top.kind === "carousel"
        ? m.config.menu.entries.map((slot) => slot.entry)
        : top.kind === "submenu"
          ? top.entry.shownChildren()
          : [];
    const child = entries.find((entry) => entry.slug.value === select);
    if (child === undefined)
      throw new Error(`exit select "${select}" is not a shown child of the level returned to.`);
    apply = () => {
      if (top.kind === "carousel") top.index = entries.indexOf(child);
      else if (top.kind === "submenu") {
        selectOnRow(m, top, top.entry.children.entries.indexOf(child), row);
      }
    };
  }
  return { stack, apply, plain: levels === 1 && select === undefined };
}

/**
 * Selects a child for an application's exit. With a rows window the child goes on the bottom
 * row (Snake II's Top score returns to `Score IDs / Instructions / New game`, plan 14 P12) or
 * on the top row, the window rebuilt at it as on entry (Space impact's returns to `New game /
 * Top score / Score IDs`).
 */
function selectOnRow<Metadata>(
  m: Machine<Metadata>,
  frame: SubmenuFrame<Metadata>,
  index: number,
  row: "top" | "bottom",
): void {
  frame.selected = index;
  const shown = shownChildrenOf(m, frame);
  if (frame.windowTop === undefined || m.rowsWindow === undefined) return;
  if (row === "top") {
    enterWindow(m, frame);
    return;
  }
  const count = shown.length;
  const position = shown.indexOf(frame.entry.children.entries[index]!);
  frame.windowTop = count <= m.rowsWindow ? 0 : wrapIndex(position - m.rowsWindow + 1, count);
}

/** Runs a level's intro before its list; the intro's stack ends with the level's frame. */
function startIntro<Metadata>(
  m: Machine<Metadata>,
  level: SubmenuEntry<Metadata>,
  stack: readonly NavFrame<Metadata>[],
  viaShortcut: boolean,
): void {
  const frame = submenuFrame(m, level, openingIndex(level));
  startApplication(m, { kind: "intro", viaShortcut }, level.intro!, [...stack, frame]);
}

function openingIndex<Metadata>(level: SubmenuEntry<Metadata>): number {
  const child = level.openingChild();
  return child === undefined ? 0 : level.children.entries.indexOf(child);
}

function togglePower<Metadata>(m: Machine<Metadata>): void {
  if (m.mode.kind === "off") powerOn(m, null);
  else switchOff(m);
}

function powerOn<Metadata>(m: Machine<Metadata>, targetPath: string | null): void {
  m.dirty = true;
  if (m.bootMs <= 0 && m.bootGates.length === 0) {
    m.mode = { kind: "standby" };
    if (targetPath !== null) applyPath(m, targetPath);
    return;
  }
  m.mode = { kind: "boot", startedAt: m.now, targetPath, nextGate: 0 };
  tickBoot(m);
}

function switchOff<Metadata>(m: Machine<Metadata>): void {
  deactivateActive(m, "power-off");
  m.mode = { kind: "off" };
  m.shortcut = null;
  m.dirty = true;
}

function goStandby<Metadata>(m: Machine<Metadata>): void {
  deactivateActive(m, "navigate");
  m.mode = { kind: "standby" };
  m.shortcut = null;
  m.dirty = true;
}

function tickBoot<Metadata>(m: Machine<Metadata>): void {
  if (m.mode.kind !== "boot") return;
  // The legacy frame clock repaints every tick; a timeline repaints through tickSignature.
  if (m.bootTimeline === undefined) m.dirty = true;
  // A gate may resume or end the boot itself (exit inside createSession), so re-read the mode.
  while (m.mode.kind === "boot") {
    const boot = m.mode;
    const elapsed = m.now - boot.startedAt;
    const gate = m.bootGates[boot.nextGate];
    if (gate !== undefined && gate.atMs <= elapsed) {
      boot.nextGate += 1;
      openGate(m, boot, gate);
      continue;
    }
    if (elapsed >= m.bootMs) finishBoot(m, boot.targetPath);
    return;
  }
}

/**
 * Asks `gate` for an application; one holds the boot at the gate's offset. A gate whose open()
 * or createSession throws is skipped, and the boot goes on as if it had returned undefined.
 */
function openGate<Metadata>(
  m: Machine<Metadata>,
  boot: Extract<Mode<Metadata>, { kind: "boot" }>,
  gate: BootGate,
): void {
  let application: PhoneApplication | undefined;
  try {
    application = gate.open();
  } catch {
    return;
  }
  if (!(application instanceof PhoneApplication)) return;
  const origin: ActivationOrigin<Metadata> = {
    kind: "gate",
    boot: { atMs: gate.atMs, nextGate: boot.nextGate, targetPath: boot.targetPath },
  };
  startApplication(m, origin, application, []);
  const mode = m.mode;
  if (mode.kind !== "app" || mode.activation.origin !== origin) return;
  const session = mode.activation.session;
  if (session === null) {
    m.mode = boot;
    m.dirty = true;
    return;
  }
  // The gate holds from the moment the boot reached its offset, which a coarse tick passed.
  const overshoot = m.now - (boot.startedAt + gate.atMs);
  if (overshoot <= 0) return;
  try {
    session.tick(overshoot);
  } catch {
    // Application timer failures are isolated from firmware navigation.
  }
}

/** A gate exited: the boot clock runs again from the gate's offset. */
function resumeBoot<Metadata>(m: Machine<Metadata>, held: HeldBoot): void {
  m.mode = {
    kind: "boot",
    startedAt: m.now - held.atMs,
    targetPath: held.targetPath,
    nextGate: held.nextGate,
  };
  m.dirty = true;
  tickBoot(m);
}

function finishBoot<Metadata>(m: Machine<Metadata>, targetPath: string | null): void {
  m.mode = { kind: "standby" };
  m.dirty = true;
  if (targetPath !== null) applyPath(m, targetPath);
}

function handleKeyEvent<Metadata>(m: Machine<Metadata>, event: KeyEvent): void {
  if (event.type === "down") {
    if (m.held.has(event.key)) return;
    const shortcutCaptured = capturedDigit(m, event.key) !== null;
    m.held.set(event.key, { downAt: m.now, longFired: false, shortcutCaptured });
    if (m.mode.kind !== "off") emit(m, "sound", { kind: "key", id: "beep" });
    if (shortcutCaptured) return;
    if (event.key === "power" && opensStandbyPower(m)) {
      startApplication(m, { kind: "power" }, m.config.standbyPower!, []);
      return;
    }
    // A shortcut intro takes every key; the shortcut resumes when it ends.
    if (m.shortcut !== null && !shortcutIntroRunning(m)) cancelShortcut(m);
    forwardToApp(m, event);
    // An application that leaves for standby on the power key's down (a note shown at standby,
    // plan 17 B6) lets the same press open the power key's application.
    if (event.key === "power" && opensStandbyPower(m)) {
      startApplication(m, { kind: "power" }, m.config.standbyPower!, []);
    }
    return;
  }

  const held = m.held.get(event.key);
  m.held.delete(event.key);
  if (held?.shortcutCaptured) {
    const digit = capturedDigit(m, event.key);
    if (!held.longFired && digit !== null) shortcutDigit(m, digit);
    return;
  }
  if (m.mode.kind === "app") {
    const activation = m.mode.activation;
    if (activation.session === null) {
      if (held !== undefined && !held.longFired && event.key === "c") {
        cancelShortcut(m);
        if (isStandbyOverlay(activation.origin)) goStandby(m);
        else returnToStack(m, activation.stack);
      }
    } else {
      forwardToApp(m, event);
    }
    return;
  }
  if (held === undefined || held.longFired) return;
  onShortPress(m, event.key);
}

/** The power key's key-down opens PhoneConfig.standbyPower at standby (a notice stays). */
function opensStandbyPower<Metadata>(m: Machine<Metadata>): boolean {
  return m.config.standbyPower !== undefined && m.mode.kind === "standby";
}

function forwardToApp<Metadata>(m: Machine<Metadata>, event: KeyEvent): void {
  if (m.mode.kind !== "app" || m.mode.activation.session === null) return;
  const session = m.mode.activation.session;
  try {
    session.onKey(event);
  } catch {
    // Application input failures are isolated from firmware navigation.
  }
  m.dirty = true;
}

function handleTick<Metadata>(m: Machine<Metadata>, nowMs: number): void {
  const dtMs = Math.max(0, nowMs - m.now);
  m.now = Math.max(m.now, nowMs);
  for (const [key, held] of m.held) {
    if (!held.longFired && m.now - held.downAt >= LONG_PRESS_MS) {
      held.longFired = true;
      onLongPress(m, key);
    }
  }
  const before = m.mode.kind === "app" ? m.mode.activation : null;
  if (m.mode.kind === "boot") tickBoot(m);
  // A gate opened by this tick has had its share of the tick (openGate).
  if (
    m.mode.kind === "app" &&
    m.mode.activation !== before &&
    m.mode.activation.origin.kind === "gate"
  ) {
    m.dirty = true;
    return;
  }
  if (m.mode.kind === "nav") {
    const shown = shownNavFrame(m.mode.stack);
    if (shown?.kind === "submenu") shownChildrenOf(m, shown);
  }
  const shortcut = m.shortcut;
  if (shortcut?.kind === "digits" && m.now >= shortcut.deadline) cancelShortcut(m);
  else if (shortcut?.kind === "stock" && !shortcutIntroRunning(m)) tickStockShortcut(m, shortcut);
  if (m.mode.kind !== "app" || m.mode.activation.session === null) return;
  try {
    m.mode.activation.session.tick(dtMs);
  } catch {
    // Application timer failures are isolated from firmware navigation.
  }
  m.dirty = true;
}

function onShortPress<Metadata>(m: Machine<Metadata>, key: PhoneKey): void {
  if (m.mode.kind === "standby") standbyShortPress(m, key);
  else if (m.mode.kind === "nav") navShortPress(m, key);
}

function onLongPress<Metadata>(m: Machine<Metadata>, key: PhoneKey): void {
  if (key === "power") {
    togglePower(m);
  } else if (m.mode.kind === "nav" && key === "c") {
    goStandby(m);
  }
}

function standbyShortPress<Metadata>(m: Machine<Metadata>, key: PhoneKey): void {
  if (m.notice !== null) {
    if (key === "navi") {
      const { path: target, open } = m.notice;
      m.notice = null;
      m.dirty = true;
      if (open !== undefined) startApplication(m, { kind: "notice" }, open, []);
      else if (target !== undefined) applyPath(m, target);
      return;
    }
    if (key === "c") {
      m.notice = null;
      reenterStandby(m);
      return;
    }
  }
  const standbyKeys = m.config.standbyKeys;
  if (key === "navi") enterMenu(m);
  else if (key === "up" && standbyKeys?.up !== undefined) tryApplyPath(m, standbyKeys.up);
  else if (key === "down" && standbyKeys?.down !== undefined) tryApplyPath(m, standbyKeys.down);
}

function navShortPress<Metadata>(m: Machine<Metadata>, key: PhoneKey): void {
  if (m.mode.kind !== "nav") return;
  const stack = m.mode.stack;
  const frame = stack[stack.length - 1]!;
  if (frame.kind === "submenu" && m.now < frame.enteringUntil) {
    frame.enteringUntil = 0;
    m.dirty = true;
  }
  if (key === "c") {
    popFrame(m);
    return;
  }

  switch (frame.kind) {
    case "carousel": {
      const total = m.config.menu.entries.length;
      if (key === "down") {
        frame.index = wrapIndex(frame.index + 1, total);
        revealCarousel(m, frame, "next");
      } else if (key === "up") {
        frame.index = wrapIndex(frame.index - 1, total);
        revealCarousel(m, frame, "previous");
      } else if (key === "navi") {
        enterEntry(m, m.config.menu.entries[frame.index]!.entry);
      }
      return;
    }
    case "submenu": {
      const entries = frame.entry.children.entries;
      if (entries.length === 0) return;
      shownChildrenOf(m, frame);
      if (key === "down") {
        stepSelection(m, frame, 1);
      } else if (key === "up") {
        stepSelection(m, frame, -1);
      } else if (key === "navi") {
        enterEntry(m, entries[frame.selected]!);
      }
      return;
    }
    case "list": {
      const items = frame.entry.source.read();
      const selected = selectedListItem(frame, items);
      if (items.length === 0) return;
      if (key === "down" || key === "up") {
        const direction = key === "down" ? 1 : -1;
        const index = wrapIndex(selected.index + direction, items.length);
        frame.fallbackIndex = index;
        frame.selectedId = items[index]!.id;
        m.dirty = true;
      } else if (key === "navi" && selected.item !== undefined) {
        stack.push({ kind: "item", entry: frame.entry, item: selected.item, scrollTop: 0 });
        m.dirty = true;
      }
      return;
    }
    case "item":
    case "reader": {
      const body = frame.kind === "item" ? frame.item.body : frame.entry.body;
      const maxTop = Math.max(0, wrapLines(body).length - READER_VISIBLE_LINES);
      if (key === "down" && frame.scrollTop < maxTop) {
        frame.scrollTop += 1;
        m.dirty = true;
      } else if (key === "up" && frame.scrollTop > 0) {
        frame.scrollTop -= 1;
        m.dirty = true;
      }
      return;
    }
    case "action":
      return;
  }
}

function applyPath<Metadata>(m: Machine<Metadata>, path: string): void {
  const parsed = parsePath(path);
  if (parsed === null || parsed.kind === "standby") {
    goStandby(m);
    return;
  }
  deactivateActive(m, "navigate");
  if (parsed.ids.length === 0) {
    m.mode = { kind: "nav", stack: [carouselFrame(m, 0, "enter")] };
    m.shortcut = null;
    m.dirty = true;
    return;
  }
  const entries = resolveIds(m.config.menu, parsed.ids);
  if (entries === null) {
    m.mode = { kind: "standby" };
    m.shortcut = null;
    m.dirty = true;
    return;
  }
  buildNavStack(m, entries);
}

function tryApplyPath<Metadata>(m: Machine<Metadata>, path: string): void {
  const parsed = parsePath(path);
  if (parsed === null || parsed.kind === "standby") return;
  const entries = resolveIds(m.config.menu, parsed.ids);
  if (entries !== null) buildNavStack(m, entries);
}

function enterMenu<Metadata>(m: Machine<Metadata>): void {
  const carousel = carouselFrame(m, 0, "enter");
  carousel.revealedAt += m.menuOpenDelayMs;
  m.mode = { kind: "nav", stack: [carousel] };
  const deadline = m.now + m.shortcutWindowMs;
  m.shortcut =
    m.shortcutEntry === undefined
      ? {
          kind: "digits",
          entries: [],
          nextLevel: numberedTopLevel(m),
          deadline,
        }
      : { kind: "stock", digits: "", deadline, pending: null, resolvedDigits: undefined };
  m.dirty = true;
}

/** The digit a key types into the open shortcut window, or null when the key is not captured. */
function capturedDigit<Metadata>(m: Machine<Metadata>, key: PhoneKey): number | null {
  if (m.shortcut === null || !/^[0-9]$/.test(key)) return null;
  if (m.shortcut.kind === "digits") return key === "0" ? null : Number(key);
  return shortcutIntroRunning(m) ? null : Number(key);
}

function shortcutIntroRunning<Metadata>(m: Machine<Metadata>): boolean {
  return (
    m.mode.kind === "app" &&
    m.mode.activation.origin.kind === "intro" &&
    m.mode.activation.origin.viaShortcut
  );
}

function shortcutDigit<Metadata>(m: Machine<Metadata>, digit: number): void {
  const shortcut = m.shortcut;
  if (shortcut === null) return;
  if (shortcut.kind === "stock") {
    stockDigit(m, shortcut, digit);
    return;
  }
  const entry = shortcut.nextLevel.find((candidate) => candidate.number === digit)?.entry;
  if (entry === undefined) return;

  shortcut.entries.push(entry);
  shortcut.nextLevel = numberedChildren(entry);
  shortcut.deadline = m.now + m.shortcutWindowMs;
  buildNavStack(m, shortcut.entries, true);
}

function cancelShortcut<Metadata>(m: Machine<Metadata>): void {
  if (m.shortcut === null) return;
  // The open window is always visible: awaitingFirst before a digit, awaitingNext after.
  m.shortcut = null;
  m.dirty = true;
}

type NumberMatch<Metadata> =
  | { kind: "entry"; entry: MenuEntry<Metadata> }
  | { kind: "wait"; exact: MenuEntry<Metadata> | undefined }
  | { kind: "none" };

/**
 * Matches typed digits as a menu number among `level`'s entries. A number that is also the
 * prefix of a longer one waits (`1` with 10-12), as do leading zeros; no candidate is none.
 */
function matchNumber<Metadata>(level: Numbered<Metadata>, digits: string): NumberMatch<Metadata> {
  const number = digits.replace(/^0+/, "");
  if (number === "")
    return level.length > 0 ? { kind: "wait", exact: undefined } : { kind: "none" };
  const exact = level.find((candidate) => String(candidate.number) === number)?.entry;
  const longer = level.some((candidate) => {
    const text = String(candidate.number);
    return text.length > number.length && text.startsWith(number);
  });
  if (exact !== undefined && !longer) return { kind: "entry", entry: exact };
  return exact !== undefined || longer ? { kind: "wait", exact } : { kind: "none" };
}

/** The entries the next typed number selects among, with their numbers. */
function stockLevel<Metadata>(
  m: Machine<Metadata>,
  s: StockShortcut<Metadata>,
): Numbered<Metadata> {
  if (s.pending !== null) return numberedChildren(s.pending.entry);
  if (m.mode.kind !== "nav") return [];
  const top = m.mode.stack[m.mode.stack.length - 1];
  if (top?.kind === "carousel") return numberedTopLevel(m);
  return top?.kind === "submenu" ? numberedChildren(top.entry) : [];
}

function stockDigit<Metadata>(
  m: Machine<Metadata>,
  s: StockShortcut<Metadata>,
  digit: number,
): void {
  const digits = `${s.digits}${digit}`;
  const match = matchNumber(stockLevel(m, s), digits);
  if (match.kind === "none") {
    openInvalidShortcut(m);
    return;
  }
  s.resolvedDigits = undefined;
  s.deadline = m.now + m.shortcutWindowMs;
  m.dirty = true;
  if (match.kind === "wait") {
    s.digits = digits;
    return;
  }
  s.digits = "";
  selectTyped(m, s, match.entry);
}

/**
 * Shows a typed entry selected in its level (opening that level first when it is the pending
 * entry itself), due to open after the delay; a submenu with an intro runs it at once.
 */
function selectTyped<Metadata>(
  m: Machine<Metadata>,
  s: StockShortcut<Metadata>,
  entry: MenuEntry<Metadata>,
  at = m.now,
): void {
  if (m.mode.kind !== "nav") return;
  const stack = m.mode.stack;
  const parent = s.pending?.entry;
  if (parent instanceof SubmenuEntry) {
    stack.push(submenuFrame(m, parent, parent.children.entries.indexOf(entry)));
  } else {
    const top = stack[stack.length - 1]!;
    if (top.kind === "carousel") {
      top.index = entry.order.value - 1;
      revealCarousel(m, top, "enter");
    } else if (top.kind === "submenu") {
      top.selected = top.entry.children.entries.indexOf(entry);
      enterWindow(m, top);
    }
  }
  s.pending = { entry, openAt: at + m.shortcutEntry!.openDelayMs };
  m.dirty = true;
  if (entry instanceof SubmenuEntry && entry.intro !== undefined) startIntro(m, entry, stack, true);
}

/** Fires every timer due by now in time order (an opening first on a tie). */
function tickStockShortcut<Metadata>(m: Machine<Metadata>, s: StockShortcut<Metadata>): void {
  while (m.shortcut === s && !shortcutIntroRunning(m)) {
    const openAt = s.pending?.openAt ?? Infinity;
    if (Math.min(openAt, s.deadline) > m.now) return;
    if (openAt <= s.deadline) openPending(m, s);
    else endStockWindow(m, s);
  }
}

/** Opens the typed entry (without its intro, which ran when it was typed). */
function openPending<Metadata>(m: Machine<Metadata>, s: StockShortcut<Metadata>): void {
  const entry = s.pending!.entry;
  s.pending = null;
  s.resolvedDigits = undefined;
  m.dirty = true;
  openEntry(m, entry, false);
}

/**
 * The window ends: pending digits resolve to their number (or Invalid shortcut), timed from the
 * deadline rather than the tick that noticed it; else an opening still due happens now, and
 * the shortcut closes.
 */
function endStockWindow<Metadata>(m: Machine<Metadata>, s: StockShortcut<Metadata>): void {
  if (s.digits !== "") {
    const match = matchNumber(stockLevel(m, s), s.digits);
    const target = match.kind === "wait" ? match.exact : undefined;
    if (target === undefined) {
      openInvalidShortcut(m);
      return;
    }
    const typed = s.digits;
    const due = s.deadline;
    s.digits = "";
    s.deadline = due + m.shortcutWindowMs;
    selectTyped(m, s, target, due);
    if (m.mode.kind === "nav") s.resolvedDigits = typed;
    return;
  }
  if (s.pending !== null) openPending(m, s);
  if (m.shortcut === s) cancelShortcut(m);
}

/**
 * A shortcut intro ended: show its level's parent with the typed entry still opening. The window
 * restarts; an opening that fell due during the intro waits for the window end.
 */
function endShortcutIntro<Metadata>(
  m: Machine<Metadata>,
  s: StockShortcut<Metadata>,
  stack: readonly NavFrame<Metadata>[],
): void {
  returnToStack(m, stack.slice(0, -1));
  s.deadline = m.now + m.shortcutWindowMs;
  if (s.pending !== null && s.pending.openAt <= m.now) s.pending.openAt = s.deadline;
}

function openInvalidShortcut<Metadata>(m: Machine<Metadata>): void {
  const stack =
    m.mode.kind === "nav"
      ? m.mode.stack
      : m.mode.kind === "app"
        ? m.mode.activation.stack
        : [carouselFrame(m, 0, "enter")];
  m.shortcut = null;
  deactivateActive(m, "navigate");
  startApplication(m, { kind: "invalid" }, m.shortcutEntry!.invalid, stack);
}

function buildNavStack<Metadata>(
  m: Machine<Metadata>,
  entries: readonly MenuEntry<Metadata>[],
  preserveShortcut = false,
): void {
  if (!preserveShortcut) m.shortcut = null;
  const stack: NavFrame<Metadata>[] = [carouselFrame(m, 0, "enter")];
  for (const [position, entry] of entries.entries()) {
    const last = position === entries.length - 1;
    const parent = stack[stack.length - 1]!;
    // Position within the parent level: a submenu level may skip a hidden entry's number.
    if (parent.kind === "carousel") parent.index = entry.order.value - 1;
    else if (parent.kind === "submenu") {
      if (!parent.entry.shownChildren().includes(entry)) {
        // A path through a hidden child (SubmenuOptions.shown) lands on its level.
        parent.selected = openingIndex(parent.entry);
        enterWindow(m, parent);
        break;
      }
      parent.selected = parent.entry.children.entries.indexOf(entry);
      enterWindow(m, parent);
    }

    const destination = entry.accept<"continue" | "application" | "action">({
      visitSubmenu(submenu) {
        stack.push(submenuFrame(m, submenu, last ? openingIndex(submenu) : 0));
        return "continue";
      },
      visitList(list) {
        stack.push({ kind: "list", entry: list, selectedId: null, fallbackIndex: 0 });
        return "continue";
      },
      visitReader(reader) {
        stack.push({ kind: "reader", entry: reader, scrollTop: 0 });
        return "continue";
      },
      visitAction(action) {
        stack.push({ kind: "action", entry: action });
        return "action";
      },
      visitApplication(application) {
        m.mode = { kind: "nav", stack };
        startApplication(m, { kind: "entry", entry: application }, application.application, stack);
        return "application";
      },
    });
    if (destination === "application") return;
    if (destination === "action") {
      m.mode = { kind: "nav", stack };
      m.dirty = true;
      return;
    }
  }
  m.mode = { kind: "nav", stack };
  m.dirty = true;
}

function enterEntry<Metadata>(m: Machine<Metadata>, entry: MenuEntry<Metadata>): void {
  if (m.mode.kind !== "nav") return;
  m.shortcut = null;
  openEntry(m, entry, true);
}

/**
 * Opens `entry` on top of the navigation stack. Select-entry (`bySelect`) runs a level's intro
 * first and starts its entry indicator; a shortcut's opening does neither.
 */
function openEntry<Metadata>(
  m: Machine<Metadata>,
  entry: MenuEntry<Metadata>,
  bySelect: boolean,
): void {
  if (m.mode.kind !== "nav") return;
  const stack = m.mode.stack;
  const visitor: MenuEntryVisitor<Metadata, void> = {
    visitSubmenu(submenu) {
      if (bySelect && submenu.intro !== undefined) {
        startIntro(m, submenu, stack, false);
        return;
      }
      const frame = submenuFrame(m, submenu, openingIndex(submenu));
      if (bySelect) frame.enteringUntil = m.now + submenu.entryIndicatorMs;
      stack.push(frame);
      m.dirty = true;
    },
    visitList(list) {
      stack.push({ kind: "list", entry: list, selectedId: null, fallbackIndex: 0 });
      m.dirty = true;
    },
    visitReader(reader) {
      stack.push({ kind: "reader", entry: reader, scrollTop: 0 });
      m.dirty = true;
    },
    visitAction(action) {
      emit(m, "action", action.action);
    },
    visitApplication(application) {
      startApplication(m, { kind: "entry", entry: application }, application.application, stack);
    },
  };
  entry.accept(visitor);
}

function popFrame<Metadata>(m: Machine<Metadata>): void {
  if (m.mode.kind !== "nav") return;
  if (m.mode.stack.length === 1) {
    goStandby(m);
    return;
  }
  m.mode.stack.pop();
  returnToStack(m, m.mode.stack);
}

function wrapIndex(index: number, total: number): number {
  return ((index % total) + total) % total;
}

function handleNavigate<Metadata>(m: Machine<Metadata>, path: string): void {
  const target = normalizePath(path);
  if (m.mode.kind === "off") {
    if (target !== "standby") powerOn(m, target);
    return;
  }
  if (m.mode.kind === "boot") {
    m.mode.targetPath = target === "standby" ? null : target;
    return;
  }
  if (m.mode.kind === "app" && m.mode.activation.origin.kind === "gate") {
    m.mode.activation.origin.boot.targetPath = target === "standby" ? null : target;
    return;
  }
  // A notice's or the power key's application shows the path `standby` but is not standby.
  const overlay = m.mode.kind === "app" && isStandbyOverlay(m.mode.activation.origin);
  if (target === currentPath(m) && !overlay) return;
  applyPath(m, target);
}

function resolveBootMs<Metadata>(config: PhoneConfig<Metadata>): number {
  const { bootMs, bootTimeline } = config;
  if (bootTimeline === undefined) return bootMs ?? DEFAULT_BOOT_MS;
  if (!(bootTimeline instanceof Timeline)) throw new Error("bootTimeline must be a Timeline.");
  if (!Number.isFinite(bootTimeline.durationMs)) {
    throw new Error("bootTimeline must be finite (no loopFrom).");
  }
  if (bootMs !== undefined && bootMs !== 0 && bootMs !== bootTimeline.durationMs) {
    throw new Error(
      `bootMs ${bootMs} conflicts with bootTimeline (${bootTimeline.durationMs} ms); use 0 or omit it.`,
    );
  }
  return bootMs ?? bootTimeline.durationMs;
}

function resolveBootGates<Metadata>(
  config: PhoneConfig<Metadata>,
  bootMs: number,
): readonly BootGate[] {
  const gates = config.bootGates;
  if (gates === undefined) return [];
  if (!Array.isArray(gates)) throw new Error("bootGates must be an array.");
  let previous = 0;
  return gates.map((gate: BootGate, index) => {
    const { atMs } = gate;
    if (!Number.isInteger(atMs) || atMs < 0 || atMs > Math.max(0, bootMs)) {
      throw new Error(
        `bootGates[${index}].atMs must be an integer in 0..${Math.max(0, bootMs)} (received ${atMs}).`,
      );
    }
    if (atMs < previous) {
      throw new Error(`bootGates must be in ascending atMs (${atMs} after ${previous}).`);
    }
    if (typeof gate.open !== "function")
      throw new Error(`bootGates[${index}].open must be a function.`);
    previous = atMs;
    return gate;
  });
}

function positiveInteger(name: string, value: number | undefined): number | undefined {
  if (value !== undefined && (!Number.isInteger(value) || value <= 0)) {
    throw new Error(`${name} must be a positive integer (received ${value}).`);
  }
  return value;
}

function resolveShortcutEntry<Metadata>(
  config: PhoneConfig<Metadata>,
): Machine<Metadata>["shortcutEntry"] {
  const { shortcutEntry } = config;
  if (shortcutEntry === undefined) return undefined;
  const { openDelayMs, invalid } = shortcutEntry;
  if (!Number.isInteger(openDelayMs) || openDelayMs < 0) {
    throw new Error(
      `shortcutEntry.openDelayMs must be a non-negative integer (received ${openDelayMs}).`,
    );
  }
  if (!(invalid instanceof PhoneApplication)) {
    throw new Error("shortcutEntry.invalid must be an application definition.");
  }
  return { openDelayMs, invalid };
}

function nonNegativeInteger(name: string, value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer (received ${value}).`);
  }
  return value;
}

export function createPhone<Metadata = unknown>(config: PhoneConfig<Metadata>): Phone {
  const bootMs = resolveBootMs(config);
  const shortcutWindowMs = nonNegativeInteger(
    "shortcutWindowMs",
    config.shortcutWindowMs,
    SHORTCUT_WINDOW_MS,
  );
  if (shortcutWindowMs === 0) throw new Error("shortcutWindowMs must be a positive integer.");
  if (config.standbyPower !== undefined && !(config.standbyPower instanceof PhoneApplication)) {
    throw new Error("standbyPower must be an application definition.");
  }
  if (config.standbyLine !== undefined && typeof config.standbyLine !== "function") {
    throw new Error("standbyLine must be a function.");
  }
  const m: Machine<Metadata> = {
    config,
    carrier: config.carrier ?? "",
    bootMs,
    bootTimeline: config.bootTimeline,
    bootGates: resolveBootGates(config, bootMs),
    menuOpenDelayMs: nonNegativeInteger("menuOpenDelayMs", config.menuOpenDelayMs, 0),
    shortcutWindowMs,
    rowsWindow: positiveInteger("rowsWindow", config.rowsWindow),
    now: 0,
    mode: { kind: "off" },
    notice: null,
    standbyMode: null,
    standbySince: 0,
    held: new Map(),
    shortcut: null,
    shortcutEntry: resolveShortcutEntry(config),
    runDepth: 0,
    notifying: false,
    deferredRuns: [],
    dirty: false,
    shownSignature: "",
    subscribers: new Set(),
    listeners: { pathchange: new Set(), action: new Set(), sound: new Set() },
  };

  const phone: Phone = {
    send(event: KeyEvent): void {
      run(m, () => handleKeyEvent(m, event));
    },
    pressKey(key: PhoneKey, holdMs = 0): void {
      phone.send({ type: "down", key });
      if (holdMs > 0) phone.tick(m.now + holdMs);
      phone.send({ type: "up", key });
    },
    tick(nowMs: number): void {
      run(m, () => handleTick(m, nowMs));
    },
    navigate(path: string): void {
      run(m, () => handleNavigate(m, path));
    },
    setNotice(notice: Notice | null): void {
      if (notice !== null && notice.path !== undefined && notice.open !== undefined) {
        throw new Error("A notice takes a path or an open application, not both.");
      }
      run(m, () => {
        const cleared = notice === null && m.notice !== null;
        m.notice = notice === null ? null : { ...notice };
        m.dirty = true;
        if (cleared) reenterStandby(m);
      });
    },
    get path(): string {
      return currentPath(m);
    },
    get screen(): ScreenModel {
      return renderScreen(m);
    },
    subscribe(cb: (snap: PhoneSnapshot) => void): () => void {
      m.subscribers.add(cb);
      return () => {
        m.subscribers.delete(cb);
      };
    },
    on<K extends keyof PhoneEventMap>(ev: K, cb: PhoneEventMap[K]): () => void {
      const listeners = m.listeners[ev] as Set<PhoneEventMap[K]>;
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
  };
  return phone;
}
