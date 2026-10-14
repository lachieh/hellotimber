// Plan 20's goldens (docs/plans/20-calculator.md "Golden pipeline additions"; paths under plan20/):
// the calculator's stills, named by CALCULATOR_CASES (Task 0's cases.json, transcribed), its
// timelines and its sound goldens. Each was imported `pending:20` until its scenario passed
// (tests/acceptance/20-calculator.test.ts); Options' numeric/star/hash escape to standby number
// entry with its DTMF pairs is `pending:22` (D9: plan 22's standby-entry handoff and the
// dual-frequency contract).
//
// Pure: imports only sibling scripts, reads captures through the injected io.
import type { CaptureIo, CaptureSetEntry, PlanCaptureSet, ShotFile } from "../capture-set.ts";
import type { GoldenStatus } from "../golden-format.ts";
import { resources } from "../resource-inputs/20-calculator.ts";
import {
  buildSoundGolden,
  type SoundCaptureEntry,
  type SoundCaptureIo,
} from "../sound-capture-set.ts";
import type { SoundGolden } from "../sound-format.ts";

/** Where a case starts beyond the virgin calculator (Task 0 K, `cases.json` `setup`). */
export type CalculatorSetup =
  /** Foreign 1.5 saved, `saveflash`, cold boot from that image (`persist/before`). */
  | "persist"
  /** `1 2 c c c`, C held to standby, the calculator again (`persist/reentry`). */
  | "reentry"
  /** Domestic 2 saved on the security-code image, then Restore factory settings (6-4, 12345). */
  | "restore"
  /** Foreign 1.5 saved, then Restore factory settings. */
  | "restore-foreign";

/**
 * One still: the keys from the calculator's first screen, as the capture harness played them
 * (`gen_v639_plan20.py` `play`): a harness key is a tap (≈42 ms down, 250 ms settle, 300 ms gap),
 * `c@1500` holds C 1500 ms (then 250 ms), `+500` waits 500 ms. The shot follows the last key.
 */
export interface CalculatorCase {
  /** `<directory>/<image>` under plan20/. */
  readonly name: string;
  /** Harness tokens separated by spaces: `0`-`9`, `*`, `#`, `up`, `down`, `menu`, `c`. */
  readonly keys: string;
  readonly setup?: CalculatorSetup;
}

