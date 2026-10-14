import { describe, expect, it } from "vite-plus/test";
import { GoldenFormatError } from "../scripts/golden-format.ts";
import {
  parseLightsGolden,
  serializeLightsGolden,
  type LightsGolden,
} from "../scripts/lights-format.ts";

const SHA = "0123456789abcdef".repeat(4);

const golden: LightsGolden = {
  id: "lights/timeout/factory/tap-03",
  status: "asserted",
  source: "captures/6.39/plan25/lights/timeout/factory/tap-03",
  sourceSha256: SHA,
  state: "factory",
  powerOnMs: 61834,
  keys: [
    { ms: 0, key: "c" },
    { ms: 1000, key: "c", holdMs: 1500 },
  ],
  note: "C at standby with the LEDs off, 372 ms after a light tick.",
  omitted: [],
  rows: [
    { ms: 18, light: "display", on: true },
    { ms: 18, light: "keypad", on: true },
    { ms: 15491, light: "keypad", on: false },
    { ms: 15492, light: "display", on: false },
  ],
};

const TEXT = `lights-golden 1
id: lights/timeout/factory/tap-03
status: asserted
source: captures/6.39/plan25/lights/timeout/factory/tap-03
source-sha256: ${SHA}
state: factory
power-on: 61834
keys: 0:c 1000:c+1500
note: C at standby with the LEDs off, 372 ms after a light tick.
omitted: none

@events
# t_ms light   state
18     display on
18     keypad  on
15491  keypad  off
15492  display off
`;

/** TEXT with line `n` (1-based) replaced. */
function withLine(n: number, line: string): string {
  const lines = TEXT.split("\n");
  lines[n - 1] = line;
  return lines.join("\n");
}

function failure(text: string): GoldenFormatError {
  try {
    parseLightsGolden(text, "x.lights.txt");
  } catch (error) {
    expect(error).toBeInstanceOf(GoldenFormatError);
    return error as GoldenFormatError;
  }
  throw new Error("expected a GoldenFormatError");
}

describe("lights golden format", () => {
  it("serializes to the documented text and parses it back", () => {
    expect(serializeLightsGolden(golden)).toBe(TEXT);
    expect(parseLightsGolden(TEXT, "x.lights.txt")).toEqual(golden);
  });

  it("round-trips a golden without keys, note or rows (it asserts no change)", () => {
    const quiet: LightsGolden = {
      id: "lights/arrival/sms-locked",
      status: "pending:18",
      source: "captures/6.39/plan25/lights/arrival/sms-locked",
      sourceSha256: SHA,
      state: "virgin",
      powerOnMs: 81378,
      omitted: [{ count: 1, reason: "a reason" }],
      rows: [],
    };
    const text = serializeLightsGolden(quiet);
    expect(text).toContain("omitted: 1 (a reason)\n\n@events\n# t_ms light   state\n");
    expect(parseLightsGolden(text, "y.lights.txt")).toEqual(quiet);
  });

  it("requires the header lines in order", () => {
    const swapped = TEXT.replace(
      "state: factory\npower-on: 61834",
      "power-on: 61834\nstate: factory",
    );
    expect(failure(swapped).message).toBe(
      'x.lights.txt:6: expected header "state: …", got "power-on: 61834"',
    );
    expect(failure(withLine(1, "lights-golden 2")).line).toBe(1);
  });

  it("takes power-on as a non-negative integer", () => {
    for (const bad of ["-1", "1.5", "", "x"]) {
      expect(failure(withLine(7, `power-on: ${bad}`)).message).toMatch(
        /^x\.lights\.txt:7: power-on must be/,
      );
    }
    expect(parseLightsGolden(withLine(7, "power-on: 0"), "x").powerOnMs).toBe(0);
  });

  it("reads keys as the sound goldens do (phone keys, ascending, the first at 0)", () => {
    expect(failure(withLine(8, "keys: 0:menu")).message).toMatch(/^x\.lights\.txt:8: key must/);
    expect(failure(withLine(8, "keys: 5:c")).message).toBe(
      "x.lights.txt:8: the first key is time 0",
    );
    expect(failure(withLine(8, "keys: 0:c 10:c 5:c")).message).toBe(
      "x.lights.txt:8: key times must ascend: 5 after 10",
    );
    expect(failure(withLine(8, "keys: 0:c+x")).line).toBe(8);
  });

  it("rejects unknown lights and states", () => {
    expect(failure(withLine(14, "18     backlight on")).message).toBe(
      'x.lights.txt:14: light must be display or keypad, got "backlight"',
    );
    expect(failure(withLine(14, "18     display dim")).message).toBe(
      'x.lights.txt:14: state must be on or off, got "dim"',
    );
    expect(failure(withLine(14, "1.5    display on")).message).toBe(
      'x.lights.txt:14: t_ms must be an integer, got "1.5"',
    );
  });

  it("rejects a light repeating its state and decreasing times", () => {
    expect(failure(withLine(15, "18     display on")).message).toBe(
      'x.lights.txt:15: display repeats its previous state "on"',
    );
    expect(failure(withLine(16, "17     keypad  off")).message).toBe(
      "x.lights.txt:16: times must not decrease: 17 after 18",
    );
  });

  it("allows negative times only when the golden has keys", () => {
    const early = withLine(14, "-5     display on");
    expect(parseLightsGolden(early, "x").rows[0]!.ms).toBe(-5);
    const keyless = early.replace("keys: 0:c 1000:c+1500\n", "");
    expect(failure(keyless).message).toBe(
      "x.lights.txt:13: times may not be negative without keys",
    );
  });

  it("names file and line for every malformed line", () => {
    expect(failure(withLine(2, "id: Lights/x")).message).toMatch(/^x\.lights\.txt:2: id must/);
    expect(failure(withLine(3, "status: done")).line).toBe(3);
    expect(failure(withLine(5, "source-sha256: abc")).line).toBe(5);
    expect(failure(withLine(10, "omitted: some")).line).toBe(10);
    expect(failure(withLine(11, "x")).line).toBe(11);
    expect(failure(withLine(12, "@rows")).line).toBe(12);
    expect(failure(withLine(13, "# t light")).line).toBe(13);
    expect(failure(`${TEXT}trailing\n`).line).toBe(18);
  });
});
