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
    const first = rows[0]!.ms;
    return resourceModule(
      "SPACE_IMPACT_SOUNDS",
      "Readonly<Record<string, { readonly id: string; readonly steps: readonly { readonly ms: number; readonly buzzer?: { readonly hz: number; readonly volume: number } | null }[] }>>",
      {
        "space-impact/shot": programFromRows(
          "space-impact/shot",
          rows.map((row) => ({ ...row, ms: row.ms - first })),
        ),
      },
    );
  },
};
