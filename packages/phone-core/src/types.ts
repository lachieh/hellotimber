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

export type ScreenModel =
  | { kind: "off" }
  | { kind: "boot"; phase: "hands" | "welcome"; frame: number } // hands animation carries the small NOKIA wordmark
  | {
      kind: "standby";
      carrier: string;
      clock?: string;
      signal: 0 | 1 | 2 | 3 | 4;
      battery: 0 | 1 | 2 | 3 | 4;
    }
  | { kind: "menu-carousel"; label: string; menuNumber: number; total: number; iconId: string }
  | { kind: "list"; title: string; items: string[]; selected: number; softkey: string }
  | { kind: "reader"; title: string; lines: string[]; scrollTop: number }
  | { kind: "editor"; title: string; text: string; cursor: number; mode: "abc" | "Abc" | "123" }
  | { kind: "confirm"; text: string; softkey: string }
  | { kind: "custom"; appId: string; frame: Bitmap }; // games draw raw pixels

export type MenuNode =
  | { type: "submenu"; id: string; label: string; iconId?: string; children: MenuNode[] }
  | {
      type: "list";
      id: string;
      label: string;
      items: { id: string; label: string; body: string }[];
    }
  | { type: "reader"; id: string; label: string; body: string }
  | { type: "app"; id: string; label: string; appId: string }
  | { type: "action"; id: string; label: string; action: { kind: "href"; value: string } };

export interface PhoneApp {
  onKey(e: KeyEvent): void;
  tick(dtMs: number): void;
  render(): ScreenModel;
  onExit?(): void;
}
export type AppFactory = (ctx: { exit(): void }) => PhoneApp;

export interface PhoneConfig {
  menu: MenuNode[];
  apps?: Record<string, AppFactory>;
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
  readonly path: string; // e.g. 'standby', 'menu/games/snake'
  readonly screen: ScreenModel;
  subscribe(cb: (snap: PhoneSnapshot) => void): () => void;
  on<K extends keyof PhoneEventMap>(ev: K, cb: PhoneEventMap[K]): () => void;
}
