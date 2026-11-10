# @hellotimber/nokia-games-sdk

What a game for the 84×48 phone and its hosts share: the game contract, the screen, drawing
helpers, the game digits, the seeded generator, the host limits and manifest validation. No
runtime dependencies, and nothing from the DOM or Node: it runs in a page, a worker, Node and an
SES compartment. Plan 28 (`docs/plans/28-game-sdk-and-user-games.md`) is the design.

## A game

A game is a manifest (plain data, so a host can build its menu before any game code runs) and a
`create` function. The instance has no fixed tick: every call returns when it next needs waking.

```ts
import { sdk, type GameDefinition } from "@hellotimber/nokia-games-sdk";

const splash = sdk.createScreen();
sdk.drawNumber(splash, 2048, 66, 16, { scale: 3, align: "right" });

export const counter: GameDefinition = {
  manifest: {
    sdk: 1,
    id: "counter",
    name: "Counter",
    splash: { frames: [sdk.encodeFrame(splash)], steps: [{ frame: 0, ms: 2500 }] },
    menu: [{ kind: "play", slug: "new-game", label: "New game" }, { kind: "top-score" }],
  },
  create(ctx) {
    let count = 0;
    return {
      // Called at session time 0, then at each time asked for: here, once a second.
      update(nowMs) {
        if (nowMs >= 30_000) ctx.over(count);
        return 1000;
      },
      // A key counts; returning nothing keeps the pending wake.
      keyDown(key) {
        if (key === "5") count++;
      },
      draw(screen) {
        screen.clear();
        sdk.drawNumber(screen, count, 84, 0, { align: "right" });
      },
    };
  },
};
```

A user game is the same thing as a `GameFactory`: a function that takes `sdk` as its argument and
returns the definition, so its source needs no imports.

## The pieces

- `GameScreen`: 84×48 pixels of 0/1. `get`, `set`, `fill`, `invert` and `blit` clip to the screen;
  `pack()` gives the 504-byte frame (row-major, MSB first, 1 = ink) and `unpackFrame` reverses it.
- `drawText(screen, font, text, x, y, ink?)` and `textWidth(font, text)` work over any `GameFont`
  (rows of `#`/`.`; a row's length is the glyph's advance). They paint only the ink, return the
  width, and throw on a glyph the font lacks, naming it.
- `drawNumber(screen, value, x, y, { font, scale, gap, align, ink })` draws an integer in
  `GAME_DIGITS`, Snake II's 4×5 HUD numerals. `align: "right"` makes `x` the exclusive right edge.
- `encodeFrame(screen)` is the base64 of the packed frame, the form of a manifest's splash
  frames. `encodeBase64` and `decodeBase64` are the codec on its own.
- `createRandom(seed)` is mulberry32, a uint32 per call; `mixSeed(a, b)` derives one seed from
  two numbers.
- `validateManifest(value)` checks an untrusted manifest's structure and returns a frozen copy,
  or throws naming the field (`Invalid game manifest: menu[2].initial: expected …`). It refuses
  unknown fields. Whether the labels can be drawn in the host's fonts is the host's check.

## Limits

`src/limits.ts` holds the only caps on a game, each with its reason: the 504-byte frame,
`MIN_WAKE_MS`, the storage and package sizes, the per-reply effect bounds, the session clock's
width and the watchdog. Everything else (levels, options, notes, splash length, instruction
length) is the game's choice.

## Tests

```sh
mise exec -- vp run @hellotimber/nokia-games-sdk#test
```
