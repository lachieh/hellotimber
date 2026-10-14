import type { Framebuffer } from "@hellotimber/phone-screen";
import { paintConfirm, type ConfirmModel } from "./confirm";
import { paintMulti, type MultiModel } from "./multi";
import { paintNote, type NoteModel } from "./note";
import { paintOptions, type OptionsModel } from "./options";
import { paintProgress, type ProgressModel } from "./progress";

export type { ConfirmModel } from "./confirm";
export type { MultiModel } from "./multi";
export type { NoteModel } from "./note";
export type { OptionsModel } from "./options";
export type { ProgressModel } from "./progress";

/** What a stock widget shows: plain data, compared by value to decide whether to repaint. */
export type WidgetModel = OptionsModel | MultiModel | NoteModel | ProgressModel | ConfirmModel;

/**
 * Paints a stock widget's screen onto a cleared framebuffer. `previous` is the screen shown
 * before it (the flow's last frame), for timeline steps that draw over it.
 */
export function paintWidget(fb: Framebuffer, model: WidgetModel, previous?: Uint8Array): void {
  switch (model.kind) {
    case "options":
      paintOptions(fb, model);
      return;
    case "multi":
      paintMulti(fb, model);
      return;
    case "note":
      paintNote(fb, model, previous);
      return;
    case "progress":
      paintProgress(fb, model);
      return;
    case "confirm":
      paintConfirm(fb, model);
      return;
  }
}
