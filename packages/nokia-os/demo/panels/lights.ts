// The phone's lights port (plan 25 D1): an LCD and a KEYS lamp beside the LCD, the LCD dimmed
// while the display LEDs are off, and the last events logged for headless checks.
import type { StockLightEvent, StockLightsPort } from "../../src/index";
import { html, type DemoPanel } from "../panel";

/** The event log's length. */
const LIGHTS_LOG_LENGTH = 8;

let elements:
  | { display: HTMLElement; keypad: HTMLElement; log: HTMLElement; lcd: HTMLElement }
  | undefined;
let log: string[] = [];

function show(light: StockLightEvent["light"], on: boolean): void {
  elements?.[light].classList.toggle("on", on);
  if (light === "display") elements?.lcd.classList.toggle("unlit", !on);
}

const lights: StockLightsPort = {
  change(event) {
    log = [...log, `${event.atMs} ${event.light} ${event.on ? "on" : "off"}`].slice(
      -LIGHTS_LOG_LENGTH,
    );
    elements?.log.replaceChildren(
      ...log.map((line) => Object.assign(document.createElement("li"), { textContent: line })),
    );
    show(event.light, event.on);
  },
};

export const lightsPanel: DemoPanel = {
  name: "lights",
  plan: 25,
  mount(slots) {
    const display = html(`<span id="lamp-lcd" class="lamp" aria-label="Display LEDs">LCD</span>`);
    const keypad = html(`<span id="lamp-keys" class="lamp" aria-label="Keypad LEDs">KEYS</span>`);
    const logList = html(
      `<ol id="lights-log" class="sound-log" aria-label="Lights events (the last 8)"></ol>`,
    );
    elements = { display, keypad, log: logList, lcd: slots.lcd };
    slots.screenRow.append(display, keypad);
    slots.phone(logList);
    // Off until the phone's boot lights it.
    show("display", false);
    show("keypad", false);
  },
  config: () => ({ lights }),
  // A restarted phone starts dark: its predecessor's lights go out.
  beforeRestart() {
    show("display", false);
    show("keypad", false);
  },
  status: () => `lights: ${elements?.display.classList.contains("on") ? "on" : "off"}`,
};
