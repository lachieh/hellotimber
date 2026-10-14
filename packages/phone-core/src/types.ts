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
  /** True while another 1-9 shortcut digit is being accepted. */
  awaitingNext: boolean;
}

export interface StandbyIndicators {
  voicemail?: boolean;
  message?: boolean;
}

export type ScreenModel =
  | { kind: "off" }
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
    }
  | {
      kind: "menu-carousel";
      label: string;
      menuNumber: number;
      total: number;
      iconId: string;
      menuIndicator: MenuIndicator;
    }
  | {
      kind: "list";
      title: string;
      items: string[];
      selected: number;
      softkey: string;
      menuIndicator?: MenuIndicator;
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
  carrier?: string; // standby line, default 'LACHLAN'
  clock?: () => string | undefined; // host supplies time; phone shows it
  bootMs?: number; // 0 to skip boot in tests
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
import type { PhoneMenu } from "./menu";
