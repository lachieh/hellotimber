// Plan 20 Task 2: the calculator's capture set on synthetic sources (no REF).
import { describe, expect, it } from "vite-plus/test";
import {
  calculator,
  CALCULATOR_CASES,
  CalculatorCaptureError,
  calculatorLcd,
  calculatorSounds,
  calculatorStills,
  CALCULATOR_STILLS,
  imageNameOf,
  stillFixtureOf,
  type CalculatorCase,
} from "../scripts/capture-sets/20-calculator.ts";
import { shotImages, type CaptureSetEntry } from "../scripts/capture-set.ts";
import { EVENTS_HEADER, KEYS_HEADER, type SoundCaptureIo } from "../scripts/sound-capture-set.ts";

const byId = (entries: readonly CaptureSetEntry[]) =>
  new Map(entries.map((entry) => [entry.id, entry] as const));

/** The plan's "Golden pipeline additions" rows, as fixture ids (`{a,b}` expanded). */
const PIPELINE_LCD = [
  "calculator/open",
  "calculator/entry",
  "calculator/exit",
  "calculator/clear-held",
  "calculator/operators",
  "calculator/operator-slow",
  "calculator/options-number",
  "calculator/options-operator",
  "calculator/options-operand",
  "calculator/choose",
  "calculator/results",
  "calculator/divide-by-zero",
  "calculator/out-of-range",
  "calculator/rate-list",
  "calculator/rate-prompt-foreign",
  "calculator/rate-prompt-domestic",
  "calculator/rate-keys",
  "calculator/rate-saved",
  "calculator/convert",
  "calculator/persist",
];

describe("calculator capture set", () => {
  const lcd = byId(calculatorLcd());

  it("lists every LCD row of the golden pipeline table", () => {
    for (const id of PIPELINE_LCD) expect(lcd.has(id), id).toBe(true);
    // `calculator/note-keys`: C, a digit, ▼ and C held during each note.
    for (const kind of ["divide-by-zero", "out-of-range"]) {
      for (const key of ["c", "digit", "down", "c-held"]) {
        expect(lcd.has(`calculator/note-keys-${kind}-${key}`)).toBe(true);
      }
    }
  });

  it("names every still by its case, in case order, one fixture per capture directory", () => {
    const entry = lcd.get("calculator/entry")!;
    const source = entry.prefer.source;
    expect(source.kind).toBe("shots");
    const files = source.kind === "shots" ? source.files : [];
    const cases = CALCULATOR_CASES.filter((c) => stillFixtureOf(c.name).id === "calculator/entry");
    expect(files).toEqual(cases.map((c) => `plan20/${c.name}.png`));
    expect(files[0]).toBe("plan20/entry/first.png");
    expect(stillFixtureOf("options/number-up")).toEqual({
      id: "calculator/options-number",
      image: "number-up",
    });
    expect(stillFixtureOf("rate/list-c")).toEqual({ id: "calculator/rate-list", image: "list-c" });
    expect(stillFixtureOf("operators/star/03")).toEqual({
      id: "calculator/operators-star",
      image: "03",
    });
    // Every case lands in exactly one still, and the stills hold Task 0's 388 cases.
    const stills = CALCULATOR_STILLS.map((s) => lcd.get(s.id)!);
    const all = stills.flatMap((s) =>
      s.prefer.source.kind === "shots" ? shotImages(s.prefer.source.files) : [],
    );
    expect(all).toHaveLength(388);
    expect(new Set(all.map((shot) => shot.file)).size).toBe(388);
    for (const still of stills) {
      const names =
        still.prefer.source.kind === "shots" ? shotImages(still.prefer.source.files) : [];
      expect(new Set(names.map((shot) => shot.name)).size, still.id).toBe(names.length);
    }
  });

  it("names a still whose file stem the golden format cannot hold", () => {
    expect(imageNameOf("results/0.1+0.2")).toBe("0p1plus0p2");
    expect(imageNameOf("results/-99999999.5-after")).toBe("-99999999p5-after");
    expect(imageNameOf("convert/foreign-1.5-10-in-domestic")).toBe("foreign-1p5-10-in-domestic");
    expect(imageNameOf("entry/c-held-1500")).toBe("c-held-1500");
    const results = lcd.get("calculator/results")!.prefer.source;
    expect(results.kind === "shots" ? results.files : []).toContainEqual({
      file: "plan20/results/12+3.png",
      name: "12plus3",
    });
  });

  it("keeps the case setups, holds and waits as captured", () => {
    const named = (name: string) => CALCULATOR_CASES.find((c) => c.name === name)!;
    expect(named("entry/c-held-1500").keys).toBe("5 6 7 c@1500");
    expect(named("rate/keys/typed-blink").keys).toBe("menu up menu menu +500 1 # 5 +480");
    expect(named("persist/restore-foreign-domestic-blink").setup).toBe("restore-foreign");
    expect(named("persist/reentry").setup).toBe("reentry");
  });

  it("throws naming both sides for a case with no image and an image with no case", () => {
    const cases: CalculatorCase[] = CALCULATOR_CASES.slice();
    const listing = (extra: readonly string[], missing?: string) => (dir: string) => {
      const stems = cases
        .filter((c) => `plan20/${c.name.slice(0, c.name.lastIndexOf("/"))}` === dir)
        .map((c) => c.name.slice(c.name.lastIndexOf("/") + 1))
        .filter((stem) => `${dir}/${stem}` !== `plan20/${missing}`);
      return dir === "plan20/entry" ? [...stems, ...extra] : stems;
    };
    expect(() => calculatorStills(cases, listing([]))).not.toThrow();
    expect(() => calculatorStills(cases, listing(["stray"]))).toThrow(
      new CalculatorCaptureError("image plan20/entry/stray.png has no case in CALCULATOR_CASES"),
    );
    expect(() => calculatorStills(cases, listing([], "entry/digit-5"))).toThrow(
      "case entry/digit-5 has no image plan20/entry/digit-5.png",
    );
    expect(() => calculatorStills([...cases, { name: "nowhere/x", keys: "" }])).toThrow(
      "case nowhere/x: no still fixture calculator/nowhere",
    );
  });

  it("imports everything pending: plan 20 until its scenario passes, plan 22 for D9", () => {
    for (const [id, entry] of lcd) {
      const d9 = /keys-options-(\d|star|hash)$|options-dtmf-confirm/.test(id);
      if (d9) expect(entry.status, id).toBe("pending:22");
      else expect(["asserted", "pending:20"], id).toContain(entry.status);
    }
    expect(lcd.get("calculator/keys-options-up")!.status).not.toBe("pending:22");
  });

  it("aligns key recordings on the key's redraw, or on the key when it changes nothing", () => {
    expect(lcd.get("calculator/keys-rate-5")!.prefer.triggerFrame).toBe(1);
    expect(lcd.get("calculator/keys-rate-up")!.prefer.triggerFrame).toBe(0);
    expect(lcd.get("calculator/open")!.prefer.source).toEqual({
      kind: "recording",
      dir: "plan20/open",
    });
  });

  it("registers as plan 20 with its resource evidence", () => {
    expect(calculator.plan).toBe("20");
    expect(calculator.resources?.textRuns?.["calculator/operators"]).toBeDefined();
  });
});

