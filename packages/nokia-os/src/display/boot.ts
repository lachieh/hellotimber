import type { ScreenModel } from "@hellotimber/phone-core";
import type { Framebuffer } from "@hellotimber/phone-screen";
import { BOOT_FRAMES } from "../resources";
import { paintUnsupported } from "./unsupported";

/** Boot is full-frame images: the LCD self-test, then the connecting hands (D12). */
export function paintBoot(fb: Framebuffer, screen: Extract<ScreenModel, { kind: "boot" }>): void {
  // The stock phone always boots from its timeline, so the legacy "welcome" phase never occurs.
  if (screen.phase !== "hands") {
    paintUnsupported(fb, `boot ${screen.phase}`);
    return;
  }
  const frame = BOOT_FRAMES[screen.frame];
  if (!frame) throw new Error(`No stock boot frame ${screen.frame} (have ${BOOT_FRAMES.length}).`);
  fb.blitBitmap(frame, 0, 0);
}
