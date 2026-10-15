// A widget that answers keys as they go down leaves for a screen whose keys act on release: the
// screen it shows must not take that key's release (plan 21: the ringing alarm, the stopwatch).
import type { PhoneKey } from "@hellotimber/phone-core";
import type { Widget } from "./flow";

/** `widget`, given only the keys that went down while it was shown. */
export function freshKeys(widget: Widget): Widget {
  const downs = new Set<PhoneKey>();
  return {
    render: (flow) => widget.render(flow),
    onKeyDown(key, flow) {
      downs.add(key);
      widget.onKeyDown?.(key, flow);
    },
    onKey(key, flow) {
      if (downs.delete(key)) widget.onKey?.(key, flow);
    },
    tick: (dtMs, flow) => widget.tick?.(dtMs, flow),
    close: () => widget.close?.(),
  };
}
