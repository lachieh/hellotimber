# Plan 28 - Game SDK and user games

> **For agentic workers:** execute task-by-task; tick checkboxes; commit per task.
> If this plan contradicts VISION.md, AGENTS.md, or the code, STOP and report.

**Prerequisites:** plans 13, 14, 15, 16 and 23 `done`. Plan 16 finished while this plan was being
written; its Tasks 9-11 edited `src/sound/sounder.ts`, `src/firmware/cues.ts`, the demo and the
README, which this plan edits too. Plan 24 (Games II) does not depend on this plan, but both edit
the Games level (`src/firmware/{menu,leaves,bindings}.ts`). Whichever plan lands second rebases
onto the other and keeps both plans' tests green.
**Ground truth:** no new captures. Extra games are not stock firmware, so their gameplay is ours
and their goldens are approved snapshots (D11). The shell screens around them reuse stock widgets
that plan 14/23 goldens already assert: the splash intro, the rows game menu, the Level page, the
`… selected` notes, the Top score note, the text pages, the game-over note and the fireworks.
"Sandbox investigation" cites the sandbox facts; read it before Tasks 9-12.
**Status:** not started.

## Goal

Make new games addable to `@hellotimber/nokia-os` without editing firmware code. Each game
supplies its own menu name, menu animation and menu entries:

- a game SDK (`@hellotimber/nokia-games-sdk`): the manifest, the runtime contract (fixed-step
  ticks, key down/up, drawing into an 84×48 1-bit frame), a context with a seeded RNG, sound,
  vibration, quota'd storage and stock fonts, plus deterministic replays;
- a shell in nokia-os that turns a game into a Games submenu with its splash intro, New game and
  Continue (with suspend), and the stock Level, option, Top score, Instructions, game-over and
  fireworks screens as optional services;
- 2048 as the first game: first-party, in `@hellotimber/nokia-games`, designed for the 84×48
  LCD;
- user-supplied games, JS or Wasm, run in a sandbox (`@hellotimber/nokia-games-sandbox`). The
  sandbox runs only the game's functions: no network, no host DOM or storage, no wall clock, and a
  watchdog can terminate it. The same 2048 runs there as user JS, and a minimal Wasm game proves
  the ABI;
- a demo in which extra games can be switched on, installed from a file or URL, persisted, played
  and recorded as replays.

Stock fidelity is a hard rule. A phone created without `games` is byte-identical to today's, and
every golden passes unchanged. phone-core and the website do not change.

## Why this plan exists (measured gap)

| Area           | nokia-os today                                                                                                                | Needed                                                       |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Games list     | the four stock games + Settings, built from the generated tree; Snake II by hand (plan 23), the rest placeholders for plan 24 | games added from data, no firmware edits                     |
| Game hosting   | `src/widgets/snake.ts` is welded to Snake II's engine, timing tables and setting keys                                         | one host for any game: fixed step, keys, frame, effects      |
| Shell screens  | game-over and fireworks are generic (plan 23 D13); Level page, Top score and Continue are Snake II's                          | offered to every game as services                            |
| Untrusted code | none                                                                                                                          | user JS/Wasm that can compute and draw, and nothing else     |
| Determinism    | Snake II replays its goldens from seed + `input` (plan 23 D5)                                                                 | the same discipline for every SDK game, recordable from play |

## Sandbox investigation (planning, 2026-10-14)

Lachlan's question: "Can't we only execute a game function, with anything else like window.fetch
inaccessible?" Facts, checked against primary sources:

| #   | Fact                                                                                                                                                                                                                                                                                                                                                                                                        | Source                                                                                                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | Hiding globals in the page's own realm (shadowing `fetch`, `with`, a Proxy scope) is escapable: every function reaches `Function.prototype.constructor`, and `(function(){}).constructor("return this")()` returns the real global. SES exists to close that path: lockdown replaces the intrinsic constructors with "powerless dummies"; "The `Function.prototype.constructor` can only throw exceptions". | https://github.com/endojs/endo/tree/master/packages/ses (README, "Lockdown"); `src/tame-function-constructors.js`                                                             |
| F2  | `ses` 2.3.0 (2026-08-13), Apache-2.0. Unpacked 4.7 MB; `dist/ses.umd.min.js` is 237,664 B minified, ≈48 KB gzip (measured from the tarball). "The SES shim runs in most engines, either as an ESM module `ses` or as a `<script>` tag"; the README recommends a separate script over bundling.                                                                                                              | https://registry.npmjs.org/ses; SES README                                                                                                                                    |
| F3  | A new Compartment gets JS intrinsics only: "Compartments receive no ambient authority… (for example no `fetch`)". `new Compartment({ globals, __options__: true })` and `compartment.evaluate(source)` are current.                                                                                                                                                                                         | SES README                                                                                                                                                                    |
| F4  | Inside a compartment, `eval`, `Function` and dynamic `import` are the compartment's own. The shim rejects any source text that looks like an `import(` call, "even in a comment or literal string" (SES_IMPORT_REJECTED), and rejects HTML comments (SES_HTML_COMMENT_REJECTED).                                                                                                                            | `packages/ses/error-codes/SES_IMPORT_REJECTED.md`, `SES_HTML_COMMENT_REJECTED.md`                                                                                             |
| F5  | "`Math.random`, `Date.now`, and the `new Date()` are disabled within compartments"; `performance.now` is unavailable. A host can endow a seeded PRNG instead.                                                                                                                                                                                                                                               | https://github.com/endojs/endo/blob/master/docs/lockdown.md (`mathTaming`/`dateTaming` deprecation; "Timing side-channels")                                                   |
| F6  | `lockdown()` works without CSP `'unsafe-eval'`, but `compartment.evaluate()` needs it (the evaluator is built with `FERAL_FUNCTION`). SES cannot stop an infinite loop or unbounded allocation; its docs send untrusted guests to "a separate agent (such as a worker…)". `lockdown()` inside a worker is not stated explicitly (medium confidence).                                                        | `docs/lockdown.md` ("evalTaming", "Limitations"); `packages/ses/src/make-evaluate.js`; CHANGELOG 0.18.1                                                                       |
| F7  | `Worker.terminate()` "immediately terminates the Worker"; the HTML spec aborts the script running in the worker, infinite loops included.                                                                                                                                                                                                                                                                   | https://developer.mozilla.org/en-US/docs/Web/API/Worker/terminate; https://html.spec.whatwg.org/multipage/workers.html                                                        |
| F8  | A worker's CSP: `blob:` URL → a clone of the policy container of the environment that created the blob; other local schemes (`data:`) → a clone of its owner's; http(s) → the worker script's own response headers. MDN agrees.                                                                                                                                                                             | https://html.spec.whatwg.org/multipage/browsers.html#initialize-worker-policy-container; https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers   |
| F9  | `connect-src` governs `fetch`, XHR, `EventSource`, `sendBeacon` and `WebSocket`. `importScripts` is a script request (`script-src`). A nested `new Worker` is `worker-src`. `default-src 'none'` covers all of them, and also blocks eval and Wasm compilation unless `script-src` lists `'unsafe-eval'` / `'wasm-unsafe-eval'`.                                                                            | https://w3c.github.io/webappsec-csp/ (ED 2026-09-16); https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src                  |
| F10 | An `about:srcdoc` iframe inherits a clone of its parent's policy container, and a `<meta http-equiv="Content-Security-Policy">` inside it applies as well (both enforced). A `src` document does not inherit the parent's CSP.                                                                                                                                                                              | HTML spec (policy container for `about:srcdoc`); CSP3 §3.3, §7.8                                                                                                              |
| F11 | Script in an opaque-origin `sandbox="allow-scripts"` frame can start a dedicated worker from a `blob:` it created: Firefox yes (bug 341604), Chrome yes per reports. Safari is UNVERIFIED (WebKit bug 170075 was fixed in 2021, but a later report says it still reproduced). http(s) workers fail from origin `null` (Firefox bug 1260388).                                                                | https://bugzilla.mozilla.org/show_bug.cgi?id=341604; https://bugs.webkit.org/show_bug.cgi?id=170075; https://bugzilla.mozilla.org/show_bug.cgi?id=1260388                     |
| F12 | Since 127.0.6483.0, desktop Chromium moves sandboxed frames without `allow-same-origin` into a separate process from their parent.                                                                                                                                                                                                                                                                          | https://chromium.googlesource.com/chromium/src/+/main/docs/process_model_and_site_isolation.md                                                                                |
| F13 | Wasm reaches the host only through its imports: "Modules must declare all accessible functions… at load time". `WebAssembly.Module.imports()`/`exports()` list them before instantiation. A `Memory` has a `maximum` in 64 KiB pages.                                                                                                                                                                       | https://webassembly.org/docs/security/; https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/JavaScript_interface/Module/imports_static; MDN `WebAssembly.Memory()` |
| F14 | WAT compilers on npm that need no native toolchain: `watr` 5.11.9 (2026-10-02, MIT, zero dependencies, 1.4 MB unpacked); `wabt` 1.0.39 (2025-11-05, Apache-2.0, an Emscripten build, 5.6 MB).                                                                                                                                                                                                               | https://www.npmjs.com/package/watr; https://www.npmjs.com/package/wabt                                                                                                        |

Conclusions:

1. **Yes, the sandbox can expose only the game's functions, but not by hiding globals in the
   phone's realm (F1).** A guarantee needs a realm whose globals were never reachable: an SES
   Compartment for JS (F3-F5) or a Wasm import object (F13). Both run on an agent the host can
   kill (F7). For defence in depth, the browser denies network access to that agent regardless
   of what the code does (F8-F10).
2. **The network denial must come from the agent's own policy, not from the host page.** A
   `blob:` worker created inside an opaque-origin sandboxed document inherits that document's
   CSP (F8, F10, F11). The host page keeps its own policy, and `'unsafe-eval'` never has to be
   allowed in the page that runs the phone.
