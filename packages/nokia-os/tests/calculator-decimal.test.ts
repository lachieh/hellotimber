// Plan 20 Task 3: the calculator's exact decimal arithmetic (D3). Expected strings are
// transcribed from the `calculator/results` and `calculator/convert` goldens (plan20/results,
// plan20/convert), independent of the code.
import { describe, expect, it } from "vite-plus/test";
import {
  calculate,
  formatDecimal,
  parseDecimal,
  type CalcOperator,
  type CalcResult,
} from "../src/calculator/decimal";

describe("display strings", () => {
  it("round-trips every kind of display string the goldens show", () => {
    for (const text of [
      "0",
      "0.",
      "123.",
      "0.0012345",
      "-21",
      "12.345678",
      "123456789",
      "-0.3333333",
      "-100000000",
      "0.5",
      "0.0010",
    ]) {
      expect(formatDecimal(parseDecimal(text)), text).toBe(text);
    }
  });

  it("reads sign, digits and scale", () => {
    expect(parseDecimal("-0.0012345")).toEqual({
      negative: true,
      digits: 12345n,
      scale: 7,
      point: true,
    });
    expect(parseDecimal("123.")).toEqual({ negative: false, digits: 123n, scale: 0, point: true });
  });

  it("rejects anything that is not a display string", () => {
    for (const text of ["", "-", ".", ".5", "01", "1.2.3", "+1", " 1", "1e5", "--1", "1,5", "x"]) {
      expect(() => parseDecimal(text), JSON.stringify(text)).toThrow();
    }
  });
});

const ok = (text: string): CalcResult => ({ ok: text });
const OUT_OF_RANGE: CalcResult = { error: "out-of-range" };
const DIVIDE_BY_ZERO: CalcResult = { error: "divide-by-zero" };

/** `[a, op, b, result]`, each row a `results/` (or `convert/`) golden image. */
const RESULTS: readonly (readonly [string, CalcOperator, string, CalcResult])[] = [
  ["12", "+", "3", ok("15")],
  ["2", "-", "5", ok("-3")],
  ["-3", "*", "7", ok("-21")],
  ["1.5", "+", "2.25", ok("3.75")],
  ["2.5", "*", "2", ok("5")],
  ["0.1", "+", "0.2", ok("0.3")],
  ["1", "/", "3", ok("0.3333333")],
  ["2", "/", "3", ok("0.6666667")],
  ["1", "/", "7", ok("0.1428571")],
  ["10", "/", "3", ok("3.3333333")],
  ["100000000", "/", "3", ok("33333333")],
  ["123456789", "+", "1", ok("123456790")],
  ["24691357", "/", "2", ok("12345679")],
  ["0.0000001", "/", "100", ok("0")],
  // A result feeds the next operation as displayed: (1/3) × 3, (2/3) × 3, (1/3) + (1/3).
  ["0.3333333", "*", "3", ok("0.9999999")],
  ["0.6666667", "*", "3", ok("2.0000001")],
  ["0.3333333", "+", "0.3333333", ok("0.6666666")],
  ["99999", "*", "99999", OUT_OF_RANGE],
  ["500000000", "+", "500000000", OUT_OF_RANGE],
  ["99999999", "*", "99999999", OUT_OF_RANGE],
  ["-1", "-", "999999999", OUT_OF_RANGE],
  ["-21", "/", "0", DIVIDE_BY_ZERO],
  ["-24691357", "/", "2", ok("-12345679")],
  ["-1", "/", "3", ok("-0.3333333")],
  ["-2", "/", "3", ok("-0.6666667")],
  ["-12345678", "*", "1", ok("-12345678")],
  ["0", "-", "123456789", ok("-123456789")],
  // `results/-99999999.5`: 0 - 99999999, then - 0.5 (the name is the unrounded sum).
  ["0", "-", "99999999", ok("-99999999")],
  ["-99999999", "-", "0.5", ok("-100000000")],
  ["999999999", "+", "1", OUT_OF_RANGE],
  // Half rounding away from zero (the corrected R criterion's representable cases).
  ["0.0000001", "/", "2", ok("0.0000001")],
  ["-0.0000001", "/", "2", ok("-0.0000001")],
  ["0.0000003", "/", "2", ok("0.0000002")],
  ["-0.0000003", "/", "2", ok("-0.0000002")],
  ["0.5", "+", "0.5", ok("1")],
  // The carry to ten (a different sum from the impossible `9.9999999 + 0.00000001`).
  ["9.9999999", "+", "0.0000001", ok("10")],
  ["1", "/", "8", ok("0.125")],
  ["12345678", "+", "0.5", ok("12345679")],
  ["12345677", "+", "0.5", ok("12345678")],
  ["-12345678", "-", "0.5", ok("-12345679")],
  ["1", "-", "1", ok("0")],
  ["0.3", "-", "0.1", ok("0.2")],
  ["-0.5", "+", "0.5", ok("0")],
  ["999999999", "*", "1", ok("999999999")],
  ["-999999999", "+", "0", ok("-999999999")],
  ["-99999999", "-", "1", ok("-100000000")],
  ["0", "/", "5", ok("0")],
  ["5", "/", "0.5", ok("10")],
  // Conversions (`calculator/convert`): amount × or ÷ the typed rate, formatted alike.
  ["10", "*", "1.5", ok("15")],
  ["10", "/", "1.5", ok("6.6666667")],
  ["15", "*", "1.5", ok("22.5")],
  ["99999999", "*", "100", OUT_OF_RANGE],
  ["99999999", "/", "100", ok("999999.99")],
  ["1", "/", "100", ok("0.01")],
  ["0.0000001", "*", "0.5", ok("0.0000001")],
  ["0.0000001", "/", "0.5", ok("0.0000002")],
  ["10", "/", "0", DIVIDE_BY_ZERO],
  ["10", "*", "0", ok("0")],
];

