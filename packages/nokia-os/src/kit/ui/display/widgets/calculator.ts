import { textWidth, type Framebuffer } from "@hellotimber/phone-screen";
import { STOCK_FONTS } from "../../resources";
import { SOFTKEY_TOP } from "../standby";
import { paintPrompt, type PromptModel } from "./prompt";

/** The calculator screen's lines: the small face, right-aligned, the last one at top 28. */
const LAST_LINE_TOP = 28;
const LINE_PITCH = 10;
const MAX_LINES = 3;

/** The rate entry's value: the large face right-aligned in the prompt's box (as `end` prompts). */
const VALUE_END = 83;
/** Its cursor: one column left of the character after it, rows 22-35 (`rate/keys/*`). */
const CURSOR_TOP = 22;
const CURSOR_ROWS = 14;

/**
 * The stock calculator (plan 20): its screen (the operand, operator and operand lines over
 * `Options`), or the exchange-rate entry (a prompt whose cursor sits between characters, D7).
 */
export type CalculatorModel =
  | {
      readonly kind: "calculator";
      readonly screen: "display";
      /** One to three lines, top to bottom. */
      readonly lines: readonly string[];
      readonly softkey: string;
    }
  | {
      readonly kind: "calculator";
      readonly screen: "rate";
      readonly label: string;
      readonly text: string;
      /** Characters before the cursor. */
      readonly cursorAt: number;
      /** The blinking cursor's step: shown or hidden. */
      readonly cursor: boolean;
      readonly softkey: string;
    };

export function paintCalculator(fb: Framebuffer, model: CalculatorModel): void {
  if (model.screen === "rate") {
    paintRate(fb, model);
    return;
  }
  const { lines } = model;
  if (lines.length < 1 || lines.length > MAX_LINES) {
    throw new Error(`The calculator shows 1-${MAX_LINES} lines, not ${lines.length}.`);
  }
  const font = STOCK_FONTS.small;
  lines.forEach((line, i) => {
    const width = textWidth(font, line);
    if (width > fb.width) throw new Error(`Calculator line "${line}" is ${width} px wide.`);
    const top = LAST_LINE_TOP - (lines.length - 1 - i) * LINE_PITCH;
    fb.drawText(font, line, fb.width - width, top);
  });
  fb.drawTextCentered(font, model.softkey, SOFTKEY_TOP);
}

function paintRate(fb: Framebuffer, model: Extract<CalculatorModel, { screen: "rate" }>): void {
  const prompt: PromptModel = {
    kind: "prompt",
    icons: ["prompt/pen"],
    label: [model.label],
    entry: { kind: "box", text: model.text, font: "large", cursor: "none" },
    cursor: false,
    softkey: model.softkey,
  };
  paintPrompt(fb, prompt);
  if (!model.cursor) return;
  const after = model.text.slice(model.cursorAt);
  const x = VALUE_END - textWidth(STOCK_FONTS.large, after) - 1;
  fb.fillRect(x, CURSOR_TOP, 1, CURSOR_ROWS, 1);
}
