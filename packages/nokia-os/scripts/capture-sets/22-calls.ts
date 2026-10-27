// Plan 22's goldens (docs/plans/22-call-register-divert-and-dialling.md "Golden pipeline additions";
// paths under plan22/): number entry, calls and the call register. Stills replay CALL_CASES (Task
// 0's cases.json, transcribed with the setup each case's section played before it); timelines are
// the recordings of CALL_RECORDINGS; sounds are CALL_SOUNDS. Hold, New call and Send DTMF in a call,
// the `p`/`w` DTMF after a connect and service strings are plan 22b's; Save and the phone book from
// a call are plan 19's.
//
// Pure: imports only sibling scripts, reads captures through the injected io.
import type { CaptureIo, CaptureSetEntry, PlanCaptureSet, ShotFile } from "../capture-set.ts";
import type { GoldenStatus, TriggerFrame } from "../golden-format.ts";
import {
  buildSoundGolden,
  type SoundCaptureEntry,
  type SoundCaptureIo,
} from "../sound-capture-set.ts";
import type { SoundGolden } from "../sound-format.ts";
import { resources } from "../resource-inputs/22-calls.ts";

const P = "plan22";
const ASSERTED: GoldenStatus = "asserted";
/** Plan 22b: services, held calls and the DTMF a call sends after `p`/`w`. */
const SERVICES: GoldenStatus = "pending:22b";
/**
 * The phone book's screens from number entry and calls (Save's `Name:`, ▼ on the code pages,
 * Phone book in a call): plan 19 landed after plan 22, and wiring its flows into these screens is
 * this plan's follow-up (as plan 19's `Call` from a name is `pending:22`).
 */
const PHONE_BOOK: GoldenStatus = "pending:22";

/**
 * A golden's status: its own (22b's, this plan's follow-up), else asserted: every plan 22 golden is driven by
 * tests/acceptance/22-call-register-divert-and-dialling.test.ts (Task 10).
 */
function statusOf(own?: GoldenStatus): GoldenStatus {
  return own ?? ASSERTED;
}

/**
 * One still: harness tokens from a settled standby (`gen_v639_plan22.py` `play`): a key is a tap
 * (≈42 ms down, 250 ms settle, 300 ms gap), `c@1500` holds C 1500 ms (then 250 ms), `+500` waits,
 * `!callin:<n>` / `!hangup` / `!answer` are the network's. `setup` was played first in the same
 * section (outside the case's fork); the shot follows the last key.
 */
export interface CallCase {
  /** `<directory>/<image>` under plan22/. */
  readonly name: string;
  readonly keys: string;
  readonly setup?: string;
  /** The image the case was captured on: factory (plan 15's restored image) or virgin. */
  readonly state?: "factory";
  /** A golden image name where the file stem is not one. */
  readonly image?: string;
}