/** Task 0's `plan20/cases.json`, in capture order. */
export const CALCULATOR_CASES: readonly CalculatorCase[] = [
  { name: "entry/first", keys: "" },
  { name: "entry/digit-0", keys: "0" },
  { name: "entry/digit-1", keys: "1" },
  { name: "entry/digit-2", keys: "2" },
  { name: "entry/digit-3", keys: "3" },
  { name: "entry/digit-4", keys: "4" },
  { name: "entry/digit-5", keys: "5" },
  { name: "entry/digit-6", keys: "6" },
  { name: "entry/digit-7", keys: "7" },
  { name: "entry/digit-8", keys: "8" },
  { name: "entry/digit-9", keys: "9" },
  { name: "entry/zero-zero", keys: "0 0" },
  { name: "entry/zero-five", keys: "0 5" },
  { name: "entry/nine-digits", keys: "1 2 3 4 5 6 7 8 9" },
  { name: "entry/ten-digits", keys: "1 2 3 4 5 6 7 8 9 1" },
  { name: "entry/point-eight", keys: "1 2 # 3 4 5 6 7 8" },
  { name: "entry/point-nine", keys: "1 2 # 3 4 5 6 7 8 9" },
  { name: "entry/point-first", keys: "#" },
  { name: "entry/point-first-digit", keys: "# 5" },
  { name: "entry/point-twice", keys: "# #" },
  { name: "entry/point-twice-digit", keys: "# # 5" },
  { name: "entry/point-after-zero", keys: "0 #" },
  { name: "entry/point-after-digits", keys: "1 2 3 #" },
  { name: "entry/point-second", keys: "1 2 # 3 # 4" },
  { name: "entry/point-after-nine", keys: "1 2 3 4 5 6 7 8 9 #" },
  { name: "entry/point-after-eight", keys: "1 2 3 4 5 6 7 8 #" },
  { name: "entry/point-after-eight-digit", keys: "1 2 3 4 5 6 7 8 # 9" },
  { name: "entry/small-fraction", keys: "0 # 0 0 1 2 3 4 5" },
  { name: "entry/c-digit", keys: "1 2 3 c" },
  { name: "entry/c-point", keys: "1 2 # c" },
  { name: "entry/c-point-digit", keys: "1 2 # 5 c" },
  { name: "entry/c-point-digit-2", keys: "1 2 # 5 c c" },
  { name: "entry/c-to-zero", keys: "1 2 c c" },
  { name: "entry/c-point-first", keys: "# c" },
  { name: "entry/c-point-first-2", keys: "# c c" },
  { name: "entry/c-nine", keys: "1 2 3 4 5 6 7 8 9 c" },
  { name: "entry/c-held-1500", keys: "5 6 7 c@1500" },
  { name: "entry/c-held-1000", keys: "5 6 7 c@1000" },
  { name: "entry/c-held-700", keys: "5 6 7 c@700" },
  { name: "entry/up", keys: "1 2 up" },
  { name: "entry/down", keys: "1 2 down" },
  { name: "entry/digit-held", keys: "7@1500" },
  { name: "entry/zero-c", keys: "0 c" },
  { name: "entry/zero-zero-c", keys: "0 0 c" },
  { name: "entry/result-c-c", keys: "1 2 * 3 menu menu c c" },
  { name: "operators/star/00", keys: "1 2" },
  { name: "operators/star/01", keys: "1 2 *" },
  { name: "operators/star/02", keys: "1 2 * *" },
  { name: "operators/star/03", keys: "1 2 * * *" },
  { name: "operators/star/04", keys: "1 2 * * * *" },
  { name: "operators/star/05", keys: "1 2 * * * * *" },
  { name: "operators/star-zero/00", keys: "" },
  { name: "operators/star-zero/01", keys: "*" },
  { name: "operators/star-zero/02", keys: "* *" },
  { name: "operators/star-zero/03", keys: "* * *" },
  { name: "operators/star-zero/04", keys: "* * * *" },
  { name: "operators/star-zero/05", keys: "* * * * *" },
  { name: "operators/star-result/00", keys: "1 2 * 3 menu menu" },
  { name: "operators/star-result/01", keys: "1 2 * 3 menu menu *" },
  { name: "operators/star-result/02", keys: "1 2 * 3 menu menu * *" },
  { name: "operators/star-result/03", keys: "1 2 * 3 menu menu * * *" },
  { name: "operators/star-result/04", keys: "1 2 * 3 menu menu * * * *" },
  { name: "operators/star-result/05", keys: "1 2 * 3 menu menu * * * * *" },
  { name: "operators/digit-after-plus", keys: "1 2 * 3" },
  { name: "operators/digit-after-minus", keys: "1 2 * * 3" },
  { name: "operators/digit-after-times", keys: "1 2 * * * 3" },
  { name: "operators/digit-after-divide", keys: "1 2 * * * * 3" },
  { name: "operators/c-through/00", keys: "1 2 * 3 4" },
  { name: "operators/c-through/01", keys: "1 2 * 3 4 c" },
  { name: "operators/c-through/02", keys: "1 2 * 3 4 c c" },
  { name: "operators/c-through/03", keys: "1 2 * 3 4 c c c" },
  { name: "operators/c-through/04", keys: "1 2 * 3 4 c c c c" },
  { name: "operators/c-through/05", keys: "1 2 * 3 4 c c c c c" },
  { name: "operators/star-after-operand", keys: "1 2 * 3 *" },
  { name: "operators/star-after-operand-2", keys: "1 2 * 3 * *" },
  { name: "operators/star-after-minus-operand", keys: "1 2 * * 3 *" },
  { name: "operators/point-operator", keys: "1 2 * #" },
  { name: "operators/point-operator-digit", keys: "1 2 * # 5" },
  { name: "operators/three-lines-long", keys: "1 2 3 4 # 5 6 7 8 * * * 0 # 0 0 1 2 3 4 5" },
  { name: "operators/operand-nine", keys: "1 2 * 1 2 3 4 5 6 7 8 9 1" },
  { name: "operators/c-held-operand", keys: "1 2 * 3 4 c@1500" },
  { name: "operators/c-held-operator", keys: "1 2 * c@1500" },
  { name: "operators/up-operator", keys: "1 2 * up" },
  { name: "operators/after-operator-slow", keys: "1 2 * +2400 * +2400 *" },
  { name: "options/number/00", keys: "1 2 menu" },
  { name: "options/number/01", keys: "1 2 menu down" },
  { name: "options/number/02", keys: "1 2 menu down down" },
  { name: "options/number/03", keys: "1 2 menu down down down" },
  { name: "options/number/04", keys: "1 2 menu down down down down" },
  { name: "options/number/05", keys: "1 2 menu down down down down down" },
  { name: "options/number/06", keys: "1 2 menu down down down down down down" },
  { name: "options/number/07", keys: "1 2 menu down down down down down down down" },
  { name: "options/number/08", keys: "1 2 menu down down down down down down down down" },
  { name: "options/number-up", keys: "1 2 menu up" },
  { name: "choose/number-c", keys: "1 2 menu c" },
  { name: "choose/number-c-up", keys: "1 2 menu down c" },
  { name: "options/operator/00", keys: "1 2 * * menu" },
  { name: "options/operator/01", keys: "1 2 * * menu down" },
  { name: "options/operator/02", keys: "1 2 * * menu down down" },
  { name: "options/operator/03", keys: "1 2 * * menu down down down" },
  { name: "options/operator/04", keys: "1 2 * * menu down down down down" },
  { name: "options/operator-up", keys: "1 2 * * menu up" },
  { name: "choose/operator-c", keys: "1 2 * * menu c" },
  { name: "choose/operator-c-up", keys: "1 2 * * menu down c" },
  { name: "options/operand/00", keys: "1 2 * * 3 menu" },
  { name: "options/operand/01", keys: "1 2 * * 3 menu down" },
  { name: "options/operand/02", keys: "1 2 * * 3 menu down down" },
  { name: "options/operand/03", keys: "1 2 * * 3 menu down down down" },
  { name: "options/operand/04", keys: "1 2 * * 3 menu down down down down" },
  { name: "options/operand/05", keys: "1 2 * * 3 menu down down down down down" },
  { name: "options/operand-up", keys: "1 2 * * 3 menu up" },
  { name: "choose/operand-c", keys: "1 2 * * 3 menu c" },
  { name: "choose/operand-c-up", keys: "1 2 * * 3 menu down c" },
  { name: "choose/number-equals", keys: "1 2 menu menu" },
  { name: "choose/number-add", keys: "1 2 menu down menu" },
  { name: "choose/number-subtract", keys: "1 2 menu down down menu" },
  { name: "choose/number-multiply", keys: "1 2 menu down down down menu" },
  { name: "choose/number-divide", keys: "1 2 menu down down down down menu" },
  { name: "choose/number-in-domestic", keys: "1 2 menu down down down down down menu" },
  { name: "choose/number-in-domestic-after", keys: "1 2 menu down down down down down menu +3500" },
  { name: "choose/number-in-foreign", keys: "1 2 menu down down down down down down menu" },
  {
    name: "choose/number-in-foreign-after",
    keys: "1 2 menu down down down down down down menu +3500",
  },
  { name: "choose/number-exchange-rate", keys: "1 2 menu down down down down down down down menu" },
  { name: "choose/operator-add", keys: "1 2 * * menu menu" },
  { name: "choose/operator-subtract", keys: "1 2 * * menu down menu" },
  { name: "choose/operator-multiply", keys: "1 2 * * menu down down menu" },
  { name: "choose/operator-divide", keys: "1 2 * * menu down down down menu" },
  { name: "choose/operand-equals", keys: "1 2 * * 3 menu menu" },
  { name: "choose/operand-add", keys: "1 2 * * 3 menu down menu" },
  { name: "choose/operand-subtract", keys: "1 2 * * 3 menu down down menu" },
  { name: "choose/operand-multiply", keys: "1 2 * * 3 menu down down down menu" },
  { name: "choose/operand-divide", keys: "1 2 * * 3 menu down down down down menu" },
  { name: "choose/result-digit", keys: "1 2 * 3 menu menu 5" },
  { name: "choose/result-star", keys: "1 2 * 3 menu menu *" },
  { name: "choose/result-point", keys: "1 2 * 3 menu menu #" },
  { name: "choose/result-options", keys: "1 2 * 3 menu menu menu" },
  { name: "choose/zero-options", keys: "menu" },
  { name: "choose/zero-equals", keys: "menu menu" },
  { name: "choose/result-c", keys: "1 2 * 3 menu menu c" },
  { name: "results/12+3", keys: "1 2 * 3 menu menu" },
  { name: "results/12+3-after", keys: "1 2 * 3 menu menu +3500" },
  { name: "results/2-5", keys: "2 * * 5 menu menu" },
  { name: "results/2-5-after", keys: "2 * * 5 menu menu +3500" },
  { name: "results/-3x7", keys: "2 * * 5 * * * 7 menu menu" },
  { name: "results/-3x7-after", keys: "2 * * 5 * * * 7 menu menu +3500" },
  { name: "results/1.5+2.25", keys: "1 # 5 * 2 # 2 5 menu menu" },
  { name: "results/1.5+2.25-after", keys: "1 # 5 * 2 # 2 5 menu menu +3500" },
  { name: "results/2.5x2", keys: "2 # 5 * * * 2 menu menu" },
  { name: "results/2.5x2-after", keys: "2 # 5 * * * 2 menu menu +3500" },
  { name: "results/0.1+0.2", keys: "0 # 1 * 0 # 2 menu menu" },
  { name: "results/0.1+0.2-after", keys: "0 # 1 * 0 # 2 menu menu +3500" },
  { name: "results/1d3", keys: "1 * * * * 3 menu menu" },
  { name: "results/1d3-after", keys: "1 * * * * 3 menu menu +3500" },
  { name: "results/2d3", keys: "2 * * * * 3 menu menu" },
  { name: "results/2d3-after", keys: "2 * * * * 3 menu menu +3500" },
  { name: "results/1d7", keys: "1 * * * * 7 menu menu" },
  { name: "results/1d7-after", keys: "1 * * * * 7 menu menu +3500" },
  { name: "results/10d3", keys: "1 0 * * * * 3 menu menu" },
  { name: "results/10d3-after", keys: "1 0 * * * * 3 menu menu +3500" },
  { name: "results/100000000d3", keys: "1 0 0 0 0 0 0 0 0 * * * * 3 menu menu" },
  { name: "results/100000000d3-after", keys: "1 0 0 0 0 0 0 0 0 * * * * 3 menu menu +3500" },
  { name: "results/123456789+1", keys: "1 2 3 4 5 6 7 8 9 * 1 menu menu" },
  { name: "results/123456789+1-after", keys: "1 2 3 4 5 6 7 8 9 * 1 menu menu +3500" },
  { name: "results/24691357d2", keys: "2 4 6 9 1 3 5 7 * * * * 2 menu menu" },
  { name: "results/24691357d2-after", keys: "2 4 6 9 1 3 5 7 * * * * 2 menu menu +3500" },
  { name: "results/0.0000001d100", keys: "0 # 0 0 0 0 0 0 1 * * * * 1 0 0 menu menu" },
  { name: "results/0.0000001d100-after", keys: "0 # 0 0 0 0 0 0 1 * * * * 1 0 0 menu menu +3500" },
  { name: "results/1d3x3", keys: "1 * * * * 3 * * * 3 menu menu" },
  { name: "results/1d3x3-after", keys: "1 * * * * 3 * * * 3 menu menu +3500" },
  { name: "results/99999x99999", keys: "9 9 9 9 9 * * * 9 9 9 9 9 menu menu" },
  { name: "results/99999x99999-after", keys: "9 9 9 9 9 * * * 9 9 9 9 9 menu menu +3500" },
  { name: "results/500000000+500000000", keys: "5 0 0 0 0 0 0 0 0 * 5 0 0 0 0 0 0 0 0 menu menu" },
  {
    name: "results/500000000+500000000-after",
    keys: "5 0 0 0 0 0 0 0 0 * 5 0 0 0 0 0 0 0 0 menu menu +3500",
  },
  { name: "results/99999999x99999999", keys: "9 9 9 9 9 9 9 9 * * * 9 9 9 9 9 9 9 9 menu menu" },
  {
    name: "results/99999999x99999999-after",
    keys: "9 9 9 9 9 9 9 9 * * * 9 9 9 9 9 9 9 9 menu menu +3500",
  },
  { name: "results/-1-999999999", keys: "0 * * 1 * * 9 9 9 9 9 9 9 9 9 menu menu" },
  { name: "results/-1-999999999-after", keys: "0 * * 1 * * 9 9 9 9 9 9 9 9 9 menu menu +3500" },
  { name: "results/-21d0", keys: "2 * * 5 * * * 7 * * * * 0 menu menu" },
  { name: "results/-21d0-after", keys: "2 * * 5 * * * 7 * * * * 0 menu menu +3500" },
  { name: "results/-24691357d2", keys: "0 * * 2 4 6 9 1 3 5 7 * * * * 2 menu menu" },
  { name: "results/-24691357d2-after", keys: "0 * * 2 4 6 9 1 3 5 7 * * * * 2 menu menu +3500" },
  { name: "results/-1d3", keys: "0 * * 1 * * * * 3 menu menu" },
  { name: "results/-1d3-after", keys: "0 * * 1 * * * * 3 menu menu +3500" },
  { name: "results/-2d3", keys: "0 * * 2 * * * * 3 menu menu" },
  { name: "results/-2d3-after", keys: "0 * * 2 * * * * 3 menu menu +3500" },
  { name: "results/-12345678x1", keys: "0 * * 1 2 3 4 5 6 7 8 * * * 1 menu menu" },
  { name: "results/-12345678x1-after", keys: "0 * * 1 2 3 4 5 6 7 8 * * * 1 menu menu +3500" },
  { name: "results/-99999999.5", keys: "0 * * 9 9 9 9 9 9 9 9 * * 0 # 5 menu menu" },
  { name: "results/-99999999.5-after", keys: "0 * * 9 9 9 9 9 9 9 9 * * 0 # 5 menu menu +3500" },
  { name: "results/999999999+1", keys: "9 9 9 9 9 9 9 9 9 * 1 menu menu" },
  { name: "results/999999999+1-after", keys: "9 9 9 9 9 9 9 9 9 * 1 menu menu +3500" },
  { name: "results/0.0000001d2", keys: "0 # 0 0 0 0 0 0 1 * * * * 2 menu menu" },
  { name: "results/0.0000001d2-after", keys: "0 # 0 0 0 0 0 0 1 * * * * 2 menu menu +3500" },
  { name: "results/-0.0000001d2", keys: "0 * * 0 # 0 0 0 0 0 0 1 * * * * 2 menu menu" },
  { name: "results/-0.0000001d2-after", keys: "0 * * 0 # 0 0 0 0 0 0 1 * * * * 2 menu menu +3500" },
  { name: "results/0.0000003d2", keys: "0 # 0 0 0 0 0 0 3 * * * * 2 menu menu" },
  { name: "results/0.0000003d2-after", keys: "0 # 0 0 0 0 0 0 3 * * * * 2 menu menu +3500" },
  { name: "results/-0.0000003d2", keys: "0 * * 0 # 0 0 0 0 0 0 3 * * * * 2 menu menu" },
  { name: "results/-0.0000003d2-after", keys: "0 * * 0 # 0 0 0 0 0 0 3 * * * * 2 menu menu +3500" },
  { name: "results/0.5+0.5", keys: "0 # 5 * 0 # 5 menu menu" },
  { name: "results/0.5+0.5-after", keys: "0 # 5 * 0 # 5 menu menu +3500" },
  { name: "results/9.9999999+0.0000001", keys: "9 # 9 9 9 9 9 9 9 * 0 # 0 0 0 0 0 0 1 menu menu" },
  {
    name: "results/9.9999999+0.0000001-after",
    keys: "9 # 9 9 9 9 9 9 9 * 0 # 0 0 0 0 0 0 1 menu menu +3500",
  },
  { name: "results/2d3x3", keys: "2 * * * * 3 * * * 3 menu menu" },
  { name: "results/2d3x3-after", keys: "2 * * * * 3 * * * 3 menu menu +3500" },
  { name: "results/1d3+1d3", keys: "1 * * * * 3 * 0 # 3 3 3 3 3 3 3 menu menu" },
  { name: "results/1d3+1d3-after", keys: "1 * * * * 3 * 0 # 3 3 3 3 3 3 3 menu menu +3500" },
  { name: "results/1d8", keys: "1 * * * * 8 menu menu" },
  { name: "results/1d8-after", keys: "1 * * * * 8 menu menu +3500" },
  { name: "results/12345678.5", keys: "1 2 3 4 5 6 7 8 * 0 # 5 menu menu" },
  { name: "results/12345678.5-after", keys: "1 2 3 4 5 6 7 8 * 0 # 5 menu menu +3500" },
  { name: "results/12345677.5", keys: "1 2 3 4 5 6 7 7 * 0 # 5 menu menu" },
  { name: "results/12345677.5-after", keys: "1 2 3 4 5 6 7 7 * 0 # 5 menu menu +3500" },
  { name: "results/-12345678.5", keys: "0 * * 1 2 3 4 5 6 7 8 * * 0 # 5 menu menu" },
  { name: "results/-12345678.5-after", keys: "0 * * 1 2 3 4 5 6 7 8 * * 0 # 5 menu menu +3500" },
  { name: "results/0.12345675", keys: "0 # 1 2 3 4 5 6 7 * 0 # 0 0 0 0 0 0 0 5 menu menu" },
  {
    name: "results/0.12345675-after",
    keys: "0 # 1 2 3 4 5 6 7 * 0 # 0 0 0 0 0 0 0 5 menu menu +3500",
  },
  { name: "results/1-1", keys: "1 * * 1 menu menu" },
  { name: "results/1-1-after", keys: "1 * * 1 menu menu +3500" },
  { name: "results/0.3-0.1", keys: "0 # 3 * * 0 # 1 menu menu" },
  { name: "results/0.3-0.1-after", keys: "0 # 3 * * 0 # 1 menu menu +3500" },
  { name: "results/-0.5+0.5", keys: "0 * * 0 # 5 * 0 # 5 menu menu" },
  { name: "results/-0.5+0.5-after", keys: "0 * * 0 # 5 * 0 # 5 menu menu +3500" },
  { name: "results/999999999x1", keys: "9 9 9 9 9 9 9 9 9 * * * 1 menu menu" },
  { name: "results/999999999x1-after", keys: "9 9 9 9 9 9 9 9 9 * * * 1 menu menu +3500" },
  { name: "results/-999999999+0", keys: "0 * * 9 9 9 9 9 9 9 9 9 * 0 menu menu" },
  { name: "results/-999999999+0-after", keys: "0 * * 9 9 9 9 9 9 9 9 9 * 0 menu menu +3500" },
  { name: "results/-99999999-1", keys: "0 * * 9 9 9 9 9 9 9 9 * * 1 menu menu" },
  { name: "results/-99999999-1-after", keys: "0 * * 9 9 9 9 9 9 9 9 * * 1 menu menu +3500" },
  { name: "results/0d5", keys: "0 * * * * 5 menu menu" },
  { name: "results/0d5-after", keys: "0 * * * * 5 menu menu +3500" },
  { name: "results/5d0.5", keys: "5 * * * * 0 # 5 menu menu" },
  { name: "results/5d0.5-after", keys: "5 * * * * 0 # 5 menu menu +3500" },
  { name: "results/literal-0.00000005x1", keys: "0 # 0 0 0 0 0 0 0 5 * * * 1 menu menu" },
  {
    name: "results/literal-0.00000005x1-after",
    keys: "0 # 0 0 0 0 0 0 0 5 * * * 1 menu menu +3500",
  },
  { name: "results/literal--0.00000005x1", keys: "0 * * 0 # 0 0 0 0 0 0 0 5 * * * 1 menu menu" },
  {
    name: "results/literal--0.00000005x1-after",
    keys: "0 * * 0 # 0 0 0 0 0 0 0 5 * * * 1 menu menu +3500",
  },
  {
    name: "results/literal-9.9999999+0.00000001",
    keys: "9 # 9 9 9 9 9 9 9 * 0 # 0 0 0 0 0 0 0 1 menu menu",
  },
  {
    name: "results/literal-9.9999999+0.00000001-after",
    keys: "9 # 9 9 9 9 9 9 9 * 0 # 0 0 0 0 0 0 0 1 menu menu +3500",
  },
  { name: "results/-123456789", keys: "0 * * 1 2 3 4 5 6 7 8 9 menu menu" },
  { name: "results/-123456789-after", keys: "0 * * 1 2 3 4 5 6 7 8 9 menu menu +3500" },
  { name: "rate/list/00", keys: "menu up menu" },
  { name: "rate/list/01", keys: "menu up menu down" },
  { name: "rate/list/02", keys: "menu up menu down down" },
  { name: "rate/list/03", keys: "menu up menu down down up" },
  { name: "rate/list-c", keys: "menu up menu c" },
  { name: "rate/list-c-2", keys: "menu up menu c c" },
  { name: "rate/list-from-operand", keys: "1 2 * 3 menu up" },
  { name: "rate/keys/virgin", keys: "menu up menu menu +500" },
  { name: "rate/keys/first-digit", keys: "menu up menu menu +500 5" },
  { name: "rate/keys/zero", keys: "menu up menu menu +500 0" },
  { name: "rate/keys/point", keys: "menu up menu menu +500 #" },
  { name: "rate/keys/point-twice", keys: "menu up menu menu +500 # #" },
  { name: "rate/keys/typed", keys: "menu up menu menu +500 1 # 5" },
  { name: "rate/keys/typed-point", keys: "menu up menu menu +500 1 # 5 # 2" },
  { name: "rate/keys/c", keys: "menu up menu menu +500 1 # 5 c" },
  { name: "rate/keys/c-2", keys: "menu up menu menu +500 1 # 5 c c" },
  { name: "rate/keys/c-to-empty", keys: "menu up menu menu +500 1 # 5 c c c" },
  { name: "rate/keys/c-on-zero", keys: "menu up menu menu +500 c" },
  { name: "rate/keys/c-on-zero-2", keys: "menu up menu menu +500 c +1000" },
  { name: "rate/keys/c-on-empty", keys: "menu up menu menu +500 1 c c +1000" },
  { name: "rate/keys/c-held", keys: "menu up menu menu +500 1 # 5 c@1500" },
  { name: "rate/keys/c-held-empty-digit", keys: "menu up menu menu +500 1 # 5 c@1500 7" },
  { name: "rate/keys/limit", keys: "menu up menu menu +500 1 2 3 4 5 6 7 8 9 0 1 2" },
  { name: "rate/keys/limit-point", keys: "menu up menu menu +500 1 # 1 2 3 4 5 6 7 8 9" },
  { name: "rate/keys/limit-zero-point", keys: "menu up menu menu +500 0 # 1 2 3 4 5 6 7 8 9" },
  { name: "rate/keys/ok-empty", keys: "menu up menu menu +500 c@1500 menu +500" },
  { name: "rate/keys/ok-empty-after", keys: "menu up menu menu +500 c@1500 menu +3500" },
  { name: "rate/keys/ok-point", keys: "menu up menu menu +500 # menu +500" },
  { name: "rate/keys/ok-point-after", keys: "menu up menu menu +500 # menu +3500" },
  { name: "rate/keys/up", keys: "menu up menu menu +500 1 up" },
  { name: "rate/keys/star", keys: "menu up menu menu +500 1 *" },
  { name: "rate/keys/up-digit", keys: "menu up menu menu +500 1 2 3 up 4" },
  { name: "rate/keys/up-c", keys: "menu up menu menu +500 1 2 3 up c" },
  { name: "rate/keys/up-down", keys: "menu up menu menu +500 1 2 3 up down" },
  { name: "rate/keys/down", keys: "menu up menu menu +500 1 2 3 down" },
  { name: "rate/keys/start-c", keys: "menu up menu menu +500 1 2 3 up up up c" },
  { name: "rate/keys/start-up", keys: "menu up menu menu +500 1 2 3 up up up up" },
  {
    name: "rate/keys/prefilled-digit",
    keys: "menu up menu menu +500 1 # 5 menu +3500 menu up menu menu +500 7",
  },
  {
    name: "rate/keys/prefilled-point",
    keys: "menu up menu menu +500 1 # 5 menu +3500 menu up menu menu +500 #",
  },
  { name: "rate/after/foreign-1.5-screen", keys: "menu up menu menu +500 1 # 5 menu +3500" },
  {
    name: "rate/after/foreign-1.5-foreign",
    keys: "menu up menu menu +500 1 # 5 menu +3500 menu up menu menu +500",
  },
  {
    name: "rate/after/foreign-1.5-domestic",
    keys: "menu up menu menu +500 1 # 5 menu +3500 menu up menu down menu +500",
  },
  {
    name: "rate/after/foreign-1.5-domestic-digit",
    keys: "menu up menu menu +500 1 # 5 menu +3500 menu up menu down menu +500 4",
  },
  {
    name: "rate/after/foreign-1.5-domestic-c",
    keys: "menu up menu menu +500 1 # 5 menu +3500 menu up menu down menu +500 c",
  },
  {
    name: "rate/after/foreign-1.5-domestic-c-2",
    keys: "menu up menu menu +500 1 # 5 menu +3500 menu up menu down menu +500 c c",
  },
  {
    name: "rate/after/domestic-2-foreign",
    keys: "menu up menu down menu +500 2 menu +3500 menu up menu menu +500",
  },
  {
    name: "rate/after/domestic-3-foreign",
    keys: "menu up menu down menu +500 3 menu +3500 menu up menu menu +500",
  },
  {
    name: "rate/after/domestic-3-domestic",
    keys: "menu up menu down menu +500 3 menu +3500 menu up menu down menu +500",
  },
  {
    name: "rate/after/ok-unchanged",
    keys: "menu up menu menu +500 1 # 5 menu +3500 menu up menu menu +500 menu +3500",
  },
  {
    name: "rate/after/ok-unchanged-domestic",
    keys: "menu up menu menu +500 1 # 5 menu +3500 menu up menu down menu +500 menu +3500",
  },
  {
    name: "rate/after/ok-unchanged-domestic-foreign",
    keys: "menu up menu menu +500 1 # 5 menu +3500 menu up menu down menu +500 menu +3500 menu up menu menu +500",
  },
  { name: "rate/after/foreign-with-operand", keys: "1 2 * 3 menu up menu +500" },
  { name: "convert/rate-0-10-in-domestic", keys: "1 0 menu down down down down down menu" },
  {
    name: "convert/rate-0-10-in-domestic-after",
    keys: "1 0 menu down down down down down menu +3500",
  },
  { name: "convert/rate-0-10-in-foreign", keys: "1 0 menu down down down down down down menu" },
  {
    name: "convert/rate-0-10-in-foreign-after",
    keys: "1 0 menu down down down down down down menu +3500",
  },
  {
    name: "convert/foreign-1.5-10-in-domestic",
    keys: "menu up menu menu +500 1 # 5 menu +3500 1 0 menu down down down down down menu",
  },
  {
    name: "convert/foreign-1.5-10-in-domestic-after",
    keys: "menu up menu menu +500 1 # 5 menu +3500 1 0 menu down down down down down menu +3500",
  },
  {
    name: "convert/foreign-1.5-10-in-foreign",
    keys: "menu up menu menu +500 1 # 5 menu +3500 1 0 menu down down down down down down menu",
  },
  {
    name: "convert/foreign-1.5-10-in-foreign-after",
    keys: "menu up menu menu +500 1 # 5 menu +3500 1 0 menu down down down down down down menu +3500",
  },
  {
    name: "convert/foreign-1.5-15-in-domestic",
    keys: "menu up menu menu +500 1 # 5 menu +3500 1 5 menu down down down down down menu",
  },
  {
    name: "convert/foreign-1.5-15-in-domestic-after",
    keys: "menu up menu menu +500 1 # 5 menu +3500 1 5 menu down down down down down menu +3500",
  },
  {
    name: "convert/foreign-1.5-15-in-foreign",
    keys: "menu up menu menu +500 1 # 5 menu +3500 1 5 menu down down down down down down menu",
  },
  {
    name: "convert/foreign-1.5-15-in-foreign-after",
    keys: "menu up menu menu +500 1 # 5 menu +3500 1 5 menu down down down down down down menu +3500",
  },
  {
    name: "convert/foreign-1.5-0.5-in-domestic",
    keys: "menu up menu menu +500 1 # 5 menu +3500 0 # 5 menu down down down down down menu",
  },
  {
    name: "convert/foreign-1.5-0.5-in-domestic-after",
    keys: "menu up menu menu +500 1 # 5 menu +3500 0 # 5 menu down down down down down menu +3500",
  },
  {
    name: "convert/foreign-1.5-0.5-in-foreign",
    keys: "menu up menu menu +500 1 # 5 menu +3500 0 # 5 menu down down down down down down menu",
  },
  {
    name: "convert/foreign-1.5-0.5-in-foreign-after",
    keys: "menu up menu menu +500 1 # 5 menu +3500 0 # 5 menu down down down down down down menu +3500",
  },
  {
    name: "convert/domestic-2-10-in-domestic",
    keys: "menu up menu down menu +500 2 menu +3500 1 0 menu down down down down down menu",
  },
  {
    name: "convert/domestic-2-10-in-domestic-after",
    keys: "menu up menu down menu +500 2 menu +3500 1 0 menu down down down down down menu +3500",
  },
  {
    name: "convert/domestic-2-10-in-foreign",
    keys: "menu up menu down menu +500 2 menu +3500 1 0 menu down down down down down down menu",
  },
  {
    name: "convert/domestic-2-10-in-foreign-after",
    keys: "menu up menu down menu +500 2 menu +3500 1 0 menu down down down down down down menu +3500",
  },
  {
    name: "convert/domestic-2-5-in-domestic",
    keys: "menu up menu down menu +500 2 menu +3500 5 menu down down down down down menu",
  },
  {
    name: "convert/domestic-2-5-in-domestic-after",
    keys: "menu up menu down menu +500 2 menu +3500 5 menu down down down down down menu +3500",
  },
  {
    name: "convert/domestic-2-5-in-foreign",
    keys: "menu up menu down menu +500 2 menu +3500 5 menu down down down down down down menu",
  },
  {
    name: "convert/domestic-2-5-in-foreign-after",
    keys: "menu up menu down menu +500 2 menu +3500 5 menu down down down down down down menu +3500",
  },
  {
    name: "convert/domestic-3-10-in-domestic",
    keys: "menu up menu down menu +500 3 menu +3500 1 0 menu down down down down down menu",
  },
  {
    name: "convert/domestic-3-10-in-domestic-after",
    keys: "menu up menu down menu +500 3 menu +3500 1 0 menu down down down down down menu +3500",
  },
  {
    name: "convert/domestic-3-10-in-foreign",
    keys: "menu up menu down menu +500 3 menu +3500 1 0 menu down down down down down down menu",
  },
  {
    name: "convert/domestic-3-10-in-foreign-after",
    keys: "menu up menu down menu +500 3 menu +3500 1 0 menu down down down down down down menu +3500",
  },
  {
    name: "convert/domestic-3-1-in-domestic",
    keys: "menu up menu down menu +500 3 menu +3500 1 menu down down down down down menu",
  },
  {
    name: "convert/domestic-3-1-in-domestic-after",
    keys: "menu up menu down menu +500 3 menu +3500 1 menu down down down down down menu +3500",
  },
  {
    name: "convert/domestic-3-1-in-foreign",
    keys: "menu up menu down menu +500 3 menu +3500 1 menu down down down down down down menu",
  },
  {
    name: "convert/domestic-3-1-in-foreign-after",
    keys: "menu up menu down menu +500 3 menu +3500 1 menu down down down down down down menu +3500",
  },
  {
    name: "convert/foreign-3-10-in-domestic",
    keys: "menu up menu menu +500 3 menu +3500 1 0 menu down down down down down menu",
  },
  {
    name: "convert/foreign-3-10-in-domestic-after",
    keys: "menu up menu menu +500 3 menu +3500 1 0 menu down down down down down menu +3500",
  },
  {
    name: "convert/foreign-3-10-in-foreign",
    keys: "menu up menu menu +500 3 menu +3500 1 0 menu down down down down down down menu",
  },
  {
    name: "convert/foreign-3-10-in-foreign-after",
    keys: "menu up menu menu +500 3 menu +3500 1 0 menu down down down down down down menu +3500",
  },
  {
    name: "convert/foreign-3-1-in-domestic",
    keys: "menu up menu menu +500 3 menu +3500 1 menu down down down down down menu",
  },
  {
    name: "convert/foreign-3-1-in-domestic-after",
    keys: "menu up menu menu +500 3 menu +3500 1 menu down down down down down menu +3500",
  },
  {
    name: "convert/foreign-3-1-in-foreign",
    keys: "menu up menu menu +500 3 menu +3500 1 menu down down down down down down menu",
  },
  {
    name: "convert/foreign-3-1-in-foreign-after",
    keys: "menu up menu menu +500 3 menu +3500 1 menu down down down down down down menu +3500",
  },
  {
    name: "convert/foreign-100-99999999-in-domestic",
    keys: "menu up menu menu +500 1 0 0 menu +3500 9 9 9 9 9 9 9 9 menu down down down down down menu",
  },
  {
    name: "convert/foreign-100-99999999-in-domestic-after",
    keys: "menu up menu menu +500 1 0 0 menu +3500 9 9 9 9 9 9 9 9 menu down down down down down menu +3500",
  },
  {
    name: "convert/foreign-100-99999999-in-foreign",
    keys: "menu up menu menu +500 1 0 0 menu +3500 9 9 9 9 9 9 9 9 menu down down down down down down menu",
  },
  {
    name: "convert/foreign-100-99999999-in-foreign-after",
    keys: "menu up menu menu +500 1 0 0 menu +3500 9 9 9 9 9 9 9 9 menu down down down down down down menu +3500",
  },
  {
    name: "convert/foreign-100-1-in-domestic",
    keys: "menu up menu menu +500 1 0 0 menu +3500 1 menu down down down down down menu",
  },
  {
    name: "convert/foreign-100-1-in-domestic-after",
    keys: "menu up menu menu +500 1 0 0 menu +3500 1 menu down down down down down menu +3500",
  },
  {
    name: "convert/foreign-100-1-in-foreign",
    keys: "menu up menu menu +500 1 0 0 menu +3500 1 menu down down down down down down menu",
  },
  {
    name: "convert/foreign-100-1-in-foreign-after",
    keys: "menu up menu menu +500 1 0 0 menu +3500 1 menu down down down down down down menu +3500",
  },
  {
    name: "convert/foreign-0.5-0.0000001-in-domestic",
    keys: "menu up menu menu +500 0 # 5 menu +3500 0 # 0 0 0 0 0 0 1 menu down down down down down menu",
  },
  {
    name: "convert/foreign-0.5-0.0000001-in-domestic-after",
    keys: "menu up menu menu +500 0 # 5 menu +3500 0 # 0 0 0 0 0 0 1 menu down down down down down menu +3500",
  },
  {
    name: "convert/foreign-0.5-0.0000001-in-foreign",
    keys: "menu up menu menu +500 0 # 5 menu +3500 0 # 0 0 0 0 0 0 1 menu down down down down down down menu",
  },
  {
    name: "convert/foreign-0.5-0.0000001-in-foreign-after",
    keys: "menu up menu menu +500 0 # 5 menu +3500 0 # 0 0 0 0 0 0 1 menu down down down down down down menu +3500",
  },
  {
    name: "convert/foreign-0.5-3-in-domestic",
    keys: "menu up menu menu +500 0 # 5 menu +3500 3 menu down down down down down menu",
  },
  {
    name: "convert/foreign-0.5-3-in-domestic-after",
    keys: "menu up menu menu +500 0 # 5 menu +3500 3 menu down down down down down menu +3500",
  },
  {
    name: "convert/foreign-0.5-3-in-foreign",
    keys: "menu up menu menu +500 0 # 5 menu +3500 3 menu down down down down down down menu",
  },
  {
    name: "convert/foreign-0.5-3-in-foreign-after",
    keys: "menu up menu menu +500 0 # 5 menu +3500 3 menu down down down down down down menu +3500",
  },
  {
    name: "convert/foreign-1.5-result-in-domestic",
    keys: "menu up menu menu +500 1 # 5 menu +3500 4 * 6 menu menu menu down down down down down menu",
  },
  {
    name: "convert/foreign-1.5-converted-star",
    keys: "menu up menu menu +500 1 # 5 menu +3500 1 0 menu down down down down down menu *",
  },
  {
    name: "convert/foreign-1.5-converted-digit",
    keys: "menu up menu menu +500 1 # 5 menu +3500 1 0 menu down down down down down menu 7",
  },
  {
    name: "convert/foreign-1.5-twice",
    keys: "menu up menu menu +500 1 # 5 menu +3500 1 0 menu down down down down down menu menu down down down down down menu",
  },
  {
    name: "rate/keys/ok-empty-reopen",
    keys: "menu up menu menu +500 c menu +3500 menu up menu menu +500",
  },
  {
    name: "rate/keys/ok-empty-reopen-domestic",
    keys: "menu up menu menu +500 c menu +3500 menu up menu down menu +500",
  },
  {
    name: "rate/keys/ok-point-reopen",
    keys: "menu up menu menu +500 # menu +3500 menu up menu menu +500",
  },
  {
    name: "rate/keys/ok-empty-in-domestic",
    keys: "menu up menu menu +500 c menu +3500 1 0 menu down down down down down menu",
  },
  { name: "rate/keys/up-mid-digit", keys: "menu up menu menu +500 1 2 3 up up 4" },
  { name: "rate/keys/up-mid", keys: "menu up menu menu +500 1 2 3 up up" },
  { name: "rate/keys/down-mid", keys: "menu up menu menu +500 1 2 3 down +480" },
  { name: "rate/keys/limit-insert", keys: "menu up menu menu +500 1 2 3 4 5 6 7 up 8" },
  { name: "rate/keys/limit-blink", keys: "menu up menu menu +500 1 2 3 4 5 6 7 8 9 0 1 2 +480" },
  {
    name: "rate/keys/limit-point-blink",
    keys: "menu up menu menu +500 1 # 1 2 3 4 5 6 7 8 9 +480",
  },
  {
    name: "rate/keys/limit-zero-point-blink",
    keys: "menu up menu menu +500 0 # 1 2 3 4 5 6 7 8 9 +480",
  },
  { name: "rate/keys/point-blink", keys: "menu up menu menu +500 # +480" },
  { name: "rate/keys/point-twice-blink", keys: "menu up menu menu +500 # # +480" },
  { name: "rate/keys/typed-blink", keys: "menu up menu menu +500 1 # 5 +480" },
  { name: "persist/before", keys: "menu up menu menu +500 1 # 5 menu +3500" },
  { name: "persist/boot-first", keys: "", setup: "persist" },
  { name: "persist/boot-foreign", keys: "menu up menu menu +500", setup: "persist" },
  { name: "persist/boot-foreign-blink", keys: "menu up menu menu +500 +480", setup: "persist" },
  { name: "persist/boot-domestic", keys: "menu up menu down menu +500", setup: "persist" },
  {
    name: "persist/boot-domestic-blink",
    keys: "menu up menu down menu +500 +480",
    setup: "persist",
  },
  { name: "persist/reentry", keys: "", setup: "reentry" },
  {
    name: "persist/restore-set",
    keys: "menu up menu down menu +500 2 menu +3500 menu up menu down menu +500",
  },
  { name: "persist/restore-done", keys: "", setup: "restore" },
  { name: "persist/restore-first", keys: "", setup: "restore" },
  { name: "persist/restore-foreign", keys: "menu up menu menu +500", setup: "restore" },
  { name: "persist/restore-domestic", keys: "menu up menu down menu +500", setup: "restore" },
  { name: "persist/restore-foreign-blink", keys: "menu up menu menu +500 +480", setup: "restore" },
  {
    name: "persist/restore-domestic-blink",
    keys: "menu up menu down menu +500 +480",
    setup: "restore",
  },
  {
    name: "persist/restore-foreign-set",
    keys: "menu up menu menu +500 1 # 5 menu +3500 menu up menu menu +500",
  },
  { name: "persist/restore-foreign-done", keys: "", setup: "restore-foreign" },
  { name: "persist/restore-foreign-first", keys: "", setup: "restore-foreign" },
  {
    name: "persist/restore-foreign-foreign",
    keys: "menu up menu menu +500",
    setup: "restore-foreign",
  },
  {
    name: "persist/restore-foreign-domestic",
    keys: "menu up menu down menu +500",
    setup: "restore-foreign",
  },
  {
    name: "persist/restore-foreign-foreign-blink",
    keys: "menu up menu menu +500 +480",
    setup: "restore-foreign",
  },
  {
    name: "persist/restore-foreign-domestic-blink",
    keys: "menu up menu down menu +500 +480",
    setup: "restore-foreign",
  },
];

