// Standalone demo: the stock v6.39 firmware (the whole menu tree, plan 14) on a 2D canvas,
// driven by the keyboard or buttons, with a dev-only overlay of the committed goldens.
import type { Phone, PhoneKey, ScreenModel } from "@hellotimber/phone-core";
import { createScreenRenderer, Framebuffer, type ScreenRenderer } from "@hellotimber/phone-screen";
import { LCD_HEIGHT, LCD_WIDTH, parseGolden, type GoldenImage } from "../scripts/golden-format.ts";
import { createStockPhone, missingStockGlyphs, paintStockScreen } from "../src/index";

const SCALE = 6;
const POWER_HOLD_MS = 1000;
/** Open question 1: the demo operator is `Telstra` (the stock small font covers it). */
const DEFAULT_CARRIER = "Telstra";

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

const lcd = element<HTMLDivElement>("lcd");
const status = element<HTMLParagraphElement>("status");
const error = element<HTMLParagraphElement>("error");
const carrierForm = element<HTMLFormElement>("carrier-form");
const carrierInput = element<HTMLInputElement>("carrier");
const carrierError = element<HTMLParagraphElement>("carrier-error");
const skipBoot = element<HTMLInputElement>("skip-boot");

const renderer: ScreenRenderer = createScreenRenderer({ paint: paintStockScreen, scale: SCALE });
renderer.canvas.setAttribute("aria-label", "Phone LCD");
lcd.append(renderer.canvas);

let carrier = DEFAULT_CARRIER;
let phone: Phone = startPhone();
let unsubscribe = (): void => {};

function startPhone(): Phone {
  return createStockPhone({ carrier, clock, date, boot: skipBoot.checked ? "skip" : "animated" });
}

/** Subscribes to the current phone and shows its screen. */
function attach(): void {
  unsubscribe();
  unsubscribe = phone.subscribe(({ screen }) => show(screen));
  show(phone.screen);
}

function show(screen: ScreenModel): void {
  status.textContent = `path: ${phone.path} · screen: ${screen.kind}`;
  try {
    renderer.render(screen);
    error.hidden = true;
  } catch (cause) {
    // The stock painter throws on text it cannot draw (D10); show it rather than freeze.
    error.textContent = cause instanceof Error ? cause.message : String(cause);
    error.hidden = false;
  }
  golden.update(screen);
}

function restart(): void {
  phone = startPhone();
  attach();
}

// One virtual clock for every phone: performance.now() in whole milliseconds.
function frame(): void {
  phone.tick(Math.floor(performance.now()));
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// --- keys ---------------------------------------------------------------------------------

function pressPower(): void {
  phone.send({ type: "down", key: "power" });
  const pressed = phone;
  setTimeout(() => pressed.send({ type: "up", key: "power" }), POWER_HOLD_MS);
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
  if (!event.repeat) phone.send({ type: "down", key });
});

window.addEventListener("keyup", (event) => {
  const key = KEYBOARD[event.key];
  if (key !== undefined) phone.send({ type: "up", key });
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
    phone.send({ type: "up", key });
  };
  button.addEventListener("pointerdown", (event) => {
    button.setPointerCapture(event.pointerId);
    down = true;
    phone.send({ type: "down", key });
  });
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
}

// --- settings ------------------------------------------------------------------------------

carrierForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const missing = missingStockGlyphs(carrierInput.value, "small");
  if (missing.length > 0) {
    carrierError.textContent = `The stock font has no ${missing.map((ch) => `"${ch}"`).join(", ")}.`;
    carrierError.hidden = false;
    return;
  }
  carrierError.hidden = true;
  carrier = carrierInput.value;
  restart();
});

skipBoot.addEventListener("change", restart);

// --- golden overlay (dev only) -------------------------------------------------------------

interface GoldenOverlay {
  update(screen: ScreenModel): void;
}

const golden: GoldenOverlay = import.meta.env.DEV ? createGoldenOverlay() : { update() {} };

