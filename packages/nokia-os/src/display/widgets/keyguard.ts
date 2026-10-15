import type { ScreenModel } from "@hellotimber/phone-core";
import { textWidth, type Framebuffer } from "@hellotimber/phone-screen";
import { STOCK_FONTS, WIDGET_SPRITES, type WidgetFrame } from "../../resources";
import { paintStandby, SOFTKEY_TOP } from "../standby";
import { paintNote } from "./note";

type Standby = Extract<ScreenModel, { kind: "standby" }>;

/** The keyguard's notes: large lines from x 0 (`keyguard/lock` d, `hint` c, `unlock` d). */
export const KEYPAD_LOCKED_LINES: readonly string[] = ["Keypad", "locked"];
export const KEYGUARD_HINT_LINES: readonly string[] = ["Press", "Unlock", "and then *"];
export const KEYPAD_ACTIVE_LINES: readonly string[] = ["Keypad", "active"];

/** `Now press *`: the small face from x 6 at tops 7 and 16, in place of the operator. */
const NOW_PRESS: readonly { readonly text: string; readonly top: number }[] = [
  { text: "Now", top: 7 },
  { text: "press *", top: 16 },
];
const NOW_PRESS_X = 6;
/** The emergency number: the large face at top 24, its last cell ending at x 76 (ink to 75). */
const EMERGENCY_TOP = 24;
const EMERGENCY_END = 76;
/** It must clear the signal ladder (x 0-3) and the battery ladder (from x 80). */
const EMERGENCY_START = 5;

/** The keyguard's screens (plan 25 K1-K6), over the kernel's standby where they show it. */
export type KeyguardModel =
  /** The locked standby: standby with the key icon and `Unlock` (`leaving`: no ladders). */
  | { readonly kind: "keyguard"; readonly screen: "locked-standby"; readonly standby: Standby }
  /** `Now press *` in place of the operator, the rest of the locked standby kept. */
  | { readonly kind: "keyguard"; readonly screen: "now-press"; readonly standby: Standby }
  /** The emergency display: the number above `Call`, the locked standby's icons and clock. */
  | {
      readonly kind: "keyguard";
      readonly screen: "emergency";
      readonly standby: Standby;
      readonly number: string;
    }
  /** A note's timeline step: `Keypad locked`, the hint or `Keypad active`. */
  | {
      readonly kind: "keyguard";
      readonly screen: "lock-note" | "hint" | "active-note";
      readonly frame: WidgetFrame;
      readonly next?: WidgetFrame;
    };

const NOTE_LINES = {
  "lock-note": KEYPAD_LOCKED_LINES,
  hint: KEYGUARD_HINT_LINES,
  "active-note": KEYPAD_ACTIVE_LINES,
} as const;

function sprite(id: string) {
  const found = WIDGET_SPRITES[id];
  if (found === undefined) throw new Error(`No stock widget sprite "${id}".`);
  return found;
}

/** Standby with the key icon, the soft key `softkey` (`Unlock`, `Call`) and no operator line. */
function lockedStandby(fb: Framebuffer, standby: Standby, carrier: string, softkey: string): void {
  paintStandby(fb, { ...standby, carrier });
  const key = sprite("keyguard/key");
  fb.blitBitmap(key.bitmap, key.x, key.y);
  // Standby's own soft key is `Menu`: the band below the ladders holds nothing else.
  fb.fillRect(0, SOFTKEY_TOP, fb.width, fb.height - SOFTKEY_TOP, 0);
  fb.drawTextCentered(STOCK_FONTS.small, softkey, SOFTKEY_TOP);
}

export function paintKeyguard(fb: Framebuffer, model: KeyguardModel, previous?: Uint8Array): void {
  switch (model.screen) {
    case "locked-standby":
      lockedStandby(fb, model.standby, model.standby.carrier, "Unlock");
      return;
    case "now-press":
      lockedStandby(fb, model.standby, "", "Unlock");
      for (const { text, top } of NOW_PRESS) fb.drawText(STOCK_FONTS.small, text, NOW_PRESS_X, top);
      return;
    case "emergency": {
      const width = textWidth(STOCK_FONTS.large, model.number);
      const x = EMERGENCY_END + 1 - width;
      if (x < EMERGENCY_START) {
        throw new Error(`The emergency number ${JSON.stringify(model.number)} does not fit.`);
      }
      lockedStandby(fb, model.standby, "", "Call");
      fb.drawText(STOCK_FONTS.large, model.number, x, EMERGENCY_TOP);
      return;
    }
    default:
      paintNote(
        fb,
        {
          kind: "note",
          lines: NOTE_LINES[model.screen],
          frame: model.frame,
          ...(model.next ? { next: model.next } : {}),
        },
        previous,
      );
  }
}
