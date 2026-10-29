import { describe, expect, it } from "vite-plus/test";
import {
  observedSpaceImpactInput,
  withObservedSpaceImpactInput,
} from "../scripts/space-impact-delivery";
import { loadGolden } from "./support/goldens";

describe("Space impact observed delivered input", () => {
  it("imports the complete event stream into the golden without a REF dependency", () => {
    const events = observedSpaceImpactInput(loadGolden("game/space-impact/level-0").note);
    expect(events).toHaveLength(1812);
    expect(events.filter((event) => event.kind === "down")).toHaveLength(537);
    expect(events.filter((event) => event.kind === "repeat")).toHaveLength(71);
    expect(events.filter((event) => event.kind === "step")).toHaveLength(796);
    expect(events.filter((event) => event.atMs > 3350 && event.atMs < 3446)).toEqual([
      { atMs: 3354.214, kind: "down", key: "8" },
      { atMs: 3389.6243, kind: "step" },
      { atMs: 3444.7135, kind: "repeat", key: "8" },
      { atMs: 3445.7874, kind: "up" },
    ]);
  });

  it("round-trips event order, including simultaneous events and repeats", () => {
    const events = [
      { atMs: 10, kind: "down", key: "8" },
      { atMs: 10, kind: "repeat", key: "8" },
      { atMs: 11, kind: "up" },
    ];
    expect(
      observedSpaceImpactInput(withObservedSpaceImpactInput("Source evidence.", events)),
    ).toEqual(events);
  });

  it.each([
    undefined,
    {},
    [null],
    [{ atMs: 1, kind: "down", key: "Q" }],
    [
      { atMs: 2, kind: "step" },
      { atMs: 1, kind: "step" },
    ],
    [{ atMs: Infinity, kind: "step" }],
  ])("rejects missing or malformed event evidence: %j", (value) => {
    expect(() => withObservedSpaceImpactInput("", value)).toThrow(/Space impact/);
  });
});
