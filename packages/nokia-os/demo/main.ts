// Standalone demo: the stock v6.39 firmware (the whole menu tree, plan 14, and Snake II, plan 23)
// on a 2D canvas, driven by the keyboard or buttons, with a dev-only overlay of the committed
// goldens. Arrows stay ▲/▼ (they turn the snake); the digits steer it. The phone's EEPROM is the
// page's localStorage (plan 15): settings survive a reload, and empty storage is the virgin
// phone. "Erase EEPROM" empties it; "Factory settings" restarts over the factory state (plan 16
// D7: the virgin phone is nearly silent); the SIM select swaps the card (Phone security's new-SIM
// prompt). The phone's sound port (plan 16 D4) plays through WebAudio, drives a VIBRA lamp and a
// shake of the LCD, and logs its last events for headless checks.
import type { Phone, PhoneKey, ScreenModel } from "@hellotimber/phone-core";
import { createScreenRenderer, Framebuffer, type ScreenRenderer } from "@hellotimber/phone-screen";
import { LCD_HEIGHT, LCD_WIDTH, parseGolden, type GoldenImage } from "../scripts/golden-format.ts";
import { StockEeprom } from "../src/firmware/eeprom";
import { createStockSettings } from "../src/firmware/settings";
import {
  createStockPhone,
  missingStockGlyphs,
  paintStockScreen,
  STOCK_STORAGE_PREFIX,
  type StockSoundEvent,
  type StockSoundPort,
} from "../src/index";

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
const simSelect = element<HTMLSelectElement>("sim");
const eraseButton = element<HTMLButtonElement>("erase");
const factoryButton = element<HTMLButtonElement>("factory");
const storageError = element<HTMLParagraphElement>("storage-error");
const muteBox = element<HTMLInputElement>("mute");
const vibraLamp = element<HTMLSpanElement>("vibra");
const soundLog = element<HTMLOListElement>("sound-log");

// --- sound (plan 16) -----------------------------------------------------------------------

/**
 * Buzzer volume register (MAD2 PUP 0x1E, 0-194 captured; higher is louder) → gain, linear
 * between these points. The demo's choice: the emulator renders neither volume register and the
 * phone's loudness is not captured (plan 16 Open question 2). Captured registers:
 * Level 1 tables ≈4, Level 4 ≈16, Level 5 ≈61, Snake II 3-6, `Code error` 22.
 *
 * | register | 0 | 4    | 16   | 61   | 194  |
 * | gain     | 0 | 0.05 | 0.10 | 0.18 | 0.25 |
 */
const BUZZER_GAIN: readonly (readonly [register: number, gain: number])[] = [
  [0, 0],
  [4, 0.05],
  [16, 0.1],
  [61, 0.18],
  [194, 0.25],
];

/**
 * Tone-generator level word (0x91LN) → gain by its low nibble N (0 loudest; 0xF mutes): the
 * earpiece path, a quiet sine (the emulator renders it as a sine; the earpiece's sound is not
 * captured). Keypad Level 1/2/3 = 0x9108/0x9104/0x9100, warning tones 0x9105.
 */
const TONE_GAIN: readonly number[] = Array.from({ length: 16 }, (_, n) =>
  n === 15 ? 0 : 0.06 * (1 - n / 15),
);

/** Scheduling headroom: events play this long after their kernel time. */
const SOUND_LATENCY_S = 0.03;
/** The event log's length. */
const SOUND_LOG_LENGTH = 8;

function buzzerGain(register: number): number {
  for (let i = 1; i < BUZZER_GAIN.length; i++) {
    const [r1, g1] = BUZZER_GAIN[i]!;
    if (register > r1) continue;
    const [r0, g0] = BUZZER_GAIN[i - 1]!;
    return g0 + ((g1 - g0) * (register - r0)) / (r1 - r0);
  }
  return BUZZER_GAIN.at(-1)![1];
}

/** `atMs output state`, as the sound goldens write rows. */
function describeSound(event: StockSoundEvent): string {
  if (event.output === "vibrator") return `${event.atMs} vibrator ${event.on ? "on" : "off"}`;
  if (event.hz === null) return `${event.atMs} ${event.output} off`;
  const volume =
    event.output === "tone" ? `0x${event.volume.toString(16).toUpperCase()}` : event.volume;
  return `${event.atMs} ${event.output} ${event.hz} v=${volume}`;
}

interface Voice {
  readonly oscillator: OscillatorNode;
  readonly gain: GainNode;
}

/**
 * The phone's sound port: one AudioContext (made on the first user gesture, as browsers
 * require), the buzzer as a square and the tone generator as a sine, each through its gain;
 * every event scheduled at `currentTime + (atMs - phoneNow) / 1000 + SOUND_LATENCY_S`.
 */
class WebAudioSound implements StockSoundPort {
  /** The kernel time of the tick emitting events (the demo's clock). */
  phoneNow = 0;
  #audio: { ctx: AudioContext; master: GainNode; buzzer: Voice; tone: Voice } | undefined;
  #muted = false;
  #log: string[] = [];

  /** Creates or resumes the AudioContext (call from a user gesture). */
  start(): void {
    if (this.#audio !== undefined) {
      void this.#audio.ctx.resume();
      return;
    }
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = this.#muted ? 0 : 1;
    master.connect(ctx.destination);
    const voice = (type: OscillatorType): Voice => {
      const oscillator = ctx.createOscillator();
      oscillator.type = type;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      oscillator.connect(gain).connect(master);
      oscillator.start();
      return { oscillator, gain };
    };
    this.#audio = { ctx, master, buzzer: voice("square"), tone: voice("sine") };
  }