/** Task 0's `plan22/cases.json`, in capture order (durations: DURATION_CASES). */
export const CALL_CASES: readonly CallCase[] = [
  { name: "entry/length/01", keys: "* * +1700" },
  { name: "entry/length/02", keys: "* * +1700 1" },
  { name: "entry/length/03", keys: "* * +1700 1 2" },
  { name: "entry/length/04", keys: "* * +1700 1 2 3" },
  { name: "entry/length/05", keys: "* * +1700 1 2 3 4" },
  { name: "entry/length/06", keys: "* * +1700 1 2 3 4 * * * +1700" },
  { name: "entry/length/07", keys: "* * +1700 1 2 3 4 * * * +1700 5" },
  { name: "entry/length/08", keys: "* * +1700 1 2 3 4 * * * +1700 5 * * * * +1700" },
  { name: "entry/length/09", keys: "* * +1700 1 2 3 4 * * * +1700 5 * * * * +1700 6" },
  { name: "entry/length/10", keys: "* * +1700 1 2 3 4 * * * +1700 5 * * * * +1700 6 * +1700" },
  { name: "entry/length/11", keys: "* * +1700 1 2 3 4 * * * +1700 5 * * * * +1700 6 * +1700 7" },
  { name: "entry/length/12", keys: "* * +1700 1 2 3 4 * * * +1700 5 * * * * +1700 6 * +1700 7 #" },
  {
    name: "entry/length/13",
    keys: "* * +1700 1 2 3 4 * * * +1700 5 * * * * +1700 6 * +1700 7 # 8",
  },
  {
    name: "entry/length/14",
    keys: "* * +1700 1 2 3 4 * * * +1700 5 * * * * +1700 6 * +1700 7 # 8 9",
  },
  {
    name: "entry/length/15",
    keys: "* * +1700 1 2 3 4 * * * +1700 5 * * * * +1700 6 * +1700 7 # 8 9 0",
  },
  {
    name: "entry/length/16",
    keys: "* * +1700 1 2 3 4 * * * +1700 5 * * * * +1700 6 * +1700 7 # 8 9 0 1",
  },
  {
    name: "entry/length/17",
    keys: "* * +1700 1 2 3 4 * * * +1700 5 * * * * +1700 6 * +1700 7 # 8 9 0 1 2",
  },
  {
    name: "entry/length/18",
    keys: "* * +1700 1 2 3 4 * * * +1700 5 * * * * +1700 6 * +1700 7 # 8 9 0 1 2 3",
  },
  {
    name: "entry/length/19",
    keys: "* * +1700 1 2 3 4 * * * +1700 5 * * * * +1700 6 * +1700 7 # 8 9 0 1 2 3 4",
  },
  {
    name: "entry/length/20",
    keys: "* * +1700 1 2 3 4 * * * +1700 5 * * * * +1700 6 * +1700 7 # 8 9 0 1 2 3 4 5",
  },
  {
    name: "entry/length/21",
    keys: "* * +1700 1 2 3 4 * * * +1700 5 * * * * +1700 6 * +1700 7 # 8 9 0 1 2 3 4 5 6",
  },
  {
    name: "entry/length/22",
    keys: "* * +1700 1 2 3 4 * * * +1700 5 * * * * +1700 6 * +1700 7 # 8 9 0 1 2 3 4 5 6 7",
  },
  {
    name: "entry/length/23",
    keys: "* * +1700 1 2 3 4 * * * +1700 5 * * * * +1700 6 * +1700 7 # 8 9 0 1 2 3 4 5 6 7 8",
  },
  {
    name: "entry/length/24",
    keys: "* * +1700 1 2 3 4 * * * +1700 5 * * * * +1700 6 * +1700 7 # 8 9 0 1 2 3 4 5 6 7 8 9",
  },
  {
    name: "entry/length/25",
    keys: "* * +1700 1 2 3 4 * * * +1700 5 * * * * +1700 6 * +1700 7 # 8 9 0 1 2 3 4 5 6 7 8 9 0",
  },
  {
    name: "entry/length/26",
    keys: "* * +1700 1 2 3 4 * * * +1700 5 * * * * +1700 6 * +1700 7 # 8 9 0 1 2 3 4 5 6 7 8 9 0 1",
  },
  {
    name: "entry/length/27",
    keys: "* * +1700 1 2 3 4 * * * +1700 5 * * * * +1700 6 * +1700 7 # 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2",
  },
  {
    name: "entry/length/28",
    keys: "* * +1700 1 2 3 4 * * * +1700 5 * * * * +1700 6 * +1700 7 # 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3",
  },
  {
    name: "entry/length/29",
    keys: "* * +1700 1 2 3 4 * * * +1700 5 * * * * +1700 6 * +1700 7 # 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4",
  },
  {
    name: "entry/length/30",
    keys: "* * +1700 1 2 3 4 * * * +1700 5 * * * * +1700 6 * +1700 7 # 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5",
  },
  {
    name: "entry/length/31",
    keys: "* * +1700 1 2 3 4 * * * +1700 5 * * * * +1700 6 * +1700 7 # 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6",
  },
  {
    name: "entry/length/32",
    keys: "* * +1700 1 2 3 4 * * * +1700 5 * * * * +1700 6 * +1700 7 # 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7",
  },
  {
    name: "entry/length/33",
    keys: "* * +1700 1 2 3 4 * * * +1700 5 * * * * +1700 6 * +1700 7 # 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 * * +1700",
  },
  {
    name: "entry/length/34",
    keys: "* * +1700 1 2 3 4 * * * +1700 5 * * * * +1700 6 * +1700 7 # 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 * * +1700 0",
  },
  {
    name: "entry/length/35",
    keys: "* * +1700 1 2 3 4 * * * +1700 5 * * * * +1700 6 * +1700 7 # 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 * * +1700 0 * * * +1700",
  },
  {
    name: "entry/length/36",
    keys: "* * +1700 1 2 3 4 * * * +1700 5 * * * * +1700 6 * +1700 7 # 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 * * +1700 0 * * * +1700 9",
  },
  {
    name: "entry/length/37",
    keys: "* * +1700 1 2 3 4 * * * +1700 5 * * * * +1700 6 * +1700 7 # 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 * * +1700 0 * * * +1700 9 * * * * +1700",
  },
  {
    name: "entry/length/38",
    keys: "* * +1700 1 2 3 4 * * * +1700 5 * * * * +1700 6 * +1700 7 # 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 * * +1700 0 * * * +1700 9 * * * * +1700 8",
  },
  {
    name: "entry/length/39",
    keys: "* * +1700 1 2 3 4 * * * +1700 5 * * * * +1700 6 * +1700 7 # 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 * * +1700 0 * * * +1700 9 * * * * +1700 8 * +1700",
  },
  {
    name: "entry/length/40",
    keys: "* * +1700 1 2 3 4 * * * +1700 5 * * * * +1700 6 * +1700 7 # 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 * * +1700 0 * * * +1700 9 * * * * +1700 8 * +1700 7",
  },
  {
    name: "entry/length/41",
    keys: "* * +1700 1 2 3 4 * * * +1700 5 * * * * +1700 6 * +1700 7 # 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 * * +1700 0 * * * +1700 9 * * * * +1700 8 * +1700 7 #",
  },
  {
    name: "entry/length/42",
    keys: "* * +1700 1 2 3 4 * * * +1700 5 * * * * +1700 6 * +1700 7 # 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 * * +1700 0 * * * +1700 9 * * * * +1700 8 * +1700 7 # 6",
  },
  {
    name: "entry/length/43",
    keys: "* * +1700 1 2 3 4 * * * +1700 5 * * * * +1700 6 * +1700 7 # 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 * * +1700 0 * * * +1700 9 * * * * +1700 8 * +1700 7 # 6 5",
  },
  {
    name: "entry/length/44",
    keys: "* * +1700 1 2 3 4 * * * +1700 5 * * * * +1700 6 * +1700 7 # 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 * * +1700 0 * * * +1700 9 * * * * +1700 8 * +1700 7 # 6 5 4",
  },
  {
    name: "entry/length/45",
    keys: "* * +1700 1 2 3 4 * * * +1700 5 * * * * +1700 6 * +1700 7 # 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 * * +1700 0 * * * +1700 9 * * * * +1700 8 * +1700 7 # 6 5 4 3",
  },
  {
    name: "entry/length/46",
    keys: "* * +1700 1 2 3 4 * * * +1700 5 * * * * +1700 6 * +1700 7 # 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 * * +1700 0 * * * +1700 9 * * * * +1700 8 * +1700 7 # 6 5 4 3 2",
  },
  {
    name: "entry/length/47",
    keys: "* * +1700 1 2 3 4 * * * +1700 5 * * * * +1700 6 * +1700 7 # 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 * * +1700 0 * * * +1700 9 * * * * +1700 8 * +1700 7 # 6 5 4 3 2 1",
  },
  { name: "entry/star/01", keys: "*" },
  { name: "entry/star/02", keys: "* *" },
  { name: "entry/star/03", keys: "* * *" },
  { name: "entry/star/04", keys: "* * * *" },
  { name: "entry/star/05", keys: "* * * * *" },
  { name: "entry/star-after-digit/01", keys: "1 *" },
  { name: "entry/star-after-digit/02", keys: "1 * *" },
  { name: "entry/star-after-digit/03", keys: "1 * * *" },
  { name: "entry/star-after-digit/04", keys: "1 * * * *" },
  { name: "entry/star-after-digit/05", keys: "1 * * * * *" },
  { name: "entry/hash/01", keys: "#" },
  { name: "entry/hash/02", keys: "# #" },
  { name: "entry/hash/03", keys: "# # #" },
  { name: "entry/star-then-digit", keys: "* * 5" },
  { name: "entry/star-commit-then-star", keys: "* +1700 *" },
  {
    name: "entry/limit/60",
    keys: "1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0",
  },
  {
    name: "entry/limit/61",
    keys: "1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 7",
  },
  {
    name: "entry/limit/70",
    keys: "1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 7 8 9 1 2 3 4 5 6 7",
  },
  {
    name: "entry/limit/70-c10",
    keys: "1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 7 8 9 1 2 3 4 5 6 7 c c c c c c c c c c",
  },
  {
    name: "entry/limit/70-c27",
    keys: "1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 7 8 9 1 2 3 4 5 6 7 c c c c c c c c c c c c c c c c c c c c c c c c c c c",
  },
  { name: "entry/c/01", keys: "1 2 3 4 5 c" },
  { name: "entry/c/02", keys: "1 2 3 4 5 c c" },
  { name: "entry/c/03", keys: "1 2 3 4 5 c c c" },
  { name: "entry/c/04", keys: "1 2 3 4 5 c c c c" },
  { name: "entry/softkey-down/01", keys: "1 2 3 4 5 down" },
  { name: "entry/softkey-down/02", keys: "1 2 3 4 5 down down" },
  { name: "entry/softkey-down/03", keys: "1 2 3 4 5 down down down" },
  { name: "entry/softkey-down/04", keys: "1 2 3 4 5 down down down down" },
  { name: "entry/softkey-up/01", keys: "1 2 3 4 5 up" },
  { name: "entry/softkey-up/02", keys: "1 2 3 4 5 up up" },
  { name: "entry/softkey-up/03", keys: "1 2 3 4 5 up up up" },
  { name: "entry/softkey-up/04", keys: "1 2 3 4 5 up up up up" },
  { name: "entry/softkey-save-digit", keys: "1 2 3 4 5 down 6" },
  { name: "entry/softkey-save-c", keys: "1 2 3 4 5 down c" },
  { name: "entry/softkey-convert-digit", keys: "1 2 3 4 5 down down 6" },
  { name: "entry/softkey-convert-c", keys: "1 2 3 4 5 down down c" },
  { name: "entry/save", keys: "1 2 3 4 5 down menu +1500" },
  { name: "entry/save-typed", keys: "1 2 3 4 5 down menu +1500 2 2 +1500" },
  { name: "entry/convert", keys: "1 2 3 4 5 down down menu +500" },
  { name: "entry/convert-after", keys: "1 2 3 4 5 down down menu +4000" },
  { name: "entry/convert-c", keys: "1 2 3 4 5 down down menu +500 c +500" },
  { name: "entry/power", keys: "1 2 3 4 5 pwr +500" },
  { name: "entry/power-c", keys: "1 2 3 4 5 pwr +500 c +500" },
  { name: "code/imei-after", keys: "* +1700 # 0 6 # +1500" },
  { name: "code/imei-down", keys: "* +1700 # 0 6 # +1500 down +500" },
  { name: "code/imei-c", keys: "* +1700 # 0 6 # +1500 c +1000" },
  { name: "code/version-after", keys: "* +1700 # 0 0 0 0 # +1500" },
  { name: "code/version-down", keys: "* +1700 # 0 0 0 0 # +1500 down +500" },
  { name: "code/version-c", keys: "* +1700 # 0 0 0 0 # +1500 c +1000" },
  {
    name: "in-call/options-all/01",
    keys: "0 4 1 2 3 4 5 6 7 8 menu +5000 c +1000 menu +1500 down",
  },
  {
    name: "in-call/options-all/02",
    keys: "0 4 1 2 3 4 5 6 7 8 menu +5000 c +1000 menu +1500 down down",
  },
  {
    name: "in-call/options-all/03",
    keys: "0 4 1 2 3 4 5 6 7 8 menu +5000 c +1000 menu +1500 down down down",
  },
  {
    name: "in-call/options-all/04",
    keys: "0 4 1 2 3 4 5 6 7 8 menu +5000 c +1000 menu +1500 down down down down",
  },
  {
    name: "in-call/options-all/05",
    keys: "0 4 1 2 3 4 5 6 7 8 menu +5000 c +1000 menu +1500 down down down down down",
  },
  {
    name: "in-call/options-all/06",
    keys: "0 4 1 2 3 4 5 6 7 8 menu +5000 c +1000 menu +1500 down down down down down down",
  },
  {
    name: "in-call/options-all/07",
    keys: "0 4 1 2 3 4 5 6 7 8 menu +5000 c +1000 menu +1500 down down down down down down down",
  },
  {
    name: "in-call/options-all/08",
    keys: "0 4 1 2 3 4 5 6 7 8 menu +5000 c +1000 menu +1500 down down down down down down down down",
  },
  {
    name: "in-call/options-all/09",
    keys: "0 4 1 2 3 4 5 6 7 8 menu +5000 c +1000 menu +1500 down down down down down down down down down",
  },
  {
    name: "in-call/options-all/10",
    keys: "0 4 1 2 3 4 5 6 7 8 menu +5000 c +1000 menu +1500 down down down down down down down down down down",
  },
  { name: "ring/notice-1", keys: "!callin:0412345678 +3000 !hangup +4000" },
  {
    name: "ring/notice-2",
    keys: "!callin:0412345678 +3000 !hangup +4000 !callin:0412345678 +3000 !hangup +4000",
  },
  {
    name: "ring/notice-11",
    keys: "!callin:0400000000 +3000 !hangup +4000 !callin:0400000001 +3000 !hangup +4000 !callin:0400000002 +3000 !hangup +4000 !callin:0400000003 +3000 !hangup +4000 !callin:0400000004 +3000 !hangup +4000 !callin:0400000005 +3000 !hangup +4000 !callin:0400000006 +3000 !hangup +4000 !callin:0400000007 +3000 !hangup +4000 !callin:0400000008 +3000 !hangup +4000 !callin:0400000009 +3000 !hangup +4000 !callin:0400000010 +3000 !hangup +4000",
  },
  {
    name: "ring/missed-list-11",
    keys: "!callin:0400000000 +3000 !hangup +4000 !callin:0400000001 +3000 !hangup +4000 !callin:0400000002 +3000 !hangup +4000 !callin:0400000003 +3000 !hangup +4000 !callin:0400000004 +3000 !hangup +4000 !callin:0400000005 +3000 !hangup +4000 !callin:0400000006 +3000 !hangup +4000 !callin:0400000007 +3000 !hangup +4000 !callin:0400000008 +3000 !hangup +4000 !callin:0400000009 +3000 !hangup +4000 !callin:0400000010 +3000 !hangup +4000 menu +4500",
  },
  {
    name: "register/standby-up-list/01",
    keys: "up +1000 down",
    setup:
      "0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500 0 4 2 2 2 2 2 2 2 2 menu +7000 menu +2500 0 4 3 3 3 3 3 3 3 3 menu +7000 menu +2500",
  },
  {
    name: "register/standby-up-list/02",
    keys: "up +1000 down down",
    setup:
      "0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500 0 4 2 2 2 2 2 2 2 2 menu +7000 menu +2500 0 4 3 3 3 3 3 3 3 3 menu +7000 menu +2500",
  },
  {
    name: "register/standby-up-list/03",
    keys: "up +1000 down down down",
    setup:
      "0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500 0 4 2 2 2 2 2 2 2 2 menu +7000 menu +2500 0 4 3 3 3 3 3 3 3 3 menu +7000 menu +2500",
  },
  {
    name: "register/standby-up-list/04",
    keys: "up +1000 down down down up",
    setup:
      "0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500 0 4 2 2 2 2 2 2 2 2 menu +7000 menu +2500 0 4 3 3 3 3 3 3 3 3 menu +7000 menu +2500",
  },
  {
    name: "register/dialled/01",
    keys: "menu +300 down down down +800 menu +1500 down down +600 menu +1500 down",
    setup:
      "0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500 0 4 2 2 2 2 2 2 2 2 menu +7000 menu +2500 0 4 3 3 3 3 3 3 3 3 menu +7000 menu +2500",
  },
  {
    name: "register/dialled/02",
    keys: "menu +300 down down down +800 menu +1500 down down +600 menu +1500 down down",
    setup:
      "0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500 0 4 2 2 2 2 2 2 2 2 menu +7000 menu +2500 0 4 3 3 3 3 3 3 3 3 menu +7000 menu +2500",
  },
  {
    name: "register/dialled/03",
    keys: "menu +300 down down down +800 menu +1500 down down +600 menu +1500 down down down",
    setup:
      "0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500 0 4 2 2 2 2 2 2 2 2 menu +7000 menu +2500 0 4 3 3 3 3 3 3 3 3 menu +7000 menu +2500",
  },
  {
    name: "register/dialled-options/01",
    keys: "menu +300 down down down +800 menu +1500 down down +600 menu +1500 menu +1500 down",
    setup:
      "0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500 0 4 2 2 2 2 2 2 2 2 menu +7000 menu +2500 0 4 3 3 3 3 3 3 3 3 menu +7000 menu +2500",
  },
  {
    name: "register/dialled-options/02",
    keys: "menu +300 down down down +800 menu +1500 down down +600 menu +1500 menu +1500 down down",
    setup:
      "0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500 0 4 2 2 2 2 2 2 2 2 menu +7000 menu +2500 0 4 3 3 3 3 3 3 3 3 menu +7000 menu +2500",
  },
  {
    name: "register/dialled-options/03",
    keys: "menu +300 down down down +800 menu +1500 down down +600 menu +1500 menu +1500 down down down",
    setup:
      "0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500 0 4 2 2 2 2 2 2 2 2 menu +7000 menu +2500 0 4 3 3 3 3 3 3 3 3 menu +7000 menu +2500",
  },
  {
    name: "register/dialled-options/04",
    keys: "menu +300 down down down +800 menu +1500 down down +600 menu +1500 menu +1500 down down down down",
    setup:
      "0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500 0 4 2 2 2 2 2 2 2 2 menu +7000 menu +2500 0 4 3 3 3 3 3 3 3 3 menu +7000 menu +2500",
  },
  {
    name: "register/dialled-options/05",
    keys: "menu +300 down down down +800 menu +1500 down down +600 menu +1500 menu +1500 down down down down down",
    setup:
      "0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500 0 4 2 2 2 2 2 2 2 2 menu +7000 menu +2500 0 4 3 3 3 3 3 3 3 3 menu +7000 menu +2500",
  },
  {
    name: "register/dialled-options/06",
    keys: "menu +300 down down down +800 menu +1500 down down +600 menu +1500 menu +1500 down down down down down down",
    setup:
      "0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500 0 4 2 2 2 2 2 2 2 2 menu +7000 menu +2500 0 4 3 3 3 3 3 3 3 3 menu +7000 menu +2500",
  },
  {
    name: "register/time-of-call-back",
    keys: "menu +300 down down down +800 menu +1500 down down +600 menu +1500 menu +1500 down down menu +1500 menu +1500",
    setup:
      "0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500 0 4 2 2 2 2 2 2 2 2 menu +7000 menu +2500 0 4 3 3 3 3 3 3 3 3 menu +7000 menu +2500",
  },
  {
    name: "register/redialled/01",
    keys: "menu +300 down down down +800 menu +1500 down down +600 menu +1500 down",
    setup:
      "0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500 0 4 2 2 2 2 2 2 2 2 menu +7000 menu +2500 0 4 3 3 3 3 3 3 3 3 menu +7000 menu +2500 0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500",
  },
  {
    name: "register/redialled/02",
    keys: "menu +300 down down down +800 menu +1500 down down +600 menu +1500 down down",
    setup:
      "0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500 0 4 2 2 2 2 2 2 2 2 menu +7000 menu +2500 0 4 3 3 3 3 3 3 3 3 menu +7000 menu +2500 0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500",
  },
  {
    name: "register/redialled/03",
    keys: "menu +300 down down down +800 menu +1500 down down +600 menu +1500 down down down",
    setup:
      "0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500 0 4 2 2 2 2 2 2 2 2 menu +7000 menu +2500 0 4 3 3 3 3 3 3 3 3 menu +7000 menu +2500 0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500",
  },
  {
    name: "register/time-of-call-12h",
    keys: "menu +300 down down down +800 menu +1500 down down +600 menu +1500 menu +1500 down down menu +1500",
    setup:
      "menu 1 1 2 3 +3000 down +800 menu +4000 c@1500 +1000 0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500",
  },
  {
    name: "register/missed/01",
    keys: "menu +300 down down down +800 menu +1500 menu +4000 down",
    setup:
      "!callin:0444444444 +3000 !hangup +3500 c +500 !callin:0455555555 +3000 !hangup +3500 c +500",
  },
  {
    name: "register/missed/02",
    keys: "menu +300 down down down +800 menu +1500 menu +4000 down down",
    setup:
      "!callin:0444444444 +3000 !hangup +3500 c +500 !callin:0455555555 +3000 !hangup +3500 c +500",
  },
  {
    name: "register/received/01",
    keys: "menu +300 down down down +800 menu +1500 down menu +1500 down",
    setup: "!callin:0466666666 +3000 menu +4500 menu +2500 !callin:0477777777 +3000 c +2000",
  },
  {
    name: "register/received/02",
    keys: "menu +300 down down down +800 menu +1500 down menu +1500 down down",
    setup: "!callin:0466666666 +3000 menu +4500 menu +2500 !callin:0477777777 +3000 c +2000",
  },
  {
    name: "register/dialled-21/01",
    keys: "menu +300 down down down +800 menu +1500 down down +600 menu +1500 up",
    setup:
      "0 4 0 0 0 0 0 0 0 0 menu +3000 menu +2500 0 4 0 0 0 0 0 0 0 1 menu +3000 menu +2500 0 4 0 0 0 0 0 0 0 2 menu +3000 menu +2500 0 4 0 0 0 0 0 0 0 3 menu +3000 menu +2500 0 4 0 0 0 0 0 0 0 4 menu +3000 menu +2500 0 4 0 0 0 0 0 0 0 5 menu +3000 menu +2500 0 4 0 0 0 0 0 0 0 6 menu +3000 menu +2500 0 4 0 0 0 0 0 0 0 7 menu +3000 menu +2500 0 4 0 0 0 0 0 0 0 8 menu +3000 menu +2500 0 4 0 0 0 0 0 0 0 9 menu +3000 menu +2500 0 4 0 0 0 0 0 0 1 0 menu +3000 menu +2500 0 4 0 0 0 0 0 0 1 1 menu +3000 menu +2500 0 4 0 0 0 0 0 0 1 2 menu +3000 menu +2500 0 4 0 0 0 0 0 0 1 3 menu +3000 menu +2500 0 4 0 0 0 0 0 0 1 4 menu +3000 menu +2500 0 4 0 0 0 0 0 0 1 5 menu +3000 menu +2500 0 4 0 0 0 0 0 0 1 6 menu +3000 menu +2500 0 4 0 0 0 0 0 0 1 7 menu +3000 menu +2500 0 4 0 0 0 0 0 0 1 8 menu +3000 menu +2500 0 4 0 0 0 0 0 0 1 9 menu +3000 menu +2500 0 4 0 0 0 0 0 0 2 0 menu +3000 menu +2500",
  },
  {
    name: "register/dialled-21/02",
    keys: "menu +300 down down down +800 menu +1500 down down +600 menu +1500 up up",
    setup:
      "0 4 0 0 0 0 0 0 0 0 menu +3000 menu +2500 0 4 0 0 0 0 0 0 0 1 menu +3000 menu +2500 0 4 0 0 0 0 0 0 0 2 menu +3000 menu +2500 0 4 0 0 0 0 0 0 0 3 menu +3000 menu +2500 0 4 0 0 0 0 0 0 0 4 menu +3000 menu +2500 0 4 0 0 0 0 0 0 0 5 menu +3000 menu +2500 0 4 0 0 0 0 0 0 0 6 menu +3000 menu +2500 0 4 0 0 0 0 0 0 0 7 menu +3000 menu +2500 0 4 0 0 0 0 0 0 0 8 menu +3000 menu +2500 0 4 0 0 0 0 0 0 0 9 menu +3000 menu +2500 0 4 0 0 0 0 0 0 1 0 menu +3000 menu +2500 0 4 0 0 0 0 0 0 1 1 menu +3000 menu +2500 0 4 0 0 0 0 0 0 1 2 menu +3000 menu +2500 0 4 0 0 0 0 0 0 1 3 menu +3000 menu +2500 0 4 0 0 0 0 0 0 1 4 menu +3000 menu +2500 0 4 0 0 0 0 0 0 1 5 menu +3000 menu +2500 0 4 0 0 0 0 0 0 1 6 menu +3000 menu +2500 0 4 0 0 0 0 0 0 1 7 menu +3000 menu +2500 0 4 0 0 0 0 0 0 1 8 menu +3000 menu +2500 0 4 0 0 0 0 0 0 1 9 menu +3000 menu +2500 0 4 0 0 0 0 0 0 2 0 menu +3000 menu +2500",
  },
  {
    name: "register/dialled-21/03",
    keys: "menu +300 down down down +800 menu +1500 down down +600 menu +1500 up up down",
    setup:
      "0 4 0 0 0 0 0 0 0 0 menu +3000 menu +2500 0 4 0 0 0 0 0 0 0 1 menu +3000 menu +2500 0 4 0 0 0 0 0 0 0 2 menu +3000 menu +2500 0 4 0 0 0 0 0 0 0 3 menu +3000 menu +2500 0 4 0 0 0 0 0 0 0 4 menu +3000 menu +2500 0 4 0 0 0 0 0 0 0 5 menu +3000 menu +2500 0 4 0 0 0 0 0 0 0 6 menu +3000 menu +2500 0 4 0 0 0 0 0 0 0 7 menu +3000 menu +2500 0 4 0 0 0 0 0 0 0 8 menu +3000 menu +2500 0 4 0 0 0 0 0 0 0 9 menu +3000 menu +2500 0 4 0 0 0 0 0 0 1 0 menu +3000 menu +2500 0 4 0 0 0 0 0 0 1 1 menu +3000 menu +2500 0 4 0 0 0 0 0 0 1 2 menu +3000 menu +2500 0 4 0 0 0 0 0 0 1 3 menu +3000 menu +2500 0 4 0 0 0 0 0 0 1 4 menu +3000 menu +2500 0 4 0 0 0 0 0 0 1 5 menu +3000 menu +2500 0 4 0 0 0 0 0 0 1 6 menu +3000 menu +2500 0 4 0 0 0 0 0 0 1 7 menu +3000 menu +2500 0 4 0 0 0 0 0 0 1 8 menu +3000 menu +2500 0 4 0 0 0 0 0 0 1 9 menu +3000 menu +2500 0 4 0 0 0 0 0 0 2 0 menu +3000 menu +2500",
  },
  {
    name: "register/missed-12/01",
    keys: "menu +300 down down down +800 menu +1500 menu +4000 up",
    setup:
      "!callin:0410000000 +3000 !hangup +3500 c +500 !callin:0410000001 +3000 !hangup +3500 c +500 !callin:0410000002 +3000 !hangup +3500 c +500 !callin:0410000003 +3000 !hangup +3500 c +500 !callin:0410000004 +3000 !hangup +3500 c +500 !callin:0410000005 +3000 !hangup +3500 c +500 !callin:0410000006 +3000 !hangup +3500 c +500 !callin:0410000007 +3000 !hangup +3500 c +500 !callin:0410000008 +3000 !hangup +3500 c +500 !callin:0410000009 +3000 !hangup +3500 c +500 !callin:0410000010 +3000 !hangup +3500 c +500 !callin:0410000011 +3000 !hangup +3500 c +500",
  },
  {
    name: "register/missed-12/02",
    keys: "menu +300 down down down +800 menu +1500 menu +4000 up up",
    setup:
      "!callin:0410000000 +3000 !hangup +3500 c +500 !callin:0410000001 +3000 !hangup +3500 c +500 !callin:0410000002 +3000 !hangup +3500 c +500 !callin:0410000003 +3000 !hangup +3500 c +500 !callin:0410000004 +3000 !hangup +3500 c +500 !callin:0410000005 +3000 !hangup +3500 c +500 !callin:0410000006 +3000 !hangup +3500 c +500 !callin:0410000007 +3000 !hangup +3500 c +500 !callin:0410000008 +3000 !hangup +3500 c +500 !callin:0410000009 +3000 !hangup +3500 c +500 !callin:0410000010 +3000 !hangup +3500 c +500 !callin:0410000011 +3000 !hangup +3500 c +500",
  },
  {
    name: "register/erase-lists-all-missed",
    keys: "menu +300 down down down +800 menu +1500 menu +1000",
    setup:
      "!callin:0444444444 +3000 !hangup +3500 c +500 !callin:0466666666 +3000 menu +4500 menu +2500 0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500 menu +300 down down down +800 menu +1500 down down down +500 menu +1500 menu +4030 c@1500 +1000",
  },
  {
    name: "register/erase-lists-all-dialled",
    keys: "up +1000",
    setup:
      "!callin:0444444444 +3000 !hangup +3500 c +500 !callin:0466666666 +3000 menu +4500 menu +2500 0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500 menu +300 down down down +800 menu +1500 down down down +500 menu +1500 menu +4030 c@1500 +1000",
  },
  {
    name: "register/erase-lists-missed-missed",
    keys: "menu +300 down down down +800 menu +1500 menu +1000",
    setup:
      "!callin:0444444444 +3000 !hangup +3500 c +500 !callin:0466666666 +3000 menu +4500 menu +2500 0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500 menu +300 down down down +800 menu +1500 down down down +500 menu +1500 down menu +4030 c@1500 +1000",
  },
  {
    name: "register/erase-lists-missed-dialled",
    keys: "up +1000",
    setup:
      "!callin:0444444444 +3000 !hangup +3500 c +500 !callin:0466666666 +3000 menu +4500 menu +2500 0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500 menu +300 down down down +800 menu +1500 down down down +500 menu +1500 down menu +4030 c@1500 +1000",
  },
  {
    name: "register/erase-lists-dialled-missed",
    keys: "menu +300 down down down +800 menu +1500 menu +1000",
    setup:
      "!callin:0444444444 +3000 !hangup +3500 c +500 !callin:0466666666 +3000 menu +4500 menu +2500 0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500 menu +300 down down down +800 menu +1500 down down down +500 menu +1500 down down menu +4030 c@1500 +1000",
  },
  {
    name: "register/erase-lists-dialled-dialled",
    keys: "up +1000",
    setup:
      "!callin:0444444444 +3000 !hangup +3500 c +500 !callin:0466666666 +3000 menu +4500 menu +2500 0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500 menu +300 down down down +800 menu +1500 down down down +500 menu +1500 down down menu +4030 c@1500 +1000",
  },
  {
    name: "register/erase-lists-received-missed",
    keys: "menu +300 down down down +800 menu +1500 menu +1000",
    setup:
      "!callin:0444444444 +3000 !hangup +3500 c +500 !callin:0466666666 +3000 menu +4500 menu +2500 0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500 menu +300 down down down +800 menu +1500 down down down +500 menu +1500 down down down menu +4030 c@1500 +1000",
  },
  {
    name: "register/erase-lists-received-dialled",
    keys: "up +1000",
    setup:
      "!callin:0444444444 +3000 !hangup +3500 c +500 !callin:0466666666 +3000 menu +4500 menu +2500 0 4 1 1 1 1 1 1 1 1 menu +7000 menu +2500 menu +300 down down down +800 menu +1500 down down down +500 menu +1500 down down down menu +4030 c@1500 +1000",
  },
];

