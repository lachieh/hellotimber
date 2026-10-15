// Plan 14's acceptance (docs/plans/14-menu-depth-and-stock-widgets.md "Coverage guard", Task
// 13): the generated tree goldens run the generic tree scenario (tests/support/acceptance.ts);
// the Task 0 probes (S7) run the hand-written scenarios below.
import type { PhoneKey } from "@hellotimber/phone-core";
import { StockEeprom } from "../../src/firmware/eeprom";
import { createStockSettings } from "../../src/firmware/settings";
import { acceptancePlan, type Scenario } from "../support/acceptance.ts";
import { expectLcd } from "../support/golden.ts";
import { newGameLeafScenario } from "../support/game.ts";
import { goldenImage, loadGolden } from "../support/goldens.ts";
import { after, keys, SNAKE, stills, timeline, type Later } from "../support/probes.ts";
import { seededStorage, standbyRig, type Rig } from "../support/rig.ts";

const PHONE_BOOK = "navi navi";

/** Instructions of each game: the path to its game menu and the ▼ count to Instructions. */
const INSTRUCTIONS: Readonly<Record<string, string>> = {
  "8-1-6": `${SNAKE} down*5 navi`,
  "8-2-4": "navi down*7 navi down navi wait:7000 down*3 navi",
  "8-3-3": "navi down*7 navi down*2 navi wait:7000 down*2 navi",
  "8-4-1-5": "navi down*7 navi down*3 navi wait:7000 navi down*4 navi",
  "8-4-2-5": "navi down*7 navi down*3 navi wait:7000 down navi down*4 navi",
};

/**
 * A rig at standby in the factory image's state (`v639-factory-setup.inc`) after `script`. The
 * image was saved after a Restore and power-cycled: its Shakes page reads the `On` Restore wrote
 * (docs/specs/stock/storage-and-settings.md), where nokia-os keeps the virgin page text until a
 * choice, so the rig stores it.
 */
function factoryAfter(script: string): Rig {
  const storage = seededStorage({ factory: true });
  createStockSettings(new StockEeprom(storage)).choose("games/settings/shakes", 1);
  const rig = standbyRig({ storage });
  keys(rig, script);
  return rig;
}

/**
 * A Menu 8 6 3 digit probe: its timeline from `triggerRow` (the digit's first redraw) to
 * `lastRow` (Games › Settings selected), then Select, ▼×2, Select: Shakes' list as image `list`.
 */
function shakesCheck(
  id: string,
  rig: Rig,
  triggerRow: number,
  lastRow: number,
  list: string,
  later: readonly Later[],
): void {
  timeline(id, rig, "1", later, { triggerRow, lastRow });
  keys(rig, "navi down*2 navi");
  expectLcd(rig.paint(), goldenImage(id, list), `${id}: Shakes' list after the check`);
}

/** `key` on `count` consecutive golden rows from `from`. */
const rowKeys = (from: number, key: PhoneKey, count: number): Later[] =>
  Array.from({ length: count }, (_, i) => [from + i, key]);

const wrap = (base: string, key: "down" | "up", count: number): string[] => [
  base,
  ...Array.from({ length: count - 1 }, () => key),
];

/** Stills: ▲/▼ per image after opening a list. */
const WRAPS: Readonly<Record<string, string>> = {
  reminders: "navi down*9 navi",
  "phone-book-erase": "navi navi down*3 navi",
  games: "navi down*7 navi",
  profiles: "navi down*11 navi",
};

