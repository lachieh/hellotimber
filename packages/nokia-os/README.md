# @hellotimber/nokia-os

A strict reproduction of the stock Nokia 3310 firmware (v6.39, PPM E, English) on the generic
`@hellotimber/phone-core` kernel, painted with `@hellotimber/phone-screen`'s LCD toolkit. Every
pixel and timing step is checked against emulator captures of the real firmware.

What it covers today (plan 13): the boot sequence, standby, the 12-entry main-menu carousel with
its animated icons, rail, menu-number indicator and first-digit shortcut dots, and every level-1
submenu in both firmware presentations (row lists and one-item pages with a current value).
Deeper leaves open a marked placeholder (a dotted border the firmware never draws) until later
plans implement them.

## Usage

```ts
import { createStockPhone, paintStockScreen } from "@hellotimber/nokia-os";
import { createScreenRenderer } from "@hellotimber/phone-screen";

const pad = (n: number) => String(n).padStart(2, "0");
const phone = createStockPhone({
  carrier: "Telstra", // every character must exist in the stock font; otherwise this throws
  clock: () => {
    const now = new Date();
    return `${pad(now.getHours())}:${pad(now.getMinutes())}`; // "07:59"
  },
  date: () => {
    const now = new Date();
    return `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`; // "13.10.2026"
  },
  boot: "animated", // or "skip" (tests, reduced motion)
});

const renderer = createScreenRenderer({ paint: paintStockScreen, scale: 6 });
document.body.append(renderer.canvas);
phone.subscribe(({ screen }) => renderer.render(screen));

const loop = () => {
  phone.tick(Math.floor(performance.now()));
  requestAnimationFrame(loop);
};
requestAnimationFrame(loop);

phone.send({ type: "down", key: "power" }); // the phone starts switched off;
setTimeout(() => phone.send({ type: "up", key: "power" }), 1000); // a long press turns it on
```

`missingStockGlyphs(text, font)` lists the characters a stock font cannot draw, so a host can
validate an operator name before calling `createStockPhone`.

With `@hellotimber/phone-3d`, pass `renderer.canvas` as the screen texture source and forward
the model's key callbacks to `phone.send(...)`. nokia-os never imports phone-3d.

## Demo

```sh
mise exec -- vp run @hellotimber/nokia-os#demo   # http://localhost:5173
```

Arrows ▲/▼, Enter Navi, Backspace or Escape C (hold it to return to standby), digits, `*`,
`#`, and `P` power (held for 1 s). The buttons do the same. The demo validates the operator
name, can skip the boot, and shows the phone's path and screen kind in a status line. In dev it
also lays any committed golden over the LCD, as an overlay or as a pixel difference.

## Asset policy

Everything the painter draws comes from committed goldens. Fonts are harvested from the text in
golden images (`scripts/text-runs.ts` is the only manual input). Icons, boot frames and status
art are cropped from goldens, and timelines come from golden timing rows. Nothing is copied from
the capture corpus's extracted firmware assets.

## Golden workflow

The capture corpus (`nokia-3310/`, emulator captures of the real firmware) is gitignored and is
never committed. Two scripts turn it into committed, generated data. Never edit their output:

```sh
# 1. Import captures into goldens/ (84×48 '#'/'.' text grids with timings, plus index.json).
mise exec -- vp run @hellotimber/nokia-os#import-captures /path/to/nokia-3310
# 2. Derive fonts, icons, boot frames and status art into src/resources/generated/.
mise exec -- vp run @hellotimber/nokia-os#extract-resources
# 3. Test: pixel and timing acceptance against every asserted golden, plus freshness checks.
mise exec -- vp run @hellotimber/nokia-os#test
```

`scripts/capture-set.ts` decides which captures become goldens and whether each is `asserted` or
`pending:<plan>`. `tests/acceptance.test.ts` drives the phone with key presses on a virtual 1 ms
clock through a scenario for every asserted golden, and fails if one has no scenario. Timelines
are compared after aligning on the transition, within ±2 ms. Tests never read the corpus.

## Capture artefacts

The emulator's virgin EEPROM and synthetic network leave marks that the OS does not reproduce:

| Artefact                                            | Handling                                           |
| --------------------------------------------------- | -------------------------------------------------- |
| Operator `Orange F`, clock `10:10`, setup date      | host config and ports; goldens pass them as inputs |
| Security-code prompt, `Code accepted`, clock wizard | not reproduced; boot is self-test + hands          |
| First standby `Snooze` prompt                       | not imported                                       |
| Profiles slot 6 name                                | labelled `(empty)` (UNVERIFIED)                    |
| Page values (`Level 1`, `Off`, …)                   | initial state of the in-memory settings store      |
