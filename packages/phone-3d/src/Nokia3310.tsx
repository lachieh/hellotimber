import Keypad from "./Keypad";
import { BODY } from "./layout";
import PhoneBody from "./PhoneBody";
import Screen from "./Screen";
import { DEFAULT_SCREEN_BG } from "./types";
import type { Nokia3310Props } from "./types";

/** World height the stage was framed against since plan 03 (the glTF era
 *  normalized to it too). The model is authored in cm (11.3 tall) and scaled
 *  down to this so PhoneStage's camera/lights carry over unchanged. */
const STAGE_HEIGHT = 10;

/**
 * The fully procedural Nokia 3310 (model v2): beveled extruded body,
 * seventeen individually pressable keys with printed legends, per-key green
 * backlight, and the 84×48 CanvasTexture LCD seated in real bezel geometry.
 * Pure code — no glTF, no Draco, no runtime calibration.
 */
export function Nokia3310({
  screenCanvas,
  screenVersion,
  onKey,
  backlightOn = true,
  pressedKeys,
  screenBgColor = DEFAULT_SCREEN_BG,
}: Nokia3310Props) {
  return (
    <group scale={STAGE_HEIGHT / BODY.h}>
      <PhoneBody />
      <Keypad backlightOn={backlightOn} pressedKeys={pressedKeys} onKey={onKey} />
      <Screen
        screenCanvas={screenCanvas}
        screenVersion={screenVersion}
        backlightOn={backlightOn}
        bgColor={screenBgColor}
      />
    </group>
  );
}
