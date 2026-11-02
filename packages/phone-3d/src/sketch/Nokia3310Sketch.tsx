import { useId } from "react";
import type { CSSProperties } from "react";
import { VIEW_HEIGHT_AT_ORIGIN } from "../frame";
import { MATERIALS, PRINT_DARK } from "../materials";
import { DEFAULT_SCREEN_BG } from "../types";
import { BOUNDS, REGIONS, SILHOUETTE } from "./outline.generated";

export interface Nokia3310SketchProps {
  className?: string;
  /** Same as `<PhoneStage fit>`: the sketch then lines up with the stage's flat phone. */
  fit?: number;
  /** The LCD's background; pass the `screenBgColor` you give the stage. */
  screenBgColor?: string;
}

const INK = "#16130f";
const PAPER_HIGHLIGHT = "#fffdf6";

/** Flat comic colours for each model node: the 3D materials as they read lit on screen. */
const FILL: Record<string, string> = {
  island: "#d6d9e1",
  badge: MATERIALS.badge.color,
  badge_logo: "#dfe4ea",
  key_power: "#3c4459",
  key_navi: MATERIALS.navi.color,
};
const KEY_FILL = "#dadde5";
const BODY_FILL = "#5e6883";

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const LEGENDS: Record<string, string> = {
  ...Object.fromEntries(DIGITS.map((d) => [`key_${d}`, d])),
  key_star: "*",
  key_hash: "#",
  key_c: "C",
};

/** The viewBox: the phone's bounds made symmetric about the stage origin, where the camera looks. */
const HALF_W = Math.max(-BOUNDS.x, BOUNDS.x + BOUNDS.width);
const HALF_H = Math.max(-BOUNDS.y, BOUNDS.y + BOUNDS.height);
const VIEW_BOX = `${-HALF_W} ${-HALF_H} ${2 * HALF_W} ${2 * HALF_H}`;

/**
 * The SVG's height in its container (which must be `container-type: size`, as the sketch's own
 * wrapper is): the flat phone's height under the stage camera. Without `fit` the camera sees
 * VIEW_HEIGHT_AT_ORIGIN; with it, the phone spans `fit` of the limiting side.
 */
function sketchHeight(fit: number | undefined): string {
  if (fit === undefined) return `${((2 * HALF_H) / VIEW_HEIGHT_AT_ORIGIN) * 100}cqh`;
  return `min(${fit * 100}cqh, ${((fit * HALF_H) / HALF_W) * 100}cqw)`;
}

/**
 * The 3310 drawn flat in comic ink, traced from the 3D model's front view. Pure SVG: it renders
 * on the server, before three.js and the model have loaded, exactly where `<PhoneStage>` with
 * the same `fit` and `form` draws the phone flat before it rises.
 */
export function Nokia3310Sketch({
  className,
  fit,
  screenBgColor = DEFAULT_SCREEN_BG,
}: Nokia3310SketchProps) {
  const wrapper: CSSProperties = {
    position: "absolute",
    inset: 0,
    containerType: "size",
    pointerEvents: "none",
  };
  const svg: CSSProperties = {
    position: "absolute",
    left: "50%",
    top: "50%",
    height: sketchHeight(fit),
    aspectRatio: `${HALF_W} / ${HALF_H}`,
    translate: "-50% -50%",
    overflow: "visible",
  };
  const screen = REGIONS.screen;
  // Ids unique per sketch: a page may hold several (one per breakpoint, say).
  const id = useId();
  const ref = (name: string) => `${id}${name}`;
  const url = (name: string) => `url(#${ref(name)})`;
  return (
    <div className={className} style={wrapper} aria-hidden="true">
      <svg viewBox={VIEW_BOX} style={svg} role="presentation">
        <defs>
          {/* Ben-Day dots for the shading, densest away from the light (top left). */}
          <pattern id={ref("dots")} width="0.13" height="0.13" patternUnits="userSpaceOnUse">
            <circle cx="0.065" cy="0.065" r="0.034" fill={INK} />
          </pattern>
          <linearGradient id={ref("shade")} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0.35" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#fff" stopOpacity="0.55" />
          </linearGradient>
          <mask id={ref("shade-mask")} maskContentUnits="objectBoundingBox">
            <rect width="1" height="1" fill={url("shade")} />
          </mask>
          <clipPath id={ref("body")}>
            <path d={SILHOUETTE} />
          </clipPath>
          {screen && (
            <clipPath id={ref("screen")}>
              <path d={screen.d} />
            </clipPath>
          )}
        </defs>

        <path d={SILHOUETTE} fill={BODY_FILL} />
        <g clipPath={url("body")}>
          <rect
            x={-HALF_W}
            y={-HALF_H}
            width={2 * HALF_W}
            height={2 * HALF_H}
            fill={url("dots")}
            mask={url("shade-mask")}
          />
        </g>

        <g stroke={INK} strokeWidth="0.045" strokeLinejoin="round">
          {Object.entries(REGIONS).map(([name, region]) => (
            <path
              key={name}
              d={region.d}
              fillRule="evenodd"
              fill={name === "screen" ? screenBgColor : (FILL[name] ?? KEY_FILL)}
            />
          ))}
        </g>

        {/* Gloss on the LCD: two hard white streaks. */}
        {screen && (
          <g clipPath={url("screen")} stroke={PAPER_HIGHLIGHT} strokeLinecap="round">
            <path
              d={`M${screen.center[0] - 1.6} ${screen.center[1] + 0.2}L${screen.center[0] - 0.4} ${screen.center[1] - 1.3}`}
              strokeWidth="0.16"
              opacity="0.75"
            />
            <path
              d={`M${screen.center[0] - 1.0} ${screen.center[1] + 0.5}L${screen.center[0] + 0.1} ${screen.center[1] - 0.9}`}
              strokeWidth="0.07"
              opacity="0.75"
            />
          </g>
        )}

        {/* Key legends, hand-lettered at each key's centre. */}
        <g
          fill={PRINT_DARK}
          fontFamily='"Arial Black", "Helvetica Neue", system-ui, sans-serif'
          fontWeight="900"
          fontSize="0.34"
          textAnchor="middle"
          dominantBaseline="central"
        >
          {Object.entries(LEGENDS).map(([name, legend]) => {
            const region = REGIONS[name];
            if (!region) return null;
            return (
              <text key={name} x={region.center[0]} y={region.center[1]}>
                {legend}
              </text>
            );
          })}
        </g>
        <ScrollArrows />
        {REGIONS.key_navi && (
          <path
            d={`M${REGIONS.key_navi.center[0] - 0.42} ${REGIONS.key_navi.center[1]}h0.84`}
            stroke={MATERIALS.naviBar.color}
            strokeWidth="0.1"
            strokeLinecap="round"
          />
        )}

        {/* The bold outer contour last, so it sits over every inner line. */}
        <path d={SILHOUETTE} fill="none" stroke={INK} strokeWidth="0.11" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/** Chevrons on the scroll keys. */
function ScrollArrows() {
  return (
    <g fill="none" stroke={PRINT_DARK} strokeWidth="0.06" strokeLinecap="round">
      {(["key_up", "key_down"] as const).map((name) => {
        const region = REGIONS[name];
        if (!region) return null;
        const [x, y] = region.center;
        const dy = name === "key_up" ? -0.07 : 0.07;
        return (
          <path key={name} d={`M${x - 0.12} ${y - dy}L${x} ${y + dy}L${x + 0.12} ${y - dy}`} />
        );
      })}
    </g>
  );
}
