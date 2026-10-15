// A screen the firmware shows for a moment between two others (plan 18): the next screen's soft
// key drawn alone before it (`sms/send-to-many` frame 1: `OK`, 168 ms; `sms/centre-1-ok`: `Select`,
// 128 ms; `sms/exit`: standby's `Menu`, 83 ms), or a blank LCD (`sms/save` frame 1, 32 ms).
import type { WidgetModel } from "../display/widgets";
import type { Flow, Widget } from "./flow";

/** `model` for `ms`, then `next` acts on the flow (replaces this screen, goes to standby). */
export function interlude(model: WidgetModel, ms: number, next: (flow: Flow) => void): Widget {
  let left = ms;
  return {
    render: () => model,
    tick(dtMs, flow) {
      if (left <= 0) return;
      left -= dtMs;
      if (left <= 0) next(flow);
    },
  };
}

/** A soft key alone on a blank screen (the next screen's, drawn first). */
export function softkeyAlone(softkey: string): WidgetModel {
  return { kind: "info-screen", lines: [], softkey };
}

/** The blank LCD (boot's first frame). */
export const BLANK: WidgetModel = { kind: "boot-frame", frame: 0 };
