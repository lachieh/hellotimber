import type { CSSProperties, ReactNode } from "react";
import "./graffiti.css";

/** What a mark was made with. */
type Ink = "ghost" | "pencil" | "biro" | "red" | "marker" | "carved";

interface Mark {
  /** Where on the desk, in % of its width and height, and its turn in degrees. */
  x: number;
  y: number;
  turn: number;
  ink: Ink;
  /** Font size in rem (text) or width in rem (doodles). */
  size: number;
  /** The quick scrawl rather than the rounder hand. */
  scrawl?: boolean;
  /** Only on desks wide enough to have the room (desktop). */
  wide?: boolean;
  text?: string;
  doodle?: ReactNode;
}

const circleScrawl = (
  <svg viewBox="0 0 200 110">
    <path d="M100 8C40 6 6 30 10 58s52 46 100 44 84-20 82-48S150 6 92 12C52 16 24 34 28 60s46 40 88 36 70-20 66-44" />
  </svg>
);

const heart = (
  <svg viewBox="0 0 120 104">
    <path d="M60 100C20 70 4 50 6 30 8 10 34 0 48 14c6 6 10 12 12 18 2-6 6-12 12-18 14-14 40-4 42 16 2 20-14 40-54 70z" />
  </svg>
);

const scribbledOut = (
  <svg viewBox="0 0 160 50">
    <path d="M6 30C30 8 40 44 58 16s30 30 46 4 28 26 44 2M8 40C34 18 42 50 62 24s28 26 48 6 24 22 42 4M10 18c22-10 34 20 52 0s32 18 50-2 26 16 40 2" />
  </svg>
);

const tally = (
  <svg viewBox="0 0 120 50">
    <path d="M10 6v40M22 4v42M34 6v40M46 5v41M4 34l50-22M76 6v40M88 4v42M100 6v40" />
  </svg>
);

const smiley = (
  <svg viewBox="0 0 60 60">
    <circle cx="30" cy="30" r="26" />
    <path d="M20 22v6M40 22v6M17 38c8 10 18 10 26 0" />
  </svg>
);

const star = (
  <svg viewBox="0 0 60 60">
    <path d="M30 4l7 20h21l-17 12 7 21-18-13-18 13 7-21L2 24h21z" />
  </svg>
);

const cube = (
  <svg viewBox="0 0 70 70">
    <path d="M10 22h34v34H10zM10 22l16-14h34L44 22M60 8v34L44 56" />
  </svg>
);

const arrow = (
  <svg viewBox="0 0 90 40">
    <path d="M4 26c24-14 50-16 76-8M66 8l16 10-14 14" />
  </svg>
);

/**
 * Years of a school desk's graffiti, scratched, inked and pencilled into the laminate around the
 * phone. Decoration only; the desk's things sit on top of it.
 */
const zigzag = (
  <svg viewBox="0 0 140 30">
    <path d="M4 20l10-14 10 18 10-16 10 18 10-16 10 18 10-16 10 18 10-16 10 18 10-14" />
  </svg>
);

const hatch = (
  <svg viewBox="0 0 120 70">
    <path d="M6 60L40 6M18 64L54 8M30 66L68 8M42 66L80 10M54 66L92 12M66 64L104 14M78 62L114 18" />
  </svg>
);

