# @hellotimber/snake

Nokia Snake II as a pure TypeScript library: a deterministic rules engine plus a
rasterizer that draws any game state to an 84×48 1-bit bitmap. Zero dependencies,
no DOM, no timers — the host decides when to tick and where to put the pixels.

Gameplay follows the original Snake II: 21×10 cell playfield with wraparound
edges, no reversing, six mazes (No maze, Box, Tunnel, Mill, Rails, Apartment),
levels 1–9 (faster + more points per food), a bonus bug every 5 foods with a
countdown value, and a flashing death animation into a GAME OVER screen.

## Usage

```ts
import { createSnake, renderSnakeFrame, tickIntervalMs, MAZE_NAMES } from "@hellotimber/snake";

const game = createSnake({ speed: 9, maze: 1, seed: 1234 });
game.dispatch("up"); // queue a turn ("up" | "down" | "left" | "right")
const alive = game.tick(); // advance one step; false once game over
const frame = renderSnakeFrame(game.state); // { width: 84, height: 48, pixels: Uint8Array }
setTimeout(step, tickIntervalMs(9)); // host owns the clock (105 ms at level 9)
```

- `createSnake({ speed?, maze?, seed? })` — level 1–9 (default 1), maze 0–5
  (default 0, see `MAZE_NAMES`), PRNG seed (default 1). Same options + same
  inputs ⇒ identical games, byte for byte.
- `game.state` — plain serializable object (snake cells, food, bonus, score,
  status…). Treat it as read-only.
- `game.pause()` / `game.resume()` / `game.reset()` — interruptions and restart;
  any `dispatch` also starts an idle game or resumes a paused one.
- `renderSnakeFrame(state)` — pure function; safe to call at any frame rate.

## Play it in a terminal

Save as `play.mjs` next to a checkout (or with the package installed) and run
`node play.mjs`. Arrow keys steer, `q` quits:

```js
import { createSnake, renderSnakeFrame, tickIntervalMs } from "@hellotimber/snake";

const game = createSnake({ speed: 7, maze: 1, seed: Date.now() >>> 0 });
game.dispatch("right");

process.stdin.setRawMode(true);
process.stdin.resume();
const keys = { "\u001b[A": "up", "\u001b[B": "down", "\u001b[C": "right", "\u001b[D": "left" };
process.stdin.on("data", (b) => {
  const k = b.toString();
  if (k === "q" || k === "\u0003") process.exit(0);
  if (keys[k]) game.dispatch(keys[k]);
});

const timer = setInterval(() => {
  const alive = game.tick();
  const { width, height, pixels } = renderSnakeFrame(game.state);
  let out = "\u001b[H\u001b[2J";
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x++) {
      const top = pixels[y * width + x];
      const bottom = pixels[(y + 1) * width + x];
      out += top && bottom ? "█" : top ? "▀" : bottom ? "▄" : " ";
    }
    out += "\n";
  }
  process.stdout.write(out);
  if (!alive) {
    clearInterval(timer);
    console.log("score:", game.state.score);
    process.stdin.pause();
  }
}, tickIntervalMs(7));
```

## Testing

```sh
vp test run   # from packages/snake/ (or `vp run -r test` from the repo root)
```

Everything is deterministic: gameplay tests script exact seeds and assert exact
cells, scores and pixels.
