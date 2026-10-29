export type SpaceImpactDeliveredEvent = { readonly atMs: number } & (
  | { readonly kind: "step" | "shield" | "up" }
  | { readonly kind: "down" | "repeat"; readonly key: "0" | "1" | "8" }
);

const MARKER = " Delivered input v1: ";

export function spaceImpactDeliveredEvents(value: unknown): readonly SpaceImpactDeliveredEvent[] {
  if (!Array.isArray(value)) throw new Error("Space impact: missing observed delivered events");
  let previous = -Infinity;
  return value.map((event: unknown): SpaceImpactDeliveredEvent => {
    if (
      typeof event !== "object" ||
      event === null ||
      !("atMs" in event) ||
      typeof event.atMs !== "number" ||
      !Number.isFinite(event.atMs) ||
      event.atMs < previous ||
      !("kind" in event)
    )
      throw new Error("Space impact: invalid delivered event order");
    previous = event.atMs;
    const atMs = event.atMs;
    switch (event.kind) {
      case "step":
      case "shield":
      case "up":
        return { atMs, kind: event.kind };
      case "down":
      case "repeat":
        if ("key" in event && (event.key === "0" || event.key === "1" || event.key === "8"))
          return { atMs, kind: event.kind, key: event.key };
    }
    throw new Error("Space impact: invalid observed delivered key");
  });
}

export function withObservedSpaceImpactInput(note: string, value: unknown): string {
  return note + MARKER + JSON.stringify(spaceImpactDeliveredEvents(value));
}

export function observedSpaceImpactInput(
  note: string | undefined,
): readonly SpaceImpactDeliveredEvent[] {
  const start = note?.lastIndexOf(MARKER) ?? -1;
  if (note === undefined || start === -1)
    throw new Error("Space impact: golden has no delivered input");
  return spaceImpactDeliveredEvents(JSON.parse(note.slice(start + MARKER.length)));
}