3. **Residual risks are honest ones:** memory exhaustion (F6), side channels, the browser's own
   bugs, Safari support (F11), and what a game can show on the LCD. They are listed in D7.

## Scope and non-goals

In scope: the Goal items; three new packages; the shell in nokia-os (one public config field and
one validator); an EEPROM record for extra games; the demo; documentation; two new dependencies
(D17).

Out of scope: porting Snake II or plan 24's games onto the SDK (D16); the website and portfolio
integration (unsequenced, as for all of nokia-os); multiplayer and IR; Club Nokia Score IDs;
`Lights` (plan 25); nested game submenus (Pairs II-style modes are `play` items with a `mode`;
nesting is a follow-up); a game store, signing or a registry; any network feature for games (none
by design); publishing to npm.

## Decisions

Each decision states what it adds or changes relative to plans 13-16 and 23.

**D1 - Three new packages; nokia-os hosts the shell (new; layout).**

| Package                            | Owns                                                                                                                                                                                                                                          | Depends on                            |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `@hellotimber/nokia-games-sdk`     | what game code and hosts share: contract types, `GameScreen`, drawing helpers, `GAME_DIGITS`, the seeded generator, manifest and package validation, local sessions, replays, the worker protocol, the Wasm ABI adapter, conformance fixtures | nothing at runtime; dev: `watr` (D17) |
| `@hellotimber/nokia-games`         | first-party games (2048), their replay goldens, the example user packages (2048 as user JS, the Wasm game Dot)                                                                                                                                | `nokia-games-sdk`; dev: `watr`        |
| `@hellotimber/nokia-games-sandbox` | the browser sandbox: the sandboxed iframe, CSP, worker runtime (SES), watchdog and self-test                                                                                                                                                  | `nokia-games-sdk`, `ses`              |
| `@hellotimber/nokia-os` (changed)  | the shell: extra games in the Games menu, stock service screens, the session widget, the `sdk-games` EEPROM record                                                                                                                            | + `nokia-games-sdk` (runtime)         |

Alternatives rejected: _everything inside nokia-os_ would make user games depend on the firmware
package and tie first-party games to the stock OS's internals. _SDK and games only, with the
sandbox in the SDK_ would give every game author a dependency on `ses` and DOM code. The SDK stays
zero-dependency so a game package needs nothing else. nokia-os never imports `nokia-games` or the
sandbox: hosts pass games in (`StockPhoneConfig.games`). The nokia-os demo composes them as a dev
tool, under a new AGENTS rule: a package's `demo/` may import siblings through devDependencies,
and its `src/` and `tests/` may not. A test enforces this (Task 12).

**D2 - The game's "menu animation" is its splash intro; extra games have no icons (decides
Lachlan's question).** On the 3310 the only animated menu graphics are the twelve top-level
carousel icons. The Games list is a text rows list, and every stock game shows an animated
full-screen splash when its level is entered with Select. The splash runs 6-13 frames at about
250 ms per frame (2.5-3.5 s), any key skips it, and it plays again on every entry (plan 14 D12,
plan 23 C8). A game's menu animation is therefore its splash: `manifest.splash` holds packed
84×48 frames and steps, and the kernel's existing `SubmenuOptions.intro` seam plays it. A
per-game icon would invent UI the firmware does not have, and the carousel's Games icon stays
stock. Hosts that need a thumbnail (the demo's install list, a future HTML panel) use the
splash frames.

**D3 - Extra games are opt-in and sit between Pairs II and Settings (new).**
`StockPhoneConfig.games` (default none) appends games to the Games level after Pairs II, in the
order given. Menu numbers: Snake II…Pairs II keep 8-1…8-4. The extra games take orders 5, 6, …;
Settings takes order 6 when there are no extras (stock, the hidden 8-5 gap) or one extra game
(which fills the gap), and `5 + n` for n ≥ 2. Slugs never change (`menu/games/settings`,
`menu/games/<id>`), so paths, setting keys and bindings keyed by tree number (`8-6-3`) are
unaffected. Only the displayed index of Settings, and the shortcut digits that reach it, move
with two or more extra games. Without `games` the level is built exactly as today. A test proves
the menu graph is unchanged, and every golden still passes. `stockMenu` (the export) stays the
stock tree.

**D4 - The SDK contract: a data manifest and a fixed-step instance with no clock (new).** See
"SDK contract". The manifest is plain JSON-able data, so the host can build the menu before any
game code runs. That matters for sandboxed games, which only start at New game. The instance
receives key-downs and key-ups, a `step()` every `tickMs` of kernel time, and draws into a
`GameScreen` after each. It never reads time: game time is its step count. Its randomness is
`ctx.random()`, a seeded generator from the SDK. In the sandbox, SES enforces both (F5). Keys act
on key-down, as every stock game's do (plan 23 D7). Navi and C belong to the shell (suspend or
quit) and the game never sees them. The soft key and power are not game keys. The phone's keypad
beeps still sound on game keys (plan 16 D8).

**D5 - Shell services: menu items and `over()` map onto stock widgets (new; Lachlan item 1).**
The manifest's `menu` lists the game menu in order. Each item kind is a stock screen the shell
already has:

| Item                                 | Shell behaviour (stock widget and its timing)                                                                                                                                                                                                               |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `play` (New game; more with `mode`)  | starts a session (the first item must be a `play`). A fresh session discards a suspended one, as Snake II's New game does                                                                                                                                   |
| Continue (implicit, `suspend: true`) | an entry heading the list only while a game is suspended (phone-core `shown`, positional numbers, `opening()`), as plan 23 D10. Its label is the stock `Continue`                                                                                           |
| `level`                              | Snake II's Level page generalised (`levelPage`, D11 of plan 23): `min(level, 9)` filled bars, ▲ raises below `max`, ▼ lowers to 1, both act on key-down and repeat while held, OK stores, C discards                                                        |
| `choice`                             | a stock option list (`OptionListWidget`, softkey `OK`, opening on the stored value), then `<option>\nselected` in the timeline of Snake II's Mazes notes (`tree/08-games/8-1-3-*`)                                                                          |
| `top-score`                          | the animated Top score note in Snake II's timeline (`8-1-4`), reading the game's stored top score; it returns as Snake II's does (New game on the bottom row, or Continue while suspended)                                                                  |
| `instructions`                       | stock text pages (thin face, `More` cycles, C leaves)                                                                                                                                                                                                       |
| `ctx.over(score)` (`scores` ≠ false) | the stock game-over screens (`gameOver`, plan 23 D13): if the score beats the stored top score, the shell writes it, plays the fireworks with `TOP SCORE:` and cues `top-score`; otherwise `Your score:`. Both return to the game menu on New game, top row |
| `ctx.over()` (`scores: false`)       | straight back to the game menu, New game on the top row; `top-score` items are refused at validation                                                                                                                                                        |

Games draw any end animation of their own (a death blink) before calling `over`. One screen is
composed, not stock: a failed game (it threw, broke the protocol, or tripped the watchdog) shows
`Game\nerror` in the timed-note widget with the information/error icon class that `Not allowed`
uses (≈2.9 s), then the game menu on New game. The spec lists it as non-stock.

**D6 - One session port for in-process and sandboxed games; lockstep by message order (new).**
The shell drives every game through `GameModule.start() → GameSession` (SDK), a synchronous
surface: `keyDown`, `keyUp`, `step`, `frame()`, `drain()`, `failure`, `dispose`. `localGame()`
runs a definition in-process, and frames and effects are ready on return. That path is used for
first-party games and for every timing test. The sandbox's remote session sends the same calls as
ordered messages and caches the newest frame and the effects that have arrived. The game sees the
same keys and steps in the same order, so its output is identical and only the display lags. The
shell never waits for a game.

**D7 - The sandbox is layered; each layer holds if the one above it fails (new; Lachlan item
2).** Recommended design:

| Layer                                   | Mechanism                                                                                                                                                                                                                           | Guarantee                                                                                                                                                                                      |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1 Wasm (strongest)                     | ABI v1: the import object holds only `nokia.*` functions and a host `Memory` with `maximum: 16` pages (1 MiB). `Module.imports()`/`exports()` are checked first, so an unknown import or a missing export rejects the package (F13) | the module can call nothing else, and its memory cannot grow past 1 MiB                                                                                                                        |
| L2 SES Compartment (JS)                 | the worker runs `lockdown()`, then evaluates the game source in `new Compartment({ globals: {}, __options__: true })`, calling its factory with a hardened SDK object                                                               | no host globals (`fetch`, `postMessage`, `self`, `importScripts`, `indexedDB`); `import()` rejected; inert constructors; no `Math.random`/`Date` (F3-F5)                                       |
| L3 Dedicated worker + watchdog          | one worker per session; the host terminates it when a message goes unanswered for `WATCHDOG_MS` (1000 ms while playing; 5000 ms for load) or on any protocol violation                                                              | an infinite loop or a stuck game cannot freeze the phone, which keeps ticking on the main thread (F7)                                                                                          |
| L4 Opaque-origin sandboxed iframe + CSP | the worker is a `blob:` created inside `<iframe sandbox="allow-scripts">`, whose CSP is `default-src 'none'; script-src 'sha256-<bootstrap>' 'unsafe-eval' 'wasm-unsafe-eval'; worker-src blob:`                                    | the browser blocks fetch, XHR, WebSocket, EventSource, beacons, `importScripts` and nested workers' network even if L2 is broken; opaque origin: no cookies, host storage or host DOM (F8-F11) |
| L5 Host validation                      | every message from the worker is untrusted input: sequence numbers, the frame's byte length (504), effect kinds and ranges, the storage quota, at most one `over`                                                                   | a hostile game can only produce bounded pixels, bounded sounds and quota'd bytes                                                                                                               |

The iframe is a hidden `srcdoc` document by default. A srcdoc frame also inherits the host page's
CSP (F10), so a host whose own CSP forbids `'unsafe-eval'` passes `src` to a served copy of
`SANDBOX_HTML` instead (the demo has no CSP and uses srcdoc). The worker and the parent talk over
a `MessageChannel` port that the iframe hands to both, with no hop through the iframe after setup.

