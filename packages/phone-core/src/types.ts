export type PhoneKey =
  | "power"
  | "navi"
  | "c"
  | "up"
  | "down"
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "*"
  | "#";

export interface KeyEvent {
  type: "down" | "up";
  key: PhoneKey;
}

/** 1bpp bitmap, row-major, 0 = clear, 1 = set. */
export interface Bitmap {
  width: number;
  height: number;
  pixels: Uint8Array;
}

export interface MenuIndicator {
  /** One-based MenuOrder values from the root to the screen being displayed. */
  segments: readonly number[];
  /** True while another 1-9 shortcut digit is being accepted (after at least one digit). */
  awaitingNext: boolean;
  /** Present only while the shortcut window is open and no digit has been accepted. */
  awaitingFirst?: true;
  /**
   * PhoneConfig.shortcutEntry only: present while a digit is awaited at a level. It holds the
   * digits typed toward that level's next menu number ("" = none yet); `segments` then end at the
   * level the digits belong to, and the painter draws `segments-typed` with the awaiting mark and
   * adds no selection number (`12-` and dots, `11-0` and dots, `1` and dots).
   */
  typed?: string;
  /**
   * Present for SubmenuOptions.entryIndicatorMs after Select entered the shown level: `segments`
   * are the level's own path, which the painter draws with the awaiting mark and no selection
   * number (`5-9-` and dots, plan 14 closeout).
   */
  entering?: true;
}

export interface StandbyIndicators {
  voicemail?: boolean;
  message?: boolean;
}

export type ScreenModel =
  | { kind: "off" }
  // With PhoneConfig.bootTimeline, boot is always phase "hands" and frame is the timeline frame.
  | { kind: "boot"; phase: "hands" | "welcome"; frame: number } // hands animation carries the small NOKIA wordmark
  | {
      kind: "standby";
      carrier: string;
      clock?: string;
      signal: 0 | 1 | 2 | 3 | 4;
      battery: 0 | 1 | 2 | 3 | 4;
      indicators?: StandbyIndicators;
      /** Standby-scoped notice, e.g. "1 message received" + Read. */
      notice?: { text: string; softkey: string };
      /** Present only during PhoneConfig.menuOpenDelayMs, after Menu and before the carousel. */
      leaving?: true;
    }
  | {
      kind: "menu-carousel";
      label: string;
      menuNumber: number;
      total: number;
      iconId: string;
      /** Visible frame of the slot graphic's timeline; present iff the graphic has a timeline. */
      iconFrame?: number;
      menuIndicator: MenuIndicator;
      /** PhoneConfig.shortcutEntry only: a typed entry is about to open (no soft key is drawn). */
      opening?: true;
    }
  | {
      kind: "list";
      title: string;
      items: string[];
      /** Menu numbers of a submenu's items; present only when they are not 1..n (hidden entries). */
      itemOrders?: number[];
      selected: number;
      softkey: string;
      menuIndicator?: MenuIndicator;
      /** Present only for page submenus (one item per screen); absent = rows. */
      presentation?: "pages";
      /** The selected child's current value, when the submenu's detail reader returns one. */
      detail?: string;
      /** Index of the item on the first visible row; rows submenus with PhoneConfig.rowsWindow only. */
      windowTop?: number;
      /** PhoneConfig.shortcutEntry only: a typed entry is about to open (no soft key is drawn). */
      opening?: true;
    }
  | {
      kind: "reader";
      title: string;
      lines: string[];
      scrollTop: number;
      menuIndicator?: MenuIndicator;
    }
  | {
      kind: "editor";
      title: string;
      text: string;
      cursor: number;
      mode: "abc" | "Abc" | "123";
      /** Countdown basis: screens render `limit - text.length` (SMS 160). */
      limit?: number;
    }
  | { kind: "confirm"; text: string; softkey: string }
  | { kind: "custom"; appId: string; frame: Bitmap }; // games draw raw pixels

/** One entry of a list node. */
export interface MenuListItem {
  id: string;
  label: string;
  body: string;
}

