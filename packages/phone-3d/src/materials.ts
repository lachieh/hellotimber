export interface MaterialSpec {
  color: string;
  roughness: number;
  metalness: number;
}

/** Dark-blue Xpress-on shell, grey keys, blue NaviKey (spec §1). */
export const MATERIALS = {
  body: { color: "#27406e", roughness: 0.55, metalness: 0.05 },
  face: { color: "#1d3358", roughness: 0.6, metalness: 0.05 },
  key: { color: "#b8bcc4", roughness: 0.45, metalness: 0.1 },
  navi: { color: "#2456c8", roughness: 0.4, metalness: 0.1 },
  bezel: { color: "#0c1014", roughness: 0.7, metalness: 0 },
  grille: { color: "#0c1014", roughness: 0.8, metalness: 0 },
} as const satisfies Record<string, MaterialSpec>;

/** Green LCD backlight glow (spec §9: backlight is green). */
export const BACKLIGHT_COLOR = "#b4f5a0";
/** Multiplier tint for the screen texture when the backlight is off. */
export const SCREEN_DIM_TINT = "#7a8579";
