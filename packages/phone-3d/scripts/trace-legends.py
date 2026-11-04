"""
Traces the keypad's print off a front-on photo of a real 3310 into src/legends.generated.ts: per
key, the dark print on its silver cap as one SVG path (even-odd fill) in its decal's units
(legends.ts: x -100 to 100 across the decal, y down from its centre).

  uv run --no-project --with numpy --with pillow --with scikit-image --with scipy \
    --with potracer python scripts/trace-legends.py <photo.png>

The photo is not in the repo. Each cap is found as a bright region on the dark cover; the print
is what is darker than the cap's own shading around it, thresholded on a bicubic upscale and
traced with potrace into curves. Each cap maps onto its model key's decal, which spans 0.86 of
the key (Key.tsx); the rocker is one cap in the photo but two keys in the model.
"""

import sys
from pathlib import Path

import numpy as np
import potrace
from PIL import Image, ImageFilter
from scipy import ndimage
from skimage import measure, morphology

OUT = Path(__file__).resolve().parent.parent / "src" / "legends.generated.ts"
PHOTO = sys.argv[1]
UP = 8
INK = 0.34
DECAL = 0.86
# The model's caps are leaf-shaped where the real ones are oval: a little margin keeps the print
# near a cap's ends on the key.
FIT = 0.9

# The model's keys, their front-view bounds in stage units (scripts/model.ts): x0, x1, y0, y1,
# y up. Its caps are flatter than the photographed phone's, so each cap's print is fitted inside.
MODEL = {
    "1": (-1.63, -0.79, -2.25, -1.73),
    "2": (-0.42, 0.42, -2.34, -1.89),
    "3": (0.80, 1.62, -2.24, -1.73),
    "4": (-1.53, -0.72, -2.89, -2.42),
    "5": (-0.42, 0.42, -3.02, -2.56),
    "6": (0.72, 1.53, -2.89, -2.42),
    "7": (-1.51, -0.67, -3.57, -3.08),
    "8": (-0.42, 0.42, -3.69, -3.24),
    "9": (0.67, 1.51, -3.57, -3.08),
    "*": (-1.45, -0.62, -4.23, -3.76),
    "0": (-0.42, 0.42, -4.37, -3.91),
    "#": (0.62, 1.45, -4.23, -3.76),
    "c": (-1.48, -0.65, -1.41, -0.61),
    "up": (0.65, 1.45, -1.36, -0.65),
    "down": (0.24, 1.02, -1.69, -0.98),
}

img = Image.open(PHOTO).convert("RGB")
L = np.asarray(img).astype(float).mean(axis=2)
caps = measure.label(morphology.opening(L > 150, morphology.disk(2)))
regions = [r for r in measure.regionprops(caps) if 1500 < r.area < 8000]
# The cluster keys are the caps above the keypad: the C key on the left, the rocker on the right;
# the NaviKey between them carries a coloured bar, not print.
digits = [r for r in regions if 1900 < r.area < 2450]
assert len(digits) == 12, f"{len(digits)} digit caps"
top = min(r.centroid[0] for r in digits)
cluster = sorted((r for r in regions if r.centroid[0] < top - 20), key=lambda r: r.centroid[1])
c_cap, rocker = cluster[0], cluster[-1]

columns = sorted(digits, key=lambda r: r.centroid[1])
grid = [sorted(columns[i : i + 4], key=lambda r: r.centroid[0]) for i in (0, 4, 8)]
names = [["1", "4", "7", "*"], ["2", "5", "8", "0"], ["3", "6", "9", "#"]]


def ink_of(r):
    """The cap's print as a bitmap at UP× and the cap's bounds in photo pixels."""
    y0, x0, y1, x1 = r.bbox
    cap = ndimage.binary_fill_holes(
        morphology.closing(caps[y0:y1, x0:x1] == r.label, morphology.disk(6))
    )
    inner = morphology.erosion(cap, morphology.disk(3))
    big = img.crop((x0, y0, x1, y1)).resize(((x1 - x0) * UP, (y1 - y0) * UP), Image.BICUBIC)
    Lb = np.asarray(big).astype(float).mean(axis=2)
    shading = (
        Image.fromarray(Lb.astype(np.uint8))
        .filter(ImageFilter.MaxFilter(4 * UP + 1))
        .filter(ImageFilter.GaussianBlur(3 * UP))
    )
    bg = np.asarray(shading).astype(float)
    ink = np.clip((bg - Lb) / np.maximum(bg, 1), 0, 1) > INK
    inside = np.asarray(Image.fromarray(inner).resize(Lb.shape[::-1], Image.NEAREST)) > 0
    ink &= inside
    # Drop what touches the cap's edge: its rim's shading, not print.
    marks = measure.label(ink)
    edge = inside & ~ndimage.binary_erosion(inside, iterations=UP)
    for m in np.unique(marks[edge]):
        if m:
            ink[marks == m] = False
    return ink, (x0, y0)


