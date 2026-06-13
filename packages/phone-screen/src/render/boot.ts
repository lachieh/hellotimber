import type { ScreenModel } from "@hellotimber/phone-core";
import { FONT, textWidth } from "../font/font";
import type { Framebuffer } from "../framebuffer";
import { HANDS_FRAMES } from "../icons/boot";
import { wrapText } from "./layout";

type BootScreen = Extract<ScreenModel, { kind: "boot" }>;

/**
 * boot.frame advances every 200ms (phone-core) with no total in the model;
 * hold each art frame for 3 ticks (≈600ms) and clamp on the clasp
 * (contract deviation note 2).
 */
const TICKS_PER_ART_FRAME = 3;

export function renderBoot(fb: Framebuffer, screen: BootScreen, welcomeText: string): void {
  fb.clear(0);
  if (screen.phase === "hands") {
    const idx = Math.min(Math.floor(screen.frame / TICKS_PER_ART_FRAME), HANDS_FRAMES.length - 1);
    fb.blitBitmap(HANDS_FRAMES[idx]!, 0, 4);
    // Small NOKIA wordmark bottom-right — verified 3310 boot detail (spec §3).
    fb.drawText(FONT, "NOKIA", 82 - textWidth(FONT, "NOKIA"), 40);
    return;
  }
  const lines = wrapText(welcomeText).slice(0, 5);
  const top = Math.floor((fb.height - lines.length * 8) / 2);
  lines.forEach((line, i) => {
    fb.drawTextCentered(FONT, line, top + i * 8);
  });
}