const NUMBER_KEYS = "0 4 1 2 3 4 5 6 7 8";
const CALL_REGISTER = "menu +300 down down down +800 menu +1500";
const DURATIONS = `${CALL_REGISTER} down down down down +500 menu +1500`;
const PAGES = ["", "down", "down", "down"] as const;

/** A setup's pages 1-4 of Show call duration (`seq`: each page one ▼ further). */
function durationPages(dir: string, setup: string | undefined): CallCase[] {
  return PAGES.map((_, i) => ({
    name: `durations/${dir}/${i + 1}`,
    keys: [DURATIONS, ...PAGES.slice(1, i + 1)].join(" "),
    ...(setup === undefined ? {} : { setup }),
    state: "factory" as const,
    image: `${dir}-${i + 1}`,
  }));
}

/** Calls of `menu`, `total` ms, End (the `durations-fit` section), then Last call duration. */
const FIT_TOTALS = [3400, 3900, 4400, 4900, 5400, 5900, 6400, 63400, 64400] as const;

const RECEIVED = "!callin:0466666666 +3000 menu +4500 menu +2500";

/** The factory duration pages (Task 0 X): played after their setup on the factory image. */
export const DURATION_CASES: readonly CallCase[] = [
  ...durationPages("empty", undefined),
  ...FIT_TOTALS.map(
    (total): CallCase => ({
      name: `durations/fit/after-${total}/1`,
      keys: DURATIONS,
      // The fit calls were recorded (`rec_keys`: a tap is 300 ms, not play's 592 ms): Call, then
      // End `total` ms after the tap's 300 ms.
      setup: `${NUMBER_KEYS} menu +${total - (592 - 300)} menu +3030`,
      state: "factory",
      image: `fit-${total}`,
    }),
  ),
  ...durationPages("after-received", RECEIVED),
  ...durationPages(
    "after-clear",
    `${RECEIVED} ${DURATIONS} down down down down menu +1500 1 2 3 4 5 menu +4030 c@1500 +1000`,
  ),
];

