import { useId } from "react";

export type CoverId = "blue" | "chrome" | "camo" | "flame" | "frost";

export interface Cover {
  id: CoverId;
  name: string;
  /** Page wash while this pack is hovered, focused or picked. */
  wash: string;
  /** Printed band on the pack card. */
  band: string;
  /** Ink on the band (≥ 4.5:1 against it). */
  bandInk: string;
}

export const COVERS: readonly Cover[] = [
  { id: "blue", name: "Ice Blue", wash: "#4f8fe8", band: "#1d4fa8", bandInk: "#ffffff" },
  { id: "chrome", name: "Chrome", wash: "#b9c2cc", band: "#3d4650", bandInk: "#ffffff" },
  { id: "camo", name: "Camo", wash: "#7c8a4a", band: "#3f4a22", bandInk: "#f3f1e2" },
  { id: "flame", name: "Flame", wash: "#ff6a2b", band: "#b3240f", bandInk: "#ffffff" },
  { id: "frost", name: "Frosted", wash: "#c9e6ef", band: "#2f6c80", bandInk: "#ffffff" },
];

const OUTLINE =
  "M10 4Q30 0 50 4Q57 6 57 14L56 60Q54 70 55 80L56 108Q56 118 46 119L14 119Q4 118 4 108L5 80Q6 70 4 60L3 14Q3 6 10 4Z";
const KEY_HOLES = [76, 86, 96, 106].flatMap((y) =>
  [16, 30, 44].map((x) => ({ x, y: y + (x === 30 ? 1.5 : 0) })),
);

/** A Nokia 3310 front cover, drawn flat for the blister. */
export function CoverArt({ cover }: { cover: CoverId }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = (name: string) => `xp-${uid}-${name}`;
  const fill = {
    blue: `url(#${id("blue")})`,
    chrome: `url(#${id("chrome")})`,
    camo: `url(#${id("camo")})`,
    flame: "#1c1414",
    frost: "rgba(244, 250, 252, 0.72)",
  }[cover];
  return (
    <svg className="xp-cover-art" viewBox="0 0 60 122" aria-hidden="true">
      <defs>
        <linearGradient id={id("blue")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7fb2ff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#1f56c4" stopOpacity="0.8" />
        </linearGradient>
        <linearGradient id={id("chrome")} x1="0" y1="0" x2="1" y2="0.35">
          <stop offset="0" stopColor="#f4f6f8" />
          <stop offset="0.28" stopColor="#8a949e" />
          <stop offset="0.5" stopColor="#eef1f4" />
          <stop offset="0.72" stopColor="#6c7681" />
          <stop offset="1" stopColor="#d5dbe0" />
        </linearGradient>
        <pattern id={id("camo")} width="40" height="40" patternUnits="userSpaceOnUse">
          <rect width="40" height="40" fill="#6b7440" />
          <path d="M2 6q8-6 14 0t10 8-12 6T2 6Z" fill="#3e4424" />
          <path d="M22 22q10-4 14 4t-6 10-10-4 2-10Z" fill="#8c7a4c" />
          <path d="M4 28q6-2 8 4t-4 6-6-4 2-6Z" fill="#2c2f1c" />
          <path d="M26 2q8 0 10 6t-8 4-2-10Z" fill="#a39a68" />
        </pattern>
        <linearGradient id={id("fire")} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#ffd23a" />
          <stop offset="0.45" stopColor="#ff6a1a" />
          <stop offset="1" stopColor="#c21d0c" />
        </linearGradient>
        <clipPath id={id("clip")}>
          <path d={OUTLINE} />
        </clipPath>
      </defs>
      <path d={OUTLINE} fill={fill} stroke="rgba(20, 22, 30, 0.55)" strokeWidth="1.2" />
      {cover === "flame" && (
        <path
          clipPath={`url(#${id("clip")})`}
          fill={`url(#${id("fire")})`}
          d="M0 122V78q6 10 9 2t-2-18q10 8 12 20t6-6 0-22q12 12 12 28t6-4 3-16q8 14 6 30t8-6V122Z"
        />
      )}
      {cover === "frost" && (
        <path d={OUTLINE} fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2.4" />
      )}
      <rect x="13" y="19" width="34" height="27" rx="3" fill="rgba(18, 24, 20, 0.7)" />
      <rect x="22" y="11" width="16" height="3" rx="1.5" fill="rgba(18, 24, 20, 0.35)" />
      <path d="M13 56Q30 66 47 56L47 61Q30 72 13 61Z" fill="rgba(18, 24, 20, 0.6)" />
      {KEY_HOLES.map(({ x, y }) => (
        <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="5.2" ry="3.2" fill="rgba(18, 24, 20, 0.55)" />
      ))}
    </svg>
  );
}
