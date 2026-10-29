import { spaceImpactWaveProgramModule } from "../space-impact-wave-program.ts";
import { spaceImpactWaveInventoryModule } from "../space-impact-waves.ts";
import { withObservedSpaceImpactInput } from "../space-impact-delivery.ts";
import { spaceImpactSoundModule } from "../space-impact-sounds.ts";
import { spaceImpactLevelModule, spaceImpactOpeningWaveModule } from "../space-impact-levels.ts";
import { spaceImpactResources } from "../space-impact-resources.ts";
import type { CaptureIo, PlanCaptureSet } from "../capture-set.ts";
import {
  spaceImpact as captures,
  spaceImpactCaptureSet,
  spaceImpactSounds,
} from "../space-impact-capture-set.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The accepted capture gate precedes any selection or write by import-captures. */
export function assertSpaceImpactCaptureGate(read: CaptureIo["json"]): void {
  const fail = (): never => {
    throw new Error(
      "Plan 24 Task 0 capture gate is absent, incomplete or stale; run analysis/coverage.py --check in REF.",
    );
  };
  const document = (path: string): Record<string, unknown> => {
    const value = read(`plan24/${path}`);
    return isRecord(value) ? value : fail();
  };
  const audit = document("analysis/coverage-audit.json");
  const proof = document("driver-proof/complete.json");
  const validation = document("validation-20261027/result.json");
  const decision = document("analysis/accepted-criteria-20261027.json");
  const sha = proof.generator_sha256;
  const accepted = audit.accepted;
  const required = [
    "S5-level-chain",
    "S5-ending",
    ...Array.from({ length: 8 }, (_, n) => `S6-level-${n}-recording`),
  ];
  if (
    audit.status !== "pass" ||
    proof.status !== "pass" ||
    validation.status !== "pass" ||
    decision.status !== "accepted" ||
    typeof sha !== "string" ||
    !/^[a-f0-9]{64}$/.test(sha) ||
    audit.generator_sha256 !== sha ||
    !Array.isArray(accepted) ||
    !required.every((id) => accepted.includes(id))
  )
    fail();
}

export const spaceImpact: PlanCaptureSet = {
  ...captures,
  resources: {
    ...spaceImpactResources,
    generatedModules: [
      ...(spaceImpactResources.generatedModules ?? []),
      spaceImpactLevelModule,
      spaceImpactOpeningWaveModule,
      spaceImpactWaveInventoryModule,
      spaceImpactWaveProgramModule,
      spaceImpactSoundModule,
    ],
  },
  lcd(io) {
    assertSpaceImpactCaptureGate(io.json);
    const levels = io.json("plan24/input-model-20261029/delivered-levels.json");
    if (!isRecord(levels)) throw new Error("Space impact: missing delivered-level evidence");
    return spaceImpactCaptureSet(io.game).map((entry) =>
      entry.id === "game/space-impact/level-0"
        ? {
            ...entry,
            prefer: {
              ...entry.prefer,
              note: withObservedSpaceImpactInput(
                (entry.prefer.note ?? "") +
                  " Full-level replay uses the observed delivered stream below; input retains the legacy raw-pulse diagnostic.",
                levels["0"],
              ),
            },
          }
        : entry,
    );
  },
  sounds(io) {
    assertSpaceImpactCaptureGate(io.json);
    return spaceImpactSounds(io.sound);
  },
  notImported: {
    ...captures.notImported,
    "plan24/analysis/, plan24/archive/, plan24/validation-20261027/":
      "capture validation, exploratory census, accepted UNVERIFIED defaults, and duplicate replay evidence; never gameplay fixtures",
  },
};
