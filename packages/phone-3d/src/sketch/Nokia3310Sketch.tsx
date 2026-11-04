import { useId } from "react";
import type { CSSProperties, ReactNode } from "react";
import { VIEW_HEIGHT_AT_ORIGIN } from "../frame";
import { DEFAULT_SCREEN_BG } from "../types";
import { BOUNDS, REGIONS, SILHOUETTE } from "./outline.generated";

/** The handset's published size and weight, which the drawing's dimension lines give. */
export const HANDSET = { heightMm: 113, widthMm: 48, depthMm: 22, weightG: 133 } as const;

export interface Nokia3310SketchProps {
  className?: string;
  /** Same as `<PhoneStage fit>`: the sketch then lines up with the stage's flat phone. */
  fit?: number;
  /** The LCD's background; pass the `screenBgColor` you give the stage. */
  screenBgColor?: string;
  /** Show "Loading" on the LCD with a bar this full (0–1); a blank LCD when unset. */
  progress?: number;
  /** Lines written on the LCD instead of the loading bar, e.g. when the 3D phone can't load. */
  lcdText?: readonly string[];
  /**
   * How far the drawing has turned into the phone beneath it, 0–1: an edge sweeps down from the
   * top, the drawing gone above it. Gone at 1.
   */
  wipe?: number;
  /** The drawing's line colour (default near-black). */
  ink?: string;
  /** The paper it's drawn on, which also hides the 3D phone under it (default off-white). */
  paper?: string;
  /** Draw the height and width dimension lines beside the phone (default true). */
  dimensions?: boolean;
}

const INK = "#1b1b19";
const PAPER = "#f4f3ef";

/** Line weights in screen pixels, whatever the drawing's scale: contour, detail, dimension. */
const CONTOUR = 1.5;
const DETAIL = 0.8;
const THIN = 0.6;

/** The wipe's edge: the softness of the drawing's cut-off below it, and how far past the phone's
 *  bottom it runs (clearing the width dimension) before the drawing is gone. */
const WIPE_SOFT = 0.12;
const WIPE_PAST = 0.9;

/** The viewBox: the phone's bounds made symmetric about the stage origin, where the camera looks. */
const HALF_W = Math.max(-BOUNDS.x, BOUNDS.x + BOUNDS.width);
const HALF_H = Math.max(-BOUNDS.y, BOUNDS.y + BOUNDS.height);
const VIEW_BOX = `${-HALF_W} ${-HALF_H} ${2 * HALF_W} ${2 * HALF_H}`;
/** Room around the phone for the dimension lines, which draw outside the viewBox. */
const MARGIN = 1.6;

const TOP = BOUNDS.y;
const BOTTOM = BOUNDS.y + BOUNDS.height;
const LEFT = BOUNDS.x;
const RIGHT = BOUNDS.x + BOUNDS.width;

/** The drawing's top edge `wipe` of the way through (SVG y, down), where it starts to show. */
const wipeEdge = (wipe: number) => TOP + wipe * (BOUNDS.height + WIPE_PAST);

/**
 * Where the drawing is whole again below its wiping edge, `wipe` of the way through, as a world
 * height on the stage (y up): the line a stage with the same `fit` should hold the 3D phone to
 * (FormPose `pivot` and `cut`), so the phone shows only where the drawing has gone.
 */
export function wipeLine(wipe: number): number {
  return -(wipeEdge(wipe) + WIPE_SOFT);
}

/** The world height of the phone's bottom in the drawing (and on the stage). */
export const OUTLINE_BOTTOM = -BOTTOM;

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const LEGENDS: Record<string, string> = {
  ...Object.fromEntries(DIGITS.map((d) => [`key_${d}`, d])),
  key_star: "*",
  key_hash: "#",
  key_c: "C",
};

/**
 * The SVG's height in its container (which must be `container-type: size`, as the sketch's own
 * wrapper is): the flat phone's height under the stage camera. Without `fit` the camera sees
 * VIEW_HEIGHT_AT_ORIGIN; with it, the phone spans `fit` of the limiting side.
 */
function sketchHeight(fit: number | undefined): string {
  if (fit === undefined) return `${((2 * HALF_H) / VIEW_HEIGHT_AT_ORIGIN) * 100}cqh`;
  return `min(${fit * 100}cqh, ${((fit * HALF_H) / HALF_W) * 100}cqw)`;
}

