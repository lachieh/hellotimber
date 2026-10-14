import type { Framebuffer } from "@hellotimber/phone-screen";
import { paintMulti, type MultiModel } from "./multi";
import { paintOptions, type OptionsModel } from "./options";

export type { MultiModel } from "./multi";
export type { OptionsModel } from "./options";

/** What a stock widget shows: plain data, compared by value to decide whether to repaint. */
export type WidgetModel = OptionsModel | MultiModel;

/** Paints a stock widget's screen onto a cleared framebuffer. */
export function paintWidget(fb: Framebuffer, model: WidgetModel): void {
  switch (model.kind) {
    case "options":
      paintOptions(fb, model);
      return;
    case "multi":
      paintMulti(fb, model);
      return;
  }
}