/** The fixture a case belongs to (one per directory, with the pending ones split out). */
export function stillFixtureOf(c: CallCase): { readonly id: string; readonly image: string } {
  const slash = c.name.lastIndexOf("/");
  const dir = c.name.slice(0, slash);
  const stem = c.name.slice(slash + 1);
  const image = c.image ?? stem;
  if (dir === "entry") {
    return { id: stem.startsWith("save") ? "calls/entry-save" : "calls/entry-keys", image };
  }
  if (dir === "code")
    return { id: stem.endsWith("-down") ? "calls/code-down" : "calls/code", image };
  if (dir === "ring") return { id: "calls/ring-notice", image };
  if (dir === "register") {
    return {
      id: stem.startsWith("erase-lists-") ? "calls/register-erase-lists" : "calls/register-keys",
      image,
    };
  }
  if (dir.startsWith("durations/")) return { id: "calls/durations", image };
  return { id: `calls/${dir.replace(/\//g, "-")}`, image };
}

interface StillFixture {
  readonly id: string;
  readonly note: string;
  readonly status?: GoldenStatus;
}

export const CALL_STILLS: readonly StillFixture[] = [
  {
    id: "calls/entry-length",
    note: "Standby number entry of 1-47 characters (`+1234p5w6*7#8901…`): both faces, every glyph.",
  },
  { id: "calls/entry-star", note: "`*` ×1…5 on an empty entry: the pending `*` `+` `p` `w` `*`." },
  { id: "calls/entry-star-after-digit", note: "`1`, then `*` ×1…5." },
  { id: "calls/entry-hash", note: "`#` ×1…3." },
  {
    id: "calls/entry-limit",
    note: "60 characters, a 61st, 70 (first in first out), then C ×10 and ×27.",
  },
  { id: "calls/entry-c", note: "12345, then C ×1…4." },
  { id: "calls/entry-softkey-down", note: "12345, then ▼ ×1…4: Save, Convert, Call, Save." },
  { id: "calls/entry-softkey-up", note: "12345, then ▲ ×1…4: Save, Convert, Call, Save." },
  {
    id: "calls/entry-keys",
    note: "`*` then a digit, two committed `*`, digits and C on Save and Convert, Convert (the virgin rate's note), the power key's list and C.",
  },
  { id: "calls/entry-save", note: "Save: plan 19's `Name:` prompt.", status: PHONE_BOOK },
  { id: "calls/code", note: "`*#06#` and `*#0000#`, then C." },
  { id: "calls/code-down", note: "▼ on the code pages: plan 19's phone book.", status: PHONE_BOOK },
  {
    id: "calls/in-call-options-all",
    note: "In a call, C, Options: ▼ ×1…10 through the six rows' wrap.",
  },
  {
    id: "calls/ring-notice",
    note: "The missed-call notice after 1, 2 (one number) and 11 calls, and Missed 1: after 11.",
  },
  { id: "calls/register-standby-up-list", note: "Three dialled numbers: standby ▲, then ▼ ▼ ▼ ▲." },
  { id: "calls/register-dialled", note: "Dialled numbers with three entries: ▼ ×1…3." },
  { id: "calls/register-dialled-options", note: "Dialled 1:'s Options: ▼ ×1…6 through the wrap." },
  { id: "calls/register-redialled", note: "A number dialled again moves to the top: ▼ ×1…3." },
  { id: "calls/register-missed", note: "Two missed calls: ▼ ×1, ×2." },
  { id: "calls/register-received", note: "A received call and a rejected one: ▼ ×1, ×2." },
  { id: "calls/register-dialled-21", note: "21 calls: Dialled holds 20 (▲ ▲ ▼ from Dialled 1:)." },
  {
    id: "calls/register-missed-12",
    note: "12 missed calls: Missed holds 10 (▲ ▲ after the note).",
  },
  {
    id: "calls/register-keys",
    note: "Time of call's Back, and Time of call in the 12-hour Time format.",
  },
  {
    id: "calls/register-erase-lists",
    note: "Erase recent call lists (All, Missed, Dialled, Received), then Missed calls and standby ▲.",
  },
  {
    id: "calls/durations",
    note: "Show call duration's four pages: empty, after calls of measured lengths, after a received call, after Clear timers (factory).",
  },
];

