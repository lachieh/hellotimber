import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { captureSets } from "../scripts/capture-registry.ts";
import { composeResourceDeclarations } from "../scripts/resource-declarations.ts";
import type { PlanCaptureSet } from "../scripts/capture-set.ts";
import { extractResources, GOLDENS_DIR } from "../scripts/extract-resources.ts";
import { readGoldenIndex } from "../scripts/golden-index.ts";
import { loadGolden } from "./support/goldens.ts";

/** Two full extractions per test: seconds alone, longer beside the other packages' tests. */
const EXTRACTION_TIMEOUT_MS = 30_000;

const index = readGoldenIndex(GOLDENS_DIR);
const compose = (sets: readonly PlanCaptureSet[]) =>
  composeResourceDeclarations(sets, index, loadGolden);
const crop = {
  id: "consumer/tick",
  group: "consumer",
  golden: "tree/01-phone-book/1-8-1-1.choose",
  image: "e",
  x0: 63,
  x1: 83,
  y0: 1,
  y1: 23,
};
const consumer: PlanCaptureSet = {
  plan: "29",
  resources: {
    spriteBatches: [{ order: 290, entries: [crop] }],
    timelineGroups: { consumer: ["consumer"] },
    timelineBatches: [
      {
        order: 290,
        entries: [
          {
            golden: "tree/01-phone-book/1-8-1-1.choose",
            kind: "consumer",
            name: "consumer-confirmation",
          },
        ],
      },
    ],
  },
};

describe("plan resource registrations", () => {
  it("passes a registered crop and new timeline kind through real extraction", () => {
    const result = extractResources(GOLDENS_DIR, [...captureSets(), consumer]);
    expect(result.widgets.sprites["consumer/tick"]?.art.some((row) => row.includes("#"))).toBe(
      true,
    );
    const timeline = result.widgets.timelines[result.widgets.byName["consumer-confirmation"]!];
    expect(timeline?.frames).toContainEqual({ kind: "sprite", sprite: "consumer/tick" });
  });
  it("rejects competing sprite ownership even when recipes are identical", () => {
    expect(() =>
      compose([
        consumer,
        { plan: "30", resources: { spriteBatches: [{ order: 300, entries: [crop] }] } },
      ]),
    ).toThrow(/sprite.*consumer\/tick.*29.*30/);
  });
  it("rejects an absent indexed fixture before attempting its file", () => {
    expect(() =>
      compose([
        {
          plan: "29",
          resources: {
            spriteBatches: [{ order: 290, entries: [{ ...crop, golden: "missing/fixture" }] }],
          },
        },
      ]),
    ).toThrow(/29.*missing\/fixture.*indexed LCD/);
  });
  it("rejects an absent image", () => {
    expect(() =>
      compose([
        {
          plan: "29",
          resources: { spriteBatches: [{ order: 290, entries: [{ ...crop, image: "missing" }] }] },
        },
      ]),
    ).toThrow(/missing/);
  });
});

it(
  "takes a plan-owned glyph specimen and its bearing through font extraction",
  () => {
    const sets = captureSets();
    const foundation = sets.find((set) => set.plan === "13")!;
    const resources = foundation.resources!;
    const specimen = resources.textRuns!["menu/05-tones.sub"]!;
    const textRuns = Object.fromEntries(
      Object.entries(resources.textRuns!).filter(([id]) => id !== "menu/05-tones.sub"),
    );
    const override = resources.glyphOverrides!.find(
      (entry) => entry.kind === "bearing" && entry.font === "small" && entry.char === "1",
    )!;
    const moved = sets.map((set) =>
      set.plan === "13"
        ? {
            ...set,
            resources: {
              ...resources,
              textRuns,
              glyphOverrides: resources.glyphOverrides!.filter((entry) => entry !== override),
            },
          }
        : set,
    );
    // Plan 18's goldens also harvest small "1", so removing plan 13's specimen alone no longer
    // fails extraction; the registration moved to another plan must still give the same glyph.
    const result = extractResources(GOLDENS_DIR, [
      ...moved,
      {
        plan: "29",
        resources: {
          textRuns: { "menu/05-tones.sub": specimen },
          glyphOverrides: [override],
        },
      },
    ]);
    expect(result.fonts.small.glyphs["1"]).toEqual(extractResources().fonts.small.glyphs["1"]);
  },
  EXTRACTION_TIMEOUT_MS,
);