/** D9 (plan 22): Options' digits, `*` and `#` leave for standby number entry with DTMF pairs. */
const STANDBY_ENTRY = "pending:22" as const satisfies GoldenStatus;

/**
 * Every other fixture is asserted: its scenario passes (Task 8), or fails as a known gap with
 * its measured cause (tests/acceptance/20-calculator.test.ts).
 */
const ASSERTED = "asserted" as const satisfies GoldenStatus;

/** A still fixture: the case directories it holds, and what it shows. */
interface StillFixture {
  readonly id: string;
  readonly note: string;
}

/** The fixture a case's image belongs to: one per capture directory (plan20/<dir>/<image>). */
export function stillFixtureOf(name: string): { readonly id: string; readonly image: string } {
  const slash = name.lastIndexOf("/");
  if (slash < 0) throw new Error(`calculator case "${name}" has no directory`);
  const dir = name.slice(0, slash);
  const image = name.slice(slash + 1);
  // The `-up` stills of each Options state sit beside its scroll; the rate list's C and
  // from-operand stills beside its pages.
  if (dir === "options") return { id: `calculator/options-${image.replace(/-up$/, "")}`, image };
  if (dir === "rate") return { id: "calculator/rate-list", image };
  return { id: `calculator/${dir.replace(/\//g, "-")}`, image };
}