function svgStyle(fit: number | undefined): CSSProperties {
  return {
    position: "absolute",
    left: "50%",
    top: "50%",
    height: sketchHeight(fit),
    aspectRatio: `${HALF_W} / ${HALF_H}`,
    translate: "-50% -50%",
    overflow: "visible",
  };
}

const WRAPPER: CSSProperties = {
  position: "absolute",
  inset: 0,
  containerType: "size",
  pointerEvents: "none",
};

/** Strokes keep their pixel weight at any scale, like a pen on a drawing of any size. */
const PEN = { vectorEffect: "non-scaling-stroke" } as const;

/**
 * The 3310 as a technical drawing, its front elevation traced from the 3D model: an even contour,
 * finer detail lines, shading lines down the side away from the light, and dimension lines for its
 * height and width. Pure SVG: it renders on the server, before three.js and the model have loaded,
 * exactly where `<PhoneStage>` with the same `fit` and `form` draws the phone flat before it rises.
 */
export function Nokia3310Sketch({
  className,
  fit,
  screenBgColor = DEFAULT_SCREEN_BG,
  progress,
  lcdText,
  wipe = 0,
  ink = INK,
  paper = PAPER,
  dimensions = true,
}: Nokia3310SketchProps) {
  const screen = REGIONS.screen;
  // Ids unique per sketch: a page may hold several (one per breakpoint, say).
  const id = useId();
  const ref = (name: string) => `${id}${name}`;
  const url = (name: string) => `url(#${ref(name)})`;
  if (wipe >= 1) return null;
  // The edge sweeps from the phone's top until it has passed the width dimension below it, on
  // the same clock as before the drawing had dimensions, so the 3D phone's leap lines up.
  const edge = wipeEdge(wipe);
  const wiping = wipe > 0;
  const area = {
    x: -HALF_W - MARGIN,
    y: -HALF_H - MARGIN,
    width: 2 * (HALF_W + MARGIN),
    height: 2 * (HALF_H + MARGIN),
  };
  return (
    <div className={className} style={WRAPPER} aria-hidden="true">
      <svg viewBox={VIEW_BOX} style={svgStyle(fit)} role="presentation">
        <defs>
          <clipPath id={ref("body")}>
            <path d={SILHOUETTE} />
          </clipPath>
          {wiping && (
            <>
              <linearGradient
                id={ref("wipe-fade")}
                gradientUnits="userSpaceOnUse"
                x1="0"
                y1={edge}
                x2="0"
                y2={edge + WIPE_SOFT}
              >
                <stop offset="0" stopColor="#000" />
                <stop offset="1" stopColor="#fff" />
              </linearGradient>
              <mask id={ref("wipe")} maskUnits="userSpaceOnUse" {...area}>
                <rect {...area} fill={url("wipe-fade")} />
              </mask>
            </>
          )}
        </defs>

        <g mask={wiping ? url("wipe") : undefined}>
          <path d={SILHOUETTE} fill={paper} />
          <Shading ink={ink} clip={url("body")} />

          <g stroke={ink} strokeWidth={DETAIL} strokeLinejoin="round" {...PEN}>
            {Object.entries(REGIONS).map(([name, region]) => (
              <path
                key={name}
                d={region.d}
                fillRule="evenodd"
                fill={name === "screen" ? screenBgColor : paper}
                fillOpacity={name === "screen" ? 0.55 : 1}
                {...PEN}
              />
            ))}
          </g>

          {screen && lcdText !== undefined && (
            <LcdText center={screen.center} lines={lcdText} ink={ink} />
          )}
          {screen && lcdText === undefined && progress !== undefined && (
            <LcdLoading center={screen.center} progress={progress} ink={ink} />
          )}

          <Lettering ink={ink} />

          {/* The contour last, so it sits over every inner line. */}
          <path
            d={SILHOUETTE}
            fill="none"
            stroke={ink}
            strokeWidth={CONTOUR}
            strokeLinejoin="round"
            {...PEN}
          />

          {dimensions && <Dimensions ink={ink} paper={paper} />}
        </g>

        {/* The edge itself: a fine rule sweeping down across the whole figure. */}
        {wiping && (
          <path
            d={`M${area.x} ${edge}H${area.x + area.width}`}
            stroke={ink}
            strokeWidth={THIN}
            {...PEN}
          />
        )}
      </svg>
    </div>
  );
}

