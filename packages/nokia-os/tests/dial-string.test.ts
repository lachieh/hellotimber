// Plan 22 Task 6: what the stock phone does with a typed dial string (S1, S8, S9).
import { describe, expect, it } from "vite-plus/test";
import {
  appendDial,
  DIAL_LIMIT,
  dialledNumber,
  dialOutcome,
  immediateCode,
  starCycle,
} from "../src/services/calls/dial-string";

describe("the `*` cycle and the entry's length", () => {
  it("cycles * + p w and back to *", () => {
    expect([undefined, "*", "+", "p", "w"].map((c) => starCycle(c))).toEqual([
      "*",
      "+",
      "p",
      "w",
      "*",
    ]);
  });

  it("keeps the newest 60 characters", () => {
    const sixty = "1234567890".repeat(6);
    expect(appendDial(sixty, "7")).toBe(`${sixty.slice(1)}7`);
    expect(appendDial(sixty, "7")).toHaveLength(DIAL_LIMIT);
  });
});

describe("Call (S9)", () => {
  it("sends the number cut at a later + or its first p/w", () => {
    expect(dialledNumber("+61412345678")).toBe("+61412345678");
    expect(dialledNumber("0412+345")).toBe("0412");
    expect(dialledNumber("0412345678p123")).toBe("0412345678");
    expect(dialledNumber("0412345678w123")).toBe("0412345678");
  });

  it("dials numbers, 112 as an emergency call and 911 as a number", () => {
    expect(dialOutcome("0412345678")).toEqual({ kind: "call", number: "0412345678" });
    expect(dialOutcome("12")).toEqual({ kind: "call", number: "12" });
    expect(dialOutcome("112")).toEqual({ kind: "emergency", number: "112" });
    expect(dialOutcome("911")).toEqual({ kind: "call", number: "911" });
  });

  it("answers one digit with the voice mailbox or a speed dial", () => {
    expect(dialOutcome("1")).toEqual({ kind: "voice-mailbox" });
    expect(dialOutcome("5")).toEqual({ kind: "speed-dial", key: 5 });
  });

  it("leaves service strings to plan 22b and refuses 33 characters", () => {
    for (const s of ["0", "*", "#", "04", "*123#", "##002#"]) {
      expect(dialOutcome(s).kind, s).toBe("service");
    }
    expect(dialOutcome("1".repeat(32)).kind).toBe("call");
    expect(dialOutcome("1".repeat(33))).toEqual({ kind: "invalid" });
  });
});

describe("`#` at once (S8)", () => {
  it("answers *#06#, *#0000# and digits then #", () => {
    expect(immediateCode("*#06#")).toEqual({ kind: "imei" });
    expect(immediateCode("*#0000#")).toEqual({ kind: "version" });
    expect(immediateCode("12#")).toEqual({ kind: "recall", location: 12 });
    expect(immediateCode("0#")).toEqual({ kind: "recall", location: 0 });
    expect(immediateCode("#")).toBeUndefined();
    expect(immediateCode("*12#")).toBeUndefined();
  });
});