export const CALCULATOR_STILLS: readonly StillFixture[] = [
  {
    id: "calculator/entry",
    note: "Digits, leading zeros, the 9-character limit, #, C, C held, C to 0, ▲/▼.",
  },
  {
    id: "calculator/operators",
    note: "A digit after each operator, * after a second operand, # with an operator, three long lines, C held, * 2.4 s apart.",
  },
  { id: "calculator/operators-star", note: "12, then * ×1…5: + - * / and back to +." },
  { id: "calculator/operators-star-zero", note: "0, then * ×1…5." },
  { id: "calculator/operators-star-result", note: "The result 15 (12 + 3, Equals), then * ×1…5." },
  {
    id: "calculator/operators-c-through",
    note: "12 + 34, then C ×5: through the operand, the operator, the first operand to 0.",
  },
  {
    id: "calculator/options-number",
    note: "Options on 12 (8 entries): ▼ through the wrap, and ▲ from the first.",
  },
  {
    id: "calculator/options-operator",
    note: "Options on 12 - (4 entries): ▼ through the wrap, and ▲ from the first.",
  },
  {
    id: "calculator/options-operand",
    note: "Options on 12 - 3 (5 entries): ▼ through the wrap, and ▲ from the first.",
  },
  {
    id: "calculator/choose",
    note: "Every Options entry in every state, C on Options, and keys after a result.",
  },
  {
    id: "calculator/results",
    note: "The arithmetic table (Task 0 R), each result and 3.5 s later; literal over-limit inputs truncate (corrected R criterion).",
  },
  {
    id: "calculator/rate-list",
    note: "Exchange rate's pages 8-1 and 8-2, the wrap, C, and the list from an operand.",
  },
  {
    id: "calculator/rate-keys",
    note: "The rate entry: first digit, #, C, C held, the 7-character limit, cursor edits, prefill, OK on empty and on .",
  },
  {
    id: "calculator/rate-after",
    note: "The prompts after Rate saved in both directions (the reciprocal), OK unchanged, the list from an operand.",
  },
  {
    id: "calculator/convert",
    note: "In domestic and In foreign at rate 0, Foreign 1.5/3/100/0.5 and Domestic 2/3: results, overflow, chaining.",
  },
  {
    id: "calculator/persist",
    note: "The rate after saveflash and a cold boot, re-entry at 0, and Restore factory settings after either direction.",
  },
];

