// Plan 20 Task 4: the calculator's rules (pure, no widget or timer). Expected lines are the
// stills' text (plan20/text.json, checked against the PNGs where OCR misses the `-` operator),
// transcribed from Task 0's cases.
import { describe, expect, it } from "vite-plus/test";
import type { CalcResult } from "../src/calculator/decimal";
import {
  CALCULATOR_START,
  chooseOption,
  clearHeld,
  displayLines,
  OPTION_LABELS,
  optionsFor,
  pressKey,
  type CalculatorKey,
  type CalculatorState,
  type OptionId,
  type Step,
} from "../src/calculator/engine";

/** A virgin rate (Foreign 0): In domestic multiplies by 0, In foreign divides by it. */
const VIRGIN_RATE = (amount: string, to: "domestic" | "foreign"): CalcResult =>
  to === "domestic" ? { ok: "0" } : { error: "divide-by-zero" };

/**
 * Keys from the first screen: calculator keys, `=` for Options › Equals and `[add]` etc. for
 * another Options entry. Returns the last step (its note or leave) and the state.
 */
function run(keys: string, from: CalculatorState = CALCULATOR_START): Step {
  let step: Step = { state: from };
  for (const token of keys.match(/\[[a-z-]+\]|=|\S/g) ?? []) {
    const state = step.state;
    if (token === "=") step = chooseOption(state, "equals", VIRGIN_RATE);
    else if (token.startsWith("[")) {
      step = chooseOption(
        state,
        token.slice(1, -1) as Exclude<OptionId, "exchange-rate">,
        VIRGIN_RATE,
      );
    } else step = pressKey(state, token as CalculatorKey);
    // A note restores the state before the action (the next key starts from it).
    if (step.note !== undefined) expect(step.state).toEqual(state);
  }
  return step;
}

const lines = (keys: string): readonly string[] => displayLines(run(keys).state);

describe("entry (calculator/entry)", () => {
  it.each([
    ["", ["0"]],
    ["7", ["7"]],
    ["00", ["0"]],
    ["05", ["5"]],
    ["123456789", ["123456789"]],
    ["1234567891", ["123456789"]],
    ["12#345678", ["12.345678"]],
    ["12#3456789", ["12.345678"]],
    ["#", ["0."]],
    ["#5", ["0.5"]],
    ["##", ["0."]],
    ["##5", ["0.5"]],
    ["0#", ["0."]],
    ["123#", ["123."]],
    ["12#3#4", ["12.34"]],
    ["123456789#", ["123456789"]],
    ["12345678#", ["12345678."]],
    ["12345678#9", ["12345678."]],
    ["0#0012345", ["0.0012345"]],
    ["123c", ["12"]],
    ["12#c", ["12"]],
    ["12#5c", ["12."]],
    ["12#5cc", ["12"]],
    ["12cc", ["0"]],
    ["#c", ["0"]],
    ["#cc", ["0"]],
    ["123456789c", ["12345678"]],
    ["0c", ["0"]],
    ["00c", ["0"]],
  ])("%s shows %j", (keys, expected) => {
    expect(lines(keys)).toEqual(expected);
  });

  it("leaves on C with nothing typed, and after clearing a result", () => {
    expect(run("c").leave).toBe(true);
    expect(run("0c").leave).toBeUndefined();
    expect(run("0cc").leave).toBe(true);
    // `entry/result-c-c`: 12 + 3, Equals, C (0), C: the carousel.
    expect(displayLines(run("12*3=c").state)).toEqual(["0"]);
    expect(run("12*3=cc").leave).toBe(true);
  });

  it("clears everything when C is held (entry/c-held-*, operators/c-held-*)", () => {
    expect(displayLines(clearHeld(run("567c").state))).toEqual(["0"]);
    expect(displayLines(clearHeld(run("12*34c").state))).toEqual(["0"]);
    expect(clearHeld(run("12*c").state)).toEqual(CALCULATOR_START);
  });
});

describe("operators (calculator/operators*)", () => {
  it.each([
    ["12*", ["12", "+"]],
    ["12**", ["12", "-"]],
    ["12***", ["12", "*"]],
    ["12****", ["12", "/"]],
    ["12*****", ["12", "+"]],
    ["*", ["0", "+"]],
    ["*****", ["0", "+"]],
    ["12*3=*", ["15", "+"]],
    ["12*3=****", ["15", "/"]],
    ["12*3", ["12", "+", "3"]],
    ["12**3", ["12", "-", "3"]],
    ["12***3", ["12", "*", "3"]],
    ["12****3", ["12", "/", "3"]],
    ["12*34", ["12", "+", "34"]],
    ["12*34c", ["12", "+", "3"]],
    ["12*34cc", ["12", "+"]],
    ["12*34ccc", ["12"]],
    ["12*34cccc", ["1"]],
    ["12*34ccccc", ["0"]],
    ["12*3*", ["15", "+"]],
    ["12*3**", ["15", "-"]],
    ["12**3*", ["9", "+"]],
    ["12*#", ["12", "+", "0."]],
    ["12*#5", ["12", "+", "0.5"]],
    ["1234#5678***0#0012345", ["1234.5678", "*", "0.0012345"]],
    ["12*1234567891", ["12", "+", "123456789"]],
  ])("%s shows %j", (keys, expected) => {
    expect(lines(keys)).toEqual(expected);
  });
});

