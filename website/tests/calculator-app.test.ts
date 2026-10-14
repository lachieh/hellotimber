import { LONG_PRESS_MS } from "@hellotimber/phone-core";
import type {
  ApplicationContext,
  PhoneApplication,
  PhoneApplicationSession,
  PhoneKey,
} from "@hellotimber/phone-core";
import { describe, expect, it } from "vite-plus/test";
import { CalculatorApplication } from "../src/phone/applications/calculator";

function press(session: PhoneApplicationSession, key: PhoneKey): void {
  session.onKey({ type: "down", key });
  session.onKey({ type: "up", key });
}

function enter(session: PhoneApplicationSession, value: string): void {
  for (const key of value) press(session, key as PhoneKey);
}

function display(session: PhoneApplicationSession): string {
  const screen = session.render();
  if (screen.kind !== "editor") throw new Error(`expected editor, got ${screen.kind}`);
  return screen.text;
}

function equals(session: PhoneApplicationSession): void {
  press(session, "navi");
  press(session, "navi");
}

function harness(): {
  application: CalculatorApplication;
  session: PhoneApplicationSession;
  exits: () => number;
  opened: PhoneApplication[];
} {
  let exitCount = 0;
  const opened: PhoneApplication[] = [];
  const context: ApplicationContext = {
    exit: () => (exitCount += 1),
    open: (application) => opened.push(application),
  };
  const application = new CalculatorApplication();
  return {
    application,
    session: application.createSession(context),
    exits: () => exitCount,
    opened,
  };
}

