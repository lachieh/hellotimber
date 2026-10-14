import type { Framebuffer } from "@hellotimber/phone-screen";
import { placeholderFrame } from "../placeholder";
import { paintConfirm, type ConfirmModel } from "./confirm";
import { paintGameOver, type GameOverModel } from "./game-over";
import { paintInfoPage, type InfoPageModel } from "./info-pages";
import { paintInfoScreen, type InfoScreenModel } from "./info-screen";
import { paintLevelBar, type LevelBarModel } from "./level-bar";
import { paintMulti, type MultiModel } from "./multi";
import { paintNote, type NoteModel } from "./note";
import { paintOptions, type OptionsModel } from "./options";
import { paintProgress, type ProgressModel } from "./progress";
import { paintPrompt, type PromptModel } from "./prompt";
import { paintSnake, type SnakeModel } from "./snake";
import { paintSplash, type SplashModel } from "./splash";
import { paintTextPage, type TextPageModel } from "./text-pages";

export type { ConfirmModel } from "./confirm";
export type { GameOverModel } from "./game-over";
export type { InfoPageModel } from "./info-pages";
export type { InfoScreenModel } from "./info-screen";
export type { LevelBarModel } from "./level-bar";
export type { MultiModel } from "./multi";
export type { NoteModel } from "./note";
export type { OptionsModel } from "./options";
export type { ProgressModel } from "./progress";
export type { PromptEntry, PromptModel } from "./prompt";
export type { SnakeModel } from "./snake";
export type { SplashModel } from "./splash";
export type { TextPageModel } from "./text-pages";

/** A choice a later plan implements (D13), inside a flow: the placeholder frame of `label`. */
export interface PlaceholderModel {
  readonly kind: "placeholder";
  readonly label: string;
}

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
  | SplashModel
  | SnakeModel
  | GameOverModel
  | PlaceholderModel;

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
    case "snake":
      paintSnake(fb, model);
      return;
    case "game-over":
      paintGameOver(fb, model);
      return;
    case "placeholder":
      fb.pixels.set(placeholderFrame(model.label).pixels);
      return;
  }
}
