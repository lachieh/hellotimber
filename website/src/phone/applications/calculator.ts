import { LONG_PRESS_MS, PhoneApplication } from "@hellotimber/phone-core";
import type {
  ApplicationContext,
  PhoneApplicationSession,
  PhoneKey,
  ScreenModel,
} from "@hellotimber/phone-core";

type Operator = "+" | "-" | "*" | "/";

const OPERATORS: readonly Operator[] = ["+", "-", "*", "/"];
const OPTIONS = ["Equals", "Exchange rate", "To home", "To foreign"] as const;
const DISPLAY_LIMIT = 14;
const SIGNIFICANT_DIGITS = 12;

const calculate: Record<Operator, (left: number, right: number) => number> = {
  "+": (left, right) => left + right,
  "-": (left, right) => left - right,
  "*": (left, right) => left * right,
  "/": (left, right) => left / right,
};

function expandExponent(value: string): string {
  const match = /^(-?)(\d+)(?:\.(\d*))?e([+-]?\d+)$/i.exec(value);
  if (match === null) return value;
  const [, sign, whole, fraction = "", exponentText] = match;
  const digits = `${whole}${fraction}`;
  const decimalAt = whole!.length + Number(exponentText);
  if (decimalAt <= 0) return `${sign}0.${"0".repeat(-decimalAt)}${digits}`;
  if (decimalAt >= digits.length) return `${sign}${digits}${"0".repeat(decimalAt - digits.length)}`;
  return `${sign}${digits.slice(0, decimalAt)}.${digits.slice(decimalAt)}`;
}

function formatResult(value: number): string | null {
  if (!Number.isFinite(value)) return null;
  const normalized = Object.is(value, -0) ? 0 : value;
  for (let precision = SIGNIFICANT_DIGITS; precision >= 1; precision -= 1) {
    let text = expandExponent(normalized.toPrecision(precision));
    if (text.includes(".")) text = text.replace(/0+$/, "").replace(/\.$/, "");
    if (text.length <= DISPLAY_LIMIT) return text;
  }
  return null;
}

export class CalculatorApplication extends PhoneApplication {
  constructor() {
    super("calculator");
    Object.freeze(this);
  }

  createSession(context: ApplicationContext): PhoneApplicationSession {
    let left = "0";
    let right = "";
    let operator: Operator | null = null;
    let afterResult = false;
    let error = false;
    let options: number | null = null;
    let unavailable: (typeof OPTIONS)[number] | null = null;
    let now = 0;
    let held: { key: PhoneKey; downAt: number; longFired: boolean } | null = null;

    const reset = (): void => {
      left = "0";
      right = "";
      operator = null;
      afterResult = false;
      error = false;
    };

    const activeOperand = (): string => (operator === null ? left : right);
    const setActiveOperand = (value: string): void => {
      if (operator === null) left = value;
      else right = value;
    };

    const evaluate = (): boolean => {
      if (operator === null || right === "") return false;
      const result = formatResult(calculate[operator](Number(left), Number(right)));
      if (result === null) {
        error = true;
        left = "0";
      } else {
        left = result;
      }
      right = "";
      operator = null;
      afterResult = !error;
      return !error;
    };

    const appendDigit = (digit: string): void => {
      if (error || (afterResult && operator === null)) reset();
      afterResult = false;
      const current = activeOperand();
      setActiveOperand(current === "0" ? digit : `${current}${digit}`);
    };

    const appendDecimal = (): void => {
      if (error) return;
      if (afterResult && operator === null) reset();
      afterResult = false;
      const current = activeOperand();
      if (current.includes(".")) return;
      setActiveOperand(current === "" ? "0." : `${current}.`);
    };

    const selectOperator = (): void => {
      if (error) reset();
      if (operator !== null && right !== "") {
        if (!evaluate()) return;
        operator = "+";
      } else if (operator !== null) {
        operator = OPERATORS[(OPERATORS.indexOf(operator) + 1) % OPERATORS.length]!;
      } else {
        operator = "+";
      }
      afterResult = false;
    };

    const deleteInput = (): void => {
      if (error) {
        reset();
        return;
      }
      const current = activeOperand();
      if (current === "" || (operator === null && current === "0")) {
        context.exit();
        return;
      }
      const next = current.slice(0, -1);
      setActiveOperand(next === "" && operator === null ? "0" : next);
      afterResult = false;
    };

    const shortPress = (key: PhoneKey): void => {
      if (unavailable !== null) {
        if (key === "c") unavailable = null;
        return;
      }
      if (options !== null) {
        if (key === "c") {
          options = null;
        } else if (key === "up") {
          options = (options + OPTIONS.length - 1) % OPTIONS.length;
        } else if (key === "down") {
          options = (options + 1) % OPTIONS.length;
        } else if (key === "navi") {
          const selected = options;
          if (selected === 0) {
            options = null;
            evaluate();
          } else {
            unavailable = OPTIONS[selected]!;
          }
        }
        return;
      }
      if (key >= "0" && key <= "9") appendDigit(key);
      else if (key === "#") appendDecimal();
      else if (key === "*") selectOperator();
      else if (key === "navi") options = 0;
      else if (key === "c") deleteInput();
    };

    const render = (): ScreenModel => {
      if (unavailable !== null) {
        return { kind: "reader", title: unavailable, lines: ["Not available"], scrollTop: 0 };
      }
      if (options !== null) {
        return {
          kind: "list",
          title: "Options",
          items: [...OPTIONS],
          selected: options,
          softkey: "Select",
        };
      }
      const text = error
        ? "Error"
        : operator === null
          ? left
          : `${left} ${operator}${right === "" ? "" : ` ${right}`}`;
      return { kind: "editor", title: "Calculator", text, cursor: text.length, mode: "123" };
    };

    return {
      onKey(event) {
        if (event.type === "down") {
          held = { key: event.key, downAt: now, longFired: false };
          return;
        }
        if (held === null || held.key !== event.key) return;
        const wasLong = held.longFired;
        held = null;
        if (!wasLong) shortPress(event.key);
      },
      tick(dtMs) {
        now += dtMs;
        if (
          held !== null &&
          held.key === "c" &&
          !held.longFired &&
          options === null &&
          unavailable === null &&
          now - held.downAt >= LONG_PRESS_MS
        ) {
          held.longFired = true;
          reset();
        }
      },
      render,
    };
  }
}
