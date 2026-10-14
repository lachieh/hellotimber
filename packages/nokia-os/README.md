# @hellotimber/nokia-os

A strict reproduction of the stock Nokia 3310 firmware (v6.39, PPM E, English) built on the
generic `@hellotimber/phone-core` kernel, painted with `@hellotimber/phone-screen`'s LCD toolkit.

Work in progress (plan 13). So far the package holds the LCD golden fixture format
(`scripts/golden-format.ts`) and the test diff helpers (`tests/support/golden.ts`).

## Goldens

`goldens/**/*.lcd.txt` are 84×48 text grids (`#` lit, `.` clear) imported from emulator
captures of the real firmware. They are generated; never edit them by hand:

```sh
mise exec -- vp run @hellotimber/nokia-os#import-captures /path/to/nokia-3310
```

Tests never read the capture corpus, and nothing from it is committed except these grids.