const IMAGE_NAME = /^[a-z0-9-]+$/;

/** A case with no image or a fixture without cases: names it. */
export class CallsCaptureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CallsCaptureError";
  }
}

/** Every case, the transcribed ones and the duration pages. */
export const ALL_CALL_CASES: readonly CallCase[] = [...CALL_CASES, ...DURATION_CASES];

export function callStills(cases: readonly CallCase[] = ALL_CALL_CASES): CaptureSetEntry[] {
  const files = new Map<string, ShotFile[]>();
  const named = new Set<string>();
  for (const c of cases) {
    if (named.has(c.name)) throw new CallsCaptureError(`case ${c.name} is listed twice`);
    named.add(c.name);
    const { id, image } = stillFixtureOf(c);
    if (!CALL_STILLS.some((fixture) => fixture.id === id)) {
      throw new CallsCaptureError(`case ${c.name}: no still fixture ${id}`);
    }
    if (!IMAGE_NAME.test(image)) throw new CallsCaptureError(`case ${c.name}: image name ${image}`);
    const file = `${P}/${c.name}.png`;
    const stem = c.name.slice(c.name.lastIndexOf("/") + 1);
    files.set(id, [...(files.get(id) ?? []), image === stem ? file : { file, name: image }]);
  }
  return CALL_STILLS.map(({ id, note, status }) => {
    const shots = files.get(id);
    if (shots === undefined) throw new CallsCaptureError(`still fixture ${id} has no case`);
    return {
      id,
      kind: "still",
      status: statusOf(status),
      prefer: {
        source: { kind: "shots", files: shots },
        note: `${note} Each image's keys from a settled standby are its CALL_CASES entry.`,
      },
    };
  });
}

