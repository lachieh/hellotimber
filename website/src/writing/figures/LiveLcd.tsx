import type { ReactNode } from "react";
import type { FigureFirmware } from "./figure-phone";
import { Figure, Keypad, LcdScreen } from "./parts";
import { useFigurePhone } from "./use-figure-phone";

/**
 * A live 84×48 LCD: the real firmware and the real painter, no 3D, with the phone's keys under it.
 * `start` opens a phone path first; `digits` adds the number keys; `t9` loads T9 English.
 */
export function LiveLcd({
  firmware = "home",
  start,
  digits = false,
  t9 = false,
  caption,
}: {
  firmware?: FigureFirmware;
  start?: string;
  digits?: boolean;
  t9?: boolean;
  caption: ReactNode;
}) {
  const phone = useFigurePhone({ firmware, start, t9 });
  const which = firmware === "home" ? "the homepage firmware" : "the stock v6.39 firmware";
  return (
    <Figure kind="lcd" caption={caption}>
      <div className="fig-phone" ref={phone.frameRef}>
        <LcdScreen phone={phone} label={`A live Nokia 3310 screen running ${which}`} />
        <Keypad phone={phone} digits={digits} />
      </div>
    </Figure>
  );
}