const MARKS: Mark[] = [
  // Older layers, half rubbed away.
  { x: 1, y: 12, turn: 3, ink: "ghost", size: 2.2, scrawl: true, text: "steph & bec" },
  { x: 11, y: 15, turn: -14, ink: "ghost", size: 1.3, text: "1998" },
  { x: 30, y: 19, turn: 8, ink: "ghost", size: 2.8, scrawl: true, text: "Nick", wide: true },
  { x: 2, y: 33, turn: -6, ink: "ghost", size: 1.6, text: "SPICE GIRLS RULE", wide: true },
  { x: 19, y: 37, turn: 18, ink: "ghost", size: 5, doodle: heart, wide: true },
  { x: 12, y: 50, turn: -3, ink: "ghost", size: 2.4, scrawl: true, text: "Tommo was here" },
  { x: 29, y: 60, turn: 5, ink: "ghost", size: 1.2, text: "4/3/99", wide: true },
  { x: 1, y: 72, turn: 10, ink: "ghost", size: 2, scrawl: true, text: "Bree" },
  { x: 22, y: 94, turn: -4, ink: "ghost", size: 1.5, text: "year 9 forever", wide: true },
  { x: 58, y: 12, turn: -9, ink: "ghost", size: 2.6, scrawl: true, text: "Ash ♥", wide: true },
  { x: 76, y: 8, turn: 6, ink: "ghost", size: 1.3, text: "2000!!" },
  { x: 95, y: 30, turn: 90, ink: "ghost", size: 1.8, scrawl: true, text: "Leah" },
  { x: 72, y: 44, turn: -5, ink: "ghost", size: 2.2, scrawl: true, text: "Jono + ?", wide: true },
  { x: 88, y: 53, turn: 14, ink: "ghost", size: 4.4, doodle: hatch },
  { x: 63, y: 62, turn: 3, ink: "ghost", size: 1.5, text: "MILLENNIUM BUG", wide: true },
  { x: 78, y: 79, turn: -8, ink: "ghost", size: 2.6, scrawl: true, text: "Sophie", wide: true },
  { x: 95, y: 70, turn: -2, ink: "ghost", size: 1.2, text: "'97" },
  // Newer ones on top.
  { x: 6, y: 7, turn: -8, ink: "carved", size: 1.9, text: "L.H. '01" },
  { x: 21, y: 4, turn: 4, ink: "pencil", size: 12, doodle: circleScrawl, wide: true },
  { x: 25, y: 9, turn: 4, ink: "pencil", size: 1.7, scrawl: true, text: "jess 4 eva", wide: true },
  { x: 3, y: 21, turn: -3, ink: "biro", size: 1.05, text: "SNAKE HI SCORE 2148 !!" },
  { x: 14, y: 30, turn: 6, ink: "red", size: 1.5, scrawl: true, text: "txt me l8r" },
  { x: 5, y: 40, turn: -12, ink: "marker", size: 1.9, text: "SK8 OR DIE", wide: true },
  { x: 24, y: 47, turn: 2, ink: "pencil", size: 1.1, text: "maths sux", wide: true },
  { x: 2, y: 56, turn: 8, ink: "biro", size: 0.95, text: "polyphonic ringtones r 4 posers" },
  { x: 9, y: 66, turn: -4, ink: "pencil", size: 9, doodle: scribbledOut },
  { x: 3, y: 80, turn: -2, ink: "carved", size: 1.6, text: "J.T." },
  { x: 16, y: 89, turn: 5, ink: "pencil", size: 6, doodle: tally, wide: true },
  { x: 28, y: 76, turn: -6, ink: "red", size: 3.2, doodle: star, wide: true },
  { x: 68, y: 5, turn: -5, ink: "marker", size: 1.7, text: "CLASS OF '02" },
  { x: 86, y: 3, turn: 9, ink: "carved", size: 7, doodle: heart },
  { x: 87.5, y: 8.5, turn: 9, ink: "carved", size: 1.05, text: "DAN + MEL" },
  { x: 72, y: 15, turn: 3, ink: "biro", size: 1.25, scrawl: true, text: "2 good 2 be 4gotten" },
  { x: 90, y: 22, turn: -10, ink: "pencil", size: 3.2, doodle: smiley },
  { x: 66, y: 27, turn: -2, ink: "pencil", size: 1.2, text: "mr. P is a legend", wide: true },
  { x: 78, y: 36, turn: 7, ink: "red", size: 1.6, scrawl: true, text: "kate wuz ere" },
  { x: 92, y: 44, turn: -4, ink: "biro", size: 3.6, doodle: cube, wide: true },
  { x: 68, y: 52, turn: 12, ink: "biro", size: 2.6, scrawl: true, text: "M A R C U S", wide: true },
  { x: 84, y: 62, turn: -7, ink: "pencil", size: 1.1, text: "who stole my pen??" },
  { x: 66, y: 70, turn: 4, ink: "pencil", size: 4.6, doodle: arrow, wide: true },
  { x: 72, y: 72, turn: 4, ink: "pencil", size: 1.2, scrawl: true, text: "boring", wide: true },
  { x: 90, y: 86, turn: -3, ink: "marker", size: 1.5, text: "ROCK ON" },
  { x: 60, y: 92, turn: 6, ink: "red", size: 2.4, doodle: star },
  { x: 40, y: 3, turn: -2, ink: "carved", size: 1.3, text: "nokia > motorola", wide: true },
  {
    x: 13,
    y: 12,
    turn: -4,
    ink: "biro",
    size: 1,
    scrawl: true,
    text: "is ur mum calling?",
    wide: true,
  },
  { x: 31, y: 27, turn: 22, ink: "marker", size: 1.3, text: "B.K.", wide: true },
  { x: 2, y: 47, turn: 4, ink: "red", size: 7, doodle: zigzag },
  { x: 20, y: 57, turn: -9, ink: "biro", size: 1.2, text: "TXT ME 0412 ***", wide: true },
  { x: 7, y: 93, turn: 3, ink: "carved", size: 1.4, text: "S.M. 4 R.T." },
  { x: 77, y: 25, turn: -3, ink: "carved", size: 1.2, text: "CHANTELLE", wide: true },
  { x: 62, y: 38, turn: 9, ink: "pencil", size: 1.4, scrawl: true, text: "hi!!!", wide: true },
  { x: 85, y: 74, turn: 5, ink: "biro", size: 1.1, text: "8 more weeks", wide: true },
  { x: 70, y: 84, turn: -12, ink: "marker", size: 1.2, text: "M.C.", wide: true },
  { x: 95, y: 94, turn: -6, ink: "pencil", size: 1.1, text: "the end", wide: true },
];

export default function Graffiti() {
  return (
    <div className="d01-graffiti" aria-hidden="true">
      {MARKS.map((mark, i) => {
        const style = {
          left: `${mark.x}%`,
          top: `${mark.y}%`,
          rotate: `${mark.turn}deg`,
          ...(mark.doodle ? { width: `${mark.size}rem` } : { fontSize: `${mark.size}rem` }),
        } satisfies CSSProperties;
        const className = [
          "d01-graffiti__mark",
          `d01-graffiti__mark--${mark.ink}`,
          mark.scrawl ? "d01-graffiti__mark--scrawl" : "",
          mark.wide ? "d01-graffiti__mark--wide" : "",
        ].join(" ");
        return (
          <span key={i} className={className} style={style}>
            {mark.text ?? mark.doodle}
          </span>
        );
      })}
    </div>
  );
}
