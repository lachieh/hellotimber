// Standalone demo: the stock v6.39 firmware (the whole menu tree, plan 14, and Snake II, plan 23)
// on a 2D canvas, driven by the keyboard or buttons. Arrows stay ▲/▼ (they turn the snake); the
// digits steer it. This shell owns the LCD, the keys and the phone's lifecycle; each feature's
// controls are a panel (demo/panels/, registered in demo/panels/index.ts): the operator and boot,
// the EEPROM in localStorage and the SIM (plan 15), WebAudio and vibration (plan 16), and the
// dev-only golden overlay.
import type { Phone, PhoneKey, ScreenModel } from "@hellotimber/phone-core";
import { createScreenRenderer, type ScreenRenderer } from "@hellotimber/phone-screen";
import { createStockPhone, paintStockScreen, type StockPhoneConfig } from "../src/index";
import type { DemoHost, DemoPanel, DemoSlots } from "./panel";
import * as PANELS from "./panels/index";

const SCALE = 6;
const POWER_HOLD_MS = 1000;

const DIGITS: readonly PhoneKey[] = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

const KEYBOARD: Readonly<Record<string, PhoneKey>> = {
  ArrowUp: "up",
  ArrowDown: "down",
  Enter: "navi",
  Backspace: "c",
  Escape: "c",
  "*": "*",
  "#": "#",
  ...Object.fromEntries(DIGITS.map((digit) => [digit, digit])),
};

const main = element<HTMLElement>("main");
const lcd = element<HTMLDivElement>("lcd");
const screenRow = element<HTMLDivElement>("screen-row");
const status = element<HTMLParagraphElement>("status");
const error = element<HTMLParagraphElement>("error");
const controls = element<HTMLElement>("controls");

/** The panels in plan order (then by name). */
const registered: DemoPanel[] = Object.values(PANELS);
const panels: readonly DemoPanel[] = registered.sort(
  (a, b) => a.plan - b.plan || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
);

const renderer: ScreenRenderer = createScreenRenderer({ paint: paintStockScreen, scale: SCALE });
renderer.canvas.setAttribute("aria-label", "Phone LCD");
lcd.append(renderer.canvas);

/** Undefined while the phone failed to start (a malformed EEPROM record). */
let phone: Phone | undefined;
let unsubscribe = (): void => {};

const host: DemoHost = {
  get phone() {
    return phone;
  },
  restart,
};

const wide: HTMLElement[] = [];
const slots: DemoSlots = {
  screenRow,
  lcd,
  phone: (element) => error.before(element),
  control: (element) => controls.append(element),
  wideControl: (element) => wide.push(element),
  section: (element) => main.append(element),
};
for (const panel of panels) panel.mount(slots, host);
controls.append(...wide);

/** A phone over every panel's config; a malformed stored record makes createStockPhone throw. */
function startPhone(): Phone | undefined {
  const config = Object.assign({}, ...panels.map((panel) => panel.config?.() ?? {}));
  try {
    const started = createStockPhone(config as StockPhoneConfig);
    for (const panel of panels) panel.started?.(undefined);
    return started;
  } catch (cause) {
    const failure = cause instanceof Error ? cause : new Error(String(cause));
    for (const panel of panels) panel.started?.(failure);
    return undefined;
  }
}

/** The status line: the path and screen, then every panel's part. */
function statusLine(current: Phone | undefined, screen: ScreenModel | undefined): string {
  const parts = panels.flatMap((panel) => (panel.status === undefined ? [] : [panel.status()]));
  if (current === undefined || screen === undefined) return parts.join(" · ");
  const app = screen.kind === "custom" ? ` (${screen.appId})` : "";
  return [`path: ${current.path}`, `screen: ${screen.kind}${app}`, ...parts].join(" · ");
}

/** Subscribes to the current phone and shows its screen. */
function attach(): void {
  unsubscribe();
  unsubscribe = (): void => {};
  if (phone === undefined) {
    renderer.render({ kind: "off" });
    status.textContent = statusLine(undefined, undefined);
    return;
  }
  const current = phone;
  unsubscribe = current.subscribe(({ screen }) => show(current, screen));
  show(current, current.screen);
}

function show(current: Phone, screen: ScreenModel): void {
  status.textContent = statusLine(current, screen);
  try {
    renderer.render(screen);
    error.hidden = true;
  } catch (cause) {
    // The stock painter throws on text it cannot draw (D10); show it rather than freeze.
    error.textContent = cause instanceof Error ? cause.message : String(cause);
    error.hidden = false;
  }
  for (const panel of panels) panel.screen?.(screen);
}

function restart(): void {
  for (const panel of panels) panel.beforeRestart?.();
  phone = startPhone();
  attach();
}

// One virtual clock for every phone: performance.now() in whole milliseconds.
function frame(): void {
  const now = Math.floor(performance.now());
  for (const panel of panels) panel.frame?.(now);
  phone?.tick(now);
  requestAnimationFrame(frame);
}

phone = startPhone();
requestAnimationFrame(frame);

// --- keys ---------------------------------------------------------------------------------

function pressPower(): void {
  const pressed = phone;
  pressed?.send({ type: "down", key: "power" });
  setTimeout(() => pressed?.send({ type: "up", key: "power" }), POWER_HOLD_MS);
}

window.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) {
    return;
  }
  if (event.key === "p" || event.key === "P") {
    if (!event.repeat) pressPower();
    event.preventDefault();
    return;
  }
  const key = KEYBOARD[event.key];
  if (key === undefined) return;
  event.preventDefault();
  if (!event.repeat) phone?.send({ type: "down", key });
});

window.addEventListener("keyup", (event) => {
  const key = KEYBOARD[event.key];
  if (key !== undefined) phone?.send({ type: "up", key });
});

for (const button of document.querySelectorAll<HTMLButtonElement>("button[data-key]")) {
  const key = button.dataset.key as PhoneKey;
  if (key === "power") {
    button.addEventListener("click", pressPower);
    continue;
  }
  let down = false;
  const release = (): void => {
    if (!down) return;
    down = false;
    phone?.send({ type: "up", key });
  };
  button.addEventListener("pointerdown", (event) => {
    button.setPointerCapture(event.pointerId);
    down = true;
    phone?.send({ type: "down", key });
  });
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
}

attach();

function element<ElementType extends HTMLElement>(id: string): ElementType {
  const found = document.getElementById(id);
  if (found === null) throw new Error(`Missing #${id}`);
  return found as ElementType;
}