it("allows resource evidence from an honestly pending LCD golden", () => {
  const pending = index.find((entry) => entry.id === "menu/03-chat.sub")!;
  expect(pending.status).toBe("pending:18c");
  const inputs = compose([
    {
      plan: "18c",
      resources: {
        textRuns: {
          "menu/03-chat.sub": {
            "01": [{ font: "small", text: "Phone number:", top: 7, right: 79 }],
          },
        },
      },
    },
  ]);
  expect(inputs.textRuns["menu/03-chat.sub"]!["01"]![0]!.text).toBe("Phone number:");
  expect(pending.status).toBe("pending:18c");
});

it.each([
  { label: "crop outside LCD", sprite: { ...crop, x1: 84 }, error: /invalid LCD rectangle/ },
  { label: "fractional crop", sprite: { ...crop, y0: 1.5 }, error: /invalid LCD rectangle/ },
  { label: "empty crop", sprite: { ...crop, x0: 0, x1: 0, y0: 47, y1: 47 }, error: /no ink/ },
])("rejects $label", ({ sprite, error }) => {
  expect(() =>
    compose([{ plan: "29", resources: { spriteBatches: [{ order: 290, entries: [sprite] }] } }]),
  ).toThrow(error);
});

it("rejects duplicate batch order without changing caller arrays", () => {
  const sets = [
    consumer,
    { plan: "30", resources: { spriteBatches: [{ order: 290, entries: [] }] } },
  ];
  expect(() => compose(sets)).toThrow(/sprite batch.*290.*29.*30/);
  expect(sets.map((set) => set.plan)).toEqual(["29", "30"]);
});

it("rejects duplicate explicit targets before timeline deduplication", () => {
  const probe = consumer.resources!.timelineBatches![0]!.entries[0]!;
  expect(() =>
    compose([
      consumer,
      { plan: "30", resources: { timelineBatches: [{ order: 300, entries: [probe] }] } },
    ]),
  ).toThrow(/timeline target.*consumer-confirmation.*29.*30/);
});

it("rejects competing kind mappings and unknown kinds/groups", () => {
  expect(() =>
    compose([consumer, { plan: "30", resources: { timelineGroups: { consumer: ["consumer"] } } }]),
  ).toThrow(/timeline kind.*consumer.*29.*30/);
  expect(() =>
    compose([{ plan: "29", resources: { timelineGroups: { consumer: ["missing"] } } }]),
  ).toThrow(/missing sprite group/);
  expect(() =>
    compose([{ ...consumer, resources: { ...consumer.resources, timelineGroups: {} } }]),
  ).toThrow(/unknown timeline kind/);
});

it("rejects duplicate text bands and glyph override ownership", () => {
  const resources = {
    textRuns: {
      "menu/03-chat.sub": {
        "01": [{ font: "small" as const, text: "Phone number:", top: 7, right: 79 }],
      },
    },
  };
  expect(() =>
    compose([
      { plan: "18", resources },
      { plan: "18c", resources },
    ]),
  ).toThrow(/text run.*18.*18c/);
  const glyphOverrides = [
    { kind: "advance" as const, font: "small" as const, char: "/", advance: 5 },
  ];
  expect(() =>
    compose([
      { plan: "18", resources: { glyphOverrides } },
      { plan: "20", resources: { glyphOverrides } },
    ]),
  ).toThrow(/glyph override.*18.*20/);
});

