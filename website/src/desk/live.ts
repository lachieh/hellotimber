import type { PhoneKey, ScreenModel } from "@hellotimber/phone-core";
import { useEffect, useState } from "react";
import { getPhoneRuntime } from "../phone/phone";
import { siteBreadcrumb } from "../phone/site-tree";

/** Live phone state for the surrounds. Client-only: surrounds render under <ClientOnly>. */
export interface PhoneLive {
  /** phone-core path, e.g. `standby`, `menu/games/snake`. */
  path: string;
  /** What the LCD is drawing. */
  screen: ScreenModel;
  /** The phone's own titles down to `path`, e.g. ["Menu", "Phone book", "Search"]; [] at standby. */
  trail: string[];
}

function liveFrom(path: string, screen: ScreenModel): PhoneLive {
  return { path, screen, trail: siteBreadcrumb(path) };
}

export function usePhoneLive(): PhoneLive {
  const [live, setLive] = useState<PhoneLive>(() => {
    const { phone } = getPhoneRuntime();
    return liveFrom(phone.path, phone.screen);
  });
  useEffect(() => {
    const { phone } = getPhoneRuntime();
    return phone.subscribe((snap) => {
      setLive(liveFrom(snap.path, snap.screen));
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