def trace(ink, to_units):
    """potrace curves → SVG path data, each point through `to_units` (UP× pixels → units)."""
    path = potrace.Bitmap(~ink).trace(turdsize=160, alphamax=1.0, opticurve=True)
    f = lambda p: "%.1f %.1f" % to_units(p.x, p.y)
    d = []
    for curve in path:
        parts = ["M" + f(curve.start_point)]
        for s in curve.segments:
            if s.is_corner:
                parts.append("L%sL%s" % (f(s.c), f(s.end_point)))
            else:
                parts.append("C%s %s %s" % (f(s.c1), f(s.c2), f(s.end_point)))
        d.append("".join(parts) + "Z")
    return d


def cap_units(r, origin, key):
    """Photo (UP× crop) → `key`'s decal: the cap's centre on the key's, scaled to fit the cap
    inside the key (the same scale both ways, so the print keeps its shape)."""
    x0, y0 = origin
    cx, cy = r.centroid[1], r.centroid[0]
    kx0, kx1, ky0, ky1 = MODEL[key]
    fit = FIT * min((kx1 - kx0) / (r.bbox[3] - r.bbox[1]), (ky1 - ky0) / (r.bbox[2] - r.bbox[0]))
    unit = fit * 200 / (DECAL * (kx1 - kx0))
    return lambda x, y: ((x / UP + x0 - cx) * unit, (y / UP + y0 - cy) * unit)


paths = {}
for column, keys in zip(grid, names):
    for r, name in zip(column, keys):
        ink, origin = ink_of(r)
        paths[name] = trace(ink, cap_units(r, origin, name))

ink, origin = ink_of(c_cap)
paths["c"] = trace(ink, cap_units(c_cap, origin, "c"))

# The rocker: its cap's bounds map onto the two keys' joint bounds, then each mark goes to the
# key under it, in that key's decal units.
ink, (x0, y0) = ink_of(rocker)
ry0, rx0, ry1, rx1 = rocker.bbox
mx0 = min(MODEL["up"][0], MODEL["down"][0])
mx1 = max(MODEL["up"][1], MODEL["down"][1])
my0 = min(MODEL["up"][2], MODEL["down"][2])
my1 = max(MODEL["up"][3], MODEL["down"][3])


def to_model(x, y):
    px, py = x / UP + x0, y / UP + y0
    return (
        mx0 + (px - rx0) / (rx1 - rx0) * (mx1 - mx0),
        my1 - (py - ry0) / (ry1 - ry0) * (my1 - my0),
    )


marks = measure.label(ink)
for name in ("up", "down"):
    kx0, kx1, ky0, ky1 = MODEL[name]
    unit = 200 / (DECAL * (kx1 - kx0))
    mine = np.zeros_like(ink)
    for m in range(1, marks.max() + 1):
        ys, xs = np.nonzero(marks == m)
        mx, my = to_model(xs.mean(), ys.mean())
        # The up arrow sits upper right, the down arrow lower left.
        if (mx + my > (mx0 + mx1) / 2 + (my0 + my1) / 2) == (name == "up"):
            mine |= marks == m

    def units(x, y, kx0=kx0, kx1=kx1, ky0=ky0, ky1=ky1, unit=unit):
        mx, my = to_model(x, y)
        return ((mx - (kx0 + kx1) / 2) * unit, ((ky0 + ky1) / 2 - my) * unit)

    paths[name] = trace(mine, units)

order = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "*", "#", "c", "up", "down"]
body = "".join(f'  "{k}": "{"".join(paths[k])}",\n' for k in order)
OUT.write_text(
    f"""// Generated by scripts/trace-legends.py from a front-on photo of a 3310. Do not edit.

/** Each key's print as SVG path data (fill even-odd), in its decal's units: x -100 to 100 across
 *  the decal, y down from its centre. */
export const LEGEND_PATHS = {{
{body}}} as const;
"""
)
print("wrote", OUT, {k: len(v) for k, v in paths.items()})