// ---------------------------------------------------------------- recordings

/** A recording of plan22/ as a timeline golden. */
export interface CallRecording {
  /** Under plan22/; the golden id is `calls/<dir with - for />`. */
  readonly dir: string;
  /**
   * The golden frame aligned with the scenario's trigger: a key's first redraw, or `ring` (an
   * interruption, aligned on the ringing screen: the cell's paging delay is not the phone's).
   */
  readonly triggerFrame: TriggerFrame | "ring";
  readonly note: string;
  readonly status?: GoldenStatus;
  /** Frames kept (inclusive), when the recording's head is another plan's (Snake II's game). */
  readonly frames?: { readonly from: number; readonly to: number };
}

const rec = (
  dir: string,
  triggerFrame: TriggerFrame | "ring",
  note: string,
  extra: Partial<CallRecording> = {},
): CallRecording => ({ dir, triggerFrame, note, ...extra });

const DIGIT_SLUGS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "star", "hash"] as const;
const keyName = (slug: string): string => ({ star: "*", hash: "#" })[slug] ?? slug;

export const CALL_RECORDINGS: readonly CallRecording[] = [
  // entry
  rec("entry/first-digit", 1, "5 at standby: the entry."),
  rec("entry/second-digit", 1, "5, then 6."),
  rec("entry/large-to-small", 1, "16 characters, then a 17th: the small face."),
  rec("entry/star-commit", 1, "`*` at standby: pending, then its commit (vanishes 480 ms)."),
  rec("entry/star-cycle-commit", 1, "`*` ×5 300 ms apart, then the commit."),
  rec("entry/star-digit", 1, "1, `*`, 5 600 ms later: the digit commits the `*`."),
  rec("entry/c-one", 1, "123, C: 12."),
  rec("entry/c-last", 1, "5, C: standby (the operator 88 ms later)."),
  rec("entry/c-last-star", 1, "`*`, C 600 ms later: standby."),
  ...[475, 500].map((ms) =>
    rec(
      `entry/c-held-${ms}`,
      1,
      `1234, C held ${ms} ms: ${ms >= 500 ? "deleted, then cleared to standby" : "one deleted"}.`,
    ),
  ),
  rec("entry/c-held-long", 1, "1234, C held 1.5 s: deleted, cleared at ≈500 ms."),
  rec("entry/up-held", 1, "1234, ▲ held 2.5 s: the soft key cycles (787 ms, then every ≈480 ms)."),
  rec("entry/down-held", 1, "1234, ▼ held 2.5 s."),
  rec("entry/idle", 0, "1234 left 70 s: no timeout."),
  // holds, recall, codes
  ...DIGIT_SLUGS.map((slug) =>
    rec(
      `hold/empty-${slug}`,
      1,
      `${keyName(slug)} held 1 s at standby${slug === "1" ? ": the voice mailbox call" : ": a tap"}.`,
    ),
  ),
  ...DIGIT_SLUGS.map((slug) =>
    rec(
      `hold/inside-${slug}`,
      1,
      `12, then ${keyName(slug)} held 1 s${slug === "hash" ? ": location 12 (No phone numbers)" : ""}.`,
    ),
  ),
  ...[475, 500].map((ms) =>
    rec(
      `hold/one-${ms}`,
      1,
      `1 held ${ms} ms on an empty entry${ms >= 500 ? ": the voice mailbox" : ""}.`,
    ),
  ),
  ...["1", "12", "50", "0", "51", "250"].map((n) =>
    rec(
      `recall/${n}-hash`,
      1,
      `${n}, then #: ${Number(n) >= 1 && Number(n) <= 50 ? "No phone numbers" : "Invalid location"}.`,
    ),
  ),
  rec("recall/note-c", 1, "1#, C 1.1 s into the note: standby."),
  rec("recall/note-digit", 1, "1#, 5 into the note: a new entry."),
  rec("recall/note-call", 1, "1#, Navi into the note: standby."),
  rec("code/imei", 1, "`*#06#`: Serial No."),
  rec("code/version", 1, "`*#0000#`: the version."),
  rec("code/imei-navi", 1, "`*#06#`, Navi 1 s later: standby."),
  rec("code/version-navi", 1, "`*#0000#`, Navi 1 s later: standby."),
  // hand-over
  ...(["5", "star", "hash"] as const).flatMap((slug) => [
    rec(`handover/note-${slug}`, 1, `Missed calls' No numbers, then ${keyName(slug)}: the entry.`),
    rec(
      `handover/list-${slug}`,
      1,
      `The Call register list (entered with Navi), then ${keyName(slug)}.`,
    ),
  ]),
  rec("handover/shortcut-list-late", 1, "Menu 4, 5 s later 5: the entry."),
  ...(["0", "hash", "star"] as const).map((slug) =>
    rec(`handover/carousel-${slug}`, 1, `The carousel 4 s after Menu, then ${keyName(slug)}.`),
  ),
  rec("handover/option-list-5", 1, "An option list entered with Navi, then 5."),
  rec("handover/notice-digit", 1, "The missed-call notice, then 5."),
  rec(
    "handover/notice-up",
    1,
    "The missed-call notice, then ▲: No last dialled numbers, the notice.",
  ),
  rec("handover/notice-down", 1, "The missed-call notice, then ▼: the phone book."),
  // dialling
  rec("dial/call", 1, "0412345678, Call: Calling, alerting, connected."),
  // The standby after a call without a traffic channel loses its signal ladder (the patched
  // network's first measurement, an artefact): those recordings end at standby's first frame.
  rec("dial/end-calling", 1, "Call, End 1.3 s later (taken at the alerting).", {
    frames: { from: 0, to: 9 },
  }),
  rec("dial/end-connected", 1, "Call, End 7.3 s later: standby."),
  rec("dial/c-calling", 1, "Call, C 1.3 s later: nothing changes."),
  rec("dial/c-connected", 1, "Call, connected: C, C, End."),
  rec("dial/c-held-connected", 1, "Call, connected: C held 1.5 s."),
  rec("dial/alerting", 1, "Call held alerting (CAP_MO_HOLD), the far end answers at 6.3 s."),
  rec("dial/end-alerting", 1, "Call held alerting, End at 4.3 s.", { frames: { from: 0, to: 10 } }),
  rec("dial/c-alerting", 1, "Call held alerting, C at 4.3 s: Options."),
  rec(
    "dial/net-end-alerting",
    1,
    "Call held alerting, the network's DISCONNECT (cause 16) at 4.3 s.",
    {
      frames: { from: 0, to: 10 },
    },
  ),
  rec("dial/net-end-connected", 1, "Call, connected, the network's DISCONNECT at 7.3 s."),
  rec("dial/number-one-digit", 1, "5, Call: Speed dial number not saved."),
  rec("dial/number-one-1", 1, "1, Call: Speed dial number not saved."),
  rec("dial/number-12", 1, "12, Call: dialled.", { frames: { from: 0, to: 2 } }),
  rec("dial/number-ten", 1, "1234567890, Call.", { frames: { from: 0, to: 2 } }),
  rec("dial/number-twenty", 1, "20 digits, Call: two thin lines.", { frames: { from: 0, to: 2 } }),
  rec("dial/number-twenty-eight", 1, "28 digits, Call.", { frames: { from: 0, to: 2 } }),
  rec("dial/number-thirty-two", 1, "32 digits, Call: the last 28 shown.", {
    frames: { from: 0, to: 2 },
  }),
  rec("dial/number-thirty-three", 1, "33 digits, Call: Invalid phone number, then the entry."),
  rec("dial/number-112", 1, "112, Call: Attempting emergency call."),
  rec("dial/number-911", 1, "911, Call: dialled as a number (no emergency screen).", {
    frames: { from: 0, to: 2 },
  }),
  rec("dial/number-plus", 1, "+61412345678, Call.", { frames: { from: 0, to: 2 } }),
  rec("dial/number-plus-later", 1, "0412+345, Call: 0412 dialled.", { frames: { from: 0, to: 2 } }),
  rec(
    "dial/number-hash-ended",
    1,
    "123#: the # looked up location 123 (Invalid location) before Call.",
  ),
  rec(
    "dial/number-pause",
    1,
    "0412345678p123, Call: 0412345678 dialled (the DTMF after the connect is 22b's).",
    { frames: { from: 0, to: 2 } },
  ),
  // in a call
  rec("in-call/down", 1, "In a call, ▼: Volume."),
  rec("in-call/up", 1, "In a call, ▲: Volume."),
  rec("in-call/down-steps", 1, "In a call, ▼ ×11 to the bottom."),
  rec("in-call/up-steps", 1, "In a call, ▼ ×3 earlier, then ▲ ×5 to the top."),
  rec("in-call/down-held", 1, "In a call, ▼ held 3 s."),
  ...DIGIT_SLUGS.map((slug) =>
    rec(`in-call/digit-${slug}`, 1, `In a call, ${keyName(slug)}: shown, Options, then End.`),
  ),
  rec("in-call/digits", 1, "In a call, 18 keys: the digits' layout."),
  rec("in-call/digit-held", 1, "In a call, 5 held 1.5 s."),
  rec("in-call/c", 1, "In a call, C, C: Options, End."),
  rec("in-call/options", 1, "In a call, C, Options: the list."),
  rec("in-call/options-select-0", 1, "Options, End active call: standby."),
  rec("in-call/options-select-1", 1, "Options, Hold.", { status: SERVICES }),
  rec("in-call/options-select-2", 1, "Options, New call: Phone number:.", { status: SERVICES }),
  rec("in-call/options-select-3", 1, "Options, Send DTMF: Phone number:.", { status: SERVICES }),
  rec("in-call/options-select-4", 1, "Options, Phone book.", { status: PHONE_BOOK }),
  rec("in-call/options-select-5", 1, "Options, Mute: Muted, then the call with Muted."),
  rec("in-call/options-c", 1, "Options, C: the call."),
  rec("in-call/digits-options", 1, "In a call, 5, then Options: the list."),
  rec("in-call/power", 1, "In a call, the power key: the profile list, C back."),
  rec("in-call/long", 0, "A call left 70 s: no timer."),
  // incoming
  rec(
    "ring/screen",
    1,
    "A ring at standby: the ringing screen (aligned on it), `calling` blinking.",
  ),
  ...[
    "123",
    "1234567890",
    "12345678901234",
    "123456789012345",
    "12345678901234567890",
    "plus61412345678",
  ].map((n) => rec(`ring/number-${n}`, 1, `A ring from ${n.replace("plus", "+")}.`)),
  rec("ring/answer", 1, "Ringing, Answer: Call 1."),
  rec("ring/answer-end", 1, "Answered, End 4.5 s later: standby.", { frames: { from: 0, to: 3 } }),
  rec("ring/reject", 1, "Ringing, C: rejected."),
  rec("ring/reject-held", 1, "Ringing, C held 1.5 s."),
  rec("ring/missed", 1, "Ringing, the caller hangs up: the notice."),
  rec("ring/end-by-caller", 1, "Answered, the caller hangs up 4.5 s later."),
  ...(["up", "down"] as const).map((k) =>
    rec(`ring/key-${k}`, 1, `Ringing, ${k === "up" ? "▲" : "▼"}: Volume.`),
  ),
  ...(["5", "hash", "star", "pwr"] as const).map((k) =>
    rec(
      `ring/key-${k}`,
      0,
      `Ringing, ${k === "pwr" ? "the power key" : keyName(k)}: nothing changes.`,
    ),
  ),
  rec("ring/navi-held", 1, "Ringing, Navi held: answered."),
  rec("ring/notice-c", 1, "The notice, C: standby."),
  rec("ring/notice-list", 1, "The notice, List: 1 new number, Missed 1:."),
  rec("ring/notice-list-2", 1, "Two missed calls from one number, List: 1 new number."),
  rec(
    "ring/notice-list-11",
    1,
    "Eleven missed calls, List: 2 new numbers (two distinct numbers kept).",
  ),
  rec("ring/notice-navi-held", 1, "The notice, Navi held: List."),
  rec("ring/notice-wait", 0, "The notice left 62 s."),
  // interruptions
  ...(["menu", "option-list", "entry", "editor", "calculator"] as const).flatMap((below) => {
    // Over the editor the cursor's blink comes first: the ringing screen is frame 3.
    const ring = below === "editor" ? 3 : "ring";
    return [
      rec(`interrupt/${below}-reject`, ring, `A ring over ${below}, C 3 s later.`),
      rec(`interrupt/${below}-answer-end`, ring, `A ring over ${below}, Answer, End 4.8 s later.`),
      rec(`interrupt/${below}-missed`, ring, `A ring over ${below}, the caller hangs up.`),
    ];
  }),
  rec("interrupt/note-reject", "ring", "Missed calls' No numbers, a ring 600 ms later, C."),
  rec("interrupt/note-short", "ring", "Missed calls' No numbers, a ring 600 ms later."),
  rec("interrupt/ring-during-call", 0, "In a call, a ring: paged after End."),
  rec(
    "interrupt/snake-reject",
    0,
    "A ring over a Snake II game in play, C: the Snake II menu with Continue.",
    { frames: { from: 265, to: 269 } },
  ),
  rec("interrupt/snake-answer-end", 0, "A ring over Snake II, Answer, End: standby.", {
    frames: { from: 265, to: 273 },
  }),
  // register
  rec("register/standby-up-none", 1, "Standby ▲ with no dialled number: No last dialled numbers."),
  rec("register/standby-up", 1, "Standby ▲ with three dialled numbers."),
  rec("register/standby-up-call", 1, "Standby ▲, ▼, Call: Calling."),
  rec("register/standby-up-c", 1, "Standby ▲, C."),
  rec("register/standby-up-c-held", 1, "Standby ▲, C held."),
  rec("register/dialled-open", 1, "Dialled numbers: Dialled 1:."),
  rec("register/dialled-options-open", 1, "Dialled 1:, Options."),
  rec("register/options-call", 1, "Options, Call: Calling."),
  rec("register/options-call-end", 1, "A call from Options, End: standby."),
  rec("register/send-sms", 1, "Options, Send SMS: the editor."),
  rec("register/time-of-call", 1, "Options, Time of call."),
  rec("register/edit-number", 1, "Options, Edit number: Phone number:."),
  rec("register/edit-number-ok", 1, "Edit number, OK: the standby entry."),
  rec("register/edit-number-c", 1, "Edit number, C: one deleted."),
  rec("register/save", 1, "Options, Save: Name:.", { status: PHONE_BOOK }),
  rec("register/erase", 1, "Options, Erase: Erase?."),
  rec("register/erase-ok", 1, "Erase?, OK: Erased, the list."),
  rec("register/erase-c", 1, "Erase?, C: Options."),
  rec("register/list-c", 1, "Dialled 1:, C: Dialled numbers."),
  rec("register/options-c", 1, "Options, C: Dialled 1:."),
  rec("register/missed-empty", 1, "Missed calls, empty: No numbers."),
  rec("register/missed-open", 1, "Missed calls with two unread: 2 new numbers."),
  rec("register/missed-open-read", 1, "Missed calls again: No new numbers."),
  rec("register/missed-options", 1, "Missed 1:, Options."),
  rec("register/received-open", 1, "Received calls: Received 1:."),
  rec("register/missed-12-open", 1, "Missed calls after 12 missed calls: 2 new numbers."),
  ...(["all", "missed", "dialled", "received"] as const).map((name) =>
    rec(`register/erase-lists-${name}`, 1, `Erase recent call lists, ${name}: its note.`),
  ),
  rec("durations/clear-timers", 1, "Clear timers, 12345, OK: Timers cleared (factory)."),
];

