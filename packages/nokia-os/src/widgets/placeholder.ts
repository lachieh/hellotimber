// A later plan's screen inside a flow (plan 14 D13): the placeholder frame of `label`; C goes back.
import type { PhoneKey } from "@hellotimber/phone-core";
import type { Flow, Widget } from "./flow";

/** `owner` is the plan that implements it (documentation only, never drawn). */
export function placeholderWidget(label: string, _owner: string): Widget {
  return {
    render: () => ({ kind: "placeholder", label }),
    onKey(key: PhoneKey, flow: Flow) {
      if (key === "c") flow.back();
    },
  };
}
