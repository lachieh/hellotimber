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
import { createPhone, editorApp, nokia3310Menu } from "@hellotimber/phone-core";

const phone = createPhone({
  menu: nokia3310Menu({
    phonebook: [{ id: "email", label: "Email", body: "you@example.com" }],
    inbox: [{ id: "hello", label: "Hello!", body: "Welcome to my portfolio." }],
    chat: [{ who: "them", text: "Highly recommended." }],
    missedCalls: [],
    receivedCalls: [{ id: "acme", label: "Acme 2020", body: "Senior engineer." }],
    dialledNumbers: [{ id: "site", label: "This site", body: "A Nokia 3310 portfolio." }],
    diverts: [{ id: "github", label: "GitHub", href: "https://github.com/you" }],
    reminders: [{ id: "now", label: "Now", body: "Learning three.js." }],
  }),
  apps: { "write-message": editorApp({ title: "Message:" }) },
  carrier: "LACHLAN",
  clock: () => new Date().toTimeString().slice(0, 5),
  bootMs: 3000, // 0 skips the boot animation (handy in tests)
});

// observe state
const unsubscribe = phone.subscribe(({ path, screen, poweredOn }) => {
  console.log(path, screen.kind, poweredOn);
});
phone.on("pathchange", (path) => console.log("→", path)); // sync to a router
phone.on("sound", (s) => console.log("play", s.kind, s.id)); // play audio in the host
phone.on("action", (a) => console.log("open", a.value)); // open href actions

// drive time from the host (rAF, setInterval, or a test loop)
let t = 0;
setInterval(() => phone.tick((t += 100)), 100);

// press keys
phone.pressKey("power", 1000); // hold ≈1s → boots to standby
phone.pressKey("navi"); // open the menu carousel
phone.pressKey("down"); // next menu (wraps around all 13)
phone.pressKey("navi"); // select
phone.pressKey("c"); // back one level (hold-C → standby)

// or control it from the outside (deep links / back button)
phone.navigate("menu/games/snake");
console.log(phone.path, phone.screen);

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
- Apps (`PhoneApp` via `config.apps`) receive raw key down/up events and `tick(dtMs)`
  deltas; call `ctx.exit()` synchronously from `onKey`/`tick` to return to the menu.
- `Bitmap` convention: one byte per pixel, row-major, `pixels.length === width * height`.