/**
 * A case's golden image name: its file stem, with `.` as `p` and `+` as `plus` where the golden
 * format's [a-z0-9-] needs it (`results/0.1+0.2` → `0p1plus0p2`).
 */
export function imageNameOf(name: string): string {
  return stillFixtureOf(name).image.replace(/\./g, "p").replace(/\+/g, "plus");
}

/** A case with no image or an image with no case: names both sides. */
export class CalculatorCaptureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalculatorCaptureError";
  }
}

/**
 * The still fixtures from `cases`, images in case order. `images(dir)` lists a capture
 * directory's PNG stems (no `@8x` previews) that match `listable` (the importer's io lists the
 * numbered ones only): every listed image needs a case, and every listable case its image.
 */
export function calculatorStills(
  cases: readonly CalculatorCase[],
  images?: (dir: string) => readonly string[] | undefined,
  listable: RegExp = /^/,
): CaptureSetEntry[] {
  const files = new Map<string, ShotFile[]>();
  const dirs = new Set<string>();
  const named = new Set<string>();
  for (const { name } of cases) {
    if (named.has(name)) throw new CalculatorCaptureError(`case ${name} is listed twice`);
    named.add(name);
    const { id, image } = stillFixtureOf(name);
    if (!CALCULATOR_STILLS.some((fixture) => fixture.id === id)) {
      throw new CalculatorCaptureError(`case ${name}: no still fixture ${id}`);
    }
    dirs.add(name.slice(0, name.lastIndexOf("/")));
    const file = `plan20/${name}.png`;
    const imageName = imageNameOf(name);
    files.set(id, [
      ...(files.get(id) ?? []),
      imageName === image ? file : { file, name: imageName },
    ]);
  }
  if (images !== undefined) {
    for (const dir of [...dirs].sort()) {
      const listed = images(`plan20/${dir}`);
      if (listed === undefined) continue;
      for (const stem of listed) {
        if (!named.has(`${dir}/${stem}`)) {
          throw new CalculatorCaptureError(
            `image plan20/${dir}/${stem}.png has no case in CALCULATOR_CASES`,
          );
        }
      }
      for (const name of named) {
        const stem = name.slice(name.lastIndexOf("/") + 1);
        if (name.slice(0, name.lastIndexOf("/")) !== dir || !listable.test(stem)) continue;
        if (!listed.includes(stem)) {
          throw new CalculatorCaptureError(`case ${name} has no image plan20/${name}.png`);
        }
      }
    }
  }
  return CALCULATOR_STILLS.map(({ id, note }) => {
    const shots = files.get(id);
    if (shots === undefined) throw new CalculatorCaptureError(`still fixture ${id} has no case`);
    return {
      id,
      kind: "still",
      status: ASSERTED,
      prefer: {
        source: { kind: "shots", files: shots },
        note: `${note} Each image's keys from the first screen are its CALCULATOR_CASES entry.`,
      },
    };
  });
}

