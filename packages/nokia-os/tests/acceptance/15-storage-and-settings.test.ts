// Plan 15's acceptance (docs/plans/15-storage-and-settings.md "Golden pipeline additions"): the
// boot gates and welcome notes (Task 8), and the security-code probes (A4, A5, A7, 0c).
import { expect } from "vite-plus/test";
import { GATE_BLANK_MS, SELF_TEST_MS } from "../../src/firmware/boot";
import { createMemoryStorage, type StockStorage } from "../../src/index";
import { acceptancePlan, type Scenario } from "../support/acceptance.ts";
import { expectLcd, expectTimeline } from "../support/golden.ts";
import { goldenImage, loadGolden } from "../support/goldens.ts";
import { after, digitsAt, keys, stills, timeline, type Later } from "../support/probes.ts";
import { seededStorage, standbyRig, stockRig, type Rig } from "../support/rig.ts";

/** Tones › Keypad tones and Settings › Phone settings › Cell info display, as plan 15 A7 keys. */
const KEYPAD_TONES = "navi wait:300 down*4 wait:1000 navi down*5";
const CELL_INFO = "navi wait:300 down*5 wait:1000 navi down navi down";
const TO_STANDBY = "c wait:1000 c wait:1000 c wait:2000";

/**
 * Plan 15 A7 (`probe/persist-reboot`): Keypad tones › Level 2 and Cell info display › On, then
 * a new phone over the same storage (`saveflash`, `reboot`) shows both on their pages and opens
 * both lists on them.
 */
function persistReboot(id: string): void {
  const storage = createMemoryStorage();
  const golden = loadGolden(id);
  const check = (rig: Rig, image: string, script: string): void => {
    keys(rig, script);
    expectLcd(rig.paint(), goldenImage(id, image), `${id}: ${image}`);
  };
  const first = standbyRig({ storage });
  check(first, "before-5-6-page", KEYPAD_TONES);
  check(first, "before-5-6-list", "navi");
  check(first, "set-5-6-page", "down*3 navi wait:3000");
  check(first, "before-6-2-2-page", `${TO_STANDBY} ${CELL_INFO}`);
  check(first, "before-6-2-2-list", "navi");
  check(first, "set-6-2-2-page", "down navi wait:3000");
  const second = standbyRig({ storage });
  check(second, "standby", "");
  check(second, "5-6-page", KEYPAD_TONES);
  check(second, "5-6-list", "navi");
  check(second, "6-2-2-page", `${TO_STANDBY} ${CELL_INFO}`);
  check(second, "6-2-2-list", "navi");
  expect(golden.images).toHaveLength(11);
}

/** The security-code leaves highlighted, as plan 15 A4/A5 reach them. */
const CODE_LEAVES: Readonly<Record<string, string>> = {
  "6-3-5": "navi wait:300 down*5 wait:1000 navi down*2 navi down*3",
  "6-3-6-1": "navi wait:300 down*5 wait:1000 navi down*2 navi down*4 navi",
  "6-4": "navi wait:300 down*5 wait:1000 navi down*3",
  "4-5-5": "navi wait:300 down*3 wait:1000 navi down*4 navi down*4",
};
const RESTORE_PROMPT = `${CODE_LEAVES["6-4"]} navi wait:2000`;

/** A4: Select, `00000` one digit per golden row, OK, `Code error`, the empty prompt, C. */
function codeWrong(id: string, number: string): void {
  const digits = [2, 3, 4, 5, 6].map((row) => [row, "0"] as const);
  timeline(id, after(CODE_LEAVES[number]!), "navi", [...digits, [7, "navi"], [9, "c"]]);
}

const STANDBY = "c*5 wait:2000";
/** At standby with the code changed to 11111 (Change security code, a matching verify). */
const CODE_11111 = `${CODE_LEAVES["6-3-6-1"]} navi 1 2 3 4 5 navi 1*5 navi 1*5 navi wait:3000 ${STANDBY}`;
/** At standby with Phone security On, set with `code`. */
const securityOn = (code: string) =>
  `${CODE_LEAVES["6-3-5"]} navi ${code.split("").join(" ")} navi down navi wait:3000 ${STANDBY}`;
/** At Change security code's `Enter new security code:` prompt. */
const ENTER_NEW = `${CODE_LEAVES["6-3-6-1"]} navi 1 2 3 4 5 navi`;

