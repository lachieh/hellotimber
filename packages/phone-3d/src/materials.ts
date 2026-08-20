export interface MaterialSpec {
  color: string;
  roughness: number;
  metalness: number;
}

/** Palette traced from the reference renders (nokia-3310/ + spec §1): grey-blue
 *  shell, one chrome "island" carrying screen + navi cluster, silver keys,
 *  white NaviKey with the cyan bar. */
export const MATERIALS = {
  // Colors are authored darker than the reference reads on screen — the
  // stage's lights + environment are additive (~1.7× on camera-facing faces).
  body: { color: "#4d566f", roughness: 0.55, metalness: 0.05 },
  face: { color: "#49526b", roughness: 0.6, metalness: 0.05 },
  island: { color: "#c3c7d1", roughness: 0.3, metalness: 0.75 },
  key: { color: "#c9cdd6", roughness: 0.28, metalness: 0.7 },
  navi: { color: "#e6e8ee", roughness: 0.3, metalness: 0.55 },
  naviBar: { color: "#3fc1c9", roughness: 0.4, metalness: 0.1 },
  bezel: { color: "#333a4e", roughness: 0.65, metalness: 0.05 },
  grille: { color: "#4d566f", roughness: 0.6, metalness: 0.05 },
  badge: { color: "#101216", roughness: 0.5, metalness: 0.1 },
} as const satisfies Record<string, MaterialSpec>;

/** Green LCD backlight glow (spec §9: backlight is green). */
export const BACKLIGHT_COLOR = "#b4f5a0";
/** Multiplier tint for the screen texture when the backlight is off. */
export const SCREEN_DIM_TINT = "#7a8579";

/** Legend print colors: light print on the dark shell, dark print on keys. */
export const PRINT_LIGHT = "#dfe4ea";
export const PRINT_DARK = "#18251b";
/** The original legends are dark, translucent green plastic set into opaque
 *  silver caps. A muted emission lifts the dark plastic without replacing its
 *  color with the LCD's pale-green light. */
export const LEGEND_GLOW_COLOR = "#496847";
export const LEGEND_GLOW_INTENSITY = 0.6;
export const LCD_GLOW_INTENSITY = 0.55;