/** A recording of plan20/ as a timeline golden. */
interface CalculatorRecording {
  readonly id: string;
  readonly dir: string;
  /** The first frame the trigger key changed (0: it changed nothing at once). */
  readonly triggerFrame: number;
  readonly note: string;
  readonly status?: GoldenStatus;
}

const NOTE_KEYS = [
  ["c", "C"],
  ["digit", "5"],
  ["down", "▼"],
  ["c-held", "C held 1.5 s"],
] as const;

const NOTE_SETUPS = {
  "divide-by-zero": "7 / 0",
  "out-of-range": "99999 * 99999",
} as const;

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

/** Rate entry keys of the factory key recordings (`sound/keys-rate-<slug>`). */
export const RATE_KEY_SLUGS = [...DIGITS, "star", "hash", "up", "down", "c", "menu"] as const;

/** Options keys: those that leave for standby number entry (D9) and those that stay. */
export const OPTIONS_ESCAPE_SLUGS = [...DIGITS, "star", "hash"] as const;
export const OPTIONS_KEY_SLUGS = ["up", "down", "c", "menu"] as const;

const KEY_NAMES: Readonly<Record<string, string>> = { star: "*", hash: "#", menu: "OK", c: "C" };
const keyName = (slug: string): string =>
  KEY_NAMES[slug] ?? (slug.length === 1 ? slug : slug === "up" ? "▲" : "▼");

