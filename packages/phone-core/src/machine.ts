import type {
  ApplicationContext,
  DeactivationReason,
  PhoneApplication,
  PhoneApplicationSession,
} from "./application";
import type {
  ActionEntry,
  ApplicationEntry,
  ListEntry,
  MenuEntry,
  MenuEntryVisitor,
  ReaderEntry,
  SubmenuEntry,
} from "./menu";
import { childrenOf, normalizePath, parsePath, resolveIds } from "./paths";
import type {
  KeyEvent,
  MenuIndicator,
  MenuListItem,
  Phone,
  PhoneConfig,
  PhoneEventMap,
  PhoneKey,
  PhoneSnapshot,
  ScreenModel,
} from "./types";

export const LONG_PRESS_MS = 800;
export const SHORTCUT_WINDOW_MS = 3000;
export const BOOT_FRAME_MS = 200;
export const DEFAULT_BOOT_MS = 3000;
export const READER_VISIBLE_LINES = 3;
export const READER_LINE_CHARS = 14;

/** One level of the navigation stack. stack[0] is always the menu carousel. */
type NavFrame<Metadata> =
  | { kind: "carousel"; index: number }
  | { kind: "submenu"; entry: SubmenuEntry<Metadata>; selected: number }
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

interface AppActivation<Metadata> {
  origin: ApplicationEntry<Metadata>;
  definition: PhoneApplication;
  session: PhoneApplicationSession | null;
  activationToken: object;
  stack: NavFrame<Metadata>[];
  deactivationReason: DeactivationReason | null;
  deactivated: boolean;
}

type Mode<Metadata> =
  | { kind: "off" }
  | { kind: "boot"; startedAt: number; targetPath: string | null }
  | { kind: "standby" }
  | { kind: "nav"; stack: NavFrame<Metadata>[] }
  | { kind: "app"; activation: AppActivation<Metadata> };

interface HeldKey {
  downAt: number;
  longFired: boolean;
  shortcutCaptured: boolean;
}

type Notice = { text: string; softkey: string; path?: string };

/** Clamp an index into [0, length-1] (0 for an empty list). */
function clampIndex(index: number, length: number): number {
  return length === 0 ? 0 : Math.min(Math.max(0, index), length - 1);
}

interface Machine<Metadata> {
  config: PhoneConfig<Metadata>;
  carrier: string;
  bootMs: number;
  /** Last time seen via tick(nowMs). The machine's ONLY clock. */
  now: number;
  mode: Mode<Metadata>;
  /** Standby-scoped notice — survives menu round-trips until read/cleared. */
  notice: Notice | null;
  held: Map<PhoneKey, HeldKey>;
  shortcut: {
    entries: MenuEntry<Metadata>[];
    nextLevel: readonly MenuEntry<Metadata>[];
    deadline: number;
  } | null;
  runDepth: number;
  notifying: boolean;
  deferredRuns: (() => void)[];
  dirty: boolean;
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
  const after = currentPath(m);
  if (after !== before) {
    m.dirty = true;
    emit(m, "pathchange", after);
  }
  if (!m.dirty) return;
  m.dirty = false;
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

function stackOrders<Metadata>(stack: readonly NavFrame<Metadata>[]): number[] {
  const orders: number[] = [];
  for (const frame of stack) {
    if (
      frame.kind === "submenu" ||
      frame.kind === "list" ||
      frame.kind === "reader" ||
      frame.kind === "action"
    ) {
      orders.push(frame.entry.order.value);
    }
  }
  return orders;
}

function menuIndicator<Metadata>(m: Machine<Metadata>): MenuIndicator {
  let segments: number[];
  if (m.mode.kind === "app") {
    segments = [...stackOrders(m.mode.activation.stack), m.mode.activation.origin.order.value];
  } else if (m.mode.kind === "nav") {
    segments = stackOrders(m.mode.stack);
    if (segments.length === 0) {
      const carousel = m.mode.stack[0];
      if (carousel?.kind !== "carousel") throw new Error("Navigation stack has no carousel.");
      segments = [m.config.menu.entries[carousel.index]!.entry.order.value];
    }
  } else {
    segments = [];
  }
  return {
    segments,
    awaitingNext: m.shortcut !== null && m.shortcut.entries.length > 0,
  };
}

function currentPath<Metadata>(m: Machine<Metadata>): string {
  if (m.mode.kind === "nav") {
    const slugs = stackSlugs(m.mode.stack);
    return slugs.length === 0 ? "menu" : `menu/${slugs.join("/")}`;
  }
  if (m.mode.kind === "app") {
    return `menu/${[
      ...stackSlugs(m.mode.activation.stack),
      m.mode.activation.origin.slug.value,
    ].join("/")}`;
  }
  return "standby";
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
      return {
        kind: "standby",
        carrier: m.carrier,
        clock: m.config.clock?.(),
        signal: 4,
        battery: 4,
        ...(m.notice === null
          ? {}
          : { notice: { text: m.notice.text, softkey: m.notice.softkey } }),
      };
    case "nav": {
      const frame = m.mode.stack[m.mode.stack.length - 1]!;
      if (frame.kind !== "action") return renderFrame(m, frame);
      const parent = m.mode.stack[m.mode.stack.length - 2];
      if (parent === undefined || parent.kind === "action") return { kind: "off" };
      return renderFrame(m, parent);
    }
    case "app": {
      const { origin, session } = m.mode.activation;
      if (session === null) {
        return {
          kind: "reader",
          title: origin.label,
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
          title: origin.label,
          lines: ["App error"],
          scrollTop: 0,
          menuIndicator: menuIndicator(m),
        };
      }
    }
  }
}

