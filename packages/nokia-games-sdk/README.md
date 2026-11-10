# @hellotimber/nokia-games-sdk

What a game for the 84×48 phone and its hosts share: the game contract, the screen, drawing
helpers, the game digits, the seeded generator, the host limits, manifest validation, in-process
sessions and replay goldens. No
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

## Running a game

`localGame(definition)` validates the manifest and returns a `GameModule`. Each `start` is one
`GameSession`, driven synchronously with the host's session time in whole, non-decreasing ms:

```ts
import { GAME_DIGITS, localGame } from "@hellotimber/nokia-games-sdk";
import { counter } from "./counter";

const session = localGame(counter).start(
  { mode: "", level: 1, choices: {}, seed: 44530, topScore: 0, storage: new Uint8Array(0) },
  { game: GAME_DIGITS },
);
session.keyDown("5", 420); // runs every wake due by 420 ms first, each at its own time
session.keyUp("5", 500);
session.advance(3000); // runs the wakes at 1000, 2000 and 3000 ms
session.frame(); // the newest packed frame; a new array only when the pixels changed
session.drain(); // the effects since the last drain, each with the ms of its call
session.wake(); // 4000: the next wake, or null while the game sleeps
```

`update` runs at exactly the times the game asked for, however coarsely the host advances. A
delay below `MIN_WAKE_MS` is raised to it and a fraction rounds up. A key goes down once and its
release is delivered only if its key-down was. After `ctx.over()` the session ignores every call.

`session.failure` is set once the game is dead, and starts with the reason: `game: …` (it threw),
`wake: …` (a delay that is negative, not finite or not a number), `effect: …` (a malformed ctx
call), `limit: …` (more than 64 effects or 8192 notes in one call) or `clock` (the session reached
`MAX_SESSION_MS`). A time that decreases, or a key that is not a `GameKey`, is the host's bug and
throws.

## Replays

A replay (`game-replay 1`) holds a session's start and its keys, and what the game must then do:
every effect with its ms, the frame standing at 0, every 10 000 ms, at each vibrate or over and at
the end, and a hash over every distinct frame with the ms it was drawn at. Replays are exact.

```ts
import {
  checkReplay,
  parseReplay,
  recordReplay,
  serializeReplay,
} from "@hellotimber/nokia-games-sdk";

const replay = recordReplay(module, start, "400:6 900:2 2600:8+ 2750:8-", 30_000, { note: "…" });
const text = serializeReplay(replay); // commit this as a golden

const mismatch = checkReplay(module, parseReplay(text, "goldens/counter.replay"));
if (mismatch) throw new Error(mismatch.message); // the first differing effect or frame, with its ms
```

In `input`, `400:6` is a key-down and a key-up at 400 ms, and `8+`/`8-` give them separately; keys
are `0`-`9`, `*`, `#`, `up` and `down`. `checkReplay(module, replay, { advanceMs: 17 })` also calls
`advance` on that grid, which must change nothing. `recording(module)` wraps a module so that
`lastReplay()` returns the replay text of the session just played.

## Limits

`src/limits.ts` holds the only caps on a game, each with its reason: the 504-byte frame,
`MIN_WAKE_MS`, the storage and package sizes, the per-reply effect bounds, the session clock's
width and the watchdog. Everything else (levels, options, notes, splash length, instruction
length) is the game's choice.

## Tests

```sh
mise exec -- vp run @hellotimber/nokia-games-sdk#test
```