/** The golden id of a recording. */
export const recordingId = (dir: string): string => `calls/${dir.replace(/\//g, "-")}`;

function recordingEntries(io: CaptureIo | undefined): CaptureSetEntry[] {
  return CALL_RECORDINGS.map((r) => {
    let triggerFrame: TriggerFrame;
    if (r.triggerFrame === "ring") {
      // An interruption is aligned on the ringing screen (the paging delay is the cell's).
      const frames = io?.frames.recording(`${P}/${r.dir}`);
      triggerFrame = frames === undefined ? 1 : ringFrame(frames);
    } else triggerFrame = r.triggerFrame;
    const source =
      r.frames === undefined
        ? { kind: "recording" as const, dir: `${P}/${r.dir}` }
        : { kind: "composite" as const, parts: [{ dir: `${P}/${r.dir}`, ...r.frames }] };
    return {
      id: recordingId(r.dir),
      kind: "timeline",
      status: statusOf(r.status),
      prefer: { source, triggerFrame, note: r.note },
    };
  });
}

/** The first frame after 1 s (the ringing screen comes ≥ 1.3 s after the ring). */
function ringFrame(frames: readonly { readonly startMs: number }[]): number {
  const i = frames.findIndex((f, k) => k > 0 && f.startMs > 1300);
  if (i < 0) throw new CallsCaptureError("no ringing screen");
  return i;
}

