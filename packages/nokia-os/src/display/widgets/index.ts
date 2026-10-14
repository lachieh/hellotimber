import type { Framebuffer } from "@hellotimber/phone-screen";
import { paintConfirm, type ConfirmModel } from "./confirm";
import { paintInfoPage, type InfoPageModel } from "./info-pages";
import { paintInfoScreen, type InfoScreenModel } from "./info-screen";
import { paintLevelBar, type LevelBarModel } from "./level-bar";
import { paintMulti, type MultiModel } from "./multi";
import { paintNote, type NoteModel } from "./note";
import { paintOptions, type OptionsModel } from "./options";
import { paintProgress, type ProgressModel } from "./progress";
import { paintPrompt, type PromptModel } from "./prompt";
import { paintSplash, type SplashModel } from "./splash";
import { paintTextPage, type TextPageModel } from "./text-pages";

export type { ConfirmModel } from "./confirm";
export type { InfoPageModel } from "./info-pages";
export type { InfoScreenModel } from "./info-screen";
export type { LevelBarModel } from "./level-bar";
export type { MultiModel } from "./multi";
export type { NoteModel } from "./note";
export type { OptionsModel } from "./options";
export type { ProgressModel } from "./progress";
export type { PromptEntry, PromptModel } from "./prompt";
export type { SplashModel } from "./splash";
export type { TextPageModel } from "./text-pages";

/** What a stock widget shows: plain data, compared by value to decide whether to repaint. */
export type WidgetModel =
  | OptionsModel
  | MultiModel
  | NoteModel
  | ProgressModel
  | ConfirmModel
  | InfoPageModel
  | InfoScreenModel
  | PromptModel
  | LevelBarModel
  | TextPageModel
  | SplashModel;

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
    case "info-page":
      paintInfoPage(fb, model);
      return;
    case "info-screen":
      paintInfoScreen(fb, model);
      return;
    case "prompt":
      paintPrompt(fb, model);
      return;
    case "level-bar":
      paintLevelBar(fb, model);
      return;
    case "text-page":
      paintTextPage(fb, model);
      return;
    case "splash":
      paintSplash(fb, model, previous);
      return;
  }
}
