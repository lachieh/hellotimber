// Generated widget timelines by id and by name (src/resources/generated/widgets.ts), failing
// loudly when a binding names one the extractor did not produce.
import { WIDGET_TIMELINE_BY_NAME, WIDGET_TIMELINES } from "../resources";
import type { StockWidgetTimeline } from "../resources";

export function timelineById(id: string, what: string): StockWidgetTimeline {
  const found = WIDGET_TIMELINES[id];
  if (found === undefined) throw new Error(`No widget timeline "${id}" for ${what}.`);
  return found;
}

export function timelineByName(name: string): StockWidgetTimeline {
  const id = WIDGET_TIMELINE_BY_NAME[name];
  if (id === undefined) throw new Error(`No named widget timeline "${name}".`);
  return timelineById(id, name);
}
