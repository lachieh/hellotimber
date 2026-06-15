/** The 3310's physical keys. Same literals as phone-core's PhoneKey — defined
 *  independently here because phone-3d has no internal dependencies. */
export type Nokia3310Key =
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

export interface Nokia3310Props {
  /** 84×48 canvas used as the screen texture source. */
  screenCanvas: HTMLCanvasElement;
  /** Bump to trigger texture.needsUpdate (re-upload) on the next frame. */
  screenVersion: number;
  onKey?: (key: Nokia3310Key, action: "down" | "up") => void;
  backlightOn?: boolean;
  /** Visually depress keys driven externally (e.g. keyboard input). */
  pressedKeys?: ReadonlySet<Nokia3310Key>;
  /** URL of the Draco-compressed glTF phone model (served as a static asset by
   *  the host). The host owns the asset; the package just renders what it's given. */
  modelUrl?: string;
  /** Directory containing the Draco decoder (draco_decoder.wasm + .js). */
  dracoPath?: string;
  /** Colour painted on the model's screen face behind/around the LCD overlay so
   *  the gap reads as one continuous screen. Pass the same `bg` you gave the
   *  screen renderer. Defaults to the classic green LCD background. */
  screenBgColor?: string;
}

/** Default asset locations the host is expected to serve (see phone-3d README). */
export const DEFAULT_MODEL_URL = "/models/nokia-3310.glb";
export const DEFAULT_DRACO_PATH = "/draco/";

/** Classic Nokia green LCD background — default screen-face fill. */
export const DEFAULT_SCREEN_BG = "#c7f0d8";

/** Every physical key, exactly once (internal; used by layout + tests). */
export const ALL_KEYS: readonly Nokia3310Key[] = [
  "power",
  "navi",
  "c",
  "up",
  "down",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "*",
  "0",
  "#",
];
