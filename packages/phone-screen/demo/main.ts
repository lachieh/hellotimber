import type { ScreenModel } from "@hellotimber/phone-core";
import { createScreenRenderer } from "../src/renderer";

const SCALE = 8;

const screens: Record<string, ScreenModel> = {
  "Standby reference": {
    kind: "standby",
    carrier: "LACHLAN",
    clock: "21:51",
    signal: 4,
    battery: 4,
    indicators: { voicemail: true, message: true },
  },
  "Carousel first": {
    kind: "menu-carousel",
    label: "Phone book",
    menuNumber: 1,
    total: 13,
    iconId: "phone-book",
    menuIndicator: { segments: [1], awaitingNext: false },
  },
  "Carousel middle": {
    kind: "menu-carousel",
    label: "Settings",
    menuNumber: 6,
    total: 13,
    iconId: "settings",
    menuIndicator: { segments: [6], awaitingNext: false },
  },
  "Carousel last": {
    kind: "menu-carousel",
    label: "SIM services",
    menuNumber: 13,
    total: 13,
    iconId: "sim-services",
    menuIndicator: { segments: [13], awaitingNext: false },
  },
  "List row 1": menuList(0, { segments: [1, 1], awaitingNext: false }),
  "List row 2": menuList(1, { segments: [1, 3], awaitingNext: false }),
  "List row 3": menuList(2, { segments: [1, 4], awaitingNext: false }),
  "Shortcut 5 • _": menuList(0, { segments: [5], awaitingNext: true }, "Tones"),
  "Shortcut 5 • 3 • _": {
    kind: "reader",
    title: "Incoming call alert",
    lines: ["Ringing", "Ascending", "Ring once"],
    scrollTop: 0,
    menuIndicator: { segments: [5, 3], awaitingNext: true },
  },
  "Resolved 5 • 3": {
    kind: "reader",
    title: "Incoming call alert",
    lines: ["Ringing", "Ascending", "Ring once"],
    scrollTop: 0,
    menuIndicator: { segments: [5, 3], awaitingNext: false },
  },
};

function menuList(
  selected: number,
  menuIndicator: { segments: readonly number[]; awaitingNext: boolean },
  title = "Phone book",
): ScreenModel {
  return {
    kind: "list",
    title,
    items:
      title === "Tones"
        ? ["Ringing tone", "Ringing volume", "Incoming call alert"]
        : ["Search", "Add name", "Erase"],
    selected,
    softkey: "Select",
    menuIndicator,
  };
}

const screenSelect = required<HTMLSelectElement>("screen");
const paletteSelect = required<HTMLSelectElement>("palette");
const overlayInput = required<HTMLInputElement>("overlay");
const opacityInput = required<HTMLInputElement>("opacity");
const differenceInput = required<HTMLInputElement>("difference");
const frame = required<HTMLDivElement>("frame");
const overlay = document.createElement("img");
overlay.alt = "Uploaded canonical reference overlay";
overlay.hidden = true;
frame.append(overlay);

for (const name of Object.keys(screens)) screenSelect.add(new Option(name, name));

function render(): void {
  const lightOn = paletteSelect.value === "on";
  const renderer = createScreenRenderer({
    scale: SCALE,
    fg: lightOn ? "#43523d" : "#273128",
    bg: lightOn ? "#c7f0d8" : "#81927d",
  });
  renderer.canvas.setAttribute("aria-label", screenSelect.value);
  renderer.render(screens[screenSelect.value]!);
  frame.prepend(renderer.canvas);
  for (const canvas of frame.querySelectorAll("canvas:not(:first-child)")) canvas.remove();
}

function updateOverlay(): void {
  overlay.style.opacity = String(Number(opacityInput.value) / 100);
  overlay.style.mixBlendMode = differenceInput.checked ? "difference" : "normal";
}

screenSelect.addEventListener("change", render);
paletteSelect.addEventListener("change", render);
opacityInput.addEventListener("input", updateOverlay);
differenceInput.addEventListener("change", updateOverlay);
overlayInput.addEventListener("change", () => {
  const file = overlayInput.files?.[0];
  if (file === undefined) {
    overlay.hidden = true;
    overlay.removeAttribute("src");
    return;
  }
  overlay.src = URL.createObjectURL(file);
  overlay.hidden = false;
});

function required<ElementType extends HTMLElement>(id: string): ElementType {
  const element = document.querySelector(`#${id}`);
  if (element === null) throw new Error(`Missing #${id}`);
  return element as ElementType;
}

render();
updateOverlay();
