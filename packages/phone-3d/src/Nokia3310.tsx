import { Keypad } from "./Keypad";
import { BACKLIGHT_COLOR } from "./materials";
import { PhoneBody } from "./PhoneBody";
import { Screen } from "./Screen";
import type { Nokia3310Props } from "./types";

/** The phone model; must be rendered inside an R3F <Canvas> (VISION contract). */
export function Nokia3310({
  screenCanvas,
  screenVersion,
  onKey,
  backlightOn = true,
  pressedKeys,
}: Nokia3310Props) {
  return (
    <group>
      <PhoneBody />
      <Keypad onKey={onKey} pressedKeys={pressedKeys} />
      <Screen screenCanvas={screenCanvas} screenVersion={screenVersion} backlightOn={backlightOn} />
      {/* Green backlight glow over screen + keypad (spec §9: backlight is green) */}
      {backlightOn && (
        <pointLight
          color={BACKLIGHT_COLOR}
          intensity={1.5}
          distance={4}
          decay={2}
          position={[0, 2, 1.8]}
        />
      )}
    </group>
  );
}
