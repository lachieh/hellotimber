import { Framebuffer } from "@hellotimber/phone-screen";
import type { Golden } from "../../scripts/golden-format";
import {
  observedSpaceImpactInput,
  type SpaceImpactDeliveredEvent,
} from "../../scripts/space-impact-delivery";
import {
  expireSpaceImpactShield,
  newSpaceImpactGame,
  spaceImpactKey,
  spaceImpactRender,
  stepSpaceImpact,
} from "../../src/games/space-impact/engine";
import type { SpaceImpactState } from "../../src/games/space-impact/model";
import { paintSpaceImpact } from "../../src/display/widgets/space-impact";

export function deliverSpaceImpactEvent(
  state: SpaceImpactState,
  event: SpaceImpactDeliveredEvent,
): SpaceImpactState {
  switch (event.kind) {
    case "step":
      return stepSpaceImpact(state).state;
    case "shield":
      return expireSpaceImpactShield(state).state;
    case "up":
      return spaceImpactKey(state, state.held?.key ?? "1", "up").state;
    case "down":
    case "repeat":
      return spaceImpactKey(state, event.key, event.kind).state;
  }
}

/** Diagnostic prefix accounting; full acceptance must also check every settled output and its timing. */
export function replaySpaceImpactLevel(golden: Golden) {
  const rows = golden.timeline!.filter(
    (row) => row.frame >= Number(golden.triggerFrame) && row.durationMs >= 34,
  );
  const images = new Map(golden.images.map((image) => [image.name, image.pixels]));
  let state = newSpaceImpactGame();
  let matched = 0;
  const compare = () => {
    const fb = new Framebuffer();
    paintSpaceImpact(fb, { kind: "space-impact", board: spaceImpactRender(state) });
    const row = rows[matched];
    if (row && fb.pixels.every((pixel, i) => pixel === images.get(row.image)![i])) matched++;
  };
  compare();
  const events = observedSpaceImpactInput(golden.note);
  for (const event of events) {
    state = deliverSpaceImpactEvent(state, event);
    compare();
  }
  return {
    matched,
    total: rows.length,
    next: rows[matched],
    last: rows[matched - 1],
    events: events.length,
    state,
  };
}