  set muted(muted: boolean) {
    this.#muted = muted;
    if (this.#audio !== undefined) this.#audio.master.gain.value = muted ? 0 : 1;
  }

  change(event: StockSoundEvent): void {
    this.#log = [...this.#log, describeSound(event)].slice(-SOUND_LOG_LENGTH);
    soundLog.replaceChildren(
      ...this.#log.map((line) =>
        Object.assign(document.createElement("li"), { textContent: line }),
      ),
    );
    const delayS = (event.atMs - this.phoneNow) / 1000 + SOUND_LATENCY_S;
    if (event.output === "vibrator") {
      setTimeout(() => vibrate(event.on), Math.max(0, delayS * 1000));
      return;
    }
    const audio = this.#audio;
    if (audio === undefined) return;
    const at = audio.ctx.currentTime + delayS;
    const voice = audio[event.output];
    if (event.hz === null) {
      voice.gain.gain.setValueAtTime(0, at);
      return;
    }
    voice.oscillator.frequency.setValueAtTime(event.hz, at);
    const gain =
      event.output === "buzzer" ? buzzerGain(event.volume) : TONE_GAIN[event.volume & 0xf]!;
    voice.gain.gain.setValueAtTime(gain, at);
  }

  /** Silences everything (a restarted phone emits nothing for its predecessor's sounds). */
  reset(): void {
    const audio = this.#audio;
    if (audio !== undefined) {
      for (const voice of [audio.buzzer, audio.tone]) {
        voice.gain.gain.cancelScheduledValues(0);
        voice.gain.gain.value = 0;
      }
    }
    vibrate(false);
  }
}

function vibrate(on: boolean): void {
  vibraLamp.classList.toggle("on", on);
  lcd.classList.toggle("shaking", on);
}

const sound = new WebAudioSound();
// Browsers start audio only from a user gesture: the first key or click starts it.
for (const type of ["pointerdown", "keydown"] as const) {
  window.addEventListener(type, () => sound.start(), { capture: true });
}
muteBox.addEventListener("change", () => {
  sound.muted = muteBox.checked;
});

const renderer: ScreenRenderer = createScreenRenderer({ paint: paintStockScreen, scale: SCALE });
renderer.canvas.setAttribute("aria-label", "Phone LCD");
lcd.append(renderer.canvas);

let carrier = DEFAULT_CARRIER;
/** Undefined while the stored EEPROM is malformed (the error and Erase are shown instead). */
let phone: Phone | undefined = startPhone();
let unsubscribe = (): void => {};

/**
 * A phone over the page's localStorage with the selected SIM. A malformed record makes
 * createStockPhone throw, naming its key; the demo shows that with the Erase button.
 */
function startPhone(): Phone | undefined {
  try {
    const started = createStockPhone({
      carrier,
      clock,
      date,
      boot: skipBoot.checked ? "skip" : "animated",
      storage: window.localStorage,
      sim: simSelect.value,
      sound,
    });
    storageError.hidden = true;
    return started;
  } catch (cause) {
    storageError.textContent = `${cause instanceof Error ? cause.message : String(cause)} Erase the EEPROM to start again.`;
    storageError.hidden = false;
    return undefined;
  }
}

/** The names of the EEPROM records stored in localStorage (`settings`, `security`). */
function storedRecords(): string[] {
  const names: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key?.startsWith(STOCK_STORAGE_PREFIX)) names.push(key.slice(STOCK_STORAGE_PREFIX.length));
  }
  return names.sort();
}

/** Subscribes to the current phone and shows its screen. */
function attach(): void {
  unsubscribe();
  unsubscribe = (): void => {};
  if (phone === undefined) {
    renderer.render({ kind: "off" });
    status.textContent = `EEPROM: ${storedRecords().join(", ") || "empty"}`;
    return;
  }
  const current = phone;
  unsubscribe = current.subscribe(({ screen }) => show(current, screen));
  show(current, current.screen);
}

function show(current: Phone, screen: ScreenModel): void {
  const app = screen.kind === "custom" ? ` (${screen.appId})` : "";
  const records = storedRecords().join(", ") || "empty";
  status.textContent = `path: ${current.path} · screen: ${screen.kind}${app} · EEPROM: ${records}`;
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
  sound.reset();
  phone = startPhone();
  attach();
}

// One virtual clock for every phone: performance.now() in whole milliseconds.
function frame(): void {
  sound.phoneNow = Math.floor(performance.now());
  phone?.tick(sound.phoneNow);
  requestAnimationFrame(frame);
}
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

// A new SIM card: with Phone security On, the next power-on asks for the code (plan 15 D10).
simSelect.addEventListener("change", restart);

// Erase EEPROM: every nokia-os record goes, so the next phone is the virgin one (plan 15 D4).
eraseButton.addEventListener("click", () => {
  for (const name of storedRecords()) window.localStorage.removeItem(STOCK_STORAGE_PREFIX + name);
  restart();
});

// Factory settings: the EEPROM erased, then the factory state written (Restore factory
// settings' values, plan 15 D5), and the phone restarted over it (plan 16 Open question 3).
factoryButton.addEventListener("click", () => {
  for (const name of storedRecords()) window.localStorage.removeItem(STOCK_STORAGE_PREFIX + name);
  createStockSettings(new StockEeprom(window.localStorage)).restoreFactory();
  restart();
});

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
  let current: ScreenModel = phone?.screen ?? { kind: "off" };

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
