// SIM content and SIM services (plan 30): a select restarts the phone with a sample SIM that holds
// three messages (one unread, from a sender in its phone book) and a toolkit (Menu 14: `Info`, a
// text page; `Places`, a list of two items, one a call step), a preloaded Welcome note and IMEI.
// The status line reads the screen as plain text (`describeStockScreen`, D11), as a host's
// accessibility mirror would. A toolkit call opens plan 22's placeholder until plan 22 lands.
import type { ScreenModel } from "@hellotimber/phone-core";
import { describeStockScreen, type StockPhoneConfig, type StockSimCard } from "../../src/index";
import { byId, html, type DemoPanel } from "../panel";

const STAMP = { year: 2026, month: 10, day: 13, hour: 9, minute: 30, second: 0 };

/** The sample SIM: invented content (the emulator's identity is not reused). */
export const SAMPLE_SIM: StockSimCard = {
  id: "demo-sim-content",
  phoneBook: { entries: [{ name: "Ada", number: "0412000001" }] },
  messages: {
    slots: 15,
    entries: [
      { number: "0412000001", text: "Welcome to the stock firmware!", sentAt: STAMP, read: false },
      { number: "+61400000123", text: "Your order has shipped.", sentAt: STAMP },
      null,
      { number: "0499000999", text: "See you at 7?", sentAt: { ...STAMP, day: 12 } },
    ],
  },
  toolkit: {
    title: "Sample SIM",
    items: [
      { id: "info", label: "Info", steps: [{ kind: "text", text: "Content on the SIM card." }] },
      {
        id: "places",
        label: "Places",
        steps: [
          {
            kind: "select",
            title: "Places",
            items: [
              { id: "home", label: "Home", steps: [{ kind: "text", text: "Home sweet home" }] },
              {
                id: "office",
                label: "Office",
                steps: [{ kind: "call", number: "0298765432", confirm: "Call the office?" }],
              },
            ],
          },
        ],
      },
    ],
  },
};

/** What the sample sets on the phone: the SIM, an IMEI and a preloaded Welcome note. */
export const SAMPLE_CONFIG: Partial<StockPhoneConfig> = {
  sim: SAMPLE_SIM,
  imei: "490154203310018",
  preload: { welcomeNote: "Hello from the SIM" },
};

let select: HTMLSelectElement | undefined;
let shown: ScreenModel | undefined;

export const simPanel: DemoPanel = {
  name: "sim",
  plan: 30,
  mount(slots, host) {
    const label = html<HTMLLabelElement>(`
      <label>
        SIM content (restarts the phone)
        <select id="sim-content">
          <option value="off">Off</option>
          <option value="sample">Sample SIM: messages, Menu 14</option>
        </select>
      </label>`);
    select = byId<HTMLSelectElement>(label, "sim-content");
    select.addEventListener("change", () => host.restart());
    slots.control(label);
  },
  config() {
    if (select?.value !== "sample") return {};
    return SAMPLE_CONFIG;
  },
  screen(screen) {
    shown = screen;
  },
  status: () => (shown === undefined ? "text: —" : `text: ${describeStockScreen(shown)}`),
};
