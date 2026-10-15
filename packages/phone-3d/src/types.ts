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
  /** The display LEDs: LCD backlight and its glow. Default true. */
  backlightOn?: boolean;
  /** Plan 25: the keypad LEDs (legend and NaviKey glow). Default: `backlightOn`. */
  keypadLightOn?: boolean;
  /** Visually depress keys driven externally (e.g. keyboard input). */
  pressedKeys?: ReadonlySet<Nokia3310Key>;
  /** Colour of the LCD surround fill around the pixel plane. Pass the same
   *  `bg` you gave the screen renderer. Defaults to the classic green. */
  screenBgColor?: string;
  /** URL of the Draco-compressed GLB (served as a static asset by the host). */
  modelUrl?: string;
  /** Directory containing the Draco decoder (draco_decoder.wasm + .js). */
  dracoPath?: string;
}

/** The phone's two LED lines, resolved from the props: the display LEDs
 *  (`backlightOn`, default on) and the keypad LEDs (`keypadLightOn`, default
 *  following the display). */
export function resolveLights(props: Pick<Nokia3310Props, "backlightOn" | "keypadLightOn">): {
  display: boolean;
  keypad: boolean;
} {
  const display = props.backlightOn ?? true;
  return { display, keypad: props.keypadLightOn ?? display };
}

/** Default asset locations the host is expected to serve (see README). */
export const DEFAULT_MODEL_URL = "/models/nokia3310-v3.glb";
export const DEFAULT_DRACO_PATH = "/draco/";

/** Classic Nokia green LCD background — default screen surround fill. */
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
