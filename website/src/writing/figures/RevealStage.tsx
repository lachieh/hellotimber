// The 3D half of the RevealScrubber, in its own chunk: three.js and the model load only for it.
import { PhoneStage, type FormPose } from "@hellotimber/phone-3d";
import { useMemo } from "react";

const LCD_BG = "#c7f0d8";

/** A blank LCD for the screen texture: the figure is about the body, not the firmware. */
function blankLcd(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 84;
  canvas.height = 48;
  const ctx = canvas.getContext("2d");
  if (ctx !== null) {
    ctx.fillStyle = LCD_BG;
    ctx.fillRect(0, 0, 84, 48);
  }
  return canvas;
}

export default function RevealStage({
  fit,
  pose,
  onFormStart,
}: {
  fit: number;
  pose: () => FormPose;
  onFormStart: () => void;
}) {
  const screen = useMemo(blankLcd, []);
  return (
    <PhoneStage
      className="phone-stage"
      fit={fit}
      form
      onFormStart={onFormStart}
      pose={pose}
      screenCanvas={screen}
      screenVersion={0}
      backlightOn={false}
      screenBgColor={LCD_BG}
    />
  );
}