/** Shading lines down the phone's right side, away from the light, closer together at the edge. */
function Shading({ ink, clip }: { ink: string; clip: string }) {
  const xs = [1.42, 1.62, 1.78, 1.9, 1.99, 2.05];
  return (
    <g clipPath={clip} stroke={ink} strokeWidth={THIN} {...PEN}>
      {xs.map((x) => (
        <path key={x} d={`M${x} ${TOP}V${BOTTOM}`} {...PEN} />
      ))}
    </g>
  );
}

/** Key legends at each key's centre, scroll chevrons and the Navi key's bar. */
function Lettering({ ink }: { ink: string }) {
  return (
    <>
      <g
        fill={ink}
        fontFamily="inherit"
        fontWeight="500"
        fontSize="0.3"
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
      <g fill="none" stroke={ink} strokeWidth={DETAIL} strokeLinecap="round" {...PEN}>
        {(["key_up", "key_down"] as const).map((name) => {
          const region = REGIONS[name];
          if (!region) return null;
          const [x, y] = region.center;
          const dy = name === "key_up" ? -0.06 : 0.06;
          return (
            <path
              key={name}
              d={`M${x - 0.11} ${y - dy}L${x} ${y + dy}L${x + 0.11} ${y - dy}`}
              {...PEN}
            />
          );
        })}
        {REGIONS.key_navi && (
          <path
            d={`M${REGIONS.key_navi.center[0] - 0.36} ${REGIONS.key_navi.center[1]}h0.72`}
            {...PEN}
          />
        )}
      </g>
    </>
  );
}

/** How far the dimension lines stand off the phone, and the gap before their extension lines. */
const DIM_OFFSET = 0.62;
const EXT_GAP = 0.14;
const EXT_OVER = 0.14;
const ARROW = 0.16;
const DIM_TEXT = 0.27;

/** An arrowhead at `x, y` pointing along `(dx, dy)` (a unit axis). */
function arrow(x: number, y: number, dx: number, dy: number): string {
  const back = ARROW;
  const half = ARROW * 0.3;
  const bx = x - dx * back;
  const by = y - dy * back;
  return `M${x} ${y}L${bx - dy * half} ${by + dx * half}L${bx + dy * half} ${by - dx * half}Z`;
}

/** The height (left) and width (below) dimension lines, in millimetres. */
function Dimensions({ ink, paper }: { ink: string; paper: string }) {
  const hx = LEFT - DIM_OFFSET;
  const wy = BOTTOM + DIM_OFFSET;
  // Just past where the outline reaches its extremes: its top and bottom edges' left ends, and
  // its sides' widest points, around the middle of the phone.
  const topX = -0.95;
  const bottomX = -1.2;
  const sideY = 0.1;
  const label = (x: number, y: number, text: string, vertical: boolean): ReactNode => (
    <g transform={`translate(${x} ${y})${vertical ? " rotate(-90)" : ""}`}>
      <rect x={-0.34} y={-0.17} width={0.68} height={0.34} fill={paper} />
      <text
        fill={ink}
        fontFamily="inherit"
        fontSize={DIM_TEXT}
        textAnchor="middle"
        dominantBaseline="central"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {text}
      </text>
    </g>
  );
  return (
    <g>
      <g stroke={ink} strokeWidth={THIN} fill="none" {...PEN}>
        {/* Extension lines. */}
        <path d={`M${topX - EXT_GAP} ${TOP}H${hx - EXT_OVER}`} {...PEN} />
        <path d={`M${bottomX - EXT_GAP} ${BOTTOM}H${hx - EXT_OVER}`} {...PEN} />
        <path d={`M${LEFT} ${sideY + EXT_GAP}V${wy + EXT_OVER}`} {...PEN} />
        <path d={`M${RIGHT} ${sideY + EXT_GAP}V${wy + EXT_OVER}`} {...PEN} />
        {/* Dimension lines. */}
        <path d={`M${hx} ${TOP}V${BOTTOM}`} {...PEN} />
        <path d={`M${LEFT} ${wy}H${RIGHT}`} {...PEN} />
      </g>
      <g fill={ink}>
        <path d={arrow(hx, TOP, 0, -1)} />
        <path d={arrow(hx, BOTTOM, 0, 1)} />
        <path d={arrow(LEFT, wy, -1, 0)} />
        <path d={arrow(RIGHT, wy, 1, 0)} />
      </g>
      {label(hx, 0, String(HANDSET.heightMm), true)}
      {label(0, wy, String(HANDSET.widthMm), false)}
    </g>
  );
}