// ---------------------------------------------------------------- sound

type SoundRow = Omit<SoundCaptureEntry, "state" | "status"> & {
  readonly state?: string;
  readonly status?: GoldenStatus;
};

const ALERTS = ["ringing", "ascending", "ring-once", "beep-once", "off"] as const;

export const CALL_SOUNDS: readonly SoundCaptureEntry[] = (
  [
    {
      id: "sound/calls/dtmf-keys",
      dir: `${P}/sound/dtmf/keys`,
      note: "Every digit, `*`, `#` at standby (DTMF pairs), C, C held.",
    },
    ...DIGIT_SLUGS.map((slug) => ({
      id: `sound/calls/dtmf-hold-${slug}`,
      dir: `${P}/sound/dtmf/hold-${slug}`,
      note: `${keyName(slug)} held 1 s at standby: its pair until the release.`,
    })),
    {
      id: "sound/calls/dtmf-taps-fast",
      dir: `${P}/sound/dtmf/taps-fast`,
      note: "1 2 3 tapped back to back.",
    },
    {
      id: "sound/calls/dtmf-entry-keys",
      dir: `${P}/sound/dtmf/entry-keys`,
      note: "In the entry: ▲, ▼, C, C held (900 Hz beeps).",
    },
    ...(["off", "level-1", "level-3"] as const).map((level) => ({
      id: `sound/calls/dtmf-keys-${level}`,
      dir: `${P}/sound/dtmf/keys-${level}`,
      note: `Keypad tones ${level}: 1 5 9 * # and 0 held.`,
    })),
    {
      id: "sound/calls/dtmf-keys-virgin",
      dir: `${P}/sound/dtmf/keys-virgin`,
      state: "virgin",
      note: "Virgin (Keypad tones unset): 1 5 9 * # and 0 held.",
    },
    {
      id: "sound/calls/connected",
      dir: `${P}/sound/call/connected`,
      note: "Call: the ringback until the connect.",
    },
    {
      id: "sound/calls/net-end",
      dir: `${P}/sound/call/net-end`,
      note: "In a call, the network's DISCONNECT: three 1000 Hz beeps.",
    },
    { id: "sound/calls/end", dir: `${P}/sound/call/end`, note: "In a call, End." },
    {
      id: "sound/calls/in-call-keys",
      dir: `${P}/sound/call/in-call-keys`,
      note: "In a call: DTMF digits, 5 held, ▲, ▼, C, C.",
    },
    {
      id: "sound/calls/volume-top",
      dir: `${P}/sound/call/volume-top`,
      note: "In a call: ▲ at the top beeps 1125 Hz.",
    },
    {
      id: "sound/calls/ring-keys",
      dir: `${P}/sound/call/ring-keys`,
      note: "Ringing: ▲, 5, #, ▼ cut the current note.",
    },
    {
      id: "sound/calls/ringback",
      dir: `${P}/sound/call/ringback`,
      note: "Call held alerting 15 s: the ringback (425 Hz).",
    },
    {
      id: "sound/calls/ringback-answer",
      dir: `${P}/sound/call/ringback-answer`,
      note: "Call held alerting, answered at 6.3 s.",
    },
    ...ALERTS.flatMap((alert) =>
      (["on", "off"] as const).map((vib) => ({
        id: `sound/calls/ring-${alert}-vibrator-${vib}`,
        dir: `${P}/sound/ring/${alert}-vibrator-${vib}`,
        note: `A ring, Incoming call alert ${alert}, Vibrating alert ${vib} (Nokia tune, Level 4).`,
      })),
    ),
    {
      id: "sound/calls/ring-answer",
      dir: `${P}/sound/ring/answer`,
      note: "Ringing, Answer at 4 s.",
    },
    { id: "sound/calls/ring-reject", dir: `${P}/sound/ring/reject`, note: "Ringing, C at 4 s." },
    {
      id: "sound/calls/ring-missed",
      dir: `${P}/sound/ring/missed`,
      note: "Ringing, the caller hangs up at 4 s.",
    },
    {
      id: "sound/calls/ring-virgin",
      dir: `${P}/sound/ring/virgin`,
      state: "virgin",
      note: "A ring on the virgin phone: silent.",
    },
    {
      id: "sound/note/calls-invalid-phone-number",
      dir: `${P}/sound/notes/invalid-phone-number`,
      note: '"Invalid phone number" after Call on 33 digits.',
    },
    {
      id: "sound/note/calls-speed-dial-not-saved",
      dir: `${P}/sound/notes/speed-dial-not-saved`,
      note: '"Speed dial number not saved" after Call on 5.',
    },
    {
      id: "sound/note/calls-invalid-location",
      dir: `${P}/sound/notes/invalid-location`,
      note: '"Invalid location" after 0#.',
    },
    {
      id: "sound/note/calls-no-phone-numbers",
      dir: `${P}/sound/notes/no-phone-numbers`,
      note: '"No phone numbers" after 1#.',
    },
    {
      id: "sound/note/calls-no-new-numbers",
      dir: `${P}/sound/notes/no-new-numbers`,
      note: '"No new numbers" on Missed calls read.',
    },
    {
      id: "sound/note/calls-new-numbers",
      dir: `${P}/sound/notes/new-numbers`,
      note: '"1 new number" on Missed calls after a missed call.',
    },
    {
      id: "sound/calls/no-last-dialled",
      dir: `${P}/sound/notes/no-last-dialled`,
      note: "Standby ▲ with none: No last dialled numbers has no tone.",
    },
    {
      id: "sound/calls/erased",
      dir: `${P}/sound/notes/erased`,
      note: "Erase?, OK: Erased has no tone.",
    },
    {
      id: "sound/calls/emergency",
      dir: `${P}/sound/notes/emergency`,
      note: "112, Call: Attempting emergency call.",
    },
  ] satisfies SoundRow[]
).map(
  (entry: SoundRow): SoundCaptureEntry => ({
    ...entry,
    state: entry.state ?? "factory",
    status: statusOf(entry.status),
  }),
);

export function callSounds(io: SoundCaptureIo): SoundGolden[] {
  return CALL_SOUNDS.map((entry) => buildSoundGolden(entry, io));
}

export function callsLcd(io?: CaptureIo): CaptureSetEntry[] {
  return [...callStills(), ...recordingEntries(io)];
}

export const calls: PlanCaptureSet = {
  plan: "22",
  resources,
  lcd: (io) => callsLcd(io),
  sounds: (io) => callSounds(io.sound),
  notImported: {
    "plan22/**/*.wav, *.events.csv beside LCD recordings":
      "virgin LCD recordings' audio: the factory sound/ recordings hold the call sounds",
    "plan22/sound/**/ frames": "their LCD repeats the LCD recordings; only their sound is imported",
    "plan22/dial/link-1…5": "five identical calls for the link times (dial/call is the golden)",
    "plan22/dial/stock-call":
      "the stock emulator's call (no traffic channel): its endless ringback is an artefact (D15)",
    "plan22/dial/net-end-calling": "the harness ignores a hangup before the network has the SETUP",
    "plan22/dial/net-end-alerting-17":
      "identical to net-end-alerting (every cause looks alike, S14)",
    "plan22/dial/number-04, number-pause's and number-wait's frames after the number":
      "22b's: the service request and the DTMF a call sends after `p`/`w` (22b recaptures them)",
    "plan22/entry/c-held-{400,425,450,525,550}, hold/one-{400,450,550,600}":
      "the thresholds' other sides: c-held-475/500 and hold/one-475/500 are the goldens",
    "plan22/dial/number-pause-connected": "dial/number-pause's 20 s tail (22b's DTMF sending)",
    "plan22/in-call/options-{end-all,end-active,dtmf,dtmf-send}, options-select-6…9, send-dtmf-flow, options-list/":
      "the first run's labels for the same rows (options-select-0…5 and options-all are the goldens)",
    "plan22/durations/after-{0.5,1.4,1.6,59.6,60.4}/":
      "a call timed from a polled screen; durations/fit/ times its calls by keys",
    "plan22/persist/":
      "evidence for D13's Deviation (the lists are RAM); asserted by tests/call-log.test.ts",
    "plan22/register/time-format-list, standby-12h, clock-menu":
      "plan 21's screens on the way to the 12-hour format",
    "plan22/logs/, text.json, cases/":
      "network logs, OCR and per-section cases (transcribed as CALL_CASES)",
    "plan22/**/*@8x.png": "previews",
  },
};
