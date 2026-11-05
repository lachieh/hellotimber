export interface MaterialSpec {
  color: string;
  roughness: number;
  metalness: number;
}

/** Palette matched to photographs of a dark blue 3310 (Xpress-on cover): a deep navy shell with
 *  a fine light fleck (grain.ts), satin silver-grey plastic for the island and keys (painted
 *  plastic, not chrome), a white-silver NaviKey with the cyan bar, and the light grey inner
 *  chassis that shows at the side clips and the port access along the bottom. */
export const MATERIALS = {
  // Colors are authored darker than the reference reads on screen — the
  // stage's lights + environment are additive (~1.7× on camera-facing faces).
  body: { color: "#2a4058", roughness: 0.7, metalness: 0.08 },
  /** The inside of the shell, through its openings: unlit, near black. */
  interior: { color: "#0b0c10", roughness: 1, metalness: 0 },
  island: { color: "#b7bbbf", roughness: 0.38, metalness: 0.35 },
  key: { color: "#c2c6ca", roughness: 0.38, metalness: 0.3 },
  navi: { color: "#d3d6d9", roughness: 0.4, metalness: 0.15 },
  naviBar: { color: "#2fb2d6", roughness: 0.4, metalness: 0.1 },
  /** The inner chassis: the side clips and the port access. */
  chassis: { color: "#9a9ea2", roughness: 0.62, metalness: 0 },
  /** Down the port's holes: the charging socket and the microphone, near black. */
  socket: { color: "#121315", roughness: 0.9, metalness: 0 },
  /** The data contacts beside the socket. */
  contacts: { color: "#c9a24a", roughness: 0.35, metalness: 1 },
  /** The badges the wordmark sits on: near-black, matte. */
  badge: { color: "#1f2022", roughness: 0.8, metalness: 0 },
  /** The wordmark's letters: light grey. */
  logo: { color: "#a4a7a8", roughness: 0.55, metalness: 0.15 },
} as const satisfies Record<string, MaterialSpec>;

/** Green LCD backlight glow (spec §9: backlight is green). */
export const BACKLIGHT_COLOR = "#b4f5a0";
/** Multiplier tint for the screen texture when the backlight is off. */
export const SCREEN_DIM_TINT = "#7a8579";
/** Matching active-plane contrast while the LCD backlight is on. */
export const SCREEN_LIT_PIXEL_TINT = "#eeefee";

/** Legend print colors: light print on the dark shell, dark print on keys. */
export const PRINT_LIGHT = "#dfe4ea";
export const PRINT_DARK = "#18251b";
/** The original legends are dark, translucent green plastic set into opaque
 *  silver caps, lit from behind by the keypad LEDs. Lit, they read as a deep,
 *  saturated green, still darker than the cap around them, so the print stays
 *  legible (a brighter glow washes out to the cap's own lightness). */
export const LEGEND_GLOW_COLOR = "#4cc43a";
export const LEGEND_GLOW_INTENSITY = 0.5;

/** Each key is lit by an LED behind its middle: the glow is full there and falls off towards the
 *  key's edges. `x` and `y` run from -1 to 1 across the key's print; returns the glow's share. */
export function keyGlowFalloff(x: number, y: number): number {
  const r = Math.min(1, Math.hypot(x, y * 0.8));
  return KEY_GLOW_EDGE + (1 - KEY_GLOW_EDGE) * (1 - r * r) ** 2;
}
/** The glow's share at the key's edge. */
export const KEY_GLOW_EDGE = 0.15;
export const LCD_GLOW_INTENSITY = 0.55;

/** The NaviKey's cyan bar glows cyan-green rather than the legends' green,
 *  so it keeps its colour under the same LEDs. */
export const NAVI_BAR_GLOW_COLOR = "#2fc4c8";
export const NAVI_BAR_GLOW_INTENSITY = 0.35;

/** The emission of a key's lit part, the legend print or the NaviKey's bar,
 *  under the keypad LEDs; unlit, neither glows. */
export function legendEmission(
  part: "legend" | "naviBar",
  lit: boolean,
): { color: string; intensity: number } {
  const [color, intensity] =
    part === "legend"
      ? [LEGEND_GLOW_COLOR, LEGEND_GLOW_INTENSITY]
      : [NAVI_BAR_GLOW_COLOR, NAVI_BAR_GLOW_INTENSITY];
  return { color, intensity: lit ? intensity : 0 };
}