function createGoldenOverlay(): GoldenOverlay {
  const section = element<HTMLElement>("goldens");
  const select = element<HTMLSelectElement>("golden");
  const view = element<HTMLSelectElement>("view");
  const opacity = element<HTMLInputElement>("opacity");
  const summary = element<HTMLParagraphElement>("diff-summary");
  section.hidden = false;

  const files = import.meta.glob<string>("../goldens/**/*.lcd.txt", {
    query: "?raw",
    import: "default",
    eager: true,
  });
  // Grouped by top-level menu for the tree goldens (`tree/05-tones`), else by kind (`menu`,
  // `probe`, ...), in id order.
  const images = new Map<string, GoldenImage>();
  const groups = new Map<string, HTMLOptGroupElement>();
  const parsedGoldens = Object.entries(files)
    .map(([path, text]) => parseGolden(text, path.replace("../goldens/", "")))
    .sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));
  for (const parsed of parsedGoldens) {
    const parts = parsed.id.split("/");
    const group = parts[0] === "tree" ? `${parts[0]}/${parts[1]}` : parts[0]!;
    let optgroup = groups.get(group);
    if (optgroup === undefined) {
      optgroup = document.createElement("optgroup");
      optgroup.label = group;
      groups.set(group, optgroup);
      select.append(optgroup);
    }
    for (const image of parsed.images) {
      const label = `${parsed.id} "${image.name}" (${parsed.status})`;
      images.set(label, image);
      optgroup.append(new Option(label, label));
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = LCD_WIDTH;
  canvas.height = LCD_HEIGHT;
  canvas.className = "overlay";
  canvas.setAttribute("aria-hidden", "true");
  lcd.append(canvas);
  const ctx = canvas.getContext("2d")!;
  const actual = new Framebuffer();
  let current: ScreenModel = phone.screen;

  function draw(): void {
    const mode = view.value;
    canvas.hidden = mode === "off";
    canvas.style.opacity = mode === "overlay" ? String(Number(opacity.value) / 100) : "1";
    const image = images.get(select.value);
    if (image === undefined) return;
    try {
      paintStockScreen(actual, current);
    } catch {
      actual.clear();
    }
    const pixels = ctx.createImageData(LCD_WIDTH, LCD_HEIGHT);
    let extra = 0;
    let missing = 0;
    for (let i = 0; i < LCD_WIDTH * LCD_HEIGHT; i++) {
      const g = image.pixels[i] === 1;
      const a = actual.pixels[i] === 1;
      if (a && !g) extra++;
      if (g && !a) missing++;
      // Overlay: the golden's ink in magenta. Difference: shared ink dark, only in the phone
      // red, only in the golden blue, both clear transparent.
      let rgba: readonly [number, number, number, number] = [0, 0, 0, 0];
      if (mode === "overlay") rgba = g ? [200, 0, 160, 255] : [0, 0, 0, 0];
      else if (a && g) rgba = [40, 50, 40, 255];
      else if (a) rgba = [220, 40, 40, 255];
      else if (g) rgba = [40, 90, 230, 255];
      else rgba = [199, 240, 216, 255];
      pixels.data.set(rgba, i * 4);
    }
    ctx.putImageData(pixels, 0, 0);
    summary.textContent =
      extra + missing === 0
        ? "Phone matches the golden pixel for pixel."
        : `${extra + missing} px differ: ${extra} only on the phone (red), ${missing} only in the golden (blue).`;
  }

  select.addEventListener("change", draw);
  view.addEventListener("change", draw);
  opacity.addEventListener("input", draw);
  return {
    update(screen) {
      current = screen;
      if (view.value !== "off") draw();
    },
  };
}

carrierInput.value = carrier;
attach();

function element<ElementType extends HTMLElement>(id: string): ElementType {
  const found = document.getElementById(id);
  if (found === null) throw new Error(`Missing #${id}`);
  return found as ElementType;
}
