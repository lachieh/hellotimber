/**
 * The NOKIA wordmark on the badge above the screen, measured off a front-on photo of a real 3310
 * (each letter's extent, its strokes' widths, where its diagonals cross) and drawn with straight
 * edges, as the logotype is. In the badge's units: the badge's width is 1, centred on 0, y down.
 */

/** Top and bottom of the letters (they sit a little below the badge's middle). */
const T = -0.069;
const B = 0.083;

const poly = (...points: [number, number][]) =>
  `M${points.map(([x, y]) => `${x} ${y}`).join("L")}Z`;

function roundRect(x0: number, y0: number, x1: number, y1: number, r: number): string {
  return (
    `M${x0 + r} ${y0}H${x1 - r}Q${x1} ${y0} ${x1} ${y0 + r}V${y1 - r}Q${x1} ${y1} ${x1 - r} ${y1}` +
    `H${x0 + r}Q${x0} ${y1} ${x0} ${y1 - r}V${y0 + r}Q${x0} ${y0} ${x0 + r} ${y0}Z`
  );
}

const N = poly(
  [-0.4468, T],
  [-0.378, T],
  [-0.2803, 0.033],
  [-0.2803, T],
  [-0.2333, T],
  [-0.2333, B],
  [-0.302, B],
  [-0.3998, -0.019],
  [-0.3998, B],
  [-0.4468, B],
);
const O =
  roundRect(-0.2205, T, -0.0231, B, 0.03) + roundRect(-0.1763, T + 0.037, -0.0679, B - 0.037, 0.01);
const K = poly(
  [-0.009, T],
  [0.038, T],
  [0.038, -0.004],
  [0.128, T],
  [0.1821, T],
  [0.098, 0.006],
  [0.1821, B],
  [0.115, B],
  [0.052, 0.032],
  [0.038, 0.042],
  [0.038, B],
  [-0.009, B],
);
const I = poly([0.1935, T], [0.2455, T], [0.2455, B], [0.1935, B]);
const A =
  poly(
    [0.2538, B],
    [0.333, T],
    [0.388, T],
    [0.4667, B],
    [0.408, B],
    [0.399, 0.055],
    [0.324, 0.055],
    [0.314, B],
  ) + poly([0.3355, 0.03], [0.3605, -0.022], [0.386, 0.03]);

/** The wordmark as SVG path data (fill even-odd: the O's and A's counters are holes). */
export const WORDMARK = N + O + K + I + A;

/** The letters' extent, in the badge's units. */
export const WORDMARK_BOUNDS = { left: -0.4468, right: 0.4667, top: T, bottom: B } as const;

/** The badge's width over its height on the photographed phone. */
export const BADGE_ASPECT = 4.64;
