// The calculator's arithmetic (plan 20 D3): exact decimals over the display strings, never
// JavaScript numbers. A result is exact (a quotient as a rational) until it is shown: rounded
// half away from zero to the fractional digits that fit nine magnitude characters (`.` counts,
// a leading `-` does not), with trailing fraction zeros and a trailing point dropped. Ten
// integer digits are out of range. The next operation uses the string shown.

export type CalcOperator = "+" | "-" | "*" | "/";

export type CalcResult =
  | { readonly ok: string }
  | { readonly error: "out-of-range" | "divide-by-zero" };

/** A display string: ±digits / 10^scale, and whether it shows a point (`0.`, `123.`). */
export interface Decimal {
  readonly negative: boolean;
  readonly digits: bigint;
  /** Digits after the point. */
  readonly scale: number;
  readonly point: boolean;
}

/** Characters a shown magnitude may take, the point included and a leading minus not. */
export const MAGNITUDE_CHARACTERS = 9;

const DISPLAY = /^(-?)(0|[1-9][0-9]*)(?:(\.)([0-9]*))?$/;

/** Reads a display string (`0`, `0.`, `-21`, `0.0012345`); anything else throws. */
export function parseDecimal(text: string): Decimal {
  const match = DISPLAY.exec(text);
  if (match === null) throw new Error(`"${text}" is not a calculator display string.`);
  const [, sign, whole, point, fraction = ""] = match;
  return {
    negative: sign === "-",
    digits: BigInt(whole! + fraction),
    scale: fraction.length,
    point: point !== undefined,
  };
}

/** Writes a decimal as its display string (the inverse of `parseDecimal`). */
export function formatDecimal(value: Decimal): string {
  const text = value.digits.toString().padStart(value.scale + 1, "0");
  const whole = text.slice(0, text.length - value.scale);
  const fraction = text.slice(text.length - value.scale);
  return `${value.negative ? "-" : ""}${whole}${value.point ? `.${fraction}` : ""}`;
}

/** An exact rational: `numerator / denominator`, the denominator positive. */
interface Rational {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

function rational(text: string): Rational {
  const { negative, digits, scale } = parseDecimal(text);
  return { numerator: negative ? -digits : digits, denominator: 10n ** BigInt(scale) };
}

const abs = (n: bigint): bigint => (n < 0n ? -n : n);

/**
 * `value` as shown (D3), or out of range. The integer part decides how many fraction digits fit;
 * a rounding carry only adds an integer digit when the fraction rounds to zero.
 */
function showRational(value: Rational): CalcResult {
  const negative = value.numerator < 0n !== value.denominator < 0n;
  const p = abs(value.numerator);
  const q = abs(value.denominator);
  const integerDigits = (p / q).toString().length;
  if (integerDigits > MAGNITUDE_CHARACTERS) return { error: "out-of-range" };
  const fractionDigits = Math.max(0, MAGNITUDE_CHARACTERS - integerDigits - 1);
  const unit = 10n ** BigInt(fractionDigits);
  // Half away from zero on the magnitude: floor(p/q · unit + 1/2).
  let digits = (2n * p * unit + q) / (2n * q);
  let scale = fractionDigits;
  while (scale > 0 && digits % 10n === 0n) {
    digits /= 10n;
    scale--;
  }
  if ((digits / 10n ** BigInt(scale)).toString().length > MAGNITUDE_CHARACTERS) {
    return { error: "out-of-range" };
  }
  const shown: Decimal = { negative: negative && digits !== 0n, digits, scale, point: scale > 0 };
  return { ok: formatDecimal(shown) };
}

/** `a op b` on display strings, exact, then shown (D3). */
export function calculate(a: string, op: CalcOperator, b: string): CalcResult {
  const x = rational(a);
  const y = rational(b);
  switch (op) {
    case "+":
      return showRational({
        numerator: x.numerator * y.denominator + y.numerator * x.denominator,
        denominator: x.denominator * y.denominator,
      });
    case "-":
      return showRational({
        numerator: x.numerator * y.denominator - y.numerator * x.denominator,
        denominator: x.denominator * y.denominator,
      });
    case "*":
      return showRational({
        numerator: x.numerator * y.numerator,
        denominator: x.denominator * y.denominator,
      });
    case "/":
      if (y.numerator === 0n) return { error: "divide-by-zero" };
      return showRational({
        numerator: x.numerator * y.denominator,
        denominator: x.denominator * y.numerator,
      });
  }
}
