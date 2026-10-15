// T9 predictive text (plan 18b D5): the English dictionary is a separate entry point,
// `@hellotimber/nokia-os/t9-english`, imported lazily so Vite emits it as its own chunk; the phone
// is restarted with it once it arrives (until then, and with the box unticked, the phone has no
// dictionary and Write messages is multi-tap, as for a host that leaves it out).
import type { T9Dictionary } from "../../src/index";
import { byId, html, type DemoPanel } from "../panel";

let english: T9Dictionary | undefined;
let loading = "loading";
let enabled: HTMLInputElement | undefined;

export const t9Panel: DemoPanel = {
  name: "t9",
  plan: 18,
  mount(slots, host) {
    const label = html<HTMLLabelElement>(`
      <label class="check">
        <input id="t9-english" type="checkbox" checked />
        T9 English dictionary (restarts the phone)
      </label>`);
    enabled = byId<HTMLInputElement>(label, "t9-english");
    enabled.addEventListener("change", () => host.restart());
    slots.control(label);
    import("@hellotimber/nokia-os/t9-english").then(
      ({ englishT9 }) => {
        english = englishT9;
        loading = "";
        host.restart();
      },
      (cause: unknown) => {
        loading = `failed (${cause instanceof Error ? cause.message : String(cause)})`;
      },
    );
  },
  config: () => ({ t9: enabled?.checked && english ? { english } : {} }),
  status: () =>
    `T9: ${loading || (enabled?.checked && english ? `English (${english!.size} words)` : "off")}`,
};