function renderFrame<Metadata>(
  m: Machine<Metadata>,
  frame: DisplayNavFrame<Metadata>,
): ScreenModel {
  switch (frame.kind) {
    case "carousel": {
      const slot = m.config.menu.entries[frame.index]!;
      return {
        kind: "menu-carousel",
        label: slot.entry.label,
        menuNumber: slot.entry.order.value,
        total: m.config.menu.entries.length,
        iconId: slot.graphic.id,
        menuIndicator: menuIndicator(m),
      };
    }
    case "submenu":
      return {
        kind: "list",
        title: frame.entry.label,
        items: frame.entry.children.entries.map((entry) => entry.label),
        selected: frame.selected,
        softkey: "Select",
        menuIndicator: menuIndicator(m),
      };
    case "list": {
      const items = frame.entry.source.read();
      const { index } = selectedListItem(frame, items);
      return {
        kind: "list",
        title: frame.entry.label,
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
        title: frame.entry.label,
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
  origin: ApplicationEntry<Metadata>,
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
    exit(): void {
      run(m, () => {
        if (!isActive(m, activation, token)) return;
        cancelShortcut(m);
        swallowHeldReleases(m);
        deactivate(activation, "exit");
        m.mode = { kind: "nav", stack: activation.stack };
        m.dirty = true;
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

function togglePower<Metadata>(m: Machine<Metadata>): void {
  if (m.mode.kind === "off") powerOn(m, null);
  else powerOff(m);
}

function powerOn<Metadata>(m: Machine<Metadata>, targetPath: string | null): void {
  if (m.bootMs <= 0) {
    m.mode = { kind: "standby" };
    if (targetPath !== null) applyPath(m, targetPath);
  } else {
    m.mode = { kind: "boot", startedAt: m.now, targetPath };
  }
  m.dirty = true;
}

function powerOff<Metadata>(m: Machine<Metadata>): void {
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
  m.dirty = true;
  if (m.now - m.mode.startedAt < m.bootMs) return;
  const target = m.mode.targetPath;
  m.mode = { kind: "standby" };
  if (target !== null) applyPath(m, target);
}

function handleKeyEvent<Metadata>(m: Machine<Metadata>, event: KeyEvent): void {
  if (event.type === "down") {
    if (m.held.has(event.key)) return;
    const shortcutCaptured = m.shortcut !== null && shortcutNumber(event.key) !== null;
    m.held.set(event.key, { downAt: m.now, longFired: false, shortcutCaptured });
    if (m.mode.kind !== "off") emit(m, "sound", { kind: "key", id: "beep" });
    if (shortcutCaptured) return;
    if (m.shortcut !== null) cancelShortcut(m);
    forwardToApp(m, event);
    return;
  }

  const held = m.held.get(event.key);
  m.held.delete(event.key);
  if (held?.shortcutCaptured) {
    if (!held.longFired && m.shortcut !== null) {
      shortcutDigit(m, shortcutNumber(event.key)!);
    }
    return;
  }
  if (m.mode.kind === "app") {
    const activation = m.mode.activation;
    if (activation.session === null) {
      if (held !== undefined && !held.longFired && event.key === "c") {
        m.mode = { kind: "nav", stack: activation.stack };
        m.dirty = true;
      }
    } else {
      forwardToApp(m, event);
    }
    return;
  }
  if (held === undefined || held.longFired) return;
  onShortPress(m, event.key);
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
  if (m.mode.kind === "boot") tickBoot(m);
  if (m.shortcut !== null && m.now >= m.shortcut.deadline) cancelShortcut(m);
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
      const target = m.notice.path;
      m.notice = null;
      m.dirty = true;
      if (target !== undefined) applyPath(m, target);
      return;
    }
    if (key === "c") {
      m.notice = null;
      m.dirty = true;
      return;
    }
  }
  if (key === "navi") enterMenu(m);
  else if (key === "up") tryApplyPath(m, "menu/phone-book/search");
  else if (key === "down") tryApplyPath(m, "menu/call-register/dialled-numbers");
}

function navShortPress<Metadata>(m: Machine<Metadata>, key: PhoneKey): void {
  if (m.mode.kind !== "nav") return;
  const stack = m.mode.stack;
  const frame = stack[stack.length - 1]!;
  if (key === "c") {
    popFrame(m);
    return;
  }

  switch (frame.kind) {
    case "carousel": {
      const total = m.config.menu.entries.length;
      if (key === "down") {
        frame.index = wrapIndex(frame.index + 1, total);
        m.dirty = true;
      } else if (key === "up") {
        frame.index = wrapIndex(frame.index - 1, total);
        m.dirty = true;
      } else if (key === "navi") {
        enterEntry(m, m.config.menu.entries[frame.index]!.entry);
      }
      return;
    }
    case "submenu": {
      const entries = frame.entry.children.entries;
      if (entries.length === 0) return;
      if (key === "down") {
        frame.selected = wrapIndex(frame.selected + 1, entries.length);
        m.dirty = true;
      } else if (key === "up") {
        frame.selected = wrapIndex(frame.selected - 1, entries.length);
        m.dirty = true;
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
    m.mode = { kind: "nav", stack: [{ kind: "carousel", index: 0 }] };
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
  m.mode = { kind: "nav", stack: [{ kind: "carousel", index: 0 }] };
  m.shortcut = {
    entries: [],
    nextLevel: m.config.menu.entries.map((slot) => slot.entry),
    deadline: m.now + SHORTCUT_WINDOW_MS,
  };
  m.dirty = true;
}

function shortcutNumber(key: PhoneKey): number | null {
  return key >= "1" && key <= "9" ? Number(key) : null;
}

function shortcutDigit<Metadata>(m: Machine<Metadata>, digit: number): void {
  const shortcut = m.shortcut;
  if (shortcut === null) return;
  const entry = shortcut.nextLevel.find((candidate) => candidate.order.value === digit);
  if (entry === undefined) return;

  shortcut.entries.push(entry);
  shortcut.nextLevel = childrenOf(entry);
  shortcut.deadline = m.now + SHORTCUT_WINDOW_MS;
  buildNavStack(m, shortcut.entries, true);
}

function cancelShortcut<Metadata>(m: Machine<Metadata>): void {
  if (m.shortcut === null) return;
  const wasVisible = m.shortcut.entries.length > 0;
  m.shortcut = null;
  if (wasVisible) m.dirty = true;
}

function buildNavStack<Metadata>(
  m: Machine<Metadata>,
  entries: readonly MenuEntry<Metadata>[],
  preserveShortcut = false,
): void {
  if (!preserveShortcut) m.shortcut = null;
  const stack: NavFrame<Metadata>[] = [{ kind: "carousel", index: 0 }];
  for (const entry of entries) {
    const parent = stack[stack.length - 1]!;
    const index = entry.order.value - 1;
    if (parent.kind === "carousel") parent.index = index;
    else if (parent.kind === "submenu") parent.selected = index;

    const destination = entry.accept<"continue" | "application" | "action">({
      visitSubmenu(submenu) {
        stack.push({ kind: "submenu", entry: submenu, selected: 0 });
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
        startApplication(m, application, application.application, stack);
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
  const visitor: MenuEntryVisitor<Metadata, void> = {
    visitSubmenu(submenu) {
      if (m.mode.kind === "nav") {
        m.mode.stack.push({ kind: "submenu", entry: submenu, selected: 0 });
        m.dirty = true;
      }
    },
    visitList(list) {
      if (m.mode.kind === "nav") {
        m.mode.stack.push({ kind: "list", entry: list, selectedId: null, fallbackIndex: 0 });
        m.dirty = true;
      }
    },
    visitReader(reader) {
      if (m.mode.kind === "nav") {
        m.mode.stack.push({ kind: "reader", entry: reader, scrollTop: 0 });
        m.dirty = true;
      }
    },
    visitAction(action) {
      emit(m, "action", action.action);
    },
    visitApplication(application) {
      if (m.mode.kind === "nav") {
        startApplication(m, application, application.application, m.mode.stack);
      }
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
  m.dirty = true;
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
  if (target === currentPath(m)) return;
  applyPath(m, target);
}

export function createPhone<Metadata = unknown>(config: PhoneConfig<Metadata>): Phone {
  const m: Machine<Metadata> = {
    config,
    carrier: config.carrier ?? "LACHLAN",
    bootMs: config.bootMs ?? DEFAULT_BOOT_MS,
    now: 0,
    mode: { kind: "off" },
    notice: null,
    held: new Map(),
    shortcut: null,
    runDepth: 0,
    notifying: false,
    deferredRuns: [],
    dirty: false,
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
      run(m, () => {
        m.notice = notice === null ? null : { ...notice };
        m.dirty = true;
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