describe("CalculatorApplication", () => {
  it("starts every session fresh at zero and appends digits and one decimal point", () => {
    const { application, session } = harness();
    expect(session.render()).toEqual({
      kind: "editor",
      title: "Calculator",
      text: "0",
      cursor: 1,
      mode: "123",
    });

    enter(session, "12");
    press(session, "#");
    enter(session, "34");
    press(session, "#");
    expect(display(session)).toBe("12.34");
    const fresh = application.createSession({ exit() {}, open() {} });
    expect(display(fresh)).toBe("0");
    press(fresh, "#");
    press(fresh, "#");
    expect(display(fresh)).toBe("0.");
  });

  it("cycles consecutive operator presses through +, -, *, and /", () => {
    const { session } = harness();
    enter(session, "8");
    press(session, "*");
    expect(display(session)).toBe("8 +");
    press(session, "*");
    expect(display(session)).toBe("8 -");
    press(session, "*");
    expect(display(session)).toBe("8 *");
    press(session, "*");
    expect(display(session)).toBe("8 /");
    press(session, "*");
    expect(display(session)).toBe("8 +");
  });

  it.each([
    { stars: 1, expected: "10", label: "addition" },
    { stars: 2, expected: "4", label: "subtraction" },
    { stars: 3, expected: "21", label: "multiplication" },
    { stars: 4, expected: "2.33333333333", label: "division" },
  ])("implements $label without eval", ({ stars, expected }) => {
    const { session } = harness();
    enter(session, "7");
    for (let i = 0; i < stars; i += 1) press(session, "*");
    enter(session, "3");
    equals(session);
    expect(display(session)).toBe(expected);
  });

  it("evaluates complete expressions while chaining and starts fresh after an unchained result", () => {
    const { session } = harness();
    enter(session, "2");
    press(session, "*");
    enter(session, "3");
    press(session, "*");
    press(session, "*");
    press(session, "*");
    expect(display(session)).toBe("5 *");
    enter(session, "4");
    equals(session);
    expect(display(session)).toBe("20");

    enter(session, "7");
    expect(display(session)).toBe("7");
    equals(session);
    expect(display(session)).toBe("7");
  });

  it("opens Options and unavailable currency readers, with C backing out one layer", () => {
    const { session } = harness();
    press(session, "navi");
    expect(session.render()).toEqual({
      kind: "list",
      title: "Options",
      items: ["Equals", "Exchange rate", "To home", "To foreign"],
      selected: 0,
      softkey: "Select",
    });
    press(session, "down");
    press(session, "navi");
    expect(session.render()).toEqual({
      kind: "reader",
      title: "Exchange rate",
      lines: ["Not available"],
      scrollTop: 0,
    });
    press(session, "c");
    expect(session.render()).toMatchObject({ kind: "list", title: "Options", selected: 1 });
    press(session, "c");
    expect(display(session)).toBe("0");

    for (const [index, title] of ["Exchange rate", "To home", "To foreign"].entries()) {
      const currency = harness().session;
      press(currency, "navi");
      for (let step = 0; step <= index; step += 1) press(currency, "down");
      press(currency, "navi");
      expect(currency.render()).toEqual({
        kind: "reader",
        title,
        lines: ["Not available"],
        scrollTop: 0,
      });
    }
  });

  it("short C deletes input then exits on the default display", () => {
    const { session, exits } = harness();
    enter(session, "12");
    press(session, "#");
    press(session, "c");
    expect(display(session)).toBe("12");
    press(session, "c");
    press(session, "c");
    expect(display(session)).toBe("0");
    expect(exits()).toBe(0);
    press(session, "c");
    expect(exits()).toBe(1);
  });

  it("held C clears all state and swallows its release", () => {
    const { session, exits } = harness();
    enter(session, "12");
    press(session, "*");
    enter(session, "3");
    session.onKey({ type: "down", key: "c" });
    session.tick(LONG_PRESS_MS);
    expect(display(session)).toBe("0");
    session.onKey({ type: "up", key: "c" });
    expect(exits()).toBe(0);
  });

  it("rounds to 12 significant digits and removes floating-point artifacts", () => {
    const { session } = harness();
    enter(session, "0");
    press(session, "#");
    enter(session, "1");
    press(session, "*");
    enter(session, "0");
    press(session, "#");
    enter(session, "2");
    equals(session);
    expect(display(session)).toBe("0.3");
  });

  it.each([
    { subtrahend: "2", divisor: "3", expected: "-0.33333333333" },
    { subtrahend: "3", divisor: "3", expected: "-0.66666666667" },
    { subtrahend: "2", divisor: "8", expected: "-0.125" },
  ])(
    "uses the greatest fitting precision for negative fractions",
    ({ subtrahend, divisor, expected }) => {
      const { session } = harness();
      enter(session, "1");
      press(session, "*");
      press(session, "*");
      enter(session, subtrahend);
      equals(session);
      for (let i = 0; i < 4; i += 1) press(session, "*");
      enter(session, divisor);
      equals(session);
      expect(display(session)).toBe(expected);
    },
  );

  it("strips fractional zeros and normalizes negative zero", () => {
    const { session } = harness();
    enter(session, "0");
    press(session, "*");
    press(session, "*");
    enter(session, "1");
    equals(session);
    press(session, "*");
    press(session, "*");
    press(session, "*");
    enter(session, "0");
    equals(session);
    expect(display(session)).toBe("0");
  });

  it("shows Error for division by zero, non-fitting results, and recovers safely", () => {
    const divided = harness().session;
    enter(divided, "1");
    for (let i = 0; i < 4; i += 1) press(divided, "*");
    enter(divided, "0");
    equals(divided);
    expect(display(divided)).toBe("Error");
    press(divided, "#");
    expect(display(divided)).toBe("Error");
    enter(divided, "7");
    expect(display(divided)).toBe("7");

    const overflow = harness().session;
    enter(overflow, "99999999999999");
    press(overflow, "*");
    enter(overflow, "1");
    equals(overflow);
    expect(display(overflow)).toBe("Error");
    press(overflow, "c");
    expect(display(overflow)).toBe("0");
  });

  it("accepts the 14-character rounded integer boundary and rejects the next decade", () => {
    const fitting = harness().session;
    enter(fitting, "9999999999999");
    press(fitting, "*");
    enter(fitting, "1");
    equals(fitting);
    expect(display(fitting)).toBe("10000000000000");

    const overflow = harness().session;
    enter(overflow, "99999999999999");
    press(overflow, "*");
    enter(overflow, "1");
    equals(overflow);
    expect(display(overflow)).toBe("Error");
  });

  it("safely rejects a very long operand when its result is non-finite", () => {
    const { session } = harness();
    enter(session, "9".repeat(400));
    press(session, "*");
    enter(session, "1");
    equals(session);
    expect(display(session)).toBe("Error");
  });
});