/** The keys that change nothing at once: the next frame is the cursor's blink (Task 0 S). */
const RATE_KEYS_UNCHANGED: ReadonlySet<string> = new Set(["star", "up", "down"]);

export const CALCULATOR_RECORDINGS: readonly CalculatorRecording[] = [
  {
    id: "calculator/open",
    dir: "open",
    triggerFrame: 1,
    note: "Select on Calculator: the first screen, 0 above Options.",
  },
  {
    id: "calculator/exit",
    dir: "exit",
    triggerFrame: 1,
    note: "C on the first screen's 0: the carousel, its Calculator icon restarting, 10 s.",
  },
  {
    id: "calculator/clear-held",
    dir: "clear-held",
    triggerFrame: 1,
    note: "5 6 7, C held 2 s (deletes, then clears), 1, * and # held 1.2 s (each enters once while down), C held on 1 + 0. (deletes, then clears), C held on 0 (the carousel, then standby).",
  },
  {
    id: "calculator/operator-slow",
    dir: "operator-slow",
    triggerFrame: 1,
    note: "12, then * three times 3 s apart: + - * (no multi-tap timeout).",
  },
  ...(["divide-by-zero", "out-of-range"] as const).flatMap((kind): CalculatorRecording[] => [
    {
      id: `calculator/${kind}`,
      dir: `notes/${kind}`,
      triggerFrame: 1,
      note: `${NOTE_SETUPS[kind]}, Options, OK on Equals: the note, then the screen before Equals.`,
    },
    {
      id: `calculator/${kind}-add`,
      dir: `notes/${kind}-add`,
      triggerFrame: 1,
      note: `${NOTE_SETUPS[kind]}, Options, ▼, OK on Add: the note, then the screen before.`,
    },
    ...NOTE_KEYS.map(
      ([slug, what]): CalculatorRecording => ({
        id: `calculator/note-keys-${kind}-${slug}`,
        dir: `notes/keys-${kind}-${slug}`,
        triggerFrame: 1,
        note: `${NOTE_SETUPS[kind]}, Options, OK on Equals, then ${what} 500 ms into the note.`,
      }),
    ),
  ]),
  {
    id: "calculator/in-foreign-rate-0",
    dir: "notes/in-foreign-rate-0",
    triggerFrame: 1,
    note: "10, Options, ▼ ×6, OK on In foreign at the virgin rate 0: Dividing by zero not allowed, then 10.",
  },
  {
    id: "calculator/rate-prompt-foreign",
    dir: "rate/prompt-foreign",
    triggerFrame: 1,
    note: "Exchange rate, OK on 8-1 (virgin): the prompt with 0 and its cursor blink, 3 s.",
  },
  {
    id: "calculator/rate-prompt-domestic",
    dir: "rate/prompt-domestic",
    triggerFrame: 1,
    note: "Exchange rate, ▼, OK on 8-2 (virgin): the empty prompt and its cursor blink, 3 s.",
  },
  {
    id: "calculator/rate-blink-keys",
    dir: "rate/blink-keys",
    triggerFrame: 1,
    note: "OK on 8-1, then 5 at 760 ms and 6 at 1760 ms: the blink runs on through the keys.",
  },
  {
    id: "calculator/rate-saved",
    dir: "rate/saved",
    triggerFrame: 1,
    note: "The Foreign prompt with 1.5, OK: Rate saved (tick), then the calculator.",
  },
  ...(["restore", "restore-foreign"] as const).flatMap((prefix): CalculatorRecording[] => {
    const set = prefix === "restore" ? "Domestic 2" : "Foreign 1.5";
    return [
      {
        id: `calculator/persist-${prefix}-run`,
        dir: `persist/${prefix}-run`,
        triggerFrame: 1,
        note: `${set} saved; Restore factory settings, 12345, OK: Settings restored, the page.`,
      },
      ...(["foreign", "domestic"] as const).map(
        (to): CalculatorRecording => ({
          id: `calculator/persist-${prefix}-prompt-${to}`,
          dir: `persist/${prefix}-prompt-${to}`,
          triggerFrame: 1,
          note: `${set} saved, then Restore factory settings: OK on the ${to === "foreign" ? "8-1" : "8-2"} page, the prompt (rate 1) and its blink.`,
        }),
      ),
    ];
  }),
  // The factory key recordings' LCD, paired with their sound goldens.
  ...RATE_KEY_SLUGS.map(
    (slug): CalculatorRecording => ({
      id: `calculator/keys-rate-${slug}`,
      dir: `sound/keys-rate-${slug}`,
      triggerFrame: RATE_KEYS_UNCHANGED.has(slug) ? 0 : 1,
      note: `The Foreign prompt with 1 (factory), then ${keyName(slug)}${RATE_KEYS_UNCHANGED.has(slug) ? " (nothing changes at once; the cursor's next blink)" : ""}.`,
    }),
  ),
  ...OPTIONS_KEY_SLUGS.map(
    (slug): CalculatorRecording => ({
      id: `calculator/keys-options-${slug}`,
      dir: `sound/keys-options-${slug}`,
      triggerFrame: 1,
      note: `Options on 0 (factory), then ${keyName(slug)}.`,
    }),
  ),
  ...OPTIONS_ESCAPE_SLUGS.map(
    (slug): CalculatorRecording => ({
      id: `calculator/keys-options-${slug}`,
      dir: `sound/keys-options-${slug}`,
      triggerFrame: 1,
      status: STANDBY_ENTRY,
      note: `Options on 0 (factory), then ${keyName(slug)}: standby number entry (Call). Pending plan 22's standby-entry handoff (D9).`,
    }),
  ),
  ...(["0", "1"] as const).map(
    (key): CalculatorRecording => ({
      id: `calculator/options-dtmf-confirm-${key}`,
      dir: `sound/options-dtmf-confirm-${key}`,
      triggerFrame: 1,
      status: STANDBY_ENTRY,
      note: `Options on 0 (factory), then ${key}: standby number entry with Call (independent confirmation). Pending plan 22 (D9).`,
    }),
  ),
];

