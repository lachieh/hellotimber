import { describe, expect, it } from "vite-plus/test";
import { assertSpaceImpactCaptureGate } from "../scripts/capture-sets/24-space-impact.ts";
import { spaceImpactCaptureSet } from "../scripts/space-impact-capture-set.ts";

const SHA = "a".repeat(64);
const LEVELS = Array.from({ length: 8 }, (_, level) => `S6-level-${level}-recording`);
function evidence(): Record<string, unknown> {
  return {
    "plan24/driver-proof/complete.json": { status: "pass", generator_sha256: SHA },
    "plan24/analysis/coverage-audit.json": {
      status: "pass",
      generator_sha256: SHA,
      accepted: ["S5-level-chain", "S5-ending", ...LEVELS],
    },
    "plan24/validation-20261027/result.json": { status: "pass" },
    "plan24/analysis/accepted-criteria-20261027.json": { status: "accepted" },
  };
}

describe("plan 24's capture gate", () => {
  it("accepts the closed recording scope with a current control proof", () => {
    const files = evidence();
    expect(() => assertSpaceImpactCaptureGate((path) => files[path])).not.toThrow();
  });

  it("rejects missing, failed or stale proofs and an unaccepted criterion change", () => {
    for (const [path, value] of [
      ["plan24/driver-proof/complete.json", undefined],
      ["plan24/driver-proof/complete.json", { status: "fail", generator_sha256: SHA }],
      ["plan24/driver-proof/complete.json", { status: "pass", generator_sha256: "b".repeat(64) }],
      ["plan24/validation-20261027/result.json", { status: "fail" }],
      ["plan24/analysis/accepted-criteria-20261027.json", { status: "proposed" }],
    ] as const) {
      const files = { ...evidence(), [path]: value };
      expect(() => assertSpaceImpactCaptureGate((path) => files[path]), path).toThrow(/Task 0/);
    }
  });

  it("requires the level chain, ending and each of the eight replacement criteria", () => {
    for (const missing of ["S5-level-chain", "S5-ending", ...LEVELS]) {
      const files = evidence();
      files["plan24/analysis/coverage-audit.json"] = {
        status: "pass",
        generator_sha256: SHA,
        accepted: ["S5-level-chain", "S5-ending", ...LEVELS].filter((id) => id !== missing),
      };
      expect(() => assertSpaceImpactCaptureGate((path) => files[path]), missing).toThrow(/Task 0/);
    }
  });
});

function frame(x: number): Uint8Array {
  const pixels = new Uint8Array(84 * 48);
  const digit = (x: number, glyph: string) => {
    for (let i = 0; i < 15; i++) pixels[Math.floor(i / 3) * 84 + x + (i % 3)] = Number(glyph[i]);
  };
  const zero = "111101101101111";
  for (const x of [43, 57, 61, 65, 69, 73]) digit(x, zero);
  digit(47, "111001111001111");
  pixels[25 * 84 + x] = 1;
  return pixels;
}

it("keeps each full level as a lossless recording for every captured spawn, kill and shot", () => {
  const recording = [0, 93, 186, 279].map((startMs, index) => ({
    startMs,
    durationMs: 93,
    pixels: frame(index),
  }));
  const entries = spaceImpactCaptureSet({
    recording: (dir) =>
      dir.startsWith("plan24/bot/") &&
      !/^plan24\/bot\/full\/(?:level-[0-7](?:\.exit)?|end)$/.test(dir)
        ? undefined
        : recording,
    keys: () => [],
  });
  for (const key of ["0", "8"]) {
    expect(
      entries.find((entry) => entry.id === `game/space-impact/keys-hold-${key}.timeline`),
    ).toMatchObject({
      kind: "timeline",
      status: "pending:24",
      prefer: { source: { kind: "recording", dir: `plan24/keys/hold-${key}` } },
    });
  }
  for (let level = 0; level < 8; level++) {
    const entry = entries.find((entry) => entry.id === `game/space-impact/level-${level}`);
    expect(entry).toMatchObject({
      kind: "timeline",
      status: "pending:24",
      prefer: { source: { kind: "recording", dir: `plan24/bot/full/level-${level}` } },
    });
  }
});
