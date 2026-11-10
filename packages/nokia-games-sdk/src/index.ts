import type { GameSdk } from "./contract";
import { GAME_DIGITS } from "./digits";
import { drawNumber, drawText, encodeFrame, textWidth } from "./draw";
import { MIN_WAKE_MS } from "./limits";
import { GameScreen } from "./screen";

export * from "./limits";
export type * from "./contract";
export { GameScreen, unpackFrame } from "./screen";
export { drawNumber, drawText, encodeFrame, textWidth } from "./draw";
export { GAME_DIGITS } from "./digits";
export { createRandom, mixSeed } from "./random";
export { validateManifest } from "./manifest";
export { decodeBase64, encodeBase64 } from "./base64";
export { localGame } from "./local";
export { recording } from "./recording";
export {
  ReplayFormatError,
  checkReplay,
  parseReplay,
  recordReplay,
  serializeReplay,
  type CheckReplayOptions,
  type GameReplay,
  type RecordReplayOptions,
  type ReplayFrame,
  type ReplayKey,
  type ReplayMismatch,
} from "./replay";

/** The helpers a game factory receives as its argument, so game code needs no imports. */
export const sdk: GameSdk = Object.freeze({
  version: 1,
  GAME_DIGITS,
  MIN_WAKE_MS,
  createScreen: () => new GameScreen(),
  drawText,
  textWidth,
  drawNumber,
  encodeFrame,
});
