import { useId } from "react";
import type { CSSProperties, ReactNode } from "react";
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
  /** Show "Loading" on the LCD with a bar this full (0–1); a blank LCD when unset. */
  progress?: number;
  /**
   * Line boil, 0–1: the ink wobbles like a hand-drawn cartoon redrawn every other frame, as if
   * the drawing were coming to life. Off (crisp) at 0.
   */
  boil?: number;
  /** How much of the printed dot shading shows, 0–1 (default 1). */
  halftone?: number;
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

/** How far the boil displaces the ink at full strength, in model units (the phone is 10 tall). */
const BOIL_SCALE = 0.1;
/** Drawings a second while boiling: animation "on twos". */
const BOIL_FPS = 12;

/** The wrapper and SVG every sketch layer shares, so they all line up with the stage. */
function SketchFrame({
  className,
  fit,
  children,
}: {
  className: string | undefined;
  fit: number | undefined;
  children: ReactNode;
}) {
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
  return (
    <div className={className} style={wrapper} aria-hidden="true">
      <svg viewBox={VIEW_BOX} style={svg} role="presentation">
        {children}
      </svg>
    </div>
  );
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
  progress,
  boil = 0,
  halftone = 1,
}: Nokia3310SketchProps) {
  const screen = REGIONS.screen;
  // Ids unique per sketch: a page may hold several (one per breakpoint, say).
  const id = useId();
  const ref = (name: string) => `${id}${name}`;
  const url = (name: string) => `url(#${ref(name)})`;
  return (
    <SketchFrame className={className} fit={fit}>
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
        {boil > 0 && (
          <filter id={ref("boil")} x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="turbulence" baseFrequency="2.4" numOctaves="2" seed="1">
              <animate
                attributeName="seed"
                values="1;2;3;4"
                calcMode="discrete"
                dur={`${4 / BOIL_FPS}s`}
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap
              in="SourceGraphic"
              scale={boil * BOIL_SCALE}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        )}
      </defs>

      <g filter={boil > 0 ? url("boil") : undefined}>
        <path d={SILHOUETTE} fill={BODY_FILL} />
        <g clipPath={url("body")}>
          <rect
            x={-HALF_W}
            y={-HALF_H}
            width={2 * HALF_W}
            height={2 * HALF_H}
            fill={url("dots")}
            mask={url("shade-mask")}
            opacity={halftone}
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

        {screen && progress !== undefined && (
          <LcdLoading center={screen.center} progress={progress} />
        )}

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
      </g>
    </SketchFrame>
  );
}

export interface Nokia3310BurstProps {
  className?: string;
  /** Same as the sketch's `fit`. */
  fit?: number;
  /** How far out the lines have shot, as a scale of their resting ring (1 = just clear of the phone). */
  spread?: number;
  /** The lines' opacity, 0–1. */
  opacity?: number;
}

/** Action lines: ink wedges around the phone, uneven like a hand-drawn "pop". */
const BURST_LINES = (() => {
  let seed = 3310;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const count = 26;
  return Array.from({ length: count }, (_, i) => {
    const angle = ((i + rand() * 0.6 - 0.3) / count) * 2 * Math.PI;
    return { angle, length: 0.9 + rand() * 1.6, width: 0.1 + rand() * 0.22, gap: rand() * 0.5 };
  });
})();

/**
 * Comic action lines bursting out around the phone, framed like `<Nokia3310Sketch>` with the same
 * `fit`. Pure SVG; draws nothing at zero opacity.
 */
export function Nokia3310Burst({ className, fit, spread = 1, opacity = 1 }: Nokia3310BurstProps) {
  if (opacity <= 0) return null;
  // Lines start on an ellipse just clear of the phone and point outwards.
  const rx = HALF_W * 1.12;
  const ry = HALF_H * 0.98;
  return (
    <SketchFrame className={className} fit={fit}>
      <g fill={INK} opacity={opacity}>
        {BURST_LINES.map(({ angle, length, width, gap }, i) => {
          const dx = Math.cos(angle);
          const dy = Math.sin(angle);
          // The ellipse's radius along this direction, pushed out by `spread`.
          const r = (spread * (rx * ry)) / Math.hypot(ry * dx, rx * dy) + gap;
          const [x0, y0] = [dx * r, dy * r];
          const [x1, y1] = [dx * (r + length * spread), dy * (r + length * spread)];
          const [nx, ny] = [-dy * width, dx * width];
          return (
            <path
              key={i}
              d={`M${x0 + nx} ${y0 + ny}L${x1} ${y1}L${x0 - nx} ${y0 - ny}Z`}
              strokeLinejoin="round"
            />
          );
        })}
      </g>
    </SketchFrame>
  );
}

/** LCD ink: the dark pixels of the green screen. */
const LCD_INK = "#1f2d22";
/** Segments in the loading bar, like the 3310's own signal and battery bars. */
const SEGMENTS = 10;

/**
 * "Loading" on the LCD over a segmented bar, the way the phone draws its own progress. The dots
 * blink by SMIL, so the drawing is alive before any script runs.
 */
function LcdLoading({
  center: [cx, cy],
  progress,
}: {
  center: readonly [number, number];
  progress: number;
}) {
  const lit = Math.round(Math.min(1, Math.max(0, progress)) * SEGMENTS);
  const width = 2.1;
  const height = 0.34;
  const gap = 0.05;
  const inner = (width - 2 * gap - (SEGMENTS - 1) * gap) / SEGMENTS;
  const left = cx - width / 2;
  const top = cy + 0.12;
  return (
    <g role="progressbar" aria-valuenow={Math.round(progress * 100)}>
      <text
        x={left}
        y={cy - 0.32}
        fill={LCD_INK}
        fontFamily='"Courier New", ui-monospace, monospace'
        fontWeight="700"
        fontSize="0.38"
      >
        Loading
        {[0, 1, 2].map((i) => (
          <tspan key={i}>
            .
            <animate
              attributeName="opacity"
              values="0;0;1;1"
              keyTimes={`0;${(i + 1) / 4};${(i + 1) / 4};1`}
              dur="1.2s"
              repeatCount="indefinite"
            />
          </tspan>
        ))}
      </text>
      <rect
        x={left}
        y={top}
        width={width}
        height={height}
        rx="0.04"
        fill="none"
        stroke={LCD_INK}
        strokeWidth="0.04"
      />
      {Array.from({ length: lit }, (_, i) => (
        <rect
          key={i}
          x={left + gap + i * (inner + gap)}
          y={top + gap}
          width={inner}
          height={height - 2 * gap}
          fill={LCD_INK}
        />
      ))}
    </g>
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
