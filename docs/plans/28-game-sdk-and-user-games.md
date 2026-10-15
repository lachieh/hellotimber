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
Comparisons follow the fidelity standard (AGENTS.md, 2026-10-15): settled screens are
pixel-exact, timings match within one display frame (≈17 ms), or ≈50 ms for holds of about 1 s
and longer, and sub-frame partial redraws are ignored. SDK replays are exact, because both sides
are our code on the kernel clock (D11).
"Sandbox investigation" cites the sandbox facts; read it before Tasks 9-12.
**Status:** not started.

## Goal

Make new games addable to `@hellotimber/nokia-os` without editing firmware code. Each game
supplies its own menu name, menu animation and menu entries:

- a game SDK (`@hellotimber/nokia-games-sdk`): the manifest, the runtime contract (no fixed tick:
  the game is called with the phone's session time and says when it next needs waking; key down
  and up arrive stamped with the same clock; it draws into an 84×48 1-bit frame), a context with
  a seeded RNG, sound, vibration, quota'd storage and stock fonts, plus deterministic replays;
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

| Area           | nokia-os today                                                                                                                | Needed                                                                          |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Games list     | the four stock games + Settings, built from the generated tree; Snake II by hand (plan 23), the rest placeholders for plan 24 | games added from data, no firmware edits                                        |
| Game hosting   | `src/widgets/snake.ts` is welded to Snake II's engine, timing tables and setting keys                                         | one host for any game: wakes when the game asks, keys, frame, effects           |
| Shell screens  | game-over and fireworks are generic (plan 23 D13); Level page, Top score and Continue are Snake II's                          | offered to every game as services                                               |
| Untrusted code | none                                                                                                                          | user JS/Wasm that can compute and draw, and nothing else                        |
| Determinism    | Snake II replays its goldens from seed + `input` (plan 23 D5)                                                                 | the same discipline for every SDK game: keys at kernel ms, recordable from play |

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

Out of scope: porting Snake II or plan 24's games onto the SDK (D16: new games only); the website
and portfolio integration (unsequenced, as for all of nokia-os); multiplayer and IR; Club Nokia
Score IDs; `Lights` (plan 25); nested game submenus (Pairs II-style modes are `play` items with a
`mode`; nesting is a follow-up); a game store, signing or a registry; any network feature for
games (none by design); publishing to npm.

## Decisions

Each decision states what it adds or changes relative to plans 13-16 and 23.

**D1 - Three new packages; nokia-os hosts the shell (new; layout).**

| Package                            | Owns                                                                                                                                                                                                                                                                 | Depends on                            |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `@hellotimber/nokia-games-sdk`     | what game code and hosts share: contract types, `GameScreen`, drawing helpers, `GAME_DIGITS`, the seeded generator, the host limits (D19), manifest and package validation, local sessions, replays, the worker protocol, the Wasm ABI adapter, conformance fixtures | nothing at runtime; dev: `watr` (D17) |
| `@hellotimber/nokia-games`         | first-party games (2048), their replay goldens, the example user packages (2048 as user JS, the Wasm game Dot)                                                                                                                                                       | `nokia-games-sdk`; dev: `watr`        |
| `@hellotimber/nokia-games-sandbox` | the browser sandbox: the sandboxed iframe, CSP, worker runtime (SES), watchdog and self-test                                                                                                                                                                         | `nokia-games-sdk`, `ses`              |
| `@hellotimber/nokia-os` (changed)  | the shell: extra games in the Games menu, stock service screens, the session widget, the `sdk-games` EEPROM record                                                                                                                                                   | + `nokia-games-sdk` (runtime)         |

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
full-screen splash when its level is entered with Select. The stock splashes run 6-13 frames at
about 250 ms per frame (2.5-3.5 s), any key skips them, and they play again on every entry (plan
14 D12, plan 23 C8). A game's menu animation is therefore its splash: `manifest.splash` holds
packed 84×48 frames and steps, and the kernel's existing `SubmenuOptions.intro` seam plays it.
The stock lengths are a guide, not a cap: how many frames and how long is the game's choice
(D19), and any key skips. A per-game icon would invent UI the firmware does not have, and the
carousel's Games icon stays stock. Hosts that need a thumbnail (the demo's install list, a future
HTML panel) use the splash frames.

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

**D4 - The SDK contract: a data manifest and a wake-based instance on the kernel clock (new;
decided by Lachlan 2026-10-15).** See "SDK contract". The manifest is plain JSON-able data, so
the host can build the menu before any game code runs. That matters for sandboxed games, which
only start at New game. The instance has no fixed tick. The host calls it with the session time,
and every call says when the game next needs waking:

- `update(nowMs)` runs at session time 0 (New game) and then at each time the game asked for. It
  returns a delay in ms, or `null` to sleep until a key.
- `keyDown(key, nowMs)` and `keyUp(key, nowMs)` deliver game keys stamped with the same clock. A
  returned delay or `null` replaces the pending wake; `undefined` (no return) keeps it, so a key
  that only steers needs no bookkeeping.
- `draw(screen)` follows every call.

