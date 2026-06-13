import type {
  KeyEvent,
  MenuNode,
  Phone,
  PhoneApp,
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

type SubmenuNode = Extract<MenuNode, { type: "submenu" }>;
type ListNode = Extract<MenuNode, { type: "list" }>;
type ReaderNode = Extract<MenuNode, { type: "reader" }>;
type AppNode = Extract<MenuNode, { type: "app" }>;

/** One level of the navigation stack. stack[0] is always the menu carousel. */
type NavFrame =
  | { kind: "carousel"; index: number }
  | { kind: "submenu"; node: SubmenuNode; selected: number }
  | { kind: "list"; node: ListNode; selected: number }
  | { kind: "item"; node: ListNode; itemIndex: number; scrollTop: number }
  | { kind: "reader"; node: ReaderNode; scrollTop: number };

type Mode =
  | { kind: "off" }
  | { kind: "boot"; startedAt: number; targetPath: string | null }
  | { kind: "standby" }
  | { kind: "nav"; stack: NavFrame[] }
  | { kind: "app"; node: AppNode; app: PhoneApp; stack: NavFrame[] };

interface HeldKey {
  downAt: number;
  longFired: boolean;
}

interface Machine {
  config: PhoneConfig;
  carrier: string;
  bootMs: number;
  /** Last time seen via tick(nowMs). The machine's ONLY clock. */
  now: number;
  mode: Mode;
  held: Map<PhoneKey, HeldKey>;
  /** Menu-shortcut digit window (Task 7). */
  shortcut: { digits: number[]; deadline: number } | null;
  dirty: boolean;
  subscribers: Set<(snap: PhoneSnapshot) => void>;
  listeners: { [K in keyof PhoneEventMap]: Set<PhoneEventMap[K]> };
}

function emit<K extends keyof PhoneEventMap>(
  m: Machine,
  ev: K,
  arg: Parameters<PhoneEventMap[K]>[0],
): void {
  const set = m.listeners[ev] as Set<(a: Parameters<PhoneEventMap[K]>[0]) => void>;
  for (const cb of set) {
    try {
      cb(arg);
    } catch {
      // listeners must never throw the machine into inconsistency
    }
  }
}

/**
 * Every public entry point runs through here: detect path changes (emit
 * 'pathchange' only on actual change) and flush one snapshot to subscribers.
 */
function run(m: Machine, fn: () => void): void {
  const before = currentPath(m);
  fn();
  const after = currentPath(m);
  if (after !== before) {
    m.dirty = true;
    emit(m, "pathchange", after);
  }
  if (m.dirty) {
    m.dirty = false;
    const snap = snapshot(m);
    for (const cb of m.subscribers) {
      try {
        cb(snap);
      } catch {
        // subscribers must never throw the machine into inconsistency
      }
    }
  }
}

function snapshot(m: Machine): PhoneSnapshot {
  return { path: currentPath(m), screen: renderScreen(m), poweredOn: m.mode.kind !== "off" };
}

function stackIds(stack: NavFrame[]): string[] {
  const ids: string[] = [];
  for (const f of stack) {
    if (f.kind === "submenu" || f.kind === "list" || f.kind === "reader") ids.push(f.node.id);
  }
  return ids;
}

function currentPath(m: Machine): string {
  if (m.mode.kind === "nav") {
    const ids = stackIds(m.mode.stack);
    return ids.length === 0 ? "menu" : `menu/${ids.join("/")}`;
  }
  if (m.mode.kind === "app") {
    return `menu/${[...stackIds(m.mode.stack), m.mode.node.id].join("/")}`;
  }
  return "standby"; // off, boot and standby all read as 'standby'
}

/** Greedy word-wrap at `width` chars; hard-breaks longer words; '\n' = paragraph. */
export function wrapLines(body: string, width = READER_LINE_CHARS): string[] {
  const lines: string[] = [];
  for (const para of body.split("\n")) {
    let line = "";
    for (const word of para.split(" ")) {
      let w = word;
      while (w.length > width) {
        if (line !== "") {
          lines.push(line);
          line = "";
        }
        lines.push(w.slice(0, width));
        w = w.slice(width);
      }
      if (line === "") line = w;
      else if (line.length + 1 + w.length <= width) line = `${line} ${w}`;
      else {
        lines.push(line);
        line = w;
      }
    }
    lines.push(line);
  }
  return lines;
}

function renderScreen(m: Machine): ScreenModel {
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
      };
    case "nav":
      return renderFrame(m, m.mode.stack[m.mode.stack.length - 1]!);
    case "app":
      try {
        return m.mode.app.render();
      } catch {
        return { kind: "reader", title: m.mode.node.label, lines: ["App error"], scrollTop: 0 };
      }
  }
}

function renderFrame(m: Machine, frame: NavFrame): ScreenModel {
  switch (frame.kind) {
    case "carousel": {
      const node = m.config.menu[frame.index]!;
      const iconId = node.type === "submenu" && node.iconId !== undefined ? node.iconId : node.id;
      return {
        kind: "menu-carousel",
        label: node.label,
        menuNumber: frame.index + 1,
        total: m.config.menu.length,
        iconId,
      };
    }
    case "submenu":
      return {
        kind: "list",
        title: frame.node.label,
        items: frame.node.children.map((c) => c.label),
        selected: frame.selected,
        softkey: "Select",
      };
    case "list":
      return {
        kind: "list",
        title: frame.node.label,
        items: frame.node.items.map((i) => i.label),
        selected: frame.selected,
        softkey: "Select",
      };
    case "item": {
      const item = frame.node.items[frame.itemIndex]!;
      return {
        kind: "reader",
        title: item.label,
        lines: wrapLines(item.body),
        scrollTop: frame.scrollTop,
      };
    }
    case "reader":
      return {
        kind: "reader",
        title: frame.node.label,
        lines: wrapLines(frame.node.body),
        scrollTop: frame.scrollTop,
      };
  }
}

