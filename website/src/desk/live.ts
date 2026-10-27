import type { PhoneKey } from "@hellotimber/phone-core";
import { useEffect, useState } from "react";
import { getPhoneRuntime } from "../phone/phone";
import { screenToText } from "../phone/screen-text";

/** Live phone state for the surrounds. Client-only: surrounds render under <ClientOnly>. */
export interface PhoneLive {
  /** phone-core path, e.g. `standby`, `menu/games/snake`. */
  path: string;
  /** The LCD as plain text (the same text the sr-only status mirror announces). */
  screenText: string;
}

export function usePhoneLive(): PhoneLive {
  const [live, setLive] = useState<PhoneLive>(() => {
    const { phone } = getPhoneRuntime();
    return { path: phone.path, screenText: screenToText(phone.screen) };
  });
  useEffect(() => {
    const { phone } = getPhoneRuntime();
    return phone.subscribe((snap) => {
      setLive({ path: snap.path, screenText: screenToText(snap.screen) });
    });
  }, []);
  return live;
}

/** Press and release a phone key, as a tap on the 3D keypad would. */
export function tapPhoneKey(key: PhoneKey): void {
  // `input` is a closure on the runtime object, not a class method — no `this`.
  // oxlint-disable-next-line unbound-method
  const { input } = getPhoneRuntime();
  input(key, "down");
  window.setTimeout(() => {
    input(key, "up");
  }, 90);
}

export { updateSettings, useSettings } from "../settings";

/** Hold a phone key down or let it go, for press-and-hold (power, C to standby). */
export function holdPhoneKey(key: PhoneKey, action: "down" | "up"): void {
  // `input` is a closure on the runtime object, not a class method — no `this`.
  // oxlint-disable-next-line unbound-method
  const { input } = getPhoneRuntime();
  input(key, action);
}
