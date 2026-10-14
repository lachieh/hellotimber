// The calculator's rules (plan 20 D4): a pure state machine over the display, with no widget,
// timer or storage. Keys type operands of nine magnitude characters, `*` cycles the operator
// (`+ - * /`, no timeout) or evaluates, C deletes; Options lists 8, 4 or 5 entries by state. An
// action that fails returns its note with the state before it (Task 0 N).
import { calculate, MAGNITUDE_CHARACTERS, type CalcOperator, type CalcResult } from "./decimal";

/** A key the calculator screen acts on (▲/▼ do nothing there; OK opens Options). */
export type CalculatorKey =
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "#"
  | "*"
  | "c";

/** The first operand: nothing typed (`0`), typed characters, or a shown result. */
export type Operand =
  | { readonly kind: "empty" }
  | { readonly kind: "typed"; readonly text: string }
  | { readonly kind: "result"; readonly text: string };

export interface CalculatorState {
  readonly first: Operand;
  readonly operator?: CalcOperator;
  /** The second operand as typed; absent until a key starts it. */
  readonly second?: string;
}

/** Every entry of the calculator: `0`, nothing typed. */
export const CALCULATOR_START: CalculatorState = { first: { kind: "empty" } };

export type CalculatorNote = "out-of-range" | "divide-by-zero";

/** What a key or an Options choice did. */
export interface Step {
  readonly state: CalculatorState;
  /** The note shown; `state` is then the state before the action, restored after it. */
  readonly note?: CalculatorNote;
  /** C with nothing to delete: the calculator closes. */
  readonly leave?: true;
}

/** Options entries, in list order. */
export type OptionId =
  | "equals"
  | "add"
  | "subtract"
  | "multiply"
  | "divide"
  | "in-domestic"
  | "in-foreign"
  | "exchange-rate";

export const OPTION_LABELS: Readonly<Record<OptionId, string>> = {
  equals: "Equals",
  add: "Add",
  subtract: "Subtract",
  multiply: "Multiply",
  divide: "Divide",
  "in-domestic": "In domestic",
  "in-foreign": "In foreign",
  "exchange-rate": "Exchange rate",
};

const OPERATOR_OF: Readonly<Partial<Record<OptionId, CalcOperator>>> = {
  add: "+",
  subtract: "-",
  multiply: "*",
  divide: "/",
};

/** `*` cycles the operator in this order and wraps (Task 0 P). */
const NEXT_OPERATOR: Readonly<Record<CalcOperator, CalcOperator>> = {
  "+": "-",
  "-": "*",
  "*": "/",
  "/": "+",
};

/** Converts an amount for In domestic / In foreign (the stored exchange rate, D6). */
export type Convert = (amount: string, to: "domestic" | "foreign") => CalcResult;

/** The first operand's value: nothing typed is 0. */
function value(operand: Operand): string {
  return operand.kind === "empty" ? "0" : operand.text;
}

/** A digit typed onto `text` (undefined: a new operand); a lone `0` is replaced. */
function typeDigit(text: string | undefined, digit: string): string {
  if (text === undefined || text === "0") return digit;
  return text.length >= MAGNITUDE_CHARACTERS ? text : text + digit;
}

/** `#` typed onto `text`: one point, `0.` on a new operand. */
function typePoint(text: string | undefined): string {
  if (text === undefined) return "0.";
  return text.includes(".") || text.length >= MAGNITUDE_CHARACTERS ? text : `${text}.`;
}

function typed(text: string): Operand {
  return { kind: "typed", text };
}

/** `first operator second`, shown as a result, or its note. */
function evaluate(state: CalculatorState): CalcResult {
  return calculate(value(state.first), state.operator!, state.second!);
}

/** A key on the calculator screen, acted on as it goes down (D8). */
export function pressKey(state: CalculatorState, key: CalculatorKey): Step {
  const { first, operator, second } = state;
  if (key === "c") {
    if (second !== undefined) {
      const rest = second.slice(0, -1);
      return { state: { first, operator: operator!, ...(rest === "" ? {} : { second: rest }) } };
    }
    if (operator !== undefined) return { state: { first } };
    if (first.kind === "typed" && first.text.length > 1) {
      return { state: { first: typed(first.text.slice(0, -1)) } };
    }
    if (first.kind === "empty") return { state, leave: true };
    return { state: CALCULATOR_START };
  }
  if (key === "*") {
    if (second !== undefined) {
      const result = evaluate(state);
      if ("error" in result) return { state, note: result.error };
      return { state: { first: { kind: "result", text: result.ok }, operator: "+" } };
    }
    return { state: { first, operator: operator === undefined ? "+" : NEXT_OPERATOR[operator] } };
  }
  const type = key === "#" ? typePoint : (text: string | undefined) => typeDigit(text, key);
  if (operator !== undefined) return { state: { first, operator, second: type(second) } };
  return { state: { first: typed(type(first.kind === "typed" ? first.text : undefined)) } };
}

/** C held (D8): everything clears to `0`. */
export function clearHeld(_state: CalculatorState): CalculatorState {
  return CALCULATOR_START;
}

/** The lines shown, top to bottom: the first operand, the operator, the second operand. */
export function displayLines(state: CalculatorState): readonly string[] {
  const lines = [value(state.first)];
  if (state.operator !== undefined) lines.push(state.operator);
  if (state.second !== undefined) lines.push(state.second);
  return lines;
}

/** Options' entries in `state` (Task 0 M): 8 for a number, 4 or 5 with an operator. */
export function optionsFor(state: CalculatorState): readonly OptionId[] {
  if (state.second !== undefined) return ["equals", "add", "subtract", "multiply", "divide"];
  if (state.operator !== undefined) return ["add", "subtract", "multiply", "divide"];
  return [
    "equals",
    "add",
    "subtract",
    "multiply",
    "divide",
    "in-domestic",
    "in-foreign",
    "exchange-rate",
  ];
}

/**
 * OK on an Options entry. Equals shows the result alone; an operator replaces the operator, or
 * after a second operand evaluates and continues with it; In domestic / In foreign convert the
 * number shown. Exchange rate is the widget's (it opens the rate list).
 */
export function chooseOption(
  state: CalculatorState,
  id: Exclude<OptionId, "exchange-rate">,
  convert: Convert,
): Step {
  const result = (shown: CalcResult, operator?: CalcOperator): Step =>
    "error" in shown
      ? { state, note: shown.error }
      : {
          state: {
            first: { kind: "result", text: shown.ok },
            ...(operator === undefined ? {} : { operator }),
          },
        };
  if (id === "in-domestic" || id === "in-foreign") {
    return result(convert(value(state.first), id === "in-domestic" ? "domestic" : "foreign"));
  }
  const operator = OPERATOR_OF[id];
  if (state.second !== undefined) return result(evaluate(state), operator);
  if (operator === undefined) return { state };
  return { state: { first: state.first, operator } };
}