Residual risks, stated in the README: (1) **memory exhaustion** by a JS game. Browsers have no
per-worker heap cap. Chromium desktop isolates the sandbox process (F12), so a crash there spares
the phone; elsewhere the tab can die. (2) **CPU** burns for up to `WATCHDOG_MS` before
termination. (3) **Side channels** (Spectre-class): the game gets no SharedArrayBuffer, and SES
removes `performance.now`/`Date`, but round-trip timing remains (F5 notes). The process isolation
of F12 limits this to Chromium desktop. (4) **LCD spoofing**: a game can draw a fake stock screen,
such as a fake `Security code:` prompt. Typed digits reach only the game, which has no egress, but
users could still be misled. (5) **Browser bugs** in CSP inheritance and sandboxing.
`GameSandbox.selfTest()` probes them at runtime. Safari support is UNVERIFIED (F11): if its
self-test fails, the sandbox refuses to install there, and first-party games are unaffected.
(6) **Supply chain** of `ses`.

**D8 - Protocol and latency budget (new).** See "Message protocol". Frames travel packed
(84×48 bits = 504 bytes, a transferred `ArrayBuffer`) and only when they change. At most 8 steps
may be unacknowledged. Beyond that the shell holds further steps, so a slow game slows down rather
than queueing work without limit. The watchdog trips 1000 ms after the oldest unanswered message.
Budget: message to worker < 1 ms; game step + draw ≤ 4 ms typical; frame back < 1 ms; shown at the
next phone tick (≤ 16.7 ms at 60 Hz). A key is visible within about one display frame, and the
phone never blocks. Session start (worker, SES lockdown, compile) targets ≤ 300 ms on a laptop;
Task 11 measures it. Until the first frame arrives, the previous screen stays, as the stock
firmware takes 50-110 ms to redraw after Select (plan 14 D8). If start exceeds the target, the
sandbox pre-warms one locked-down worker per installed game (Deviation).

