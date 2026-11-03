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
  divert?: boolean;
  voicemail?: boolean;
  message?: boolean;
  /** Plan 17: the host's "silent" icon (stock: drawn top-left while the active profile is silent). */
  silent?: boolean;
  /** Plan 21: an alarm is set. */
  alarm?: boolean;
  /** Plan 21: a countdown runs. */
  timer?: boolean;
  /** Plan 21: the stopwatch runs. */
  stopwatch?: boolean;
}

/** A standby ladder's bars: 0 (none) to 4 (full). */
export type StatusLevel = 0 | 1 | 2 | 3 | 4;

export type ScreenModel =
  | { kind: "off" }
  // With PhoneConfig.bootTimeline, boot is always phase "hands" and frame is the timeline frame.
  | { kind: "boot"; phase: "hands" | "welcome"; frame: number } // hands animation carries the small NOKIA wordmark
  | {
      kind: "standby";
      carrier: string;
      clock?: string;
      signal: StatusLevel;
      battery: StatusLevel;
      indicators?: StandbyIndicators;
      /** Plan 17: the host's second standby line (PhoneConfig.standbyLine); absent when it returns none. */
      line?: string;
      /** Standby-scoped notice, e.g. "1 message received" + Read. */
      notice?: { text: string; softkey: string };
      /**
       * Present only during PhoneConfig.menuOpenDelayMs (after Menu, before the carousel) and
       * PhoneConfig.standbyKeyDelayMs (after a standby key, before its target).
       */
      leaving?: true;
    }
  | {
      kind: "menu-carousel";
      label: string;
      menuNumber: number;
      /**
       * The slot's 1-based place among `total`; present only when it differs from `menuNumber`
       * (an earlier menu number is skipped, as v6.39's SIM services is Menu 14 in slot 13).
       */
      position?: number;
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
  /** Plan 32: the signal ladder's bars on standby, re-read on each tick. Default: full (4). */
  signal?: () => StatusLevel;
  /** Plan 32: the battery ladder's bars on standby, re-read on each tick. Default: full (4). */
  battery?: () => StatusLevel;
  bootMs?: number; // 0 skips boot; otherwise defaults to bootTimeline?.durationMs ?? 3000
  /** Finite boot animation; when set, boot lasts its durationMs. */
  bootTimeline?: Timeline;
  /**
   * Paths (or, plan 19, applications) opened by ▲/▼ in standby; unknown/absent = no-op. An
   * application runs as a standby application (plan 18 D11 rules: empty stack, path stays
   * `standby`, `menuIndicator()` has no segments, `exit()` returns to standby, `levels`/`select`/
   * `row` throw).
   */
  standbyKeys?: { up?: string | PhoneApplication; down?: string | PhoneApplication };
  /**
   * Plan 19: after a standby key, standby stays on screen with `leaving: true` this long before
   * its target opens (as `menuOpenDelayMs` for Menu); a key meanwhile opens the target at once
   * and goes to it. Default 0; non-negative integer.
   */
  standbyKeyDelayMs?: number;
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
   * digits that match no number open `invalid`, whose exit goes to standby. A digit while a
   * leaf is about to open opens it at once and is spent; an application the shortcut opened
   * takes the digits typed into it, unless it is a shortcut level
   * (PhoneApplicationSession.shortcutLevel: an option list), whose options they number, also
   * when typed while it is about to open. The window restarts at each digit, at a resolve and when a
   * shortcut intro ends; an opening that falls due during an intro waits for the window end.
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
  /**
   * Plan 18: standby indicators (message, voicemail; plan 21: alarm, timer, stopwatch), re-read
   * on every tick like `clock`; a change emits one snapshot. Emitted on the standby model only
   * when a field is true. Default: none.
   */
  standbyIndicators?: () => StandbyIndicators | undefined;
  /**
   * Plan 21: polled on every tick while the phone is on and not booting. An application it
   * returns interrupts whatever is shown: the interrupted mode is held (no keys, no ticks), the
   * path is unchanged, navigate() is recorded and applied after it. Its exit() restores the held
   * mode; exit({ to: "standby" }) deactivates the held mode (reason `navigate`) and shows standby;
   * levels/select/row throw. Default: none.
   */
  interruption?: () => PhoneApplication | undefined;
  /**
   * Plan 21: polled on every tick while the phone is off. An application it returns powers the
   * phone on without the boot (empty stack, path `standby`); its exit() powers the phone off
   * again; exit({ to: "standby" }) runs the normal power-on (boot and gates). Default: none.
   */
  wake?: () => PhoneApplication | undefined;
  /**
   * Plan 17: a second standby line under the operator, re-read on every tick with the time since
   * standby was last entered (boot end, a return from the menus or an application, a notice
   * cleared); a change emits one snapshot. Emitted on the standby model (and the standby Menu
   * leaves for `menuOpenDelayMs`) when it returns a string; an exception omits it. Default: none.
   */
  standbyLine?: (shownMs: number) => string | undefined;
  /**
   * Plan 17: opened on the power key's key-down at standby as a standby application (empty stack,
   * path `standby`, `menuIndicator()` without segments, `exit()` returns to standby;
   * `levels`/`select`/`row` throw). Every later key reaches it, the opening press's release and
   * the power key's own presses included; the power long press still powers off. It opens over a
   * standby notice (the notice stays), and when the running application's handling of the power
   * key's down leaves for standby (a note shown at standby); never in the menus, another
   * application or the boot, where the short press does nothing.
   */
  standbyPower?: PhoneApplication;
  /**
   * Plan 22: keys that start a standby application with themselves (stock number entry). At
   * standby the key-down of a listed key runs `open(key)` as a standby application (empty stack,
   * path `standby`, `menuIndicator()` without segments, `exit()` returns to standby; a notice
   * shown is cleared) and forwards that key-down, and later its release, to it. In menu levels a
   * listed key that no open shortcut window takes leaves the menus (as C held does) and does the
   * same; at the menu carousel so does a shortcut window's first key that begins no menu number.
   * Not consulted during the boot, a boot gate, an application (which hands keys over with
   * `exit({ to: "standby", key })`) or an interruption. `keys` must not hold `navi`, `c` or
   * `power` (throws). Default: none.
   */
  standbyEntry?: { readonly keys: readonly PhoneKey[]; open(key: PhoneKey): PhoneApplication };
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
  /**
   * Standby-scoped notice ("1 message received"): standby renders it; C clears it. Navi navigates
   * to `path` (default: clears), or (plan 18) runs `open` as a standby application: empty stack,
   * path stays `standby`, `menuIndicator()` has no segments, `exit()` returns to standby
   * (`levels`/`select`/`row` throw). `path` and `open` together throw. null clears.
   */
  setNotice(
    n: { text: string; softkey: string; path?: string; open?: PhoneApplication } | null,
  ): void;
  readonly path: string; // e.g. 'standby', 'menu/games/snake'
  readonly screen: ScreenModel;
  subscribe(cb: (snap: PhoneSnapshot) => void): () => void;
  on<K extends keyof PhoneEventMap>(ev: K, cb: PhoneEventMap[K]): () => void;
}
import type { PhoneApplication } from "./application";
import type { PhoneMenu } from "./menu";
import type { Timeline } from "./timeline";
