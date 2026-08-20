# @hellotimber/phone-screen

Rasterizes a Nokia 3310 `ScreenModel` (from `@hellotimber/phone-core`, **types
only** — no runtime dependency) into an 84×48 monochrome framebuffer and
presents it on a 2D canvas with the classic green LCD palette.

## Usage

```ts
import { createScreenRenderer } from "@hellotimber/phone-screen";

const renderer = createScreenRenderer({
  scale: 1, // canvas stays 84×48; upscale with CSS image-rendering: pixelated
  // fg: "#43523d", bg: "#c7f0d8",       // green LCD default
  welcomeText: "Hello!", // boot welcome note
});
document.body.append(renderer.canvas);

let lastVersion = renderer.version;
function frame(): void {
  renderer.render(phone.screen); // any phone-core ScreenModel
  if (renderer.version !== lastVersion) {
    lastVersion = renderer.version; // e.g. texture.needsUpdate = true in three.js
  }
  requestAnimationFrame(frame);
}
frame();
```

`render()` repaints and bumps `version` only when the output actually changes,
so it is safe to call every animation frame.

## Node / headless use

Everything except `createScreenRenderer` is DOM-free. Draw into a
`Framebuffer` directly and read `framebuffer.pixels` (one byte per pixel,
row-major, 0/1):

```ts
import { FONT, Framebuffer, renderScreen } from "@hellotimber/phone-screen";

const fb = new Framebuffer(); // 84×48
renderScreen(
  fb,
  { kind: "standby", carrier: "LACHLAN", signal: 4, battery: 4 },
  {
    welcomeText: "Hello!",
  },
);
fb.drawTextCentered(FONT, "overlay", 24);
console.log(fb.pixels.length); // 4032
```

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