describe("calculate (D3)", () => {
  it.each(RESULTS)("%s %s %s", (a, op, b, result) => {
    expect(calculate(a, op, b)).toEqual(result);
  });

  it("is exact where floats are not", () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(calculate("0.1", "+", "0.2")).toEqual(ok("0.3"));
    expect(calculate("0.7", "+", "0.1")).toEqual(ok("0.8"));
    expect(calculate("1.1", "*", "1.1")).toEqual(ok("1.21"));
    expect(calculate("0.3", "-", "0.2")).toEqual(ok("0.1"));
    expect(calculate("4.35", "*", "100")).toEqual(ok("435"));
    expect(calculate("1.005", "*", "1000")).toEqual(ok("1005"));
    expect(calculate("0.0000003", "/", "0.1")).toEqual(ok("0.000003"));
  });

  it("drops trailing fraction zeros and a trailing point, and shows rounded zero as 0", () => {
    expect(calculate("1.50", "+", "0")).toEqual(ok("1.5"));
    expect(calculate("2.", "*", "1")).toEqual(ok("2"));
    expect(calculate("-0.00000001", "+", "0")).toEqual(ok("0"));
  });

  it("never shows more than nine magnitude characters, whatever the operands (property)", () => {
    // A deterministic spread of display strings: integers, fractions, signs, extremes.
    const values: string[] = [];
    let seed = 12345;
    const next = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed;
    };
    for (let i = 0; i < 400; i++) {
      const length = 1 + (next() % 9);
      let digits = "";
      for (let d = 0; d < length; d++) digits += String(next() % 10);
      digits = digits.replace(/^0+(?=\d)/, "");
      const point = next() % 3 === 0 && digits.length < 9;
      const at = point ? next() % (digits.length + 1) : -1;
      let text = point ? `${digits.slice(0, at) || "0"}.${digits.slice(at)}`.slice(0, 9) : digits;
      text = text.replace(/^0+(?=\d)/, "");
      values.push(next() % 4 === 0 && text !== "0" ? `-${text}` : text);
    }
    const ops: CalcOperator[] = ["+", "-", "*", "/"];
    for (let i = 0; i < values.length - 1; i++) {
      const op = ops[i % 4]!;
      const result = calculate(values[i]!, op, values[i + 1]!);
      if (!("ok" in result)) continue;
      const magnitude = result.ok.replace(/^-/, "");
      expect(
        magnitude.length,
        `${values[i]} ${op} ${values[i + 1]} = ${result.ok}`,
      ).toBeLessThanOrEqual(9);
      expect(formatDecimal(parseDecimal(result.ok))).toBe(result.ok);
      expect(result.ok).not.toMatch(/\.$|\.\d*0$|^-0$/);
    }
  });
});
