import { resourceModule, type GeneratedResourceModule } from "./resource-declarations.ts";
import { programFromRows } from "./sound-programs.ts";

export const spaceImpactSoundModule: GeneratedResourceModule = {
  file: "space-impact-sounds.ts",
  extract: ({ sound }) => {
    const source = sound("sound/game/space-impact/level-0");
    const rows = source.rows.filter((row) => row.output === "buzzer").slice(0, 5);
    const expected = [440, 466, 494, 523, null];
    if (
      rows.length !== expected.length ||
      rows.some((row, i) =>
        row.state.kind === "sounding"
          ? row.state.hz !== expected[i] || row.state.volume !== 3
          : expected[i] !== null,
      )
    )
      throw new Error("Space impact: changed captured shot program");
    const bonusIndex = source.rows.findIndex(
      (row) =>
        row.output === "buzzer" &&
        row.state.kind === "sounding" &&
        row.state.hz === 2636.9 &&
        row.state.volume === 6,
    );
    const bonus = source.rows.slice(bonusIndex, bonusIndex + 2);
    if (
      bonusIndex < 0 ||
      bonus.length !== 2 ||
      bonus[1]!.output !== "buzzer" ||
      bonus[1]!.state.kind !== "off"
    )
      throw new Error("Space impact: changed captured pickup program");
    const first = rows[0]!.ms;
    const vibration = sound("sound/game/space-impact/nokeys-warning-on").rows.filter(
      (row) => row.output === "vibrator",
    );
    const durations = vibration
      .flatMap((row, i) => {
        const next = vibration[i + 1];
        return row.state.kind === "on" && next?.state.kind === "off" ? [next.ms - row.ms] : [];
      })
      .sort((a, b) => a - b);
    if (durations.length !== 3)
      throw new Error("Space impact: missing captured vibration intervals");
    return (
      resourceModule("SPACE_IMPACT_VIBRATE_MS", "number", durations[1]) +
      resourceModule(
        "SPACE_IMPACT_SOUNDS",
        "Readonly<Record<string, { readonly id: string; readonly steps: readonly { readonly ms: number; readonly buzzer?: { readonly hz: number; readonly volume: number } | null }[] }>>",
        {
          "space-impact/bonus": programFromRows(
            "space-impact/bonus",
            bonus.map((row) => ({ ...row, ms: row.ms - bonus[0]!.ms })),
          ),
          "space-impact/shot": programFromRows(
            "space-impact/shot",
            rows.map((row) => ({ ...row, ms: row.ms - first })),
          ),
        },
      )
    );
  },
};
