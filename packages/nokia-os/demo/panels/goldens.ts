// Dev only: the committed goldens over the phone's LCD (an overlay or a pixel difference), to
// compare the stock painter with the firmware's captures.
import type { ScreenModel } from "@hellotimber/phone-core";
import { Framebuffer } from "@hellotimber/phone-screen";
import {
  LCD_HEIGHT,
  LCD_WIDTH,
  parseGolden,
  type GoldenImage,
} from "../../scripts/golden-format.ts";
import { paintStockScreen } from "../../src/index";
import { byId, html, type DemoHost, type DemoPanel, type DemoSlots } from "../panel";

interface GoldenOverlay {
  update(screen: ScreenModel): void;
}

let overlay: GoldenOverlay | undefined;

export const goldensPanel: DemoPanel = {
  name: "goldens",
  plan: 13,
  mount(slots, host) {
    if (import.meta.env.DEV) overlay = createGoldenOverlay(slots, host);
  },
  screen(screen) {
    overlay?.update(screen);
  },
};

function createGoldenOverlay(slots: DemoSlots, host: DemoHost): GoldenOverlay {
  const section = html(`
    <section id="goldens" class="controls" aria-label="Golden overlay">
      <label>
        Golden image
        <select id="golden"></select>
      </label>
      <label>
        View
        <select id="view">
          <option value="off">Phone only</option>
          <option value="overlay">Overlay</option>
          <option value="difference">Difference</option>
        </select>
      </label>
      <label>
        Overlay opacity
        <input id="opacity" type="range" min="0" max="100" value="50" />
      </label>
      <p id="diff-summary" class="note"></p>
    </section>`);
  const select = byId<HTMLSelectElement>(section, "golden");
  const view = byId<HTMLSelectElement>(section, "view");
  const opacity = byId<HTMLInputElement>(section, "opacity");
  const summary = byId<HTMLParagraphElement>(section, "diff-summary");
  slots.section(section);

  const files = import.meta.glob<string>("../../goldens/**/*.lcd.txt", {
    query: "?raw",
    import: "default",
    eager: true,
  });
  // Grouped by top-level menu for the tree goldens (`tree/05-tones`), else by kind (`menu`,
  // `probe`, ...), in id order.
  const images = new Map<string, GoldenImage>();
  const groups = new Map<string, HTMLOptGroupElement>();
  const parsedGoldens = Object.entries(files)
    .map(([path, text]) => parseGolden(text, path.replace("../../goldens/", "")))
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
  slots.lcd.append(canvas);
  const ctx = canvas.getContext("2d")!;
  const actual = new Framebuffer();
  let current: ScreenModel = host.phone?.screen ?? { kind: "off" };

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