const SCENARIOS: Record<string, Scenario> = {
  // Snake II's New game: asserted early with plan 23's game comparison (ASSERTED_EARLY).
  "tree/08-games/8-1-1.leaf": newGameLeafScenario,
  "probe/wrap-down": (id) => stills(id, standbyRig(), wrap(`${PHONE_BOOK} down*9`, "down", 4)),
  ...Object.fromEntries(
    Object.entries(WRAPS).flatMap(([name, base]) =>
      (["down", "up"] as const).map((key) => [
        `probe/wrap-small-${name}-${key}`,
        (id: string) => stills(id, standbyRig(), wrap(base, key, loadGolden(id).images.length)),
      ]),
    ),
  ),
  "probe/return-top-row": (id) =>
    stills(id, standbyRig(), [`${PHONE_BOOK} down*5 up*2`, "navi", "c"]),
  "probe/return-bottom-row": (id) =>
    stills(id, standbyRig(), [`${PHONE_BOOK} down*3`, "navi", "c"]),
  "probe/return-wrapped": (id) => stills(id, standbyRig(), [`${PHONE_BOOK} up`, "navi", "c"]),
  "probe/return-note": (id) => timeline(id, after(`${PHONE_BOOK} down*4`), "navi"),
  // Image 02 is shot 2.1 s after C, 9 ms after Phone book's icon steps (its timeline from
  // menu/01-phone-book.anim); the firmware times the step from its redraw after C.
  "probe/reenter": (id) =>
    stills(id, standbyRig(), [`${PHONE_BOOK} down*5`, "c wait:1500", "navi"], true),

  // Shortcut probes press digits after Menu: the window (2920-2948 ms) and the opening delay
  // (1427-1502 ms between redraws) differ between recordings.
  "probe/shortcut-m1": (id) => timeline(id, standbyRig(), "navi", [[3, "1"]]),
  "probe/shortcut-m1-8": (id) =>
    timeline(id, standbyRig(), "navi", [
      [3, "1"],
      [5, "8"],
    ]),
  "probe/shortcut-m1-1-0": (id) =>
    timeline(id, standbyRig(), "navi", [
      [3, "1"],
      [5, "1"],
      [6, "0"],
    ]),
  "probe/shortcut-m1-2": (id) =>
    timeline(id, standbyRig(), "navi", [
      [3, "1"],
      [5, "2"],
    ]),
  "probe/shortcut-m8-1": (id) =>
    timeline(id, standbyRig(), "navi", [
      [3, "8"],
      [5, "1"],
    ]),
  "probe/shortcut-m8-1-2": (id) =>
    timeline(id, standbyRig(), "navi", [
      [3, "8"],
      [5, "1"],
      [8, "2"],
    ]),
  "probe/shortcut-m8-6": (id) =>
    timeline(id, standbyRig(), "navi", [
      [3, "8"],
      [5, "6"],
    ]),
  "probe/shortcut-m8-6-3": (id) =>
    timeline(id, standbyRig(), "navi", [
      [3, "8"],
      [5, "6"],
      [6, "3"],
    ]),
  // Digits in Shakes' option list opened by Menu 8 6 3 (2026-10-14 probes, each after the factory
  // setup: Shakes On). The frames before the digit are probe/shortcut-m8-6-3's (a known gap), so
  // the digit is matched to its first redraw from a rig showing the screen before it. The check
  // afterwards goes Menu, ▼×7, Select, ▼×4 (Games › Settings), Select, ▼×2, Select to Shakes'
  // list, which opens on Off; the Settings pages are left out (they show the factory image's
  // Lights `Off`, which nokia-os's page does not) and the list is compared alone.
  "probe/shortcut-m8-6-3-then-1": (id) =>
    shakesCheck(id, factoryAfter("navi 8 6 3 wait:1000"), 8, 29, "ad", [
      [11, "navi"],
      ...rowKeys(13, "down", 7),
      // Select ends the carousel's icon animation: ahead of its next step.
      [{ ahead: 25 }, "navi"],
      ...rowKeys(26, "down", 4),
    ]),
  // Invalid shortcut shows 2872 ms here and 2903 ms after Menu 1 8 (its timeline,
  // probe/shortcut-m1-8): the comparison ends at the note.
  "probe/shortcut-m8-6-3-then-3": (id) =>
    timeline(id, factoryAfter("navi 8 6 3 wait:1000"), "3", [], {
      triggerRow: 8,
      lastRow: 8,
    }),
  // The 1 typed 640 ms after the 3, while Shakes is about to open. Its label shows 1934 ms (1913
  // after a 1 in the list).
  "probe/shortcut-m8-6-3-1": (id) =>
    shakesCheck(id, factoryAfter("navi 8 6 3"), 7, 28, "ab", [
      [10, "navi"],
      ...rowKeys(12, "down", 7),
      [{ ahead: 24 }, "navi"],
      ...rowKeys(25, "down", 4),
    ]),
  "probe/shortcut-m1-wait-9": (id) =>
    timeline(id, standbyRig(), "navi", [
      [3, "1"],
      [16, "9"],
    ]),
  "probe/note-keys-service-nos-c-500": (id) =>
    timeline(id, after(`${PHONE_BOOK} down`), "navi", [[3, "c"]]),
  // Done plays tree/01-phone-book/1-8-1-1.choose's timeline.
  "probe/note-keys-done-down-300": (id) =>
    timeline(id, after(`${PHONE_BOOK} down*7 navi navi down`), "navi", [[3, "down"]]),

  "probe/progress-7-6-quit": (id) =>
    timeline(id, after("navi down*6 navi down*4"), "navi", [[41, "navi"]]),
  // Searching plays tree/06-settings/6-2-4-2.leaf's bar (7-22 ms off this recording's). C comes
  // before the bar step due at 10593 ms, which never shows: it goes ahead of its redraw.
  "probe/progress-6-2-4-2-c": (id) =>
    timeline(id, after("navi down*5 navi down navi down*3 navi down"), "navi", [
      [{ ahead: 40 }, "c"],
    ]),

  "probe/confirm-5-2-5-c": (id) =>
    timeline(id, after("navi down*4 navi down navi down*5"), "navi", [[2, "c"]]),
  "probe/confirm-5-2-5-ok": (id) =>
    timeline(id, after("navi down*4 navi down navi down*5"), "navi", [[2, "navi"]]),
  "probe/confirm-8-6-4-c": (id) =>
    timeline(id, after("navi down*7 navi down*4 navi down*3"), "navi", [[2, "c"]]),
  "probe/confirm-8-6-4-ok": (id) =>
    timeline(id, after("navi down*7 navi down*4 navi down*3"), "navi", [[2, "navi"]]),
  "probe/prompts-1-1": (id) => timeline(id, after(PHONE_BOOK), "navi", [[2, "c"]]),
  "probe/prompts-1-9": (id) => timeline(id, after(`${PHONE_BOOK} down*8`), "navi", [[2, "c"]]),
  "probe/prompts-6-4": (id) => timeline(id, after("navi down*5 navi down*3"), "navi", [[2, "c"]]),
  "probe/prompts-11-5": (id) =>
    timeline(id, after("navi down*10 navi down*4"), "navi", [[13, "c"]]),

  "probe/unset-down": (id) =>
    stills(id, after("navi down*4 navi down"), ["navi", ...Array(6).fill("down")]),
  "probe/unset-reopen": (id) =>
    stills(id, after("navi down*4 navi down navi down*6"), ["c", "navi"]),
  "probe/unset-up": (id) =>
    stills(id, after("navi down*4 navi down"), ["navi", ...Array(6).fill("up")]),
  "probe/unset-quit": (id) => timeline(id, after("navi down*4 navi down navi"), "navi"),

  "probe/profile-share": (id) => {
    // Tones › Ringing volume → Level 3, back to standby; then each page and list.
    const base = "navi down*4 navi down navi down*3";
    const level3 = () => after(`${base} navi wait:4000 c*4 wait:2000`);
    const check = (rig: Rig, image: string, script: string) => {
      keys(rig, script);
      expectLcd(rig.paint(), goldenImage(id, image), `${id}: ${image}`);
    };
    const rig = standbyRig();
    check(rig, "01-level-3", base);
    check(rig, "02-tones-page", "navi wait:4000");
    for (const [name, path] of [
      ["general", "navi down*11 navi navi down navi down"],
      ["silent", "navi down*11 navi down navi down navi down"],
      ["tones", "navi down*4 navi down"],
    ] as const) {
      const shared = level3();
      check(shared, `${name}-page`, path);
      check(shared, `${name}-list`, "navi");
    }
  },

  "probe/games-splash-8-1": (id) => timeline(id, after("navi down*7 navi"), "navi"),
  "probe/games-splash-8-2": (id) => timeline(id, after("navi down*7 navi down"), "navi"),
  "probe/games-splash-8-3": (id) => timeline(id, after("navi down*7 navi down*2"), "navi"),
  "probe/games-splash-8-4": (id) => timeline(id, after("navi down*7 navi down*3"), "navi"),
  ...Object.fromEntries(
    (
      [
        ["down", "down"],
        ["c", "c"],
        ["menu", "navi"],
      ] as const
    ).map(([name, key]) => [
      `probe/games-splash-skip-${name}`,
      // The splash plays probe/games-splash-8-1's timeline (first step 248 ms, here 252 ms).
      (id: string) => timeline(id, after("navi down*7 navi"), "navi", [[3, key]]),
    ]),
  ),
  "probe/games-level-keys": (id) =>
    timeline(id, after(`${SNAKE} down`), "navi", [
      [{ ms: 1600 }, "up"],
      [{ ms: 3200 }, "down"],
      [2, "navi"],
    ]),
  "probe/games-level-c": (id) => timeline(id, after(`${SNAKE} down`), "navi", [[2, "c"]]),
  // Top score plays tree/08-games/8-1-4.leaf's timeline (3-16 ms off these recordings').
  "probe/games-top-score-wait": (id) => timeline(id, after(`${SNAKE} down*3`), "navi", []),
  "probe/games-top-score-c-2s": (id) => timeline(id, after(`${SNAKE} down*3`), "navi", [[13, "c"]]),
  "probe/games-top-score-down-2s": (id) =>
    timeline(id, after(`${SNAKE} down*3`), "navi", [[13, "down"]]),
  ...Object.fromEntries(
    Object.entries(INSTRUCTIONS).map(([number, path]) => [
      `probe/games-instructions-${number}`,
      (id: string) => {
        const count = loadGolden(id).images.length;
        stills(id, standbyRig(), [path, ...Array(count - 1).fill("navi")]);
      },
    ]),
  ),
  "probe/games-instructions-c": (id) =>
    timeline(id, after(`${SNAKE} down*5`), "navi", [
      [2, "navi"],
      [3, "c"],
    ]),

  "probe/set-delay": (id) =>
    stills(id, after("navi down*6 navi down*2 navi down*3"), ["navi", "down"]),
  "probe/set-delay.rec": (id) =>
    timeline(id, after("navi down*6 navi down*2 navi down*3 navi down"), "navi"),

  "probe/multiselect": (id) => {
    const path = "navi down navi down*7 navi down*3";
    const rig = after(path);
    keys(rig, "navi");
    expectLcd(rig.paint(), goldenImage(id, "00"), `${id}: Language`);
    keys(rig, "navi wait:1000 down wait:1000 navi wait:1000 c wait:3000");
    expectLcd(rig.paint(), goldenImage(id, "after-c"), `${id}: Save changes?`);
  },
  "probe/multiselect.rec": (id) =>
    timeline(id, after("navi down navi down*7 navi down*3 navi"), "navi", [
      [2, "down"],
      [3, "navi"],
      [4, "c"],
    ]),

  "probe/prepaid-credit-info-display": (id) =>
    stills(id, after("navi down*3 navi down*7 navi"), ["", "navi", ...Array(6).fill("down")]),
  "probe/prepaid-recharge-status": (id) =>
    stills(id, after("navi down*3 navi down*7 navi"), ["down*3", "navi", ...Array(6).fill("down")]),
};

const ON_OVER_GAMES =
  "while 8-6 is opening the firmware draws Settings' first page value (`On`) over the Games " +
  "list (image f, held 0.6-1.4 s)";

acceptancePlan({
  plan: "14",
  scenarios: SCENARIOS,
  knownGaps: {
    "probe/shortcut-m8-6": ON_OVER_GAMES,
    "probe/shortcut-m8-6-3": ON_OVER_GAMES,
  },
});
