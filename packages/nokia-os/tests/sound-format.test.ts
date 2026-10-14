import { describe, expect, it } from "vite-plus/test";
import { GoldenFormatError } from "../scripts/golden-format.ts";
import {
  parseSoundGolden,
  serializeSoundGolden,
  type SoundGolden,
} from "../scripts/sound-format.ts";

const SHA = "0123456789abcdef".repeat(4);

const golden: SoundGolden = {
  id: "sound/ringing-tone/13-nokia-tune",
  status: "asserted",
  source: "captures/6.39/plan16/ringing-tone/13",
  sourceSha256: SHA,
  state: "factory",
  keys: [
    { ms: 0, key: "down" },
    { ms: 2560, key: "c", holdMs: 1500 },
  ],
  note: "Tones › Ringing tone, ▼ from Croak onto Nokia tune.",
  omitted: [
    { count: 2, reason: "divider rewrite" },
    { count: 1, reason: "stale frequency" },
  ],
  rows: [
    { ms: 31, output: "tone", state: { kind: "sounding", hz: 900, volume: 0x9104 } },
    { ms: 171, output: "tone", state: { kind: "off" } },
    { ms: 993, output: "buzzer", state: { kind: "sounding", hz: 1319, volume: 16 } },
    { ms: 993, output: "vibrator", state: { kind: "on" } },
    { ms: 1108, output: "buzzer", state: { kind: "sounding", hz: 2683.7, volume: 22 } },
    { ms: 1200, output: "tone", state: { kind: "sounding", hz: 1209, hz2: 697, volume: 0x9104 } },
    { ms: 1300, output: "buzzer", state: { kind: "off" } },
    { ms: 1300, output: "vibrator", state: { kind: "off" } },
  ],
  loop: { startMs: 993, periodMs: 6017 },
};

const TEXT = `sound-golden 1
id: sound/ringing-tone/13-nokia-tune
status: asserted
source: captures/6.39/plan16/ringing-tone/13
source-sha256: ${SHA}
state: factory
keys: 0:down 2560:c+1500
note: Tones › Ringing tone, ▼ from Croak onto Nokia tune.
omitted: 2 (divider rewrite), 1 (stale frequency)

@events
# t_ms output   state
31     tone     900 v=0x9104
171    tone     off
993    buzzer   1319 v=16
993    vibrator on
1108   buzzer   2683.7 v=22
1200   tone     1209+697 v=0x9104
1300   buzzer   off
1300   vibrator off
@loop 993 6017
`;

/** `TEXT` with one line replaced (1-based line number). */
function withLine(line: number, replacement: string): string {
  const lines = TEXT.split("\n");
  lines[line - 1] = replacement;
  return lines.join("\n");
}

function failure(text: string): GoldenFormatError {
  try {
    parseSoundGolden(text, "x.sound.txt");
  } catch (error) {
    expect(error).toBeInstanceOf(GoldenFormatError);
    return error as GoldenFormatError;
  }
  throw new Error("expected a parse failure");
}

describe("sound golden format", () => {
  it("serializes to the documented text and parses it back", () => {
    expect(serializeSoundGolden(golden)).toBe(TEXT);
    expect(parseSoundGolden(TEXT, "x.sound.txt")).toEqual(golden);
  });

  it("round-trips a silent golden with no keys, note or loop", () => {
    const silent: SoundGolden = {
      id: "sound/boot/power-on",
      status: "pending:22",
      source: "captures/6.39/plan16/boot/power-on",
      sourceSha256: SHA,
      state: "v639-plan15-restored",
      omitted: [],
      rows: [],
    };
    const text = serializeSoundGolden(silent);
    expect(text).toContain("omitted: none\n\n@events\n# t_ms output   state\n");
    expect(parseSoundGolden(text, "s.sound.txt")).toEqual(silent);
  });

  it("requires the header keys in order", () => {
    expect(failure(withLine(6, "keys: 0:down")).message).toBe(
      'x.sound.txt:6: expected header "state: …", got "keys: 0:down"',
    );
    expect(failure(withLine(1, "lcd-golden 1")).message).toMatch(
      /^x\.sound\.txt:1: expected "sound-golden 1"/,
    );
    expect(failure(withLine(2, "id: tree/x")).line).toBe(2);
    expect(failure(withLine(5, "source-sha256: abc")).line).toBe(5);
    expect(failure(withLine(6, "state: Factory")).line).toBe(6);
  });

  it("checks keys: phone key names, ascending, from time 0", () => {
    expect(failure(withLine(7, "keys: 0:menu")).message).toContain("phone key");
    expect(failure(withLine(7, "keys: 0:down 20:c 10:c")).message).toContain("ascend");
    expect(failure(withLine(7, "keys: 5:down")).message).toContain("time 0");
    expect(failure(withLine(7, "keys: 0:down+0")).line).toBe(7);
  });

  it("checks omitted counts", () => {
    expect(failure(withLine(9, "omitted: divider rewrite")).line).toBe(9);
    expect(failure(withLine(9, "omitted: 0 (stale frequency)")).line).toBe(9);
  });

  it("checks times: integers, non-decreasing", () => {
    expect(failure(withLine(13, "31.5   tone     900 v=0x9104")).message).toContain("integer");
    expect(failure(withLine(15, "10     buzzer   1319 v=16")).message).toBe(
      "x.sound.txt:15: times must not decrease: 10 after 171",
    );
  });

  it("allows negative times only with keys", () => {
    const negative = withLine(13, "-5     tone     900 v=0x9104");
    expect(parseSoundGolden(negative, "x.sound.txt").rows[0]!.ms).toBe(-5);
    const noKeys = negative.replace("keys: 0:down 2560:c+1500\n", "");
    expect(failure(noKeys).message).toContain("negative");
  });

  it("checks outputs and states", () => {
    expect(failure(withLine(13, "31     speaker  900 v=0x9104")).message).toContain("output");
    expect(failure(withLine(16, "993    vibrator 1 v=1")).message).toContain('"on" or "off"');
    expect(failure(withLine(15, "993    buzzer   on")).message).toContain("vibrator's state");
    expect(failure(withLine(15, "993    buzzer   1319.25 v=16")).message).toContain("one decimal");
    expect(failure(withLine(15, "993    buzzer   1319 v=0x10")).message).toContain("decimal");
    expect(failure(withLine(13, "31     tone     900 v=37124")).message).toContain("0xHHHH");
    expect(failure(withLine(15, "993    buzzer   1319+697 v=16")).message).toContain(
      "two frequencies",
    );
    expect(failure(withLine(15, "993    buzzer   0 v=16")).message).toContain("positive");
  });

  it("rejects an output repeating its previous state", () => {
    expect(failure(withLine(17, "1108   buzzer   1319 v=16")).message).toBe(
      'x.sound.txt:17: buzzer repeats its previous state "1319 v=16"',
    );
  });

  it("checks @loop", () => {
    expect(failure(withLine(21, "@loop 993")).line).toBe(21);
    expect(failure(withLine(21, "@loop 993 0")).line).toBe(21);
    expect(failure(withLine(21, "@loop 994 6017")).message).toContain("no row's time");
    expect(failure(`${TEXT}trailing\n`).message).toContain("unexpected content");
  });
});
