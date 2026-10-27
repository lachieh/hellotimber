// Plan 30's resource evidence (docs/plans/30-sim-content-and-sim-services.md Task 3): SIM
// services' carousel icon (a SIM card and a hand, 11 frames) from ▲'s reveal of Menu 14 (every
// reveal plays it: C's return from the level, `sim/stk-level-main-c`, is cut off at 3.4 s, before
// the icon settles, and shows the same steps within the fidelity standard). Every other screen of plan 30 draws with existing
// resources: the fonts hold every character of the fixtures, `Wait` is plan 14's hatched bar
// (`progress-*`), the level and lists are the rows layout and rail.
import type { ResourceDeclarations } from "../resource-declarations.ts";

export const resources: ResourceDeclarations = {
  menuIcons: {
    "sim-services": { golden: "sim/stk-carousel-main-up" },
  },
};