it("rejects bad text bands, non-LCD fixtures and invalid probe frames", () => {
  expect(() =>
    compose([
      {
        plan: "18",
        resources: {
          textRuns: { "menu/03-chat.sub": { "01": [{ font: "large", text: "x", top: 40 }] } },
        },
      },
    ]),
  ).toThrow(/text band.*invalid LCD rectangle/);
  const nonLcd = index.find((entry) => entry.kind === "sound")!;
  expect(() =>
    compose([
      {
        plan: "29",
        resources: { spriteBatches: [{ order: 290, entries: [{ ...crop, golden: nonLcd.id }] }] },
      },
    ]),
  ).toThrow(/not an indexed LCD/);
  const probe = consumer.resources!.timelineBatches![0]!.entries[0]!;
  expect(() =>
    compose([
      {
        ...consumer,
        resources: {
          ...consumer.resources,
          timelineBatches: [{ order: 290, entries: [{ ...probe, fromFrame: 9999 }] }],
        },
      },
    ]),
  ).toThrow(/invalid fromFrame/);
});

it(
  "sorts batches independently of plan enumeration and preserves all existing bytes",
  () => {
    expect(extractResources(GOLDENS_DIR, captureSets().reverse())).toEqual(extractResources());
  },
  EXTRACTION_TIMEOUT_MS,
);

it("requires one index registration for every plan capture module and resource input", async () => {
  const scripts = join(import.meta.dirname, "../scripts");
  const files = readdirSync(join(scripts, "capture-sets")).filter((file) => file !== "index.ts");
  expect(files.map((file) => file.split("-")[0]).sort()).toEqual(
    captureSets()
      .map((set) => set.plan)
      .sort(),
  );
  for (const file of readdirSync(join(scripts, "resource-inputs"))) {
    const module = await import(/* @vite-ignore */ join(scripts, "resource-inputs", file));
    const plan = file.split("-")[0];
    expect(captureSets().find((set) => set.plan === plan)?.resources, file).toBe(module.resources);
  }
});

it("keeps extraction consumers on the registry", () => {
  const scripts = join(import.meta.dirname, "../scripts");
  expect(readFileSync(join(scripts, "extract-resources.ts"), "utf8")).not.toMatch(
    /from ["'][^"']*(?:resource-inputs|tree-text-runs)/,
  );
  for (const file of readdirSync(import.meta.dirname).filter((file) => file.endsWith(".test.ts"))) {
    const source = readFileSync(join(import.meta.dirname, file), "utf8");
    const imports = source.match(/import[^;]+from ["'][^"']*resource-inputs[^"']*["'];/g) ?? [];
    for (const statement of imports)
      expect(statement, file).toMatch(
        /^import \{ LEVEL1 \} from ["']\.\.\/scripts\/resource-inputs\/13-foundation\.ts["'];$/,
      );
  }
});

it("does not execute capture callbacks when composing registered evidence", () => {
  const callback = () => {
    throw new Error("REF callback executed");
  };
  const sets = captureSets([{ plan: "18c", lcd: callback, ticks: callback, sounds: callback }]);
  expect(compose(sets)).toEqual({
    textRuns: {},
    glyphOverrides: [],
    sprites: [],
    probes: [],
    timelineGroups: {},
  });
  expect(() => captureSets([{ plan: "18c" }, { plan: "18c" }])).toThrow(/two capture sets/);
  expect(() => captureSets([{ plan: "oops" }])).toThrow(/not a plan number/);
});

it("rejects a missing fixture file without modifying generated output", () => {
  const generated = join(import.meta.dirname, "../src/resources/generated");
  const bytes = () =>
    readdirSync(generated).map((file) => readFileSync(join(generated, file), "utf8"));
  const before = bytes();
  expect(() =>
    composeResourceDeclarations([consumer], index, () => {
      throw new Error("fixture file missing");
    }),
  ).toThrow(/fixture file missing/);
  expect(() =>
    extractResources(GOLDENS_DIR, [
      ...captureSets(),
      {
        plan: "29",
        resources: {
          spriteBatches: [{ order: 290, entries: [{ ...crop, golden: "missing/fixture" }] }],
        },
      },
    ]),
  ).toThrow(/not an indexed LCD/);
  expect(bytes()).toEqual(before);
});