/** Segments in the loading bar, like the 3310's own signal and battery bars. */
const SEGMENTS = 10;

/** Lines of text on the LCD, centred. */
function LcdText({
  center: [cx, cy],
  lines,
  ink,
}: {
  center: readonly [number, number];
  lines: readonly string[];
  ink: string;
}) {
  const leading = 0.42;
  return (
    <text
      role="status"
      x={cx}
      y={cy - ((lines.length - 1) * leading) / 2}
      fill={ink}
      fontFamily="inherit"
      fontWeight="500"
      fontSize="0.28"
      textAnchor="middle"
      dominantBaseline="central"
    >
      {lines.map((line, i) => (
        <tspan key={i} x={cx} dy={i === 0 ? 0 : leading}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

/**
 * "Loading" on the LCD over a segmented bar, the way the phone draws its own progress. The dots
 * blink by SMIL, so the drawing is alive before any script runs.
 */
function LcdLoading({
  center: [cx, cy],
  progress,
  ink,
}: {
  center: readonly [number, number];
  progress: number;
  ink: string;
}) {
  const lit = Math.round(Math.min(1, Math.max(0, progress)) * SEGMENTS);
  const width = 2.1;
  const height = 0.3;
  const gap = 0.05;
  const inner = (width - 2 * gap - (SEGMENTS - 1) * gap) / SEGMENTS;
  const left = cx - width / 2;
  const top = cy + 0.1;
  return (
    <g role="progressbar" aria-valuenow={Math.round(progress * 100)}>
      <text x={left} y={cy - 0.28} fill={ink} fontFamily="inherit" fontWeight="500" fontSize="0.3">
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
        fill="none"
        stroke={ink}
        strokeWidth={DETAIL}
        {...PEN}
      />
      {Array.from({ length: lit }, (_, i) => (
        <rect
          key={i}
          data-segment=""
          x={left + gap + i * (inner + gap)}
          y={top + gap}
          width={inner}
          height={height - 2 * gap}
          fill={ink}
        />
      ))}
    </g>
  );
}

/** A part of the phone a callout can point at. */
export type CalloutTarget =
  | "screen"
  | "key_navi"
  | "key_c"
  | "key_up"
  | "key_5"
  | "key_power"
  | "badge";

export interface Callout {
  target: CalloutTarget;
  label: string;
}

export interface Nokia3310CalloutsProps {
  className?: string;
  /** Same as the sketch's and the stage's `fit`. */
  fit?: number;
  callouts: readonly Callout[];
  ink?: string;
  /** Which side of the phone the labels sit (default right). */
  side?: "left" | "right";
}

/**
 * Leader lines from parts of the phone to labels beside it, framed like the sketch so they point
 * at the 3D phone once it has formed. Labels are HTML-free SVG text in the page's font.
 */
export function Nokia3310Callouts({
  className,
  fit,
  callouts,
  ink = INK,
  side = "right",
}: Nokia3310CalloutsProps) {
  const dir = side === "right" ? 1 : -1;
  const elbow = dir * (HALF_W + 0.35);
  const textX = dir * (HALF_W + 0.5);
  return (
    <div className={className} style={WRAPPER} aria-hidden="true">
      <svg viewBox={VIEW_BOX} style={svgStyle(fit)} role="presentation">
        {callouts.map(({ target, label }) => {
          const region = REGIONS[target];
          if (!region) return null;
          const [x, y] = region.center;
          return (
            <g key={target}>
              <circle cx={x} cy={y} r={0.05} fill={ink} />
              <path
                d={`M${x} ${y}H${elbow}`}
                stroke={ink}
                strokeWidth={THIN}
                fill="none"
                {...PEN}
              />
              <text
                x={textX}
                y={y}
                fill={ink}
                fontFamily="inherit"
                fontSize="0.26"
                textAnchor={side === "right" ? "start" : "end"}
                dominantBaseline="central"
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