export interface PhoneConfig<Metadata = unknown> {
  menu: PhoneMenu<Metadata>;
  carrier?: string; // standby line, default ""
  clock?: () => string | undefined; // host supplies time; re-read on each tick
  bootMs?: number; // 0 skips boot; otherwise defaults to bootTimeline?.durationMs ?? 3000
  /** Finite boot animation; when set, boot lasts its durationMs. */
  bootTimeline?: Timeline;
  /** Paths opened by ▲/▼ in standby; unknown/absent = no-op. */
  standbyKeys?: { up?: string; down?: string };
  /** Menu in standby: standby stays on screen (`leaving: true`) this long before the carousel. Default 0. */
  menuOpenDelayMs?: number;
  /** Length of the Menu+digit shortcut window, from the Menu press and after each digit. Default 3000. */
  shortcutWindowMs?: number;
  /**
   * Rows submenus keep a stateful circular window of this many rows and their list models carry
   * `windowTop` (see `rowsWindowTop`). Positive integer. Default: off (no `windowTop`).
   */
  rowsWindow?: number;
  /**
   * Stock shortcut digits (default off: one digit per level, orders 1-9). Digits 0-9 form menu
   * numbers at each level: a number that is a prefix of a longer one (or all zeros) waits for
   * `shortcutWindowMs` and then resolves; a number that selects an entry shows it at once
   * (`opening: true`) and opens it `openDelayMs` later (a submenu with an intro runs it at once);
   * digits that match no number open `invalid`, whose exit goes to standby. The window restarts
   * at each digit, at a resolve and when a shortcut intro ends; an opening that falls due during
   * an intro waits for the window end.
   */
  shortcutEntry?: { openDelayMs: number; invalid: PhoneApplication };
  /**
   * Plan 15: applications that hold the boot at offsets into it, in ascending `atMs` (equal
   * offsets run in order). While a gate's application runs the boot clock is paused, the screen
   * and keys are the application's, the path stays `standby`, and `navigate()` only records the
   * target applied when the boot ends; the power long press still powers off. Its `exit()`
   * resumes the boot at `atMs`; `exit({ to: "standby" })` ends the boot at once; `levels`,
   * `select` and `row` throw. With `bootMs: 0` the gates run in order at power-on. An exception
   * from `open()` or `createSession` skips the gate.
   */
  bootGates?: readonly BootGate[];
}

/** Plan 15: an application that may hold the boot at an offset into it. */
export interface BootGate {
  /** Offset into the boot (ms) at which the gate is asked; an integer in 0..bootMs. */
  atMs: number;
  /**
   * Called once per power-on when the boot reaches `atMs`. An application holds the boot until it
   * exits; undefined lets the boot go on.
   */
  open(): PhoneApplication | undefined;
}

export interface PhoneSnapshot {
  path: string;
  screen: ScreenModel;
  poweredOn: boolean;
}

export type PhoneEventMap = {
  pathchange: (path: string) => void;
  action: (action: { kind: "href"; value: string }) => void; // website opens links
  sound: (sound: { kind: "key" | "tone"; id: string }) => void; // website plays audio
};

export interface Phone {
  send(e: KeyEvent): void;
  pressKey(key: PhoneKey, holdMs?: number): void; // convenience: down + up
  tick(nowMs: number): void; // drives timers/animations
  navigate(path: string): void; // external (router) control
  // Standby-scoped notice ("1 message received"): standby renders it;
  // NaviKey navigates to `path` (default: clears); C clears; null clears.
  setNotice(n: { text: string; softkey: string; path?: string } | null): void;
  readonly path: string; // e.g. 'standby', 'menu/games/snake'
  readonly screen: ScreenModel;
  subscribe(cb: (snap: PhoneSnapshot) => void): () => void;
  on<K extends keyof PhoneEventMap>(ev: K, cb: PhoneEventMap[K]): () => void;
}
import type { PhoneApplication } from "./application";
import type { PhoneMenu } from "./menu";
import type { Timeline } from "./timeline";