function recordingEntries(): CaptureSetEntry[] {
  return CALCULATOR_RECORDINGS.map((recording) => ({
    id: recording.id,
    kind: "timeline",
    status: recording.status ?? ASSERTED,
    prefer: {
      source: { kind: "recording", dir: `plan20/${recording.dir}` },
      triggerFrame: recording.triggerFrame,
      note: recording.note,
    },
  }));
}

/**
 * The sound goldens (factory unless named): plan 16's normalisation (`buildSoundGolden`). The two
 * warning-tone notes are `sound/note/…` goldens whose note quotes their text, the form plan 16's
 * extractor reads warning tones from (`NOTE_SOUNDS`).
 */
/** A factory recording unless `state` says otherwise; asserted unless `status` says. */
type SoundRow = Omit<SoundCaptureEntry, "state" | "status"> & {
  readonly state?: string;
  readonly status?: GoldenStatus;
};

export const CALCULATOR_SOUNDS: readonly SoundCaptureEntry[] = (
  [
    {
      id: "sound/calculator/keys",
      dir: "plan20/sound/keys",
      note: "Every key on the calculator screen, in Options (▼ ▲ C, OK on Equals) and in the rate entry, then C held.",
    },
    {
      id: "sound/note/calculator-out-of-range",
      dir: "plan20/sound/out-of-range",
      note: '"Out of range" (Warning tones On) after 99999 * 99999, Options, OK on Equals.',
    },
    {
      id: "sound/note/calculator-divide-by-zero",
      dir: "plan20/sound/divide-by-zero",
      note: '"Dividing by zero not allowed" (Warning tones On) after 7 / 0, Options, OK on Equals.',
    },
    {
      id: "sound/calculator/divide-by-zero-virgin",
      dir: "plan20/sound/divide-by-zero-virgin",
      state: "virgin",
      note: "Virgin (Warning tones unset): 7 / 0, Options, OK on Equals: the note is silent, Options' key beeps.",
    },
    {
      id: "sound/calculator/note-key",
      dir: "plan20/sound/note-key",
      note: "99999 * 99999, Options, OK on Equals (Out of range), then 5 500 ms into the note.",
    },
    {
      id: "sound/calculator/rate-saved",
      dir: "plan20/sound/rate-saved",
      note: "The empty Foreign prompt (C held), 2, OK: Rate saved adds no tone; OK beeps.",
    },
    ...RATE_KEY_SLUGS.map((slug) => ({
      id: `sound/calculator/keys-rate-${slug}`,
      dir: `plan20/sound/keys-rate-${slug}`,
      note: `The Foreign prompt with 1, then ${keyName(slug)}.`,
    })),
    ...OPTIONS_KEY_SLUGS.map((slug) => ({
      id: `sound/calculator/keys-options-${slug}`,
      dir: `plan20/sound/keys-options-${slug}`,
      note: `Options on 0, then ${keyName(slug)}.`,
    })),
    ...OPTIONS_ESCAPE_SLUGS.map((slug) => ({
      id: `sound/calculator/keys-options-${slug}`,
      dir: `plan20/sound/keys-options-${slug}`,
      status: STANDBY_ENTRY,
      note: `Options on 0, then ${keyName(slug)}: its DTMF pair (two simultaneous tones). Pending plan 22 and the dual-frequency sound contract (D9).`,
    })),
    ...(["0", "1"] as const).map((key) => ({
      id: `sound/calculator/options-dtmf-confirm-${key}`,
      dir: `plan20/sound/options-dtmf-confirm-${key}`,
      status: STANDBY_ENTRY,
      note: `Options on 0, then ${key}: its DTMF pair (independent confirmation). Pending plan 22 (D9).`,
    })),
  ] satisfies SoundRow[]
).map(
  (entry: SoundRow): SoundCaptureEntry => ({
    ...entry,
    state: entry.state ?? "factory",
    status: entry.status ?? ASSERTED,
  }),
);

export function calculatorSounds(io: SoundCaptureIo): SoundGolden[] {
  return CALCULATOR_SOUNDS.map((entry) => buildSoundGolden(entry, io));
}

/** Every LCD fixture; `io` lists numbered capture images (the sequence directories). */
export function calculatorLcd(io?: CaptureIo): CaptureSetEntry[] {
  return [
    ...calculatorStills(CALCULATOR_CASES, (dir) => io?.frames.scrollImages(dir), /^\d+$/),
    ...recordingEntries(),
  ];
}

export const calculator: PlanCaptureSet = {
  plan: "20",
  resources,
  lcd: (io) => calculatorLcd(io),
  sounds: (io) => calculatorSounds(io.sound),
  notImported: {
    "plan20/{open,exit,clear-held,operator-slow,rate/*}.wav, .events.csv":
      "virgin LCD recordings' audio: the factory sound/ recordings hold the calculator's sounds",
    "plan20/sound/{keys,out-of-range,divide-by-zero,divide-by-zero-virgin,note-key,rate-saved}/ frames":
      "their LCD repeats the stills and notes/ recordings; only their sound is imported",
    "plan20/**/*@8x.png": "previews",
    "plan20/text.json, task0-evidence.json, check.txt, cases/":
      "OCR, Task 0 evidence and per-section cases (merged into cases.json, transcribed as CALCULATOR_CASES)",
    "scratch-plan20/": "planning probes (plan 20 C1-C7), never imported",
  },
};
