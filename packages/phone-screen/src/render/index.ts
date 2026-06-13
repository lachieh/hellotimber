import type { ScreenModel } from "@hellotimber/phone-core";
import type { Framebuffer } from "../framebuffer";
import { renderBoot } from "./boot";
import { renderCarousel } from "./carousel";
import { renderConfirm, renderEditor } from "./editor";
import { renderList, renderReader } from "./list";
import { renderStandby } from "./standby";

export interface RenderOptions {
  /** Boot 'welcome' phase text — the ScreenModel carries none (deviation note 1). */
  welcomeText: string;
}

/** Rasterize any ScreenModel into the framebuffer. */
export function renderScreen(fb: Framebuffer, screen: ScreenModel, opts: RenderOptions): void {
  switch (screen.kind) {
    case "off":
      fb.clear(0);
      return;
    case "boot":
      renderBoot(fb, screen, opts.welcomeText);
      return;
    case "standby":
      renderStandby(fb, screen);
      return;
    case "menu-carousel":
      renderCarousel(fb, screen);
      return;
    case "list":
      renderList(fb, screen);
      return;
    case "reader":
      renderReader(fb, screen);
      return;
    case "editor":
      renderEditor(fb, screen);
      return;
    case "confirm":
      renderConfirm(fb, screen);
      return;
    case "custom":
      fb.clear(0);
      fb.blitBitmap(screen.frame, 0, 0); // games draw raw pixels — verbatim
      return;
  }
}
