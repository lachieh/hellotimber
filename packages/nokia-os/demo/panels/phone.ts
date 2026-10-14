// The phone itself (plan 13): the operator line, the boot animation, and the host's clock and
// date on standby and the Clock pages.
import { missingStockGlyphs } from "../../src/index";
import { byId, html, type DemoPanel } from "../panel";

/** Open question 1: the demo operator is `Telstra` (the stock small font covers it). */
const DEFAULT_CARRIER = "Telstra";

const pad = (n: number): string => String(n).padStart(2, "0");
/** The host clock in the firmware's 24-hour format, leading zero kept (`07:59`). */
const clock = (): string => {
  const now = new Date();
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
};
/** The host date as the firmware's Date setting shows it (`13.10.2026`). */
const date = (): string => {
  const now = new Date();
  return `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`;
};

let carrier = DEFAULT_CARRIER;
let skipBoot: HTMLInputElement | undefined;

export const phonePanel: DemoPanel = {
  name: "phone",
  plan: 13,
  mount(slots, host) {
    const form = html<HTMLFormElement>(`
      <form id="carrier-form">
        <label>
          Operator
          <input id="carrier" autocomplete="off" spellcheck="false" />
        </label>
        <button type="submit">Restart with operator</button>
        <p id="carrier-error" class="error" hidden></p>
      </form>`);
    const input = byId<HTMLInputElement>(form, "carrier");
    const error = byId<HTMLParagraphElement>(form, "carrier-error");
    input.value = carrier;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const missing = missingStockGlyphs(input.value, "small");
      if (missing.length > 0) {
        error.textContent = `The stock font has no ${missing.map((ch) => `"${ch}"`).join(", ")}.`;
        error.hidden = false;
        return;
      }
      error.hidden = true;
      carrier = input.value;
      host.restart();
    });
    const skip = html<HTMLLabelElement>(`
      <label class="check">
        <input id="skip-boot" type="checkbox" />
        Skip boot (restarts the phone)
      </label>`);
    skipBoot = byId<HTMLInputElement>(skip, "skip-boot");
    skipBoot.addEventListener("change", () => host.restart());
    slots.control(form);
    slots.control(skip);
  },
  config: () => ({ carrier, clock, date, boot: skipBoot?.checked ? "skip" : "animated" }),
};