Session time is whole kernel milliseconds since New game, standing still while the game is
suspended (D5's Continue). It is the only time a game sees. The `nowMs` of `update` is always
exactly the time requested (the time of the call that asked plus its delay), whatever the phone's
frame rate or the sandbox's latency; only the display lags. A wake due at the same ms as a key
runs first. Delays below `MIN_WAKE_MS` (10 ms) are raised to it (D19). A sleeping game costs the
shell one comparison per phone tick: a 2048 board waiting for a key makes no calls at all.

The game never reads the browser clock, and its randomness is `ctx.random()`, a seeded generator
from the SDK. In the sandbox, SES enforces both (F5). Determinism comes from the kernel clock: a
replay records the keys at session ms and reproduces every call, wakes included (D11). Keys act
on key-down, as every stock game's do (plan 23 D7). Holds and auto-repeat are the game's, built
from `keyUp` and wakes. Navi and C belong to the shell (suspend or quit) and the game never sees
them. The soft key and power are not game keys. The phone's keypad beeps still sound on game keys
(plan 16 D8).

Alternatives rejected: _a fixed step_ (`step()` every `tickMs`) forces every timing onto one
grid. Snake II's grace tick and death steps are off its grid (D16), and an idle board would still
be called every period. _Absolute wake times_ (`return nowMs + delay`) are equivalent, but a delay
states the decision being made and keeps the Wasm ABI's sentinels small. _Key events without a
return_ would leave a game that sleeps on input unable to schedule from a key (2048's spawn), or
force an extra `update` after every key.

**D5 - Shell services: menu items and `over()` map onto stock widgets (new; Lachlan item 1).**
The manifest's `menu` lists the game menu in order. Each item kind is a stock screen the shell
already has:

| Item                                 | Shell behaviour (stock widget and its timing)                                                                                                                                                                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `play` (New game; more with `mode`)  | starts a session (the first item must be a `play`). A fresh session discards a suspended one, as Snake II's New game does                                                                                                                                                                   |
| Continue (implicit, `suspend: true`) | an entry heading the list only while a game is suspended (phone-core `shown`, positional numbers, `opening()`), as plan 23 D10. Its label is the stock `Continue`. The session time stands while suspended                                                                                  |
| `level`                              | Snake II's Level page generalised (`levelPage`, D11 of plan 23): `min(level, 9)` filled bars (the page draws nine at most, as the phone does; the level number is the game's), ▲ raises below `level.max`, ▼ lowers to 1, both act on key-down and repeat while held, OK stores, C discards |
| `choice`                             | a stock option list (`OptionListWidget`, scrolling as stock lists do, softkey `OK`, opening on the stored value), then `<option>\nselected` in the timeline of Snake II's Mazes notes (`tree/08-games/8-1-3-*`)                                                                             |
| `top-score`                          | the animated Top score note in Snake II's timeline (`8-1-4`), reading the game's stored top score; it returns as Snake II's does (New game on the bottom row, or Continue while suspended)                                                                                                  |
| `instructions`                       | stock text pages (thin face, the three lines a stock page holds; each page's text wraps and continues on the next screen; `More` cycles, C leaves)                                                                                                                                          |
| `ctx.over(score)` (`scores` ≠ false) | the stock game-over screens (`gameOver`, plan 23 D13): if the score beats the stored top score, the shell writes it, plays the fireworks with `TOP SCORE:` and cues `top-score`; otherwise `Your score:`. Both return to the game menu on New game, top row                                 |
| `ctx.over()` (`scores: false`)       | straight back to the game menu, New game on the top row; `top-score` items are refused at validation                                                                                                                                                                                        |

Games draw any end animation of their own (a death blink, timed with wakes) before calling
`over`. One screen is composed, not stock: a failed game (it threw, broke the protocol or a D19
limit, or tripped the watchdog) shows `Game\nerror` in the timed-note widget with the
information/error icon class that `Not allowed` uses (≈2.9 s), then the game menu on New game. The
spec lists it as non-stock.

**D6 - One session port for in-process and sandboxed games; the game's schedule decides when
anything runs (new).** The shell drives every game through `GameModule.start() → GameSession`
(SDK), a synchronous surface: `keyDown(key, now)`, `keyUp(key, now)`, `advance(now)`, `wake()`,
`frame()`, `drain()`, `failure`, `dispose`. `advance(now)` runs every wake due at or before
`now`, each at its requested time. `keyDown`/`keyUp` first run the wakes due at or before the key,
then deliver it. `wake()` is the session time of the next wake, or `null` while the game sleeps.

`localGame()` runs a definition in-process, and frames and effects are ready on return. That path
is used for first-party games and for every timing test. The sandbox's remote session sends the
same calls as ordered messages and caches the newest frame, effects and wake that have arrived.
The worker runs the same `localGame` session, which owns the schedule. A key sent before the reply
that rescheduled a wake therefore still lands after exactly the wakes `localGame` would have run
first. The game's output is identical in both paths, and only the display lags. The shell never
waits for a game.

**D7 - The sandbox is layered; each layer holds if the one above it fails (new; Lachlan item
2).** Recommended design:

| Layer                                   | Mechanism                                                                                                                                                                                                                           | Guarantee                                                                                                                                                                                      |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1 Wasm (strongest)                     | ABI v1: the import object holds only `nokia.*` functions and a host `Memory` with `maximum: 16` pages (1 MiB). `Module.imports()`/`exports()` are checked first, so an unknown import or a missing export rejects the package (F13) | the module can call nothing else, and its memory cannot grow past 1 MiB                                                                                                                        |
| L2 SES Compartment (JS)                 | the worker runs `lockdown()`, then evaluates the game source in `new Compartment({ globals: {}, __options__: true })`, calling its factory with a hardened SDK object                                                               | no host globals (`fetch`, `postMessage`, `self`, `importScripts`, `indexedDB`); `import()` rejected; inert constructors; no `Math.random`/`Date` (F3-F5)                                       |
| L3 Dedicated worker + watchdog          | one worker per session; the host terminates it when a message goes unanswered for `WATCHDOG_MS` (1000 ms while playing; 5000 ms for load) or on any protocol violation                                                              | an infinite loop or a stuck game cannot freeze the phone, which keeps ticking on the main thread (F7)                                                                                          |
| L4 Opaque-origin sandboxed iframe + CSP | the worker is a `blob:` created inside `<iframe sandbox="allow-scripts">`, whose CSP is `default-src 'none'; script-src 'sha256-<bootstrap>' 'unsafe-eval' 'wasm-unsafe-eval'; worker-src blob:`                                    | the browser blocks fetch, XHR, WebSocket, EventSource, beacons, `importScripts` and nested workers' network even if L2 is broken; opaque origin: no cookies, host storage or host DOM (F8-F11) |
| L5 Host validation                      | every message from the worker is untrusted input: sequence numbers, the frame's byte length (504), the reply's `wake`, effect kinds and values, the per-reply bounds and storage quota (D19), at most one `over`                    | a hostile game can only produce 504-byte frames, bounded replies and quota'd bytes, and is messaged only when its wake falls due or a key arrives                                              |

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

**D8 - Protocol and latency budget: no per-tick messages (new).** See "Message protocol". The
host messages the worker only when a game key goes down or up, and when the session time reaches
the wake the last reply asked for (`advance`). A sleeping game exchanges nothing. At most one
`advance` is in flight. Frames travel packed (84×48 bits = 504 bytes, a transferred
`ArrayBuffer`) and only when they change. `MIN_WAKE_MS` keeps a game that asks to be woken at once
to 100 calls a second; it is a safety bound against busy-looping (D19), not a frame rate. The
watchdog trips `WATCHDOG_MS` after the oldest unanswered message.

Budget: message to worker < 1 ms; game call + draw ≤ 4 ms typical; frame back < 1 ms; shown at
the next phone tick (≤ 16.7 ms at 60 Hz). A key or a requested wake is therefore on screen within
about one display frame of its time, the fidelity standard's tolerance, while the game itself
always sees the exact time (D4). Session start (worker, SES lockdown, compile) targets ≤ 300 ms on
a laptop; Task 11 measures it. Until the first frame arrives, the previous screen stays, as the
stock firmware takes 50-110 ms to redraw after Select (plan 14 D8). If start exceeds the target,
the sandbox pre-warms one locked-down worker per installed game (Deviation).

**D9 - Persistence: one `sdk-games` EEPROM record (new; plan 15 D2).** Version 1, value
`{ games: { [id]: { topScore?, level?, choices?, data? } } }`. Absent fields take the manifest's
defaults (top score 0, `level.initial`, each choice's `initial`). `data` holds the game's saved
bytes (base64, at most `storageBytes`, whose quota is D19's 1024). Validation follows plan 15:
stale content of an installed game (an unknown choice slug, an index or level out of range, data
over quota) is dropped on read. Entries for ids that are not installed now are kept, because
uninstalling should not destroy scores. The record has no `factory`, so Restore factory settings
keeps it, as the user guide keeps data. Only nokia-os writes it; sandboxed games reach their own
`data` through `ctx.save` effects.

**D10 - Sound and vibration go through plan 16's sounder with Snake II's gating (new).**
`ctx.sound("eat" | "crash")` plays plan 16's captured game programs (`GAME_CUES`).
`ctx.sound({ notes })` plays the game's buzzer notes (whole Hz and ms; how many and how long is
the game's choice, D19) at `GAME_NOTE_VOLUME`, the meal's captured register (6). That loudness is
a choice; it was not captured. `ctx.vibrate(ms)` runs the vibrator for `ms`. A new sound replaces
a playing one, as every sounder output does (plan 16), and a new vibration replaces the running
one. Suspend and the session's end stop both, so a long tune cannot outlive its game. Gating is
plan 16 D13: sounds need Warning tones On and Games › Settings › Sounds On; the vibrator needs
Shakes On and Vibrating alert On. `StockCue` gains `{ kind: "notes"; notes }`. In-process effects
are stamped with the kernel time of the call that made them. Remote effects play when they
arrive, late by the round trip (within a display frame, D8).

**D11 - Determinism and replay goldens (new; plan 23 D5's discipline for SDK games).** A replay
(`game-replay 1`, see "Replay goldens") records the start (seed, level, mode, choices, top score,
storage) and the keys at session ms. The game's wakes are not recorded: they follow from the
start and the keys, so a replay reproduces every call. Its expectations are every effect with its
ms, frames at checkpoints, and an FNV-1a hash over every distinct frame with the ms it was drawn
at, so timing is pinned as well as pixels. Replays are exact, not perceptual: both sides are our
code on the kernel clock, so the fidelity standard's tolerances do not apply to them.

Goldens are recorded from the implementation and then reviewed. That is honest for games that have
no captured ground truth: they pin behaviour and prove parity, and the logic unit tests (TDD on
synthetic boards) prove the rules. The same replay must pass in-process (TS), as exported user JS
evaluated locally, and through the sandbox worker, and must pass however finely the host advances
the clock (every 1 ms, every 17 ms, or once per key). The sandbox tests check the worker with the
SDK's conformance fixtures; Wasm replays run through `wasmGame`. Recording from play: the SDK's
`recording(module)` wrapper logs a live session's keys with their session ms, and the demo's
"Copy replay" button turns that into a golden's input.

**D12 - Fonts: `GAME_DIGITS` in the SDK, stock faces from the host (new).** Snake II's 3×5 HUD
digits (4×5 cells, ink in the right three columns; plan 23 Task 4) are the firmware's game
numerals. The SDK ships them as `GAME_DIGITS`, so first-party games are testable without
nokia-os. A nokia-os test pins them equal to `SNAKE_SPRITES['digit/n']`; the goldens stay the
source of truth, and the copy is guarded. The four stock faces reach games as data in
`ctx.fonts` (`STOCK_FONT_DATA`'s shape, ≈50 KB, sent once per session). A host without fonts
passes only `GAME_DIGITS`. The host validates every label it draws with stock fonts (D19's label
limit): `validateStockGame` (nokia-os, public) checks the name (small face, one row), option
labels (small, one row), `… selected` notes (large, within the note's three lines) and
instruction text (thin glyphs only: the shell wraps it, so width is not the game's problem).
`createStockPhone` throws naming the game and the glyph, as the carrier check does.

**D13 - 2048 is the first game: first-party, written as an import-free factory (new; Lachlan
item 3).** See "2048 on the 84×48 LCD". Its source (`src/2048/**`) has only type imports from the
SDK. `src/index.ts` calls `factory2048(sdk)` to make the in-process definition, and the same
source, bundled to one script, is the user-JS package (D14). Running identical code both ways is
what makes the parity replays meaningful.

**D14 - User game packages: `nokia-game 1` JSON (new).** `{ "format": "nokia-game 1",
"manifest": {…}, "js": "<script>" }` or `"wasm": "<base64>"`, at most 512 KB (D19). The script's
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

**D16 - Snake II and plan 24's games stay on their own code: new games only (decided by Lachlan
2026-10-15).** This is a scope choice, not an impossibility. Every off-grid timing of Snake II is
a requested wake in the D4 contract: the per-level first-tick offsets (`SNAKE_FIRST_TICK`, about
20 ms short of a period), the 93 ms grace tick, the irregular death steps (222-251 ms), the
top-score cue 2045 ms after the crash and the top-score screen 45 ms late. Its quirks (level 175
at one timer unit with page clamps from 175, the ring-wrap no-blink, Continue that does not
reseed) are game logic and state. Under the fidelity standard those timings need to land within a
display frame, not to the millisecond.

A port would still need a cue the game schedules inside its own death (or the shell's game-over
taking a cue offset), Snake II's setting keys and records instead of `sdk-games`, and every
`game/snake/*` golden re-proved through the SDK path. That buys no visible change, so this plan
builds new games only. Plan 24's games are capture-driven in the same way. What they share with SDK
games is the widget layer (game-over, fireworks, Level page, Top score, splash), which this plan
generalises, not the runtime. The port is an unscheduled follow-up, acceptable only if every
existing golden passes unchanged through the SDK path.

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

**D19 - Limits are the game's, except those that protect the phone (new; decided by Lachlan
2026-10-15).** The manifest and contract cap nothing a game may reasonably want: the level count
(`level.max` is any positive integer; the Level page draws `min(level, 9)` bars, as the phone
does, but the number is the game's), the options of a choice (the stock list scrolls), the notes
of a sound and their pitches and lengths, the lines of an instructions page (the shell wraps and
continues them as the stock text pages do), the splash's frames, steps and durations (any key
skips it), the length of a vibration, and how often a game asks to be woken above the minimum.
Values must still be well-formed: integers where the contract says so, indices in range, unique
slugs, a first `play` item. The host keeps only these limits, each because a hostile or broken
game could otherwise hurt the phone:

| Limit             | Value                                                                                                                 | Why                                                                                                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frame size        | exactly 504 bytes packed (84×48 bits)                                                                                 | it is the LCD; a frame of another length is a broken or hostile game                                                                                                      |
| Wasm memory       | an imported host `Memory` with `maximum: 16` pages (1 MiB)                                                            | caps what a Wasm game can allocate; JS heaps cannot be capped (D7 (1))                                                                                                    |
| Storage quota     | `storageBytes` ≤ 1024 per game                                                                                        | the record lives in the phone's EEPROM store (localStorage in browsers, shared with the phone and every installed game) and is rewritten whole on each save               |
| Package size      | ≤ 512 KB                                                                                                              | packages persist in the host's localStorage and are parsed and compiled inside the 5000 ms load watchdog                                                                  |
| Effects per reply | ≤ 64 effects and ≤ 8192 notes in total                                                                                | bounds the host's validation work and memory per message; 8192 notes of 100 ms is over 13 minutes of tune, so no honest sound meets it                                    |
| Watchdog          | 1000 ms per reply while playing; 5000 ms for load                                                                     | an infinite loop or a stuck worker cannot hold the phone; it bounds how long a hostile game burns CPU                                                                     |
| Minimum wake      | `MIN_WAKE_MS` = 10 ms; shorter delays are raised to it                                                                | a game returning 0 cannot busy-loop the worker or the main thread (at most 100 calls a second); finer timing is below one display frame, so no visible behaviour needs it |
| Integer width     | session time and scores below 2^31                                                                                    | the Wasm ABI's `i32`; 2^31 ms is 24.8 days of unsuspended play, and a session reaching it fails `clock`                                                                   |
| Labels render     | stock glyphs only; the name and option labels fit one small-face row, `… selected` notes the large note's three lines | the stock widgets cannot draw a missing glyph and do not scroll a row or a note; `createStockPhone` throws, naming the game and the glyph (D12)                           |

Removed from the first draft as game decisions: `tickMs` (10-2000 ms, gone with D4); `level.max`
≤ 9; 2-9 choice options; ≤ 16 notes per sound, 100-6000 Hz, 10-1000 ms a note and ≤ 3000 ms a
sound; ≤ 3 instruction lines a page and ≤ 84 px a line; 1-16 splash frames and 1-32 steps of
50-2000 ms, ≤ 6000 ms in total; `vibrate` ≤ 1000 ms; ids of 1-24 characters; the 8-step in-flight
cap (no per-tick messages remain, D8). `localGame` enforces the same limits as the sandbox, so a
game that passes in-process passes there too.

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

/** The host limits (D19); the only caps on a game. */
export const MIN_WAKE_MS = 10;
export const MAX_STORAGE_BYTES = 1024;
export const MAX_PACKAGE_BYTES = 512 * 1024;
export const MAX_EFFECTS_PER_REPLY = 64;
export const MAX_NOTES_PER_REPLY = 8192;
export const MAX_SESSION_MS = 2 ** 31 - 1; // also the largest score
export const WATCHDOG_MS = { play: 1000, load: 5000 } as const;

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
  /** Kebab-case: the menu slug and the storage namespace; not a stock Games slug. */
  readonly id: string;
  /** The Games list label (stock small face, one row). */
  readonly name: string;
  /** The game's menu animation (D2). */
  readonly splash: GameSplash;
  /** The game menu in order (D5); the first item is a `play`. */
  readonly menu: readonly GameMenuItem[];
  /** Integers, 1 <= initial <= max; no upper cap (D19). Absent: no Level page, `start.level` is 1. */
  readonly level?: { readonly max: number; readonly initial: number };
  /** Navi/C suspend the game and add Continue (default false: they quit to the game menu). */
  readonly suspend?: boolean;
  /** Default true: `over(score)` shows the stock game-over screens and keeps a top score. */
  readonly scores?: boolean;
  /** Saved bytes the game may keep: 0..MAX_STORAGE_BYTES, default 0. */
  readonly storageBytes?: number;
}

export interface GameSplash {
  /** Packed frames, base64 (504 bytes each); at least one. */
  readonly frames: readonly string[];
  /** At least one step; `ms` a positive integer. Count and length are the game's; any key skips (shell). */
  readonly steps: readonly { readonly frame: number; readonly ms: number }[];
}

export type GameMenuItem =
  | { readonly kind: "play"; readonly slug: string; readonly label: string; readonly mode?: string }
  | { readonly kind: "level" }
  | {
      readonly kind: "choice";
      readonly slug: string;
      readonly label: string;
      readonly options: readonly string[]; // at least one; the stock list scrolls
      readonly initial: number;
    }
  | { readonly kind: "top-score" }
  /** Each page's text wraps in the thin face and continues on the next screen; `\n` breaks a line. */
  | { readonly kind: "instructions"; readonly pages: readonly string[] };

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
  /** Positive integers; any number of notes (D10). */
  | { readonly notes: readonly { readonly hz: number; readonly ms: number }[] };

export interface GameContext {
  readonly start: GameStart;
  readonly fonts: GameFonts;
  /** The session's seeded generator (mulberry32 over start.seed): a uint32 per call. */
  random(): number;
  sound(sound: GameSound): void;
  vibrate(ms: number): void; // a positive integer
  /** Replaces the saved bytes; false (nothing saved) over storageBytes. */
  save(bytes: Uint8Array): boolean;
  /** Ends the session after the current call; the shell takes over (D5). */
  over(score?: number): void;
}

/**
 * When the game next needs `update` (D4): a delay in ms from the call's time (raised to
 * MIN_WAKE_MS; a fraction rounds up), or null: sleep until a key.
 */
export type GameWake = number | null;

export interface GameInstance {
  /** At session time 0 (New game), then at each requested wake; `nowMs` is exactly the time asked for. */
  update(nowMs: number): GameWake;
  /** A game key went down at `nowMs`. A wake replaces the pending one; undefined (no return) keeps it. */
  keyDown?(key: GameKey, nowMs: number): GameWake | undefined;
  /** As keyDown, for a release (only of keys whose key-down the game got). */
  keyUp?(key: GameKey, nowMs: number): GameWake | undefined;
  /** Called after every update, keyDown and keyUp; the screen keeps the previous frame. */
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
  readonly MIN_WAKE_MS: number;
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
/** `at`: the session ms of the call that made the effect. */
export type GameEffect =
  | { readonly kind: "sound"; readonly at: number; readonly sound: GameSound }
  | { readonly kind: "vibrate"; readonly at: number; readonly ms: number }
  | { readonly kind: "save"; readonly at: number; readonly bytes: Uint8Array }
  | { readonly kind: "over"; readonly at: number; readonly score: number | undefined };

/** One running game, driven synchronously by a host (D6). Times are session ms, non-decreasing. */
export interface GameSession {
  /** Runs every wake due at or before `nowMs` (each at its own time), then delivers the key. */
  keyDown(key: GameKey, nowMs: number): void;
  keyUp(key: GameKey, nowMs: number): void;
  /** Runs every wake due at or before `nowMs`, each at its own time. */
  advance(nowMs: number): void;
  /** The session ms of the next wake; null while the game sleeps (remote: or an advance is in flight). */
  wake(): number | null;
  /** The newest packed frame; undefined before the first. Remote sessions lag by the round trip. */
  frame(): Uint8Array | undefined;
  /** Effects since the last drain, in order. */
  drain(): readonly GameEffect[];
  /** Set once the game threw, broke the protocol or a limit, or tripped the watchdog; the session is dead. */
  readonly failure: string | undefined;
  dispose(): void;
}
export interface GameModule {
  readonly manifest: GameManifest;
  /** Creates the instance and runs `update(0)`. */
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
  readonly watchdogMs?: number; // default WATCHDOG_MS.play
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
/** Problems that keep `manifest` off the stock phone (glyphs, row and note fit, slugs; D12, D19); [] when fine. */
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
- **Instructions.** Each page's text is wrapped with `wrapText(text, "thin", 84)` (the stock
  layout's rules) and cut into screens of the three lines the stock text page holds; `More`
  steps through every screen of every page and cycles, as `textPages` does.
- **Session widget** (`src/games/sdk/session.ts`).
  - Clock: the session time is the whole kernel ms played since New game. It stands while the
    game is suspended.
  - Start: New game calls `module.start()`, which creates the instance and runs `update(0)`; its
    frame replaces the screen.
  - Keys: on key-down, Navi/C suspend (`suspend`) or quit; other game keys go to
    `keyDown(key, now)`. Releases go to `keyUp` only for keys whose key-down the game got.
    Suspending first sends `keyUp` for every game key still held, at the suspension time, so no
    key is stuck down after Continue.
  - Wakes: on each kernel tick, when `wake()` is at or before the session time, the widget calls
    `advance(now)`. In-process, every due wake runs at its requested time even when one tick
    spans several, and its effects are stamped with the kernel time that wake stands for (as
    Snake II's widget stamps cues `now - left`). A sleeping game costs one comparison a tick.
  - Render: the session's newest frame, at the first kernel tick after the call that drew it
    (within one display frame of its session time). Before the first frame, the screen shown
    before New game stays.
  - Continue: the board, and the session time, stand until a key. That key is delivered at the
    time the game was suspended, and a pending wake resumes from there (plan 23 C8; the helpdoc:
    "press any key except the navigation or menu keys"). Snake II's "next step one period after
    the key" is, in this contract, a game returning its period from `keyDown`.
  - `over` replaces the widget with the shell's end screen (D5) at the kernel tick containing the
    call. `failure` replaces it with the `Game\nerror` note.
  - Effects: `save` writes the record; `sound`/`vibrate` go to the sounder (D10); suspend and
    every end stop the game's sound and vibration.
- **Seed.** `mixSeed(minutes of the day from the clock port, kernel ms at New game)`. Players
  get varied games, and the kernel's clock makes it deterministic in tests.
  `createStockPhoneWith(config, { seed })` overrides it, as for Snake II.
- **Lifecycle.** A suspended session survives standby. Power-off, New game, `over`, failure and
  quit dispose it (remote: the worker is terminated).

## 2048 on the 84×48 LCD

Rules are the standard game. Each key-down slides every tile toward its side; equal neighbours
merge once per move, resolved from the leading edge; the score adds each merged tile's value. A
move that changes nothing does nothing. After a move that changed the board, one tile spawns
100 ms later (a requested wake, so the spawn is visible). A key that arrives first spawns it
immediately, then moves. A spawn draws the cell as `random() mod emptyCount` over the empty cells
in row-major order, then its value as `random() mod 10 == 0 ? 4 : 2`. A new game spawns twice in
`update(0)`.

Between moves the game sleeps (`null`), so an idle board makes no calls. It keeps at most three
deadlines (the pending spawn, the next win-blink toggle, the end after a loss) and every call
returns the earliest minus now, or `null` when none is set.

| Element          | Pixels and behaviour                                                                                                                                                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HUD              | score in `GAME_DIGITS` from x 0, y 0..4, no leading zeros (Snake II's HUD face); the top score right-aligned to x 83, raised live once passed (Open question 7); a full-width rule at y 6                                                                                             |
| Board 4×4        | tile (c, r) is a 19×9 box at (2 + 20c, 9 + 10r): board x 2..80, y 9..47, 1-px gaps                                                                                                                                                                                                    |
| Board 3×3        | the same tiles at (12 + 20c, 14 + 10r) (the `Board` choice)                                                                                                                                                                                                                           |
| Empty cell       | one dot at the tile's centre (x + 9, y + 4), so the grid reads without lines                                                                                                                                                                                                          |
| Tiles 2-64       | outline: rows y and y + 8 over x + 1..x + 17, columns x and x + 18 over y + 1..y + 7 (corners open); numeral in ink                                                                                                                                                                   |
| Tiles ≥ 128      | the 19×9 box filled minus its four corner pixels; numeral cleared, so the big tiles stand out on a 1-bit LCD                                                                                                                                                                          |
| Numeral          | `GAME_DIGITS` (3×5 ink in 4-px cells): width `4n - 1`, left at x + ⌊(19 − (4n − 1)) / 2⌋, top y + 2. Five digits (16384, 32768, 65536) fill 19 px exactly in a filled tile; six (131072, the 4×4 maximum) draw without gaps (18 px)                                                   |
| Keys             | 2 and ▲ up, 8 and ▼ down, 4 left, 6 right; others ignored (`keyDown` returns `undefined`, keeping any wake); key-down, no repeat; Navi/C are the shell's (suspend)                                                                                                                    |
| Merge            | `sound("eat")` once per move that merged                                                                                                                                                                                                                                              |
| Win              | the first 2048 tile: `sound({ notes: 1319, 1568, 2093 Hz × 80 ms })`; the tile alternates filled/outline every 200 ms (wakes) for 10 toggles (2 s); play continues ("keep going"); a move ends the blink                                                                              |
| Lose             | after a spawn leaves no move: `sound("crash")`, `vibrate(480)`; the board stands 2000 ms (one wake); then `over(score)` (the shell's game-over, fireworks on a new top score)                                                                                                         |
| Manifest         | id `2048`, name `2048`, `suspend: true`, scores on, no level, `storageBytes` 0; menu: New game, Board (`4x4`, `3x3`; initial 0), Top score, Instructions                                                                                                                              |
| Instructions     | thin face, wrapped by the shell, e.g. two pages: `Slide the tiles with keys 2, 4, 6 and 8. Two tiles of the same number merge into one.` and `Make a 2048 tile to win. The game ends when no tile can move.` (the validator decides; the thin face lacks `C`, `j`, `q`, `z` and more) |
| Splash (≈2.25 s) | five frames built with `sdk` at module load: two outline `2` tiles apart (250 ms), closer (250 ms), one filled `4` (250 ms), `2048` in `GAME_DIGITS` × 3 centred (500 ms), the same framed (1000 ms); pinned by `goldens/2048/splash.txt`                                             |

The 1-bit LCD has no colour, so tile value shows as numeral plus two weights: outline below 128,
filled from 128. The shell's end screen uses the large face for the score (8 px digits; seven
digits fit).

## Wasm ABI v1

Imports (module `nokia`; any other import rejects the package):

| Import                  | Meaning                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| `memory`                | the host's `Memory({ initial: 1, maximum: 16 })`; the module must import it (min ≤ 1 page) (D19) |
| `random() -> i32`       | the session generator (the same mulberry32 as `ctx.random`)                                      |
| `level() -> i32`        | `start.level`                                                                                    |
| `mode() -> i32`         | index of the started `play` item among the manifest's `play` items                               |
| `choice(i: i32) -> i32` | the stored option of the manifest's i-th `choice` item                                           |
| `top_score() -> i32`    | `start.topScore`                                                                                 |
| `load(ptr, max) -> i32` | copies the saved bytes into memory; returns their length                                         |
| `save(ptr, len) -> i32` | 1 saved, 0 over quota                                                                            |
| `sound(id: i32)`        | 0 `eat`, 1 `crash`                                                                               |
| `notes(ptr, count)`     | `count` pairs of little-endian u32 (hz, ms) from memory (no cap but the per-reply bound, D19)    |
| `vibrate(ms: i32)`      | as `ctx.vibrate`                                                                                 |
| `over(score: i32)`      | as `ctx.over`; −1 = no score                                                                     |

Exports (all required): `update(now_ms: i32) -> i32`, `key_down(key: i32, now_ms: i32) -> i32`,
`key_up(key: i32, now_ms: i32) -> i32` (keys 0-9 digits, 10 `*`, 11 `#`, 12 ▲, 13 ▼), and
`draw() -> i32` (a pointer to a 504-byte packed frame inside memory, or −1 when unchanged; out of
bounds = failure). `update(0)` is the first call. The three timed exports return a delay in ms
(≥ 0, raised to `MIN_WAKE_MS`), −1 to sleep until a key, or (`key_down`/`key_up` only) −2 to keep
the pending wake. Any other value, and −2 from `update`, is a failure, as is a trap. Time is `i32`
session ms (D19). Wasm runs only in the sandbox worker in browsers; Node tests compile it
synchronously.

**Dot** (`examples/dot/dot.wat`) is the ABI proof. A 2×2 dot moves 2 px per key-down on 2/4/6/8
and wraps at the edges (`key_down` returns −2, keeping the schedule). A 2×2 target sits at a
random even position and blinks, 500 ms on and 500 ms off, so `update` asks for a wake every
500 ms. Reaching it plays `sound(0)`, adds one point and moves the target. At 30 000 ms `update`
calls `over(score)`. Its menu is New game, Top score and Instructions; its splash is two frames of
art from `examples/dot/splash.txt`.

## Message protocol (host ⇄ worker)

Every message carries `v: 1` and a `seq` that increases by one per host message. `now` is the
session ms, non-decreasing across messages. Host to worker:

| Message                                    | Reply                                                                        |
| ------------------------------------------ | ---------------------------------------------------------------------------- |
| `load { package }`                         | `loaded { seq, manifest }` or `error { seq, message }`                       |
| `start { start: GameStart, fonts }`        | `done { seq, wake, frame?, effects }` (the instance is created; `update(0)`) |
| `key { now, down: boolean, key: GameKey }` | `done { seq, wake, frame?, effects }`                                        |
| `advance { now }`                          | `done { seq, wake, frame?, effects }`                                        |
| `dispose {}`                               | none (the host terminates the worker anyway)                                 |

There is no tick message. The host sends `advance` only when the session time reaches the last
reply's `wake`, one at a time; a game whose `wake` is `null` hears nothing until a key. The
worker's dispatcher is a `localGame` session, so it runs the due wakes before each message exactly
as in-process (D6), however late the message arrives. `wake` is the absolute session ms of the
next wake, or `null`. `frame` is a transferred 504-byte `ArrayBuffer`, present only when it differs
from the last one sent. The host rejects (failure `protocol`, worker terminated):

- a reply out of order;
- a frame of another length;
- more than 64 effects, or 8192 notes in total, in one reply (D19);
- an effect out of range (not an integer, over quota);
- a `wake` that is not a whole ms after the message's `now` (it would have run already);
- a second `over`;
- anything after `over`.

`serveGame(port, load)` (SDK) is the worker-side dispatcher. It is realm-agnostic: given a
`postMessage`/`onmessage` port and a loader that turns a package into a `GameDefinition`, it
handles the protocol over a `localGame` session. `remoteGameModule(manifest, connect)` (SDK) is
the host side, a `GameModule` whose sessions speak the protocol over a port from `connect()`. Its
watchdog and clock are injected, so it is testable in Node.

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
input: 400:6 900:2 1500:4 1560:4 2600:8+ 2750:8-
until: 81200
note: greedy corner bot, seed 44530, to game over.

@effects
# ms   kind    value
900    sound   eat
79200  sound   crash
79200  vibrate 480
81200  over    5124

@frames
t0
<48 rows of 84 `#`/`.`>
t10000
…

@hash fnv1a32 0x5c3e91a7
```

Rules (SDK `parseReplay`/`serializeReplay`, `file:line` errors as plan 13's goldens):

- Header keys appear in this order.
- `input` places keys at session ms, non-decreasing; a wake due at the same ms runs before the
  key. `k` is a key-down and a key-up at that ms, while `k+`/`k-` give them separately.
- `until` is the session ms the run ends at; it ends earlier at `over`. The game's wakes come from
  the game, not the file.
- `@effects` lists every effect in order with its ms.
- `@frames` holds the frame standing at 0, every 10 000 ms, at every `vibrate` or `over`, and at
  the end.
- `@hash` covers every distinct frame drawn, in order, each as its session ms (u32, little-endian)
  followed by the 504 packed bytes.

`checkReplay(module, replay, { advanceMs? })` reports the first differing effect or frame, with
its ms. `advanceMs` (default: only at keys and wakes) makes the checker also call `advance` on that
grid, which must not change anything (D11). A differing frame gets a row-by-row diff in the style
of plan 13's `Golden mismatch`. `recordReplay(module, start, input, until)` writes one.

## Conventions for every task

- Run commands from the repo root with `mise exec --`.
- TDD: write the failing test first wherever the task names tests.
- Fidelity standard (AGENTS.md): shell screens are asserted pixel-exact once settled, and their
  timings within one display frame (17 ms), or 50 ms for holds of 1 s and longer; tests do not
  pin sub-frame partial redraws. SDK replays and session calls are exact (D11): tests assert the
  ms a game was called at, and the screen at the kernel tick that follows.
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
- No cap beyond D19's: a validator rule that bounds a count, length or duration a game may choose
  is a review failure.
- When reality differs from this plan, append a `Deviation:` paragraph under the task. If a
  deviation breaks a contract in VISION.md, stop and report.
- Parallelism (max 3 concurrent agents): Task 1 first. Then lane A (2 → 3 → 4). After 3: lanes B
  (5 → 6) and C (7 → 8). After 4: lane D (10 → 11). Task 9 needs 4 and 6. Task 12 needs 8, 9 and 11. Then 13.

## Tasks

### Task 1 - Contracts and documentation

**Files:** `VISION.md`, `AGENTS.md`, `docs/specs/nokia-3310.md`, `docs/plans/README.md`, this plan.

- [ ] VISION: architecture diagram and package table with the three packages and the edges of
      "Package boundaries"; the four contract sections exactly as "Contract changes"; one
      paragraph on extra games (opt-in, D3 numbering, non-stock screens, wake-based timing on the
      kernel clock, D19's limits).
- [ ] AGENTS: workspace layout entries; the dependency directions; the demo rule (D1); `ses` and
      `watr` as the approved dependencies of this plan.
- [ ] Spec §7: "Extra games (plan 28, not stock)": where they appear, D3 numbering, the composed
      `Game\nerror` note, and that their gameplay has no captured ground truth.
- [ ] Plans README row 28 `in progress`.
- [ ] No runtime code. `mise exec -- vp check --fix`.
- [ ] Commit: `docs: define the game SDK, shell and sandbox contracts (plan 28)`.

### Task 2 - SDK I: screen, drawing, digits, random, limits and manifests (TDD)

**Files:** `packages/nokia-games-sdk/{package.json,tsconfig.json,vite.config.ts,README.md}`,
`src/{index,contract,limits,screen,draw,digits,random,manifest}.ts`,
`tests/{screen,draw,random,manifest}.test.ts`.

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
- [ ] `src/limits.ts` holds D19's constants, each with its reason in a comment; nothing else in
      the SDK declares a bound.
- [ ] TDD `validateManifest`: structure only (kebab id, first item `play`, unique slugs, integer
      `level` with 1 ≤ initial ≤ max, choice `initial` in range, splash frames of 504 bytes and
      step frame indices in range, positive integer step ms, `storageBytes` within the quota,
      `top-score` refused with `scores: false`); errors name the field path. Positive tests prove
      the removed caps stay removed: `level.max` 1000, a 20-option choice, a 40-frame 20 s splash,
      a ten-line instructions page all pass.
- [ ] `src/index.ts` exports the contract, `sdk` (a frozen object of the helpers) and the rest.
- [ ] `mise exec -- vp run @hellotimber/nokia-games-sdk#test`, `vp check --fix`.
- [ ] Commit: `feat(nokia-games-sdk): screen, drawing, digits, random, limits and manifests`.

### Task 3 - SDK II: wake-based local sessions, replays and recording (TDD)

**Files:** `src/{local,replay,recording}.ts`, `tests/{local,replay,recording}.test.ts`,
`tests/support/counter-game.ts` (new: a tiny fixture game using every ctx call, with a scripted
schedule of wakes).

- [ ] TDD `localGame` timing:
  - `start` creates the instance and calls `update(0)`;
  - `update` runs at exactly the requested times, whether `advance` is called every 1 ms, every
    17 ms or once far past several wakes (identical call logs);
  - a key's returned wake replaces the pending one, `null` sleeps, `undefined` keeps it;
  - a wake due at a key's ms runs before the key;
  - delays below `MIN_WAKE_MS` are raised and fractions round up; a negative, NaN or infinite
    delay sets `failure`;
  - a sleeping game is never called by `advance` (call count 0);
  - non-decreasing times are required of the host (a decreasing time throws: a host bug);
  - a session reaching `MAX_SESSION_MS` fails `clock`.
- [ ] TDD the rest of `localGame`: `draw` after every call; `frame()` changes only when pixels
      change; `drain()` returns effects stamped with their call's ms; `ctx.random` is mulberry32
      over `start.seed`; `save` enforces `storageBytes`; nothing after `over` (calls are
      ignored); malformed effects (non-integer notes or vibration) and D19's per-call bounds
      throw inside the game, so `failure` is set; a throwing game sets `failure` and stops;
      `dispose` is idempotent.
- [ ] TDD the replay format: parse/serialize round trip, header order, `input` forms,
      non-decreasing ms, `until`, frame grids 84×48, `@hash` over (ms, frame); `file:line` errors.
- [ ] TDD `recordReplay`/`checkReplay` on the fixture game: an edited effect, effect ms or pixel
      is reported with its ms and a row diff; `advanceMs: 1` and `advanceMs: 17` pass the same
      replay.
- [ ] TDD `recording(module)`: a played session (keys between wakes, a held key) yields a replay
      that `checkReplay` passes.
- [ ] Commit: `feat(nokia-games-sdk): wake-based local sessions and replay goldens`.

### Task 4 - SDK III: protocol, Wasm ABI, packages and conformance (TDD)

**Files:** `src/{protocol,serve,remote,wasm,package,conformance}.ts`,
`src/generated/conformance.ts` (generated), `conformance/{conformance.wat,conformance.js}`,
`scripts/conformance.ts` (new; `watr`), `package.json` (`watr` devDependency, `conformance`
script), `pnpm-workspace.yaml` (catalog `watr`), `tests/{protocol,wasm,package,conformance}.test.ts`.

- [ ] TDD `wasmGame` against a WAT fixture compiled in the test (`watr`): imports checked with
      `Module.imports` (unknown import → error naming it), required exports with
      `Module.exports`, the host memory's 16-page cap (`memory.grow` beyond it returns −1), key
      codes, the timed exports' returns (delay, −1 sleep, −2 keep from keys, −2 from `update` and
      other negatives → `failure`), `draw` pointer bounds, `notes` decoding (u32 pairs), a trap →
      `failure`.
- [ ] TDD `parseGamePackage`: `nokia-game 1`, exactly one of `js`/`wasm`, the package size
      limit, `validateManifest`.
- [ ] TDD `serveGame` + `remoteGameModule` over a Node `MessageChannel` with an injected clock and
      injected reply delays:
  - no message while the game sleeps; `advance` only once the session time reaches the last
    reply's `wake`, never two in flight;
  - a key sent before the reply that rescheduled a wake gives the same call log as `localGame`
    (the worker runs the due wakes first);
  - `frame()` lags until the reply and then equals `localGame`'s, for random delays of 0-30 ms;
  - the watchdog (no reply in `watchdogMs` → `failure: "watchdog"` and the injected `terminate`
    called); each protocol violation of "Message protocol" → `failure: "protocol"`; `dispose`.
- [ ] Conformance fixtures: `conformance.js` (a factory script, no imports, exercising every ctx
      call, sleeping and waking) and `conformance.wat` (the same game in Wasm).
      `scripts/conformance.ts` writes `src/generated/conformance.ts` (the JS source text, the
      compiled bytes, the manifest, and the replay recorded through `localGame`). A freshness
      test regenerates in-process. A test evaluates the JS with `new Function` in Node, runs the
      Wasm through `wasmGame`, and both pass `CONFORMANCE_REPLAY`.
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
- [ ] TDD the game (`factory2048(sdk)`) through `localGame`:
  - `update(0)` spawns twice and returns `null`; an idle board is never called;
  - keys (2/▲, 8/▼, 4, 6; others ignored and keep the wake);
  - a changing move asks for a wake 100 ms later and the spawn happens there; a key before it
    spawns first, then moves; a no-op move keeps the schedule;
  - `eat` per merging move; the win notes and the 200 ms blink (10 toggles, ended by a move);
  - the lose sequence (crash, vibrate 480, a 2000 ms wake, `over(score)`);
  - the `board` choice, and `topScore` raised live in the HUD.
- [ ] Splash frames built at module load; `goldens/2048/splash.txt` pins them;
      `validateManifest(game2048.manifest)` passes.
- [ ] `scripts/bot-2048.ts` is a deterministic greedy corner bot (down, left, right, up: the
      first move that changes the board), pressing a key every 500 ms of session time.
      `scripts/record-replays.ts` writes five goldens:
  - `bot-4x4-<seed>` to game over;
  - `bot-3x3-<seed>`;
  - `fast-keys`: the bot every 60 ms, so keys land before pending spawns;
  - `win`: the first seed in 1..10000 whose bot run reaches 2048, else a Deviation and the win
    is covered by unit tests only;
  - `fireworks-ready`: a game whose score beats `top-score: 0`.
    Input files `goldens/2048/<name>.input.txt` (start + `input` + `until`) drive the recorder,
    so a replay copied from the demo (Task 12) becomes a golden by saving its input there.
- [ ] `tests/2048-replays.test.ts`: every golden passes `checkReplay(localGame(game2048))`, also
      with `advanceMs: 17`. Review the recorded frames (`t0`, a merge, the end) by eye and say so
      in the completion note.
- [ ] Run the recorder twice; no diff. `mise exec -- vp run @hellotimber/nokia-games#test`.
- [ ] Commit: `feat(nokia-games): 2048 on the 84x48 LCD with replay goldens`.

### Task 7 - Shell I: extra games in the Games menu (TDD)

**Files:** `packages/nokia-os/package.json` (dependency `@hellotimber/nokia-games-sdk`),
`src/games/sdk/{record,validate,fonts,menu}.ts` (new), `src/firmware/{menu,records,leaves}.ts`,
`src/widgets/{level-bar,text-pages}.ts` (`levelPage`; wrapped pages),
`src/display/widgets/{index,game-frame}.ts`, `src/index.ts` (`validateStockGame`),
`tests/sdk-menu.test.ts` (new), `tests/support/sdk-fixture.ts` (new: two fixture games built with
the SDK, one with every menu item, a level `max` of 20 and a long instructions page),
`tests/settings.test.ts`, `tests/widgets-info.test.ts`.

- [ ] Guard: `GAME_DIGITS` equals `SNAKE_SPRITES['digit/0'..'9']` (D12).
- [ ] TDD `validateStockGame`: name glyphs (small) and row fit, option label glyphs and row fit,
      `… selected` notes (large, the note's three lines), instruction text (thin glyphs only;
      long text passes), id not a stock Games slug (read from `STOCK_TREE`), duplicate ids;
      messages name the game, the field and the glyph.
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
  - Level: `levelPage` with `max` (the fixture's 20: ▲ climbs past 9 while the page shows nine
    bars; Snake II passes 9, and its Level page behaviour and goldens are unchanged:
    `snakeLevel` now calls `levelPage`);
  - a choice list stores its value, then its `… selected` note;
  - Top score reads the record and returns as Snake II's;
  - Instructions: the long page wraps into several three-line screens, `More` steps through them
    and cycles; the stock Snake II pages are unchanged.
- [ ] Shell screens asserted per the fidelity standard: settled frames pixel-exact against the
      stock widgets' goldens, timings within one display frame.
- [ ] Every nokia-os test and golden passes unchanged.
- [ ] `mise exec -- vp run @hellotimber/nokia-os#test`, `vp run -r test`, `vp run website#build`,
      `vp check --fix`.
- [ ] Commit: `feat(nokia-os): extra games in the Games menu`.

### Task 8 - Shell II: sessions, end screens and effects (TDD)

**Files:** `src/games/sdk/session.ts` (new), `src/firmware/{phone,cues,menu}.ts`,
`src/sound/sounder.ts` (`notes` cue), `src/widgets/game-over.ts` (a top-score number source
other than Snake II's), `src/index.ts`, `tests/sdk-session.test.ts` (new), `tests/sounder.test.ts`.

- [ ] TDD the session widget with the fixture games through `localGame`:
  - New game runs `update(0)` and shows its frame at the next kernel tick;
  - each requested wake runs at its exact session ms, also when one kernel tick spans several
    wakes; the screen changes at the tick containing the wake (within one display frame);
  - a sleeping game is not called across many ticks;
  - key-downs and key-ups forwarded with their session ms; Navi/C suspend (`suspend`) or quit;
    suspend sends `keyUp` for held game keys; no `keyUp` reaches the game for a key it never saw
    go down;
  - the session time stands while suspended; Continue's board stands until a key, which is
    delivered at the suspension time, and a pending wake resumes from there;
  - a session survives standby; power-off and New game dispose it.
- [ ] TDD the end: `over(score)` beating the top score writes it, plays the fireworks timeline
      with `TOP SCORE:` and cues `top-score`; otherwise `Your score:`; `scores: false` returns
      directly; every path returns to New game on the top row; `failure` shows `Game\nerror`.
- [ ] TDD effects: `save` → record; `eat`/`crash`/`notes` → sounder with the plan 16 D13 gating
      (Warning tones and Games Sounds); `vibrate` gated by Shakes and Vibrating alert; times are
      the kernel time of the call that made them; a long tune is stopped by suspend and by the
      session's end.
- [ ] A fake remote session (frames and wakes arriving a call late, then `failure`) shows the
      previous frame until the first arrives, sends `advance` only at its known wake, and ends on
      `Game\nerror`.
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
  - Dot follows the ABI (keys returning −2, wrap, target, the 500 ms blink wakes, `over` at
    30 000 ms), and its replay golden `goldens/dot/bot.replay.txt` passes through `wasmGame`;
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
  - a game returning a 0 ms delay forever is woken at most once per `MIN_WAKE_MS` of session
    time, and the worker stays responsive;
  - the watchdog: a game looping forever in `update` (and one in `keyDown`) is terminated within
    `watchdogMs` + 100 ms, and the phone-side session reports `failure: "watchdog"`.
- [ ] Generator twice, no diff. `mise exec -- vp run @hellotimber/nokia-games-sandbox#test`.
- [ ] Commit: `feat(nokia-games-sandbox): SES worker runtime for user games`.

### Task 11 - Sandbox II: the browser host

**Files:** `src/{index,host,sandbox-html,self-test}.ts`, `tests/{sandbox-html,host}.test.ts`.

- [ ] `SANDBOX_HTML`/`SANDBOX_CSP`: a bootstrap script that takes one message from the parent
      (`{ source, port }`), makes a `Blob` and a `Worker`, and transfers the port to the worker.
      The CSP is D7's L4, with `'sha256-…'` of the bootstrap; a test recomputes the hash.
- [ ] `createGameSandbox`:
  - one hidden `<iframe sandbox="allow-scripts">` (srcdoc, or `src`);
  - `install(pkg)`: `parseGamePackage`, a worker per load (watchdog `WATCHDOG_MS.load`),
    manifest comparison, and then a `remoteGameModule` whose `connect()` asks the iframe for a
    fresh worker per session and whose `terminate` ends it;
  - `dispose` removes the iframe and terminates every worker.
- [ ] `selfTest()` starts a probe worker without SES that tries `fetch`, `WebSocket`,
      `importScripts` (a `data:` script), `new Worker` and `XMLHttpRequest` to a public URL and
      reports each as `blocked` or `allowed`. Every one must be `blocked`; `install` refuses
      while any is `allowed` (D7 (5)).
- [ ] Unit tests cover the parts that need no DOM (the HTML, CSP and hash; the host's message
      plumbing with a fake iframe/port); the browser behaviour is Task 12's.
- [ ] Measure in Task 12's browser run and record: session start (worker + lockdown + first
      frame; above 300 ms → pre-warm, D8, Deviation), and key-to-frame latency (within one display
      frame is the fidelity target; sub-frame differences are not chased).
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
     moves to `8-8`; both play; an idle sandboxed 2048 sends no messages (count them in the
     page);
  6. Sandbox self-test reports every probe `blocked` (record the browser and version);
  7. install a hostile package that loops forever: `Game\nerror` within about 1 s while the
     phone stays responsive;
  8. Copy replay, saved as `packages/nokia-games/goldens/2048/demo.input.txt`, then
     `vp run @hellotimber/nokia-games#replays` adds its golden.
     Screenshots in the completion note. Repeat steps 6-7 in Firefox and Safari if
     `agent-browser` offers them; otherwise list them as UNVERIFIED.
- [ ] READMEs:
  - SDK: writing a game, the wake-based contract, D19's limits and why, replays, packages, the
    Wasm ABI;
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
- [ ] `grep` the SDK and shell for bounds: every one is a D19 constant from `src/limits.ts`.
- [ ] Spec §7: final facts and what stays UNVERIFIED (Safari, loudness of custom notes).
- [ ] Plans README row 28 `done`. Completion notes; status `done`.
- [ ] Commit: `docs: complete the game SDK (plan 28)`.

## Follow-ups

- **Plan 24:** reuse `levelPage`, the generic Top score and game-over sources, and record
  whether any of its games could be an SDK game without changing a golden (D16).
- **Porting Snake II (not scheduled):** feasible on the wake-based contract (D16). It needs a
  game-scheduled cue inside the death (or a game-over cue offset), Snake II's own settings and
  records, and every `game/snake/*` golden passing unchanged through the SDK path under the
  fidelity standard.
- **Nested game menus** (Pairs II-style Time trial / Puzzle) as a `submenu` item.
- **Portfolio integration (unsequenced):** the website passes `games` and hosts the sandbox
  (with `src` if its CSP forbids `'unsafe-eval'`).
- **Pre-warmed workers** if Task 11's start time exceeds the budget.

## Open questions for Lachlan

Resolved provisionally so execution is not blocked; each is cheap to reverse. Lachlan decided
questions 1, 2, 3, 10, 12, 13 and 14 on 2026-10-15 (marked below); the rest stay provisional.

1. **Where extra games appear (D3) — decided: after Pairs II.** The first fills the hidden `8-5`, and
   Settings moves only from the second game on. Reverse with a `More games` submenu at `8-5`,
   which keeps Settings at `8-6` always but puts every extra game one level deeper.
2. **Demo default (D15) — decided: on.** The demo's "Extra games" toggle starts ticked, so 2048
   is in the Games menu immediately; unticking it gives the strict stock phone.
3. **Menu animation (D2) — decided: the splash only, with no icons.** Reverse by adding an optional `icon` that
   only hosts (not the phone) display.
4. **Continue (D5):** Snake II's rule (the board and the session time stand until a key) for every
   suspendable game; the key is delivered and pending wakes resume.
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
12. **Snake II port (D16) — decided: new games only.** A scope choice; the port stays an
    unscheduled follow-up.
13. **Timing (D4) — decided: wake-based, no fixed tick.** The game is called with the kernel's
    session time and returns its next wake; keys are stamped with the same clock.
14. **Limits (D19) — decided: the game's,** except the protections D19 lists with their reasons.
15. **`MIN_WAKE_MS` = 10 ms (D19):** below one display frame, so it never limits anything visible.
    Reverse by raising it to a display frame (17 ms) if busy games show up in profiles.
16. **Key handlers' `undefined` keeps the wake (D4).** Reverse by requiring every call to return a
    wake (simpler rule, more bookkeeping in steering games).
17. **Session time stands while suspended (D4, D5).** Reverse by passing kernel time through the
    suspension, so a game sees the gap and decides itself.

## Conflicts found while planning

- AGENTS.md: "Integration code … lives in `website/src/` only". The nokia-os demo already
  composes nokia-os with phone-screen. This plan has it compose two more siblings and writes the
  rule down (D1).
- VISION's diagram puts nokia-os on phone-core and phone-screen only; it gains the SDK edge
  (Task 1).
- Plan 14 D12 and plan 23 D11 describe the Level page as Snake II's; `levelPage` generalises it
  without changing a Snake II golden (Task 7). Its ▲ bound becomes the caller's `max` (Snake II
  passes 9).
- `paintTextPage` throws on more than three lines; the shell cuts wrapped instructions into
  three-line screens before painting, so the painter is unchanged.

## Done means

- A host passes `games` and they appear in Games after Pairs II with their splash, menu and stock
  service screens. Without `games` the phone and every golden are unchanged.
- Games are called only at session time 0, at the times they ask for and on game keys, always
  with the exact kernel session time; an idle 2048 board makes no calls, in-process or sandboxed.
- 2048 plays on the 84×48 LCD, in-process and as user JS through the sandbox, and passes the same
  replay goldens both ways and on any advance grid. Dot proves the Wasm ABI.
- The manifest and contract cap nothing beyond D19's protections, each stated with its reason in
  `src/limits.ts` and the SDK README.
- In the browser, the sandbox's self-test reports every network probe blocked. A looping game is
  terminated without freezing the phone. The escape suite passes in Node.
- The demo installs games from a file or URL, keeps them across reloads, and copies replays.
- phone-core, phone-screen, snake and the website are unchanged. `vp check`, `vp run -r test` and
  `vp run website#build` pass. VISION, AGENTS, the spec and the plans README match what shipped.