describe("calculator sound goldens", () => {
  /** Every recording: a 900 Hz beep after one OK key, or a DTMF pair for the escape keys. */
  const io: SoundCaptureIo = {
    events: (dir) => {
      const dtmf = /keys-options-(\d|star|hash)$|dtmf-confirm/.test(dir);
      const on = dtmf ? "1336,941,0,0,0,0,0x9104" : "900,0,0,0,0,0,0x9104";
      return [EVENTS_HEADER, "0,0,0,0,0,0,0,0x910F", `10,${on}`, "150,0,0,0,0,0,0,0x910F"].join(
        "\n",
      );
    },
    keys: () => [KEYS_HEADER, "menu,0.0,60.0"].join("\n"),
    sha256: () => "0".repeat(64),
    list: () => [],
  };
  const goldens = new Map(calculatorSounds(io).map((golden) => [golden.id, golden] as const));

  it("normalises the recordings as plan 16 does, factory unless the virgin row", () => {
    const keys = goldens.get("sound/calculator/keys")!;
    expect(keys.state).toBe("factory");
    expect(keys.source).toBe("captures/6.39/plan20/sound/keys");
    expect(keys.rows).toEqual([
      { ms: 10, output: "tone", state: { kind: "sounding", hz: 900, volume: 0x9104 } },
      { ms: 150, output: "tone", state: { kind: "off" } },
    ]);
    expect(goldens.get("sound/calculator/divide-by-zero-virgin")!.state).toBe("virgin");
  });

  it("keeps both frequencies of a DTMF pair, pending plan 22", () => {
    const zero = goldens.get("sound/calculator/keys-options-0")!;
    expect(zero.status).toBe("pending:22");
    expect(zero.rows[0]!.state).toEqual({ kind: "sounding", hz: 1336, hz2: 941, volume: 0x9104 });
    expect(goldens.get("sound/calculator/options-dtmf-confirm-1")!.status).toBe("pending:22");
    expect(goldens.get("sound/calculator/keys-options-up")!.status).not.toBe("pending:22");
  });

  it("quotes the warning-tone notes' text, as plan 16's warning-tone extraction reads it", () => {
    expect(goldens.get("sound/note/calculator-out-of-range")!.note).toMatch(/^"Out of range"/);
    expect(goldens.get("sound/note/calculator-divide-by-zero")!.note).toMatch(
      /^"Dividing by zero not allowed"/,
    );
    expect(goldens.get("sound/calculator/note-key")!.note).not.toMatch(/^"/);
  });
});