describe("Options (calculator/options-*, calculator/choose)", () => {
  const labels = (keys: string) => optionsFor(run(keys).state).map((id) => OPTION_LABELS[id]);

  it("lists 8, 4 or 5 entries by state", () => {
    const all = [
      "Equals",
      "Add",
      "Subtract",
      "Multiply",
      "Divide",
      "In domestic",
      "In foreign",
      "Exchange rate",
    ];
    expect(labels("")).toEqual(all);
    expect(labels("12")).toEqual(all);
    expect(labels("12*3=")).toEqual(all);
    expect(labels("12**")).toEqual(["Add", "Subtract", "Multiply", "Divide"]);
    expect(labels("12**3")).toEqual(["Equals", "Add", "Subtract", "Multiply", "Divide"]);
  });

  it.each([
    ["12=", ["12"]],
    ["12[add]", ["12", "+"]],
    ["12[subtract]", ["12", "-"]],
    ["12[multiply]", ["12", "*"]],
    ["12[divide]", ["12", "/"]],
    ["12[in-domestic]", ["0"]],
    ["12**[add]", ["12", "+"]],
    ["12**[multiply]", ["12", "*"]],
    ["12**[divide]", ["12", "/"]],
    ["12**3=", ["9"]],
    ["12**3[add]", ["9", "+"]],
    ["12**3[subtract]", ["9", "-"]],
    ["12**3[divide]", ["9", "/"]],
    ["12*3=5", ["5"]],
    ["12*3=*", ["15", "+"]],
    ["12*3=#", ["0."]],
    ["=", ["0"]],
    ["12*3=c", ["0"]],
    ["12*3[divide]", ["15", "/"]],
  ])("%s shows %j", (keys, expected) => {
    expect(lines(keys)).toEqual(expected);
  });

  it("shows a note and keeps the state before the action", () => {
    expect(run("12[in-foreign]").note).toBe("divide-by-zero");
    expect(lines("12[in-foreign]")).toEqual(["12"]);
    const out = run("99999***99999=");
    expect(out.note).toBe("out-of-range");
    expect(displayLines(out.state)).toEqual(["99999", "*", "99999"]);
    expect(run("7****0[add]").note).toBe("divide-by-zero");
    expect(displayLines(run("7****0[add]").state)).toEqual(["7", "/", "0"]);
    expect(run("7****0*").note).toBe("divide-by-zero");
  });

  it("lets a result be converted and then continued", () => {
    const rate = (amount: string, to: "domestic" | "foreign"): CalcResult =>
      to === "domestic" ? { ok: amount === "10" ? "15" : "22.5" } : { ok: "?" };
    const converted = chooseOption(run("10").state, "in-domestic", rate);
    expect(displayLines(converted.state)).toEqual(["15"]);
    expect(displayLines(pressKey(converted.state, "*").state)).toEqual(["15", "+"]);
    expect(displayLines(pressKey(converted.state, "7").state)).toEqual(["7"]);
    expect(displayLines(chooseOption(converted.state, "in-domestic", rate).state)).toEqual([
      "22.5",
    ]);
  });
});

describe("results and the corrected R criterion (calculator/results)", () => {
  it.each([
    ["12*3=", "15"],
    ["2**5=", "-3"],
    ["2**5***7=", "-21"],
    ["0#1*0#2=", "0.3"],
    ["1****3***3=", "0.9999999"],
    ["2****3***3=", "2.0000001"],
    ["1****3*0#3333333=", "0.6666666"],
    ["0**1****3=", "-0.3333333"],
    ["0**123456789=", "-123456789"],
    ["0**99999999**0#5=", "-100000000"],
    ["0**999999999*0=", "-999999999"],
    // Literal over-limit inputs: the entry drops the tenth character, so these replay entry
    // truncation (`results/literal-*`), not arithmetic on impossible operands.
    ["0#00000005***1=", "0"],
    ["0**0#00000005***1=", "0"],
    ["9#9999999*0#00000001=", "9.9999999"],
  ])("%s = %s", (keys, expected) => {
    expect(lines(keys)).toEqual([expected]);
  });

  it("truncates the literal operands at entry (results/literal-*)", () => {
    expect(lines("0#00000005")).toEqual(["0.0000000"]);
    expect(lines("9#9999999*0#00000001")).toEqual(["9.9999999", "+", "0.0000000"]);
  });

  it.each([
    ["99999***99999=", ["99999", "*", "99999"]],
    ["500000000*500000000=", ["500000000", "+", "500000000"]],
    ["0**1**999999999=", ["-1", "-", "999999999"]],
    ["999999999*1=", ["999999999", "+", "1"]],
    ["2**5***7****0=", ["-21", "/", "0"]],
  ])("%s shows its note and then %j", (keys, expected) => {
    const step = run(keys);
    expect(step.note).toBeDefined();
    expect(displayLines(step.state)).toEqual(expected);
  });
});