// --- power -----------------------------------------------------------------

function togglePower(m: Machine): void {
  if (m.mode.kind === "off") powerOn(m, null);
  else powerOff(m);
}

function powerOn(m: Machine, targetPath: string | null): void {
  if (m.bootMs <= 0) {
    m.mode = { kind: "standby" };
    if (targetPath !== null) applyPath(m, targetPath);
  } else {
    m.mode = { kind: "boot", startedAt: m.now, targetPath };
  }
  m.dirty = true;
}

function powerOff(m: Machine): void {
  exitAppIfActive(m);
  m.mode = { kind: "off" };
  m.shortcut = null;
  m.dirty = true;
}

/** Tear down a hosted app when the machine leaves it (power off, navigate, …). */
function exitAppIfActive(m: Machine): void {
  if (m.mode.kind !== "app") return;
  for (const h of m.held.values()) h.longFired = true; // swallow in-flight key releases
  try {
    m.mode.app.onExit?.();
  } catch {
    // apps must never throw the machine into inconsistency
  }
}

function goStandby(m: Machine): void {
  exitAppIfActive(m);
  m.mode = { kind: "standby" };
  m.shortcut = null;
  m.dirty = true;
}

function tickBoot(m: Machine): void {
  if (m.mode.kind !== "boot") return;
  m.dirty = true; // animation frame may have advanced
  if (m.now - m.mode.startedAt >= m.bootMs) {
    const target = m.mode.targetPath;
    m.mode = { kind: "standby" };
    if (target !== null) applyPath(m, target);
  }
}

// --- key events --------------------------------------------------------------

function handleKeyEvent(m: Machine, e: KeyEvent): void {
  if (e.type === "down") {
    if (m.held.has(e.key)) return; // duplicate down (e.g. OS key repeat)
    m.held.set(e.key, { downAt: m.now, longFired: false });
    if (m.mode.kind !== "off") emit(m, "sound", { kind: "key", id: "beep" });
    forwardToApp(m, e);
    return;
  }
  const held = m.held.get(e.key);
  m.held.delete(e.key);
  if (m.mode.kind === "app") {
    forwardToApp(m, e); // the app owns its keys (incl. its own long-press logic)
    return;
  }
  if (held === undefined || held.longFired) return; // long press already handled in tick()
  onShortPress(m, e.key);
}

function forwardToApp(m: Machine, e: KeyEvent): void {
  if (m.mode.kind !== "app") return;
  try {
    m.mode.app.onKey(e);
  } catch {
    // apps must never throw the machine into inconsistency
  }
  m.dirty = true;
}

function handleTick(m: Machine, nowMs: number): void {
  m.now = Math.max(m.now, nowMs);
  for (const [key, h] of m.held) {
    if (!h.longFired && m.now - h.downAt >= LONG_PRESS_MS) {
      h.longFired = true;
      onLongPress(m, key);
    }
  }
  if (m.mode.kind === "boot") tickBoot(m);
}

function onShortPress(m: Machine, key: PhoneKey): void {
  switch (m.mode.kind) {
    case "standby":
      standbyShortPress(m, key);
      return;
    case "nav":
      navShortPress(m, key);
      return;
    default:
      return; // off/boot ignore short presses; apps got the raw events already
  }
}

function onLongPress(m: Machine, key: PhoneKey): void {
  if (key === "power") {
    togglePower(m);
    return;
  }
  if (m.mode.kind === "nav" && key === "c") {
    goStandby(m); // hold-C exits to standby
  }
  // everything else: long presses belong to the active app (if any) or do nothing
}

function standbyShortPress(_m: Machine, _key: PhoneKey): void {
  // Replaced in Task 5 (navi → menu, up → phone book, down → dialled numbers).
}

function navShortPress(_m: Machine, _key: PhoneKey): void {
  // Replaced in Task 5 (carousel), extended in Tasks 6 (lists/readers) and 7 (shortcuts).
}

function applyPath(_m: Machine, _path: string): void {
  // Replaced in Task 5 (jump the machine to a resolved menu path).
}

function handleNavigate(_m: Machine, _path: string): void {
  // Replaced in Task 10 (external router control).
}

// --- public factory ----------------------------------------------------------

export function createPhone(config: PhoneConfig): Phone {
  const m: Machine = {
    config,
    carrier: config.carrier ?? "LACHLAN",
    bootMs: config.bootMs ?? DEFAULT_BOOT_MS,
    now: 0,
    mode: { kind: "off" },
    held: new Map(),
    shortcut: null,
    dirty: false,
    subscribers: new Set(),
    listeners: { pathchange: new Set(), action: new Set(), sound: new Set() },
  };

  const phone: Phone = {
    send(e: KeyEvent): void {
      run(m, () => handleKeyEvent(m, e));
    },
    pressKey(key: PhoneKey, holdMs = 0): void {
      phone.send({ type: "down", key });
      if (holdMs > 0) phone.tick(m.now + holdMs); // advances the machine clock
      phone.send({ type: "up", key });
    },
    tick(nowMs: number): void {
      run(m, () => handleTick(m, nowMs));
    },
    navigate(path: string): void {
      run(m, () => handleNavigate(m, path));
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
      const set = m.listeners[ev] as Set<PhoneEventMap[K]>;
      set.add(cb);
      return () => {
        set.delete(cb);
      };
    },
  };
  return phone;
}