const PROBE_SCENARIOS: Record<string, Scenario> = {
  "probe/persist-reboot": persistReboot,

  // Plan 15 0c: accepted codes (v6.39 with the re-provisioned code). Each note plays its own
  // recording's timeline, or another recording's where it was recorded elsewhere.
  "probe/accept-6-3-5-on": (id) =>
    timeline(id, after(CODE_LEAVES["6-3-5"]!), "navi", [
      ...digitsAt(3, "12345"),
      [8, "navi"],
      [9, "down"],
      [10, "navi"],
    ]),
  "probe/accept-6-3-5-off": (id) =>
    timeline(id, after(`${securityOn("12345")} ${CODE_LEAVES["6-3-5"]}`), "navi", [
      ...digitsAt(2, "12345"),
      [7, "navi"],
      [8, "down"],
      [9, "navi"],
    ]),
  // Code error plays probe/code-wrong-6-4's timeline (2904 ms; here 2911 ms).
  "probe/accept-6-3-6-1-mismatch": (id) =>
    timeline(id, after(CODE_LEAVES["6-3-6-1"]!), "navi", [
      ...digitsAt(2, "12345"),
      [7, "navi"],
      ...digitsAt(8, "11111"),
      [13, "navi"],
      ...digitsAt(14, "22222"),
      [19, "navi"],
    ]),
  // New codes of 4, 6, 0 and 10 digits; Code error as above (2910-2918 ms here).
  "probe/accept-6-3-6-1-lengths": (id) =>
    timeline(id, after(ENTER_NEW), "1", [
      ...digitsAt(2, "234"),
      [5, "navi"],
      ...digitsAt(7, "123456"),
      [13, "navi"],
      [15, "navi"],
      ...digitsAt(17, "1234567890"),
      [27, "navi"],
    ]),
  "probe/accept-6-3-6-1-match": (id) =>
    timeline(id, after(ENTER_NEW), "1", [
      ...digitsAt(2, "1111"),
      [6, "navi"],
      ...digitsAt(7, "11111"),
      [12, "navi"],
    ]),
  // Code error as above (2919 ms here).
  "probe/accept-6-4-old-code": (id) =>
    timeline(id, after(`${CODE_11111} ${CODE_LEAVES["6-4"]}`), "navi", [
      ...digitsAt(2, "12345"),
      [7, "navi"],
    ]),
  // Settings restored plays probe/accept-c7-restore's timeline (18 ms off this recording's).
  "probe/accept-6-4-new-code": (id) =>
    timeline(id, after(`${CODE_11111} ${RESTORE_PROMPT}`), "1", [
      ...digitsAt(2, "1111"),
      [6, "navi"],
    ]),
  // As above (15 ms off).
  "probe/accept-6-4-restore": (id) =>
    timeline(id, after(CODE_LEAVES["6-4"]!), "navi", [...digitsAt(2, "12345"), [7, "navi"]]),
  "probe/accept-c7-restore": (id) =>
    timeline(id, after(`${CODE_11111} ${securityOn("11111")} ${CODE_LEAVES["6-4"]}`), "navi", [
      ...digitsAt(2, "11111"),
      [7, "navi"],
    ]),
  "probe/accept-4-5-5": (id) =>
    timeline(id, after(CODE_LEAVES["4-5-5"]!), "navi", [...digitsAt(2, "12345"), [7, "navi"]]),
  // Phone security On (code 11111), then Restore factory settings: the page reads Off.
  "probe/accept-restore-phone-security": (id) =>
    stills(id, standbyRig(), [
      `${CODE_11111} ${securityOn("11111")} ${CODE_LEAVES["6-3-5"]}`,
      `${STANDBY} ${CODE_LEAVES["6-4"]} navi 1*5 navi wait:3000 ${STANDBY} ${CODE_LEAVES["6-3-5"]}`,
    ]),
  ...Object.fromEntries(
    Object.keys(CODE_LEAVES).map((number) => [
      `probe/code-wrong-${number}`,
      (id: string) => codeWrong(id, number),
    ]),
  ),
  // A5: Restore's prompt after each key (`v639-plan15.cap`); the sub-recordings are timelines.
  "probe/code-keys-6-4": (id) =>
    stills(id, standbyRig(), [
      CODE_LEAVES["6-4"]!,
      "navi wait:2000",
      "1 2",
      "c",
      "c",
      "c wait:3000",
      "navi wait:2000",
      "navi wait:4000 1 2 3",
      "navi wait:5000",
      "1 2 3 4 5",
      "6",
      "7",
      "8",
      "9",
      "0",
      "1",
      "c~1000",
    ]),
  "probe/code-keys-6-4-c-on-empty": (id) => timeline(id, after(RESTORE_PROMPT), "c"),
  "probe/code-keys-6-4-ok-empty": (id) => timeline(id, after(RESTORE_PROMPT), "navi"),
  "probe/code-keys-6-4-ok-123": (id) => timeline(id, after(`${RESTORE_PROMPT} 1 2 3`), "navi"),
};

// ---------------------------------------------------------------- plan 15 boot gates (Task 8)

/** The kernel's long press: power turns the phone on this long after the key goes down. */
const POWER_LONG_PRESS_MS = 800;

/**
 * A boot golden from the power key (trigger frame 0), with `later` keys on the ticks their
 * golden rows start. Its self-test replays boot/power-on's recording, whose first frame (power
 * key to the first draw, 268 ms) these recordings show as 245-270 ms, and whose steps the
 * gate-free welcome note's recording shows 8 ms longer; the gate's notes replay
 * boot/security-gate's and boot/welcome-note's.
 */
