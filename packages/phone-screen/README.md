# @hellotimber/phone-screen

Rasterizes a Nokia 3310 `ScreenModel` (from `@hellotimber/phone-core`, **types
only** — no runtime dependency) into an 84×48 monochrome framebuffer and
presents it on a 2D canvas with the classic green LCD palette.

## Usage

Supply a painter for your firmware. The toolkit owns the canvas, palette, scaling and
change detection; the painter owns every pixel and clears the previous frame.

```ts
import { createScreenRenderer, Framebuffer } from "@hellotimber/phone-screen";
import type { ScreenPainter } from "@hellotimber/phone-screen";

const paint: ScreenPainter = (fb, screen) => {
  fb.clear();
  if (screen.kind === "custom") fb.blitBitmap(screen.frame, 0, 0);
};
const renderer = createScreenRenderer({ paint, scale: 1 });
document.body.append(renderer.canvas);
// Subscribe your phone snapshots to renderer.render(snapshot.screen).
// renderer.version changes only when pixels change.

// Headless rendering uses exactly the same painter:
const fb = new Framebuffer();
paint(fb, { kind: "off" });
```

There are no built-in phone layouts or boot animations. Stock firmware supplies its own
painter; standalone consumers provide theirs. Bitmap and font helpers remain DOM-free.

## Native pixel authoring

`bitmapFromArt`, `Framebuffer`, and `createPixelFont` are the direct 1:1
authoring seam. Every character in the art is one logical LCD pixel; `#` is
set and `.` is clear.

```ts
import { bitmapFromArt, createPixelFont, Framebuffer } from "@hellotimber/phone-screen";

const mail = bitmapFromArt(["######", "#....#", "##..##", "#.##.#", "######"]);

const digits = createPixelFont(
  {
    0: ["###.", "#.#.", "#.#.", "#.#.", "###."],
    1: [".#..", "##..", ".#..", ".#..", "###."],
  },
  5,
  4,
);

const pixels = new Framebuffer(); // native 84x48
pixels.blitBitmap(mail, 4, 4);
pixels.drawText(digits, "10", 16, 4);
```

Fonts without a fallback glyph reject unknown characters. Pass a fallback
character as the fourth `createPixelFont` argument only when substitution is
intentional.

## Testing

`vp test run` (or `pnpm test`). Pixel-level tests run in node; the canvas
wrapper test uses jsdom with a stubbed 2D context.
