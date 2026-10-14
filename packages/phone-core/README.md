# @hellotimber/phone-core

The Nokia 3310 "firmware" as a pure TypeScript state machine. **Zero runtime
dependencies, no DOM, no timers** — time is injected through `tick(nowMs)`, which
makes every behavior (boot animation, long presses, multi-tap timeouts, the 3-second
menu-shortcut window) deterministic and unit-testable.

It models: the boot/power sequence, the one-softkey menu system (carousel → lists →
readers), `Menu`+digit shortcuts, multi-tap text entry, app hosting (games draw raw
pixels), key sounds as events, and external `navigate(path)` control for URL sync.

## Usage

```ts
import { createPhone, PhoneMenu } from "@hellotimber/phone-core";

// Hosts compose their own PhoneMenu; phone-core contains no Nokia portfolio content.
const menu = new PhoneMenu([]);
const phone = createPhone({
  menu,
  carrier: "LACHLAN",
  bootMs: 0,
});

const unsubscribe = phone.subscribe(({ path, screen, poweredOn }) => {
  console.log(path, screen.kind, poweredOn);
});
phone.pressKey("power", 1000);
unsubscribe();
```

## Notes

- `tick(nowMs)` takes an absolute, monotonically increasing timestamp (e.g.
  `performance.now()`); the machine never calls `Date.now()` itself.
- `pressKey(key, holdMs)` is down + up; a `holdMs ≥ 800` advances the internal clock
  and derives a long press (power toggle, hold-C exit/clear, hold-digit numbers).
- `navigate()` to the current path is a strict no-op and emits no `pathchange` —
  safe for router bridges with echo suppression. Unknown paths fall back to
  `standby`. Navigating while off boots the phone and lands on the target.
- Menu entries carry explicit slugs and one-based order. Each top-level slot also requires
  a graphic; optional generic metadata remains opaque to phone-core. Top-level orders are
  contiguous; a submenu level may skip a number (a hidden entry keeps its number), and its list
  model then carries `itemOrders` (the shortcut numbers) beside the visible positions.
- Application entries hold reusable `PhoneApplication` definitions directly. Every launch
  creates a fresh `PhoneApplicationSession`; `context.open(application)` hands off to another
  definition on the same path and stack, while `context.exit()` returns to the menu.
- Animation is described by `Timeline`s (`{ frame, durationMs }` steps, optional `loopFrom`).
  They hold no pixels: the kernel resolves _which_ frame is visible and the host's renderer maps
  it to pixels. A top-level `MenuGraphic(id, timeline, { reveals })` exposes
  `screen.iconFrame` on the carousel. The timeline restarts every time the slot is revealed
  (`enter`, `next` ▼, `previous` ▲, `return` from a deeper screen), and `reveals` can play a
  different timeline per reveal. Subscribers get a snapshot only when the visible frame
  changes. `bootTimeline` drives the boot screen the same way and sets the boot length.

  ```ts
  const icon = new Timeline([
    { frame: 0, durationMs: 1100 },
    { frame: 1, durationMs: 194 },
    { frame: 0, durationMs: 1 },
  ]);
  new TopLevelEntry(entry, new MenuGraphic("games", icon));
  ```

- Host policy is configuration, not kernel code: `standbyKeys` (paths for ▲/▼ in standby),
  `carrier` (default `""`), `shortcutWindowMs` (default 3000), and `menuOpenDelayMs`
  (default 0: standby stays on screen with `leaving: true` before the carousel). The standby
  `clock()` and submenu `detail` readers are re-read on every tick; a changed value emits one
  snapshot. Submenus choose `presentation: "rows" | "pages"`.
- `rowsWindow` (default off) gives rows submenus a stateful circular window of that many rows;
  their list models then carry `windowTop`, the index of the item on the first visible row.
  `rowsWindowTop(previousTop, selected, count, rows)` is the rule, exported so host widgets draw
  their own lists the same way: with `count <= rows` the window is 0; entering a level
  (`previousTop` undefined) puts the selection on the top row; the window then holds while the
  selection stays inside it (indices modulo `count`), a move to the item just after the bottom
  row puts it on the bottom row, and any other move outside puts it on the top row. The window
  survives a child opening and closing and is rebuilt when the level is entered again.

  ```ts
  rowsWindowTop(undefined, 0, 10, 3); // 0: entering a ten-item level
  rowsWindowTop(7, 0, 10, 3); // 8: ▼ from the last item shows items 8, 9, 0
  rowsWindowTop(0, 9, 10, 3); // 9: ▲ from the first item shows items 9, 0, 1
  ```

- `Bitmap` convention: one byte per pixel, row-major, `pixels.length === width * height`.