function bootTimeline(id: string, storage: StockStorage, later: readonly Later[] = []): Rig {
  const golden = loadGolden(id);
  const rows = golden.timeline!;
  const rig = stockRig({ storage });
  rig.advance(100);
  rig.hold("power");
  rig.advance(POWER_LONG_PRESS_MS - 2);
  const last = rows[rows.length - 1]!;
  const span = last.startMs + last.durationMs - rows[0]!.startMs + 100;
  const schedule = later.map(([row, key]) => {
    if (typeof row !== "number") throw new Error(`${id}: boot keys go on golden rows`);
    return { atMs: rows[row]!.startMs - rows[0]!.startMs, run: () => rig.press(key) };
  });
  const recording = rig.record(
    span,
    () => {
      rig.advance(1);
      rig.release("power");
    },
    schedule,
  );
  expectTimeline(recording, golden, `${id}: power on, then ${later.map((l) => l[1]).join(" ")}`);
  return rig;
}

/** A phone at the power-on prompt (Phone security On, no recent SIM), as `run 8s` leaves it. */
function atGatePrompt(): Rig {
  const rig = stockRig({ storage: seededStorage() });
  rig.press("power", 1000);
  rig.advance(SELF_TEST_MS + GATE_BLANK_MS + 3000);
  return rig;
}

/** Entries at the power-on prompt from golden row `from`: one digit per row, then OK. */
function entriesAt(from: number, codes: readonly string[]): Later[] {
  return codes.flatMap((code, k) => {
    const start = from + k * (code.length + 2);
    return [...digitsAt(start, code), [start + code.length, "navi"] as const];
  });
}

const STANDBY_IMAGE = () => goldenImage("standby/standby", "01-standby");

const BOOT_SCENARIOS: Record<string, Scenario> = {
  // A1: 00000 OK (Code error, 2889 ms), then 12345 OK: Code accepted, the hands, standby.
  "boot/security-gate": (id) => {
    const rig = bootTimeline(id, seededStorage(), [
      ...entriesAt(6, ["00000"]),
      ...entriesAt(13, ["12345"]),
    ]);
    expectLcd(rig.paint(), STANDBY_IMAGE(), `${id}: after the hands`);
  },
  // A6: 12345 OK: Code accepted, then the note instead of the hands, then standby.
  "boot/welcome-note": (id) => {
    const rig = bootTimeline(id, seededStorage({ welcomeNote: "Hi" }), entriesAt(6, ["12345"]));
    expectLcd(rig.paint(), STANDBY_IMAGE(), `${id}: after the note`);
  },
  "boot/welcome-note-long": (id) => {
    const storage = seededStorage({ welcomeNote: "Welcome to my phone" });
    const rig = bootTimeline(id, storage, entriesAt(6, ["12345"]));
    expectLcd(rig.paint(), STANDBY_IMAGE(), `${id}: after the note`);
  },
  // 0c: after Restore (no gate), the note follows the self-test.
  "boot/welcome-note-ungated": (id) => {
    const rig = bootTimeline(id, seededStorage({ phoneSecurity: false, welcomeNote: "Hi" }));
    expectLcd(rig.paint(), STANDBY_IMAGE(), `${id}: after the note`);
  },
  // A2: the prompt after each key (`v639-plan15.cap`).
  "boot/security-gate-keys": (id) =>
    stills(id, atGatePrompt(), [
      "",
      "1",
      "2",
      "c",
      "c",
      "c",
      "wait:2000",
      "1 2 3 4 5",
      "6",
      "7",
      "8",
      "9",
      "0",
      "1",
      "c~1000",
      "1 2 3",
    ]),
  // Code error plays boot/security-gate's timeline (2889 ms; here 2904 and 2909 ms).
  "boot/security-gate-ok-123": (id) => {
    const rig = atGatePrompt();
    keys(rig, "1 2 3");
    timeline(id, rig, "navi", []);
  },
  "boot/security-gate-ok-empty": (id) => timeline(id, atGatePrompt(), "navi", []),
  // A3: six 00000 then 12345; the fifth wrong code locks every entry. Code error as above
  // (2890-2907 ms here).
  "boot/security-lockout": (id) => {
    const [first, ...later] = entriesAt(1, [...Array(6).fill("00000"), "12345"]);
    timeline(id, atGatePrompt(), first![1], later);
  },
  // Four 00000 then 12345: accepted, the hands. Code error as above (2890-2904 ms here).
  "boot/security-lockout-4": (id) => {
    const [first, ...later] = entriesAt(1, [...Array(4).fill("00000"), "12345"]);
    timeline(id, atGatePrompt(), first![1], later);
  },
};

acceptancePlan({
  plan: "15",
  scenarios: { ...PROBE_SCENARIOS, ...BOOT_SCENARIOS },
});