**D9 - Persistence: one `sdk-games` EEPROM record (new; plan 15 D2).** Version 1, value
`{ games: { [id]: { topScore?, level?, choices?, data? } } }`. Absent fields take the manifest's
defaults (top score 0, `level.initial`, each choice's `initial`). `data` holds the game's saved
bytes (base64, at most `storageBytes`, which is at most 1024). Validation follows plan 15: stale
content of an installed game (an unknown choice slug, an index or level out of range, data over
quota) is dropped on read. Entries for ids that are not installed now are kept, because
uninstalling should not destroy scores. The record has no `factory`, so Restore factory settings
keeps it, as the user guide keeps data. Only nokia-os writes it; sandboxed games reach their own
`data` through `ctx.save` effects.

**D10 - Sound and vibration go through plan 16's sounder with Snake II's gating (new).**
`ctx.sound("eat" | "crash")` plays plan 16's captured game programs (`GAME_CUES`).
`ctx.sound({ notes })` plays at most 16 buzzer notes (100-6000 Hz, 10-1000 ms each, at most
3000 ms in total) at `GAME_NOTE_VOLUME`, the meal's captured register (6). That loudness is a
choice; it was not captured. `ctx.vibrate(ms)` (1-1000) runs the vibrator. Gating is plan 16 D13:
sounds need Warning tones On and Games › Settings › Sounds On; the vibrator needs Shakes On and
Vibrating alert On. `StockCue` gains `{ kind: "notes"; notes }`. In-process effects are stamped
with the kernel time of the step that made them. Remote effects play when they arrive, late by
the round trip.

**D11 - Determinism and replay goldens (new; plan 23 D5's discipline for SDK games).** A replay
(`game-replay 1`, see "Replay goldens") records the start (seed, level, mode, choices, top score,
storage) and the keys by step, using plan 23's `input` convention: `n:k` means after step `n`,
before step `n + 1`. Its expectations are every effect, frames at checkpoints, and an FNV-1a hash
over every drawn frame. Goldens are recorded from the implementation and then reviewed. That is
honest for games that have no captured ground truth: they pin behaviour and prove parity, and
the logic unit tests (TDD on synthetic boards) prove the rules. The same replay must pass in-process
(TS), as exported user JS evaluated locally, and through the sandbox worker. The sandbox tests
check that last one with the SDK's conformance fixtures; Wasm replays run through `wasmGame`.
Recording from play: the SDK's `recording(module)` wrapper logs a live session, and the demo's
"Copy replay" button turns that into a golden's input.

**D12 - Fonts: `GAME_DIGITS` in the SDK, stock faces from the host (new).** Snake II's 3×5 HUD
digits (4×5 cells, ink in the right three columns; plan 23 Task 4) are the firmware's game
numerals. The SDK ships them as `GAME_DIGITS`, so first-party games are testable without
nokia-os. A nokia-os test pins them equal to `SNAKE_SPRITES['digit/n']`; the goldens stay the
source of truth, and the copy is guarded. The four stock faces reach games as data in
`ctx.fonts` (`STOCK_FONT_DATA`'s shape, ≈50 KB, sent once per session). A host without fonts
passes only `GAME_DIGITS`. The host validates every label it draws with stock fonts:
`validateStockGame` (nokia-os, public) checks the name (small face, one row), option labels
(small), `… selected` notes (large, three lines within the note's text area) and instruction
lines (thin, ≤ 84 px). `createStockPhone` throws naming the game and the glyph, as the carrier
check does.

**D13 - 2048 is the first game: first-party, written as an import-free factory (new; Lachlan
item 3).** See "2048 on the 84×48 LCD". Its source (`src/2048/**`) has only type imports from the
SDK. `src/index.ts` calls `factory2048(sdk)` to make the in-process definition, and the same
source, bundled to one script, is the user-JS package (D14). Running identical code both ways is
what makes the parity replays meaningful.

**D14 - User game packages: `nokia-game 1` JSON (new).** `{ "format": "nokia-game 1",
"manifest": {…}, "js": "<script>" }` or `"wasm": "<base64>"`, at most 512 KB. The script's
completion value is a `GameFactory`; it has no imports (SES rejects `import(`, F4) and receives
the SDK as its argument. On install the sandbox evaluates it once and requires the factory's
manifest to equal the package's, so the menu the host builds is the menu the code declares.
`nokia-games` generates two examples with a script and freshness tests:

- `examples/2048.nokia-game.json`: `src/2048/user.ts` bundled to an IIFE with `build()` from
  `vite-plus` (Vite's JS API, `lib` format `iife`, `write: false`, no minify). The SDK is marked
  external, and a test fails the bundle if any SDK runtime import survives.
- `examples/dot.nokia-game.json`: Dot, a minimal Wasm game written in WAT (`examples/dot/dot.wat`)
  and compiled by `watr` (D17).

**D15 - The demo exposes extra and user games (new).** The nokia-os demo gains a Games panel:

- an "Extra games" checkbox (2048), on by default (Open question 2, decided by Lachlan);
- "Install game…" from a file, or from a URL that the demo page fetches, never the game;
- the list of installed games with Remove;
- "Copy replay" for the last SDK session;
- "Sandbox self-test" (D7 (5)).

Installed packages persist in the page's localStorage under `nokia-os-demo/games`, outside
`STOCK_STORAGE_PREFIX`, so Erase EEPROM leaves them installed. Their scores live in the
`sdk-games` record. The menu is built at phone creation, so any change power-cycles the phone, as
the SIM select does.

**D16 - Snake II and plan 24's games stay stock-native; no port now (decides Lachlan's
question).** Snake II depends on things a fixed-step contract cannot express without growing
Snake-shaped options:

- per-level first-tick offsets (`SNAKE_FIRST_TICK`, about 20 ms short of a period) and a 93 ms
  grace tick off the period grid;
- irregular death steps (222-251 ms) and a top-score cue 2045 ms after the crash;
- a top-score screen 45 ms late;
- level 175 at one timer unit with page clamps from 175;
- the ring-wrap no-blink quirk;
- Continue that does not reseed.

Plan 24's games are capture-driven in the same way. What they share with SDK games is the widget
layer (game-over, fireworks, Level page, Top score, splash), which this plan generalises, not the
runtime. A later port would be acceptable only if every existing golden passes unchanged through
the SDK path. That is recorded as a follow-up, not scheduled.

**D17 - New dependencies (flagged per AGENTS.md; approved by Lachlan 2026-10-15).** Both are added to the pnpm `catalog:`.

- `ses` ^2.3.0 (Apache-2.0, about 48 KB gzip as UMD) is a runtime dependency of
  `nokia-games-sandbox`. Its `dist/ses.umd.min.js` text is prepended to the worker blob and never
  loaded into the phone's page realm. `lockdown()` therefore never freezes the host's intrinsics,
  which React and three.js would not tolerate.
- `watr` ^5.11 (MIT, zero dependencies) is a devDependency of `nokia-games-sdk` and
  `nokia-games`, used only by generator scripts and tests that compile WAT into bytes.

`wabt` (5.6 MB Emscripten build) was rejected for size. If pnpm's minimum release age refuses the
newest `watr`, pin the newest version it accepts; do not add an exclusion.

**D18 - phone-core and the website do not change.** The shell uses existing seams (`intro`,
`shown`, `opening`, `exit({ select, row })`, `onKeyDown`). The diff of `website/`, `packages/phone-core/`, `packages/phone-screen/` and `packages/snake/`
since the commit before Task 1 is empty at the end.

## Package boundaries

```text
website ─────────────▶ phone-core, phone-screen, phone-3d, snake        (unchanged)
nokia-os ────────────▶ phone-core, phone-screen, nokia-games-sdk         (runtime)
nokia-os/demo (dev) ─▶ nokia-games, nokia-games-sandbox                  (devDependencies; demo/ only)
nokia-games ─────────▶ nokia-games-sdk
nokia-games-sandbox ─▶ nokia-games-sdk, ses
nokia-games-sdk ─────▶ (none)
phone-screen ────────▶ phone-core (type-only)
snake, phone-3d ─────▶ (none)
```

- `nokia-games-sdk` has no DOM, Node or phone vocabulary at runtime and must run in a page, a
  worker, Node and an SES compartment (its helpers are hardened there).
- `nokia-games` imports only SDK types inside game sources (`src/2048/**`, enforced by a test).
- `nokia-games-sandbox` is browser code. Its worker runtime is generated (D14-style IIFE bundle)
  and its Node tests run that runtime in `node:worker_threads`.
- nokia-os never imports `nokia-games` or `nokia-games-sandbox` from `src/` or `tests/` (a test
  greps imports).
- Every package's tests pass with only its declared dependencies (plan 13's reading of rule 3).

## Contract changes

Task 1 writes these into `VISION.md` (architecture diagram, package table and three new
contract sections) and `AGENTS.md` (workspace layout, dependency directions, the demo rule).

### `@hellotimber/nokia-games-sdk` (new)

```ts
export const SCREEN_WIDTH = 84;
export const SCREEN_HEIGHT = 48;
/** Packed frame: 84×48 bits, row-major, MSB first, 1 = ink (504 bytes). */
export const PACKED_FRAME_BYTES = 504;

export type GameKey =
  | "up"
  | "down"
  | "*"
  | "#"
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9";

/** Plain data (JSON in a user package). `validateManifest` checks structure; the host checks glyphs. */
export interface GameManifest {
  readonly sdk: 1;
  /** Kebab-case, 1-24 chars: the menu slug and the storage namespace; not a stock Games slug. */
  readonly id: string;
  /** The Games list label (stock small face, one row). */
  readonly name: string;
  /** The game's menu animation (D2). */
  readonly splash: GameSplash;
  /** The game menu in order (D5); the first item is a `play`. */
  readonly menu: readonly GameMenuItem[];
  /** The fixed step: 10-2000 ms, or one per level (length `level.max`). */
  readonly tickMs: number | readonly number[];
  /** 1 <= initial <= max <= 9. Absent: no Level page, `start.level` is 1. */
  readonly level?: { readonly max: number; readonly initial: number };
  /** Navi/C suspend the game and add Continue (default false: they quit to the game menu). */
  readonly suspend?: boolean;
  /** Default true: `over(score)` shows the stock game-over screens and keeps a top score. */
  readonly scores?: boolean;
  /** Saved bytes the game may keep: 0-1024, default 0. */
  readonly storageBytes?: number;
}

export interface GameSplash {
  /** Packed frames, base64 (504 bytes each): 1-16. */
  readonly frames: readonly string[];
  /** 1-32 steps of 50-2000 ms, 6000 ms at most in total; any key skips (shell). */
  readonly steps: readonly { readonly frame: number; readonly ms: number }[];
}

export type GameMenuItem =
  | { readonly kind: "play"; readonly slug: string; readonly label: string; readonly mode?: string }
  | { readonly kind: "level" }
  | {
      readonly kind: "choice";
      readonly slug: string;
      readonly label: string;
      readonly options: readonly string[]; // 2-9
      readonly initial: number;
    }
  | { readonly kind: "top-score" }
  | { readonly kind: "instructions"; readonly pages: readonly (readonly string[])[] }; // <= 3 lines a page

export interface GameStart {
  readonly mode: string; // the play item's mode ("" for none)
  readonly level: number;
  readonly choices: Readonly<Record<string, number>>; // by choice slug
  readonly seed: number; // uint32
  readonly topScore: number;
  readonly storage: Uint8Array; // the saved bytes (<= storageBytes)
}

/** Glyph rows of `#`/`.`; a row's length is the glyph's advance (STOCK_FONT_DATA's shape). */
export interface GameFont {
  readonly height: number;
  readonly glyphs: Readonly<Record<string, readonly string[]>>;
}
export interface GameFonts {
  readonly game: GameFont; // GAME_DIGITS, always
  readonly small?: GameFont;
  readonly large?: GameFont;
  readonly digits?: GameFont;
  readonly thin?: GameFont;
}

export type GameSound =
  | "eat"
  | "crash"
  | { readonly notes: readonly { readonly hz: number; readonly ms: number }[] };

export interface GameContext {
  readonly start: GameStart;
  readonly fonts: GameFonts;
  /** The session's seeded generator (mulberry32 over start.seed): a uint32 per call. */
  random(): number;
  sound(sound: GameSound): void;
  vibrate(ms: number): void; // 1-1000
  /** Replaces the saved bytes; false (nothing saved) over storageBytes. */
  save(bytes: Uint8Array): boolean;
  /** Ends the session after the current call; the shell takes over (D5). */
  over(score?: number): void;
}

export interface GameInstance {
  keyDown?(key: GameKey): void;
  keyUp?(key: GameKey): void;
  /** One fixed step. */
  step(): void;
  /** Called after every keyDown, keyUp and step; the screen keeps the previous frame. */
  draw(screen: GameScreen): void;
}

export interface GameDefinition {
  readonly manifest: GameManifest;
  create(ctx: GameContext): GameInstance;
}

/** What a game module evaluates to: the SDK's helpers arrive as the argument (no imports). */
export type GameFactory = (sdk: GameSdk) => GameDefinition;

export interface GameSdk {
  readonly version: 1;
  readonly GAME_DIGITS: GameFont;
  createScreen(): GameScreen;
  drawText(
    screen: GameScreen,
    font: GameFont,
    text: string,
    x: number,
    y: number,
    ink?: 0 | 1,
  ): number;
  textWidth(font: GameFont, text: string): number;
  drawNumber(
    screen: GameScreen,
    value: number,
    x: number,
    y: number,
    options?: {
      font?: GameFont;
      scale?: 1 | 2 | 3;
      gap?: number;
      align?: "left" | "right";
      ink?: 0 | 1;
    },
  ): number;
  encodeFrame(screen: GameScreen): string; // base64 of the packed frame (splash building)
}
export const sdk: GameSdk;

export class GameScreen {
  readonly width: 84;
  readonly height: 48;
  readonly pixels: Uint8Array; // 4032 bytes, 0/1, row-major (phone-core Bitmap layout)
  get(x: number, y: number): 0 | 1; // 0 outside
  set(x: number, y: number, ink?: 0 | 1): void; // clipped
  clear(): void;
  fill(x: number, y: number, w: number, h: number, ink?: 0 | 1): void;
  invert(x: number, y: number, w: number, h: number): void;
  blit(art: readonly string[], x: number, y: number): void; // `#` ink, `.` paper, other chars skip
  pack(): Uint8Array; // 504 bytes
}
export function unpackFrame(packed: Uint8Array): Uint8Array; // 4032 bytes
export const GAME_DIGITS: GameFont;
export function createRandom(seed: number): () => number; // mulberry32
export function mixSeed(a: number, b: number): number; // uint32 hash of two uint32s
export function validateManifest(value: unknown): GameManifest; // throws naming the field

// --- hosts -----------------------------------------------------------------------------------
export type GameEffect =
  | { readonly kind: "sound"; readonly step: number; readonly sound: GameSound }
  | { readonly kind: "vibrate"; readonly step: number; readonly ms: number }
  | { readonly kind: "save"; readonly step: number; readonly bytes: Uint8Array }
  | { readonly kind: "over"; readonly step: number; readonly score: number | undefined };

/** One running game, driven synchronously by a host (D6). */
export interface GameSession {
  keyDown(key: GameKey): void;
  keyUp(key: GameKey): void;
  step(): void;
  /** The newest packed frame; undefined before the first. Remote sessions lag by the round trip. */
  frame(): Uint8Array | undefined;
  /** Effects since the last drain, in order. */
  drain(): readonly GameEffect[];
  /** Set once the game threw, broke the protocol or tripped the watchdog; the session is dead. */
  readonly failure: string | undefined;
  dispose(): void;
}
export interface GameModule {
  readonly manifest: GameManifest;
  start(start: GameStart, fonts: GameFonts): GameSession;
}
export function localGame(definition: GameDefinition): GameModule;
export function wasmGame(manifest: GameManifest, bytes: Uint8Array): GameDefinition; // ABI v1
export function parseGamePackage(value: unknown): GamePackage; // `nokia-game 1`
export function recording(module: GameModule): GameModule & { lastReplay(): string | undefined };
// replays: parseReplay, serializeReplay, recordReplay, checkReplay (see "Replay goldens")
// protocol: HostMessage, WorkerMessage, serveGame, remoteGameModule (see "Message protocol")
// conformance: CONFORMANCE_JS, CONFORMANCE_WASM, CONFORMANCE_MANIFEST, CONFORMANCE_REPLAY
```

### `@hellotimber/nokia-games` (new)

```ts
export const factory2048: GameFactory;
export const game2048: GameDefinition; // factory2048(sdk)
export const dotWasm: Uint8Array; // the Wasm example's bytes (generated)
export const EXAMPLE_PACKAGES: { readonly "2048": unknown; readonly dot: unknown }; // `nokia-game 1` JSON
```

### `@hellotimber/nokia-games-sandbox` (new)

```ts
export interface GameSandboxOptions {
  /** Where the hidden iframe goes (default document.body). */
  readonly container?: HTMLElement;
  /** A served copy of SANDBOX_HTML, for host pages whose CSP forbids 'unsafe-eval' (F10). */
  readonly src?: string;
  readonly watchdogMs?: number; // default 1000
}
export interface GameSandbox {
  /** Validates, loads once in a worker (manifest equality, D14) and returns a module whose sessions are remote. */
  install(pkg: unknown): Promise<GameModule>;
  /** Probes the browser's enforcement outside SES (D7 (5)): fetch, WebSocket, importScripts, nested worker. */
  selfTest(): Promise<SandboxSelfTest>;
  dispose(): void;
}
export function createGameSandbox(options?: GameSandboxOptions): GameSandbox;
export const SANDBOX_HTML: string;
export const SANDBOX_CSP: string;
```

### `@hellotimber/nokia-os` (additive)

```ts
export interface StockPhoneConfig {
  // ...plan 13/15/16 fields unchanged...
  /**
   * Plan 28: extra games, appended to Games after Pairs II in this order (D3). Default: none,
   * which is the stock phone. Throws when a game fails `validateStockGame`, naming it.
   */
  games?: readonly GameModule[];
}
/** Problems that keep `manifest` off the stock phone (glyphs, widths, slugs, D12); [] when fine. */
export function validateStockGame(manifest: GameManifest): string[];
```

`stockMenu`, `paintStockScreen`, `missingStockGlyphs`, the storage and sound contracts are
unchanged. Internal: `src/games/sdk/**`, the `sdk-games` record in `STOCK_RECORDS`, the
`notes` cue, `levelPage` (generalised from `snakeLevel`), the `game-frame` widget model.

## The shell in nokia-os

- **Building the level.** For each module, `entryOf` makes a rows `SubmenuEntry` (slug = id,
  label = name, softkey `Select`, `intro` = the splash) whose children are the manifest's items,
  numbered 1… in order (D5). With `suspend`, a Continue entry heads the list with `shown` and
  `opening()` from the phone's games holder, as Snake II's (plan 23 D10). Item slugs: `play`
  items their own, `level` → `level`, `top-score` → `top-score`, `instructions` →
  `instructions`, `choice` its own. Labels: `New game`/the play label, `Level`, `Top score`,
  `Instructions`, the choice label.
- **Splash.** A flow widget plays `splash.steps` over the decoded frames (a `game-frame`
  widget model: the packed frame as base64, compared by value) and goes back on any key, like
  `splash.ts`.
- **Session widget** (`src/games/sdk/session.ts`).
  - Keys: on key-down, Navi/C suspend (`suspend`) or quit; other game keys go to `keyDown`. Key
    releases go to `keyUp`.
  - Steps: the first `step` comes one `tickMs` (the level's) after New game. Later steps follow
    every `tickMs` of kernel time: `tick(dtMs)` accumulates, runs every due step (at most 8 per
    tick, so a long stall cannot spiral), drains effects after each call, and stamps them with
    the step's kernel time.
  - Render: the session's newest frame. Before the first frame, the screen shown before New game
    stays.
  - Continue: the board stands until a key. That key is delivered, and the next step follows one
    period later (plan 23 C8; the helpdoc: "press any key except the navigation or menu keys").
  - `over` replaces the widget with the shell's end screen (D5). `failure` replaces it with the
    `Game\nerror` note.
  - Effects: `save` writes the record; `sound`/`vibrate` go to the sounder (D10).
- **Seed.** `mixSeed(minutes of the day from the clock port, kernel ms at New game)`. Players
  get varied games, and the kernel's clock makes it deterministic in tests.
  `createStockPhoneWith(config, { seed })` overrides it, as for Snake II.
- **Lifecycle.** A suspended session survives standby. Power-off, New game, `over`, failure and
  quit dispose it (remote: the worker is terminated).

## 2048 on the 84×48 LCD

Rules are the standard game. Each key-down slides every tile toward its side; equal neighbours
merge once per move, resolved from the leading edge; the score adds each merged tile's value. A
move that changes nothing does nothing. After a move that changed the board, one tile spawns at
the next step (100 ms later, so the spawn is visible). A key that arrives first spawns it
immediately, then moves. A spawn draws the cell as `random() mod emptyCount` over the empty cells
in row-major order, then its value as `random() mod 10 == 0 ? 4 : 2`. A new game spawns twice.

| Element          | Pixels and behaviour                                                                                                                                                                                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| HUD              | score in `GAME_DIGITS` from x 0, y 0..4, no leading zeros (Snake II's HUD face); the top score right-aligned to x 83, raised live once passed (Open question 7); a full-width rule at y 6                                                                                                              |
| Board 4×4        | tile (c, r) is a 19×9 box at (2 + 20c, 9 + 10r): board x 2..80, y 9..47, 1-px gaps                                                                                                                                                                                                                     |
| Board 3×3        | the same tiles at (12 + 20c, 14 + 10r) (the `Board` choice)                                                                                                                                                                                                                                            |
| Empty cell       | one dot at the tile's centre (x + 9, y + 4), so the grid reads without lines                                                                                                                                                                                                                           |
| Tiles 2-64       | outline: rows y and y + 8 over x + 1..x + 17, columns x and x + 18 over y + 1..y + 7 (corners open); numeral in ink                                                                                                                                                                                    |
| Tiles ≥ 128      | the 19×9 box filled minus its four corner pixels; numeral cleared, so the big tiles stand out on a 1-bit LCD                                                                                                                                                                                           |
| Numeral          | `GAME_DIGITS` (3×5 ink in 4-px cells): width `4n - 1`, left at x + ⌊(19 − (4n − 1)) / 2⌋, top y + 2. Five digits (16384, 32768, 65536) fill 19 px exactly in a filled tile; six (131072, the 4×4 maximum) draw without gaps (18 px)                                                                    |
| Keys             | 2 and ▲ up, 8 and ▼ down, 4 left, 6 right; others ignored; key-down, no repeat; Navi/C are the shell's (suspend)                                                                                                                                                                                       |
| Merge            | `sound("eat")` once per move that merged                                                                                                                                                                                                                                                               |
| Win              | the first 2048 tile: `sound({ notes: 1319, 1568, 2093 Hz × 80 ms })`; the tile alternates filled/outline every 2 steps for 10 toggles (2 s); play continues ("keep going"); a move ends the blink                                                                                                      |
| Lose             | after a spawn leaves no move: `sound("crash")`, `vibrate(480)`; the board stands 20 steps (2 s); then `over(score)` (the shell's game-over, fireworks on a new top score)                                                                                                                              |
| Manifest         | id `2048`, name `2048`, `tickMs` 100, `suspend: true`, scores on, no level, `storageBytes` 0; menu: New game, Board (`4x4`, `3x3`; initial 0), Top score, Instructions                                                                                                                                 |
| Instructions     | thin face, three lines a page, e.g. `Slide the tiles` / `with keys 2, 4,` / `6 and 8. Two` · `tiles of the` / `same number` / `merge into one.` · `Make a 2048 tile` / `to win. The game` / `ends when no` · `tile can move.` (the validator decides; the thin face lacks `C`, `j`, `q`, `z` and more) |
| Splash (≈2.25 s) | five frames built with `sdk` at module load: two outline `2` tiles apart (250 ms), closer (250 ms), one filled `4` (250 ms), `2048` in `GAME_DIGITS` × 3 centred (500 ms), the same framed (1000 ms); pinned by `goldens/2048/splash.txt`                                                              |

The 1-bit LCD has no colour, so tile value shows as numeral plus two weights: outline below 128,
filled from 128. The shell's end screen uses the large face for the score (8 px digits; seven
digits fit).

## Wasm ABI v1

Imports (module `nokia`; any other import rejects the package):

| Import                  | Meaning                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| `memory`                | the host's `Memory({ initial: 1, maximum: 16 })`; the module must import it (min ≤ 1 page) |
| `random() -> i32`       | the session generator (the same mulberry32 as `ctx.random`)                                |
| `mode() -> i32`         | index of the started `play` item among the manifest's `play` items                         |
| `choice(i: i32) -> i32` | the stored option of the manifest's i-th `choice` item                                     |
| `top_score() -> i32`    | `start.topScore`                                                                           |
| `load(ptr, max) -> i32` | copies the saved bytes into memory; returns their length                                   |
| `save(ptr, len) -> i32` | 1 saved, 0 over quota                                                                      |
| `sound(id: i32)`        | 0 `eat`, 1 `crash`                                                                         |
| `notes(ptr, count)`     | `count` pairs of little-endian u16 (hz, ms) from memory                                    |
| `vibrate(ms: i32)`      | as `ctx.vibrate`                                                                           |
| `over(score: i32)`      | as `ctx.over`; −1 = no score                                                               |

Exports (all required): `init(level: i32)`, `key_down(key: i32)`, `key_up(key: i32)` (0-9 digits,
10 `*`, 11 `#`, 12 ▲, 13 ▼), `step()`, `draw() -> i32` (a pointer to a 504-byte packed frame inside
memory, or −1 when unchanged; out of bounds = failure). A trap is a failure. Wasm runs only in the
sandbox worker in browsers; Node tests compile it synchronously.

**Dot** (`examples/dot/dot.wat`) is the ABI proof. A 2×2 dot moves 2 px per key-down on 2/4/6/8
and wraps at the edges. A 2×2 target sits at a random even position. Reaching it plays
`sound(0)`, adds one point and moves the target. After 300 steps (`tickMs` 100, 30 s) the game
calls `over(score)`. Its menu is New game, Top score and Instructions; its splash is two frames of
art from `examples/dot/splash.txt`.

## Message protocol (host ⇄ worker)

Every message carries `v: 1` and a `seq` that increases by one per host message. Host to worker:

| Message                               | Reply                                                  |
| ------------------------------------- | ------------------------------------------------------ |
| `load { package }`                    | `loaded { seq, manifest }` or `error { seq, message }` |
| `start { start: GameStart, fonts }`   | `done { seq, step: 0, frame?, effects }`               |
| `key { down: boolean, key: GameKey }` | `done { seq, step, frame?, effects }`                  |
| `step {}`                             | `done { seq, step, frame?, effects }`                  |
| `dispose {}`                          | none (the host terminates the worker anyway)           |

`frame` is a transferred 504-byte `ArrayBuffer`, present only when it differs from the last one
sent. The host rejects (failure `protocol`, worker terminated):

- a reply out of order;
- a frame of another length;
- more than 64 effects in one reply;
- an effect out of range (D10's bounds, quota);
- a second `over`;
- anything after `over`.

`serveGame(port, load)` (SDK) is the worker-side dispatcher. It is realm-agnostic: given a
`postMessage`/`onmessage` port and a loader that turns a package into a `GameDefinition`, it
handles the protocol. `remoteGameModule(manifest, connect)` (SDK) is the host side, a `GameModule`
whose sessions speak the protocol over a port from `connect()`. Its watchdog and clock are
injected, so it is testable in Node.

## Replay goldens (`game-replay 1`)

```text
game-replay 1
game: 2048
seed: 44530
level: 1
mode:
choices: board=0
top-score: 0
storage:
input: 0:6 1:2 3:4 4:4 7:8+ 9:8-
steps: 812
note: greedy corner bot, seed 44530, to game over.

@effects
# step kind value
3      sound eat
811    sound crash
811    vibrate 480
812    over 5124

@frames
t0000
<48 rows of 84 `#`/`.`>
t0100
…

@hash fnv1a32 0x5c3e91a7
```

Rules (SDK `parseReplay`/`serializeReplay`, `file:line` errors as plan 13's goldens):

- Header keys appear in this order.
- `input` uses plan 23's tick convention; `k` is a key-down then key-up, while `k+`/`k-` give
  them separately.
- `steps` is the number of steps run (the run ends at `over` or at `steps`).
- `@effects` lists every effect in order.
- `@frames` holds the frame after step 0, every 100th step, every step with `vibrate` or `over`,
  and the last step.
- `@hash` covers every frame drawn, packed, in order.

`checkReplay(module, replay)` reports the first differing effect or frame. A differing frame
gets a row-by-row diff in the style of plan 13's `Golden mismatch`. `recordReplay(module, start,
input)` writes one.

## Conventions for every task

- Run commands from the repo root with `mise exec --`.
- TDD: write the failing test first wherever the task names tests.
- After each task: `mise exec -- vp check --fix` and the named test commands. A task that touches
  nokia-os also runs `mise exec -- vp run @hellotimber/nokia-os#test` (every golden must still
  pass) and `mise exec -- vp run website#build`.
- Commit rule: run `mise exec -- vp check --fix` yourself, stage files by explicit path, then
  `git commit --no-verify -m "<message>"`. Never `git add -A`/`git add .`. Never stage `TODOS.md`
  (Lachlan's untracked notes).
- New packages follow AGENTS.md "Creating a new package" exactly (`vp create vite:library`,
  delete the scaffold cruft, the source-exports `package.json`, the `tsconfig.json` template from
  `docs/specs/integration-notes.md` §1, `vp install` from the root). No `build` scripts.
- Never hand-edit `src/generated/**`, `examples/*.nokia-game.json` or `goldens/**`: change the
  generator or its input and regenerate. Each generator runs twice with no diff before its commit.
- Only the dependencies of D17. Tests never need a browser; the browser-only guarantees (CSP,
  iframe, Safari) are checked with `agent-browser` in Task 12 and recorded there.
- When reality differs from this plan, append a `Deviation:` paragraph under the task. If a
  deviation breaks a contract in VISION.md, stop and report.
- Parallelism (max 3 concurrent agents): Task 1 first. Then lane A (2 → 3 → 4). After 3: lanes B
  (5 → 6) and C (7 → 8). After 4: lane D (10 → 11). Task 9 needs 4 and 6. Task 12 needs 8, 9 and 11. Then 13.

## Tasks

### Task 1 - Contracts and documentation

**Files:** `VISION.md`, `AGENTS.md`, `docs/specs/nokia-3310.md`, `docs/plans/README.md`, this plan.

- [ ] VISION: architecture diagram and package table with the three packages and the edges of
      "Package boundaries"; the four contract sections exactly as "Contract changes"; one
      paragraph on extra games (opt-in, D3 numbering, non-stock screens).
- [ ] AGENTS: workspace layout entries; the dependency directions; the demo rule (D1); `ses` and
      `watr` as the approved dependencies of this plan.
- [ ] Spec §7: "Extra games (plan 28, not stock)": where they appear, D3 numbering, the composed
      `Game\nerror` note, and that their gameplay has no captured ground truth.
- [ ] Plans README row 28 `in progress`.
- [ ] No runtime code. `mise exec -- vp check --fix`.
- [ ] Commit: `docs: define the game SDK, shell and sandbox contracts (plan 28)`.

### Task 2 - SDK I: screen, drawing, digits, random and manifests (TDD)

**Files:** `packages/nokia-games-sdk/{package.json,tsconfig.json,vite.config.ts,README.md}`,
`src/{index,contract,screen,draw,digits,random,manifest}.ts`, `tests/{screen,draw,random,manifest}.test.ts`.

- [ ] Scaffold per AGENTS ("Creating a new package"); `vp install`.
- [ ] TDD `GameScreen`: clipping; `fill`/`invert`/`blit`; `pack()`/`unpackFrame()` round trip,
      with known bytes for a hand-made frame (MSB first, row-major, 504 bytes).
- [ ] TDD drawing: `textWidth`/`drawText` over a two-glyph test font (advance = row length; a
      missing glyph throws, naming it); `drawNumber` with `GAME_DIGITS` at scale 1 and 3,
      `align: "right"`, gap 0, `ink: 0` on a filled box; `encodeFrame` is base64 of `pack()`.
- [ ] `GAME_DIGITS`: the ten 4×5 cells of Snake II's HUD digits, transcribed from
      `packages/nokia-os/src/resources/generated/snake.ts` (`digit/0`…`9`). Task 7's guard
      pins the equality.
- [ ] TDD `createRandom` (mulberry32: published first outputs for seed 1 and 44530), uint32
      output; `mixSeed` deterministic, uint32, sensitive to both inputs.
- [ ] TDD `validateManifest`: every rule of the contract comments (kebab id, lengths, ranges,
      first item `play`, unique slugs, `tickMs` array length = `level.max`, `top-score` refused
      with `scores: false`, splash frame decoding and step bounds); errors name the field path.
- [ ] `src/index.ts` exports the contract, `sdk` (a frozen object of the helpers) and the rest.
- [ ] `mise exec -- vp run @hellotimber/nokia-games-sdk#test`, `vp check --fix`.
- [ ] Commit: `feat(nokia-games-sdk): screen, drawing, digits, random and manifests`.

### Task 3 - SDK II: local sessions, replays and recording (TDD)

**Files:** `src/{local,replay,recording}.ts`, `tests/{local,replay,recording}.test.ts`,
`tests/support/counter-game.ts` (new: a tiny fixture game using every ctx call).

- [ ] TDD `localGame`: `draw` after every call; `frame()` changes only when pixels change;
      `drain()` returns effects stamped with the step count; `ctx.random` is mulberry32 over
      `start.seed`; `save` enforces `storageBytes`; nothing after `over` (calls are ignored);
      bounds of D10 (`sound` notes, `vibrate`) throw inside the game, so `failure` is set; a
      throwing game sets `failure` and stops; `dispose` is idempotent.
- [ ] TDD the replay format: parse/serialize round trip, header order, `input` forms, ascending
      ticks, frame grids 84×48, `@hash`; `file:line` errors.
- [ ] TDD `recordReplay`/`checkReplay` on the fixture game: an edited effect or pixel is
      reported with the step and a row diff.
- [ ] TDD `recording(module)`: a played session (keys between steps) yields a replay that
      `checkReplay` passes.
- [ ] Commit: `feat(nokia-games-sdk): local game sessions and replay goldens`.

### Task 4 - SDK III: protocol, Wasm ABI, packages and conformance (TDD)

**Files:** `src/{protocol,serve,remote,wasm,package,conformance}.ts`,
`src/generated/conformance.ts` (generated), `conformance/{conformance.wat,conformance.js}`,
`scripts/conformance.ts` (new; `watr`), `package.json` (`watr` devDependency, `conformance`
script), `pnpm-workspace.yaml` (catalog `watr`), `tests/{protocol,wasm,package,conformance}.test.ts`.

- [ ] TDD `wasmGame` against a WAT fixture compiled in the test (`watr`): imports checked with
      `Module.imports` (unknown import → error naming it), required exports with
      `Module.exports`, the host memory's 16-page cap (`memory.grow` beyond it returns −1), key
      codes, `draw` pointer bounds, `notes` decoding, a trap → `failure`.
- [ ] TDD `parseGamePackage`: `nokia-game 1`, exactly one of `js`/`wasm`, the size limit,
      `validateManifest`.
- [ ] TDD `serveGame` + `remoteGameModule` over a Node `MessageChannel` with an injected clock:
      lockstep order; `frame()` lags until the reply and then equals `localGame`'s; the 8-step
      in-flight limit; the watchdog (no reply in `watchdogMs` → `failure: "watchdog"` and the
      injected `terminate` called); each protocol violation of "Message protocol" →
      `failure: "protocol"`; `dispose`.
- [ ] Conformance fixtures: `conformance.js` (a factory script, no imports, exercising every ctx
      call) and `conformance.wat` (the same game in Wasm). `scripts/conformance.ts` writes
      `src/generated/conformance.ts` (the JS source text, the compiled bytes, the manifest, and
      the replay recorded through `localGame`). A freshness test regenerates in-process. A test
      evaluates the JS with `new Function` in Node, runs the Wasm through `wasmGame`, and both
      pass `CONFORMANCE_REPLAY`.
- [ ] Run the generator twice; no diff.
- [ ] Commit: `feat(nokia-games-sdk): worker protocol, Wasm ABI and game packages`.

### Task 5 - 2048 I: the engine (TDD)

**Files:** `packages/nokia-games/{package.json,tsconfig.json,vite.config.ts,README.md}`,
`src/2048/engine.ts`, `tests/2048-engine.test.ts`.

- [ ] Scaffold per AGENTS; dependency `@hellotimber/nokia-games-sdk` (`workspace:*`).
- [ ] TDD the engine as pure functions over an immutable state (size 4 or 3, cells as
      exponents, score, pending spawn, won, over), with synthetic boards for each case:
  - slides in four directions;
  - one merge per tile per move, from the leading edge (`2 2 2 2` → `4 4`, `2 2 4` → `4 4`,
    `4 2 2` → `4 4`);
  - score;
  - a no-op move does nothing;
  - spawn draws (cell `r mod empty`, value `r mod 10 == 0 ? 4 : 2`, from an injected generator);
  - the start's two spawns;
  - the first 2048 sets `won` once;
  - lose detection (full, no equal neighbours, 4×4 and 3×3).
- [ ] A test fails if `src/2048/**` uses `Math.random`, `Date`, `performance` or a runtime import.
- [ ] Commit: `feat(nokia-games): 2048 engine`.

### Task 6 - 2048 II: the LCD, splash, game and replay goldens (TDD)

**Files:** `src/2048/{view,splash,game,user}.ts`, `src/index.ts`, `goldens/2048/**`,
`scripts/{bot-2048,record-replays}.ts` (new), `package.json` (`replays` script),
`tests/{2048-view,2048-game,2048-replays}.test.ts`.

- [ ] TDD the view against hand-drawn art grids in the test file, at each geometry row of "2048
      on the 84×48 LCD": empty dots; tiles 2, 64, 128, 2048, 16384 and 131072; HUD score and
      top score; 3×3 placement; the win blink's two states.
- [ ] TDD the game (`factory2048(sdk)`) through `localGame`: keys (2/▲, 8/▼, 4, 6; others
      ignored), the spawn one step after a move or at the next key, `eat` per merging move,
      the win notes and blink, the lose sequence (crash, vibrate 480, 20 steps, `over(score)`),
      the `board` choice, and `topScore` raised live in the HUD.
- [ ] Splash frames built at module load; `goldens/2048/splash.txt` pins them;
      `validateManifest(game2048.manifest)` passes.
- [ ] `scripts/bot-2048.ts` is a deterministic greedy corner bot (down, left, right, up: the
      first move that changes the board). `scripts/record-replays.ts` writes four goldens:
  - `bot-4x4-<seed>` to game over;
  - `bot-3x3-<seed>`;
  - `win`: the first seed in 1..10000 whose bot run reaches 2048, else a Deviation and the win
    is covered by unit tests only;
  - `fireworks-ready`: a game whose score beats `top-score: 0`.
    Input files `goldens/2048/<name>.input.txt` (start + `input`) drive the recorder, so a replay
    copied from the demo (Task 12) becomes a golden by saving its input there.
- [ ] `tests/2048-replays.test.ts`: every golden passes `checkReplay(localGame(game2048))`.
      Review the recorded frames (`t0000`, a merge, the end) by eye and say so in the completion
      note.
- [ ] Run the recorder twice; no diff. `mise exec -- vp run @hellotimber/nokia-games#test`.
- [ ] Commit: `feat(nokia-games): 2048 on the 84x48 LCD with replay goldens`.

### Task 7 - Shell I: extra games in the Games menu (TDD)

**Files:** `packages/nokia-os/package.json` (dependency `@hellotimber/nokia-games-sdk`),
`src/games/sdk/{record,validate,fonts,menu}.ts` (new), `src/firmware/{menu,records,leaves}.ts`,
`src/widgets/level-bar.ts` (`levelPage`), `src/display/widgets/{index,game-frame}.ts`,
`src/index.ts` (`validateStockGame`), `tests/sdk-menu.test.ts` (new),
`tests/support/sdk-fixture.ts` (new: two fixture games built with the SDK, one with every
menu item), `tests/settings.test.ts`, `tests/widgets-info.test.ts`.

- [ ] Guard: `GAME_DIGITS` equals `SNAKE_SPRITES['digit/0'..'9']` (D12).
- [ ] TDD `validateStockGame`: name glyphs (small) and row width, option labels, `… selected`
      notes (large), instruction lines (thin, ≤ 84 px), id not a stock Games slug (read from
      `STOCK_TREE`), duplicate ids; messages name the game, the field and the glyph.
- [ ] TDD the `sdk-games` record (plan 15 D2/D9): virgin `{ games: {} }`; defaults from the
      manifest; stale fields of installed games dropped; unknown ids kept; data over quota
      dropped; no `factory` (Restore keeps it); listed in `STOCK_RECORDS`.
- [ ] TDD the Games level:
  - no `games` gives a menu graph equal to today's (a structural comparison of every node: slug,
    order, label, options);
  - one game gives `8-5` and Settings at `8-6`; two give `8-5`, `8-6` and Settings at `8-7`;
  - paths `menu/games/<id>/…` resolve;
  - Select plays the splash (any key skips) and then opens the game menu;
  - Continue is shown only while suspended, numbered by position;
  - Level: `levelPage` with `max` (Snake II's Level page behaviour and its goldens unchanged:
    `snakeLevel` now calls `levelPage`);
  - a choice list stores its value, then its `… selected` note;
  - Top score reads the record and returns as Snake II's;
  - Instructions pages.
- [ ] Every nokia-os test and golden passes unchanged.
- [ ] `mise exec -- vp run @hellotimber/nokia-os#test`, `vp run -r test`, `vp run website#build`,
      `vp check --fix`.
- [ ] Commit: `feat(nokia-os): extra games in the Games menu`.

### Task 8 - Shell II: sessions, end screens and effects (TDD)

**Files:** `src/games/sdk/session.ts` (new), `src/firmware/{phone,cues,menu}.ts`,
`src/sound/sounder.ts` (`notes` cue), `src/widgets/game-over.ts` (a top-score number source
other than Snake II's), `src/index.ts`, `tests/sdk-session.test.ts` (new), `tests/sounder.test.ts`.

- [ ] TDD the session widget with the fixture games through `localGame`:
  - the first step one `tickMs` after New game, then every `tickMs` (per level), at most 8
    catch-up steps per tick;
  - key-downs and key-ups forwarded; Navi/C suspend (`suspend`) or quit;
  - Continue's board stands until a key, which is delivered;
  - the frame shown is the session's;
  - a session survives standby; power-off and New game dispose it.
- [ ] TDD the end: `over(score)` beating the top score writes it, plays the fireworks timeline
      with `TOP SCORE:` and cues `top-score`; otherwise `Your score:`; `scores: false` returns
      directly; every path returns to New game on the top row; `failure` shows `Game\nerror`.
- [ ] TDD effects: `save` → record; `eat`/`crash`/`notes` → sounder with the plan 16 D13 gating
      (Warning tones and Games Sounds); `vibrate` gated by Shakes and Vibrating alert; times are
      the step's kernel time.
- [ ] A fake remote session (frames arriving a call late, then `failure`) shows the previous
      frame until the first arrives and ends on `Game\nerror`.
- [ ] `StockPhoneConfig.games` wired through `createStockPhone`; a failing validation throws;
      the seed is `mixSeed` over the clock and kernel time; `createStockPhoneWith({ seed })`.
- [ ] `mise exec -- vp run @hellotimber/nokia-os#test`, `vp run -r test`, `vp run website#build`.
- [ ] Commit: `feat(nokia-os): host SDK games with the stock game screens`.

### Task 9 - User packages: 2048 as user JS, and Dot in Wasm (TDD)

**Files:** `packages/nokia-games/{scripts/export-packages.ts,examples/**,src/index.ts,package.json}`
(`watr` devDependency, `export-packages` script), `tests/{packages,dot}.test.ts`.

- [ ] `scripts/export-packages.ts`:
  - bundles `src/2048/user.ts` (exports `factory2048`) to an IIFE with `build()` from
    `vite-plus` (`lib` iife, `write: false`, no minify, SDK external), wrapped so the script's
    completion value is the factory;
  - writes `examples/2048.nokia-game.json` with the manifest from `factory2048(sdk)`;
  - compiles `examples/dot/dot.wat` with `watr` and writes `examples/dot.nokia-game.json` (splash
    frames from `examples/dot/splash.txt`) and `src/generated/dot.ts` (`dotWasm`).
- [ ] TDD:
  - both packages pass `parseGamePackage`;
  - the 2048 bundle contains no `import`, `require` or SDK path;
  - evaluating its `js` with `new Function` in Node and calling it with `sdk` passes every 2048
    replay golden (parity, D11);
  - Dot follows the ABI (keys, wrap, target, 300 steps, `over`), and its replay golden
    `goldens/dot/bot.replay.txt` passes through `wasmGame`;
  - freshness: in-process export equals the committed files.
- [ ] Run the export twice; no diff.
- [ ] Commit: `feat(nokia-games): 2048 and Dot as user game packages`.

### Task 10 - Sandbox I: the SES worker runtime (TDD, Node)

**Files:** `packages/nokia-games-sandbox/{package.json,tsconfig.json,vite.config.ts,README.md}`,
`src/worker/{main,load}.ts`, `src/generated/worker-runtime.ts` (generated),
`scripts/bundle-worker.ts` (new), `pnpm-workspace.yaml` (catalog `ses`),
`tests/{worker,escape,watchdog}.test.ts`, `tests/support/node-worker.ts` (new).

- [ ] Scaffold per AGENTS; dependencies `@hellotimber/nokia-games-sdk`, `ses` (D17).
- [ ] `src/worker/main.ts`:
  - `startGameWorker(port)` calls `lockdown()` and then `serveGame(port, load)`;
  - `load` evaluates a JS package in `new Compartment({ globals: {}, __options__: true })`,
    requires a function result, calls it with `harden(sdk)` and compares manifests (D14);
  - a Wasm package goes to `wasmGame` with the ABI import object only.
- [ ] `scripts/bundle-worker.ts` bundles `main.ts` (SDK inlined, `ses` external) to an IIFE
      string in `src/generated/worker-runtime.ts`. The blob source at runtime is
      `ses/dist/ses.umd.min.js` text + the runtime + a two-line bootstrap. The task checks how
      that file can be imported (`?raw`, or a `createRequire` path read by the generator if
      `ses`'s `exports` hide it), records the outcome, and adds a freshness test.
- [ ] TDD in `node:worker_threads` (a small adapter maps `parentPort` to the port shape) with the
      same blob source:
  - `CONFORMANCE_JS` and `CONFORMANCE_WASM` pass `CONFORMANCE_REPLAY` through
    `remoteGameModule` (parity);
  - the escape suite: hostile factories (inline test sources) try `fetch`, `globalThis.postMessage`,
    `self`, `process`, `require`, `import("x")` (rejected at evaluate),
    `(function(){}).constructor("return this")()`, the async and generator constructors,
    `Math.random()`, `Date.now()` and `new Date()`, and mutating `sdk`. Each fails inside the
    compartment, and the session reports `failure` or the game observes `undefined`/throws, as
    the test states per case;
  - the watchdog: a game looping forever in `step` is terminated within `watchdogMs` + 100 ms,
    and the phone-side session reports `failure: "watchdog"`.
- [ ] Generator twice, no diff. `mise exec -- vp run @hellotimber/nokia-games-sandbox#test`.
- [ ] Commit: `feat(nokia-games-sandbox): SES worker runtime for user games`.

### Task 11 - Sandbox II: the browser host

**Files:** `src/{index,host,sandbox-html,self-test}.ts`, `tests/{sandbox-html,host}.test.ts`.

- [ ] `SANDBOX_HTML`/`SANDBOX_CSP`: a bootstrap script that takes one message from the parent
      (`{ source, port }`), makes a `Blob` and a `Worker`, and transfers the port to the worker.
      The CSP is D7's L4, with `'sha256-…'` of the bootstrap; a test recomputes the hash.
- [ ] `createGameSandbox`:
  - one hidden `<iframe sandbox="allow-scripts">` (srcdoc, or `src`);
  - `install(pkg)`: `parseGamePackage`, a worker per load (watchdog 5000 ms), manifest
    comparison, and then a `remoteGameModule` whose `connect()` asks the iframe for a fresh
    worker per session and whose `terminate` ends it;
  - `dispose` removes the iframe and terminates every worker.
- [ ] `selfTest()` starts a probe worker without SES that tries `fetch`, `WebSocket`,
      `importScripts` (a `data:` script), `new Worker` and `XMLHttpRequest` to a public URL and
      reports each as `blocked` or `allowed`. Every one must be `blocked`; `install` refuses
      while any is `allowed` (D7 (5)).
- [ ] Unit tests cover the parts that need no DOM (the HTML, CSP and hash; the host's message
      plumbing with a fake iframe/port); the browser behaviour is Task 12's.
- [ ] Measure session start (worker + lockdown + first frame) in Task 12's browser run and
      record it; above 300 ms → pre-warm (D8, Deviation).
- [ ] Commit: `feat(nokia-games-sandbox): sandboxed iframe host with network denial`.

### Task 12 - Demo, READMEs and browser verification

**Files:** `packages/nokia-os/{package.json (devDependencies),demo/{index.html,main.ts,games.ts,style.css},README.md}`,
`packages/nokia-games-sdk/README.md`, `packages/nokia-games/README.md`,
`packages/nokia-games-sandbox/README.md`, `packages/nokia-os/tests/boundaries.test.ts` (new).

- [ ] Demo Games panel per D15:
  - Extra games toggle;
  - Install game… (file input; URL field, fetched by the page);
  - installed list with Remove;
  - Copy replay (via `recording`);
  - Sandbox self-test, with its report in the status area.
    Persistence in `nokia-os-demo/games`; any change recreates the phone. The status line names
    the open application, as today.
- [ ] `boundaries.test.ts`: nokia-os `src/` and `tests/` import neither `@hellotimber/nokia-games`
      nor `@hellotimber/nokia-games-sandbox` (D1).
- [ ] Verify with `mise exec -- vp run @hellotimber/nokia-os#demo` and `agent-browser` (headless:
      drive by the `[role=status]` line, Skip boot):
  1. Extra games on; Menu › Games shows `2048` at `8-5` and Settings at `8-6`;
  2. Select plays the splash, then the menu;
  3. New game, a merge, Navi (`Continue` heads the list), Continue (the board stands until a
     key), play to game over (`Game over!`/`Your score:` or fireworks);
  4. Top score;
  5. install `examples/2048.nokia-game.json` and `examples/dot.nokia-game.json`; Settings
     moves to `8-8`; both play;
  6. Sandbox self-test reports every probe `blocked` (record the browser and version);
  7. install a hostile package that loops forever: `Game\nerror` within about 1 s while the
     phone stays responsive;
  8. Copy replay, saved as `packages/nokia-games/goldens/2048/demo.input.txt`, then
     `vp run @hellotimber/nokia-games#replays` adds its golden.
     Screenshots in the completion note. Repeat steps 6-7 in Firefox and Safari if
     `agent-browser` offers them; otherwise list them as UNVERIFIED.
- [ ] READMEs:
  - SDK: writing a game, the contract, replays, packages, the Wasm ABI;
  - nokia-games: 2048's design, regenerating examples and replays;
  - sandbox: the layers, guarantees and residual risks (D7), CSP and `src` hosting, self-test;
  - nokia-os: `games`, `validateStockGame`, D3 numbering.
- [ ] Commit: `feat(nokia-os): extra and user games in the demo`.

### Task 13 - Verification gate and closeout

**Files:** this plan, `docs/plans/README.md`, `docs/specs/nokia-3310.md`, `VISION.md` (if a
Deviation changed a contract detail).

- [ ] `mise exec -- vp check --fix`, `mise exec -- vp run -r test`,
      `mise exec -- vp run website#build`. The diff of `website/`, `packages/phone-core/`, `packages/phone-screen/` and
      `packages/snake/` since the commit before Task 1 is empty.
- [ ] Every nokia-os golden asserted before this plan is still asserted and passing; no new
      known gaps.
- [ ] Spec §7: final facts and what stays UNVERIFIED (Safari, loudness of custom notes).
- [ ] Plans README row 28 `done`. Completion notes; status `done`.
- [ ] Commit: `docs: complete the game SDK (plan 28)`.

## Follow-ups

- **Plan 24:** reuse `levelPage`, the generic Top score and game-over sources, and record
  whether any of its games could be an SDK game without changing a golden (D16).
- **Porting Snake II (not scheduled):** only if the SDK grows variable step scheduling and every
  `game/snake/*` golden passes unchanged through it.
- **Nested game menus** (Pairs II-style Time trial / Puzzle) as a `submenu` item.
- **Portfolio integration (unsequenced):** the website passes `games` and hosts the sandbox
  (with `src` if its CSP forbids `'unsafe-eval'`).
- **Pre-warmed workers** if Task 11's start time exceeds the budget.

## Open questions for Lachlan

Resolved provisionally so execution is not blocked; each is cheap to reverse. Lachlan decided
questions 1, 2, 3 and 10 on 2026-10-15 (marked below); the rest stay provisional.

1. **Where extra games appear (D3) — decided: after Pairs II.** The first fills the hidden `8-5`, and
   Settings moves only from the second game on. Reverse with a `More games` submenu at `8-5`,
   which keeps Settings at `8-6` always but puts every extra game one level deeper.
2. **Demo default (D15) — decided: on.** The demo's "Extra games" toggle starts ticked, so 2048
   is in the Games menu immediately; unticking it gives the strict stock phone.
3. **Menu animation (D2) — decided: the splash only, with no icons.** Reverse by adding an optional `icon` that
   only hosts (not the phone) display.
4. **Continue (D5):** Snake II's rule (the board stands until a key) for every suspendable game.
5. **Navi/C without `suspend`:** they quit to the game menu without a game-over screen.
6. **Seed (shell):** clock minutes mixed with the kernel time at New game. Reverse by adding an
   entropy port to `StockPhoneConfig`.
7. **2048 HUD:** score left, top score right, no labels (the stock fonts' HUD style). Reverse by
   dropping the top score from the HUD.
8. **2048 `Board` choice (3×3):** included to prove `choice` items. Reverse by deleting the item
   and its goldens.
9. **`Game\nerror` (D5):** a composed note for failed games. Reverse by using the stock
   `Not allowed` note.
10. **Sandbox scope (D7) — decided: JS and Wasm user games, so SES and the CSP layer both** (`ses`
    and `watr` approved), although Wasm alone needs neither SES nor
    `'unsafe-eval'`. Reverse to "Wasm only" if JS user games are not wanted: `ses` goes, and so
    does `'unsafe-eval'`.
11. **Safari (F11):** UNVERIFIED. If its self-test fails, user games are unavailable there.
12. **Snake II port (D16):** no.

## Conflicts found while planning

- AGENTS.md: "Integration code … lives in `website/src/` only". The nokia-os demo already
  composes nokia-os with phone-screen. This plan has it compose two more siblings and writes the
  rule down (D1).
- VISION's diagram puts nokia-os on phone-core and phone-screen only; it gains the SDK edge
  (Task 1).
- Plan 14 D12 and plan 23 D11 describe the Level page as Snake II's; `levelPage` generalises it
  without changing a Snake II golden (Task 7).

## Done means

- A host passes `games` and they appear in Games after Pairs II with their splash, menu and stock
  service screens. Without `games` the phone and every golden are unchanged.
- 2048 plays on the 84×48 LCD, in-process and as user JS through the sandbox, and passes the same
  replay goldens both ways. Dot proves the Wasm ABI.
- In the browser, the sandbox's self-test reports every network probe blocked. A looping game is
  terminated without freezing the phone. The escape suite passes in Node.
- The demo installs games from a file or URL, keeps them across reloads, and copies replays.
- phone-core, phone-screen, snake and the website are unchanged. `vp check`, `vp run -r test` and
  `vp run website#build` pass. VISION, AGENTS, the spec and the plans README match what shipped.
