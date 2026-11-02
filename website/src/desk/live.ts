import type { PhoneKey, ScreenModel } from "@hellotimber/phone-core";
import { useEffect, useState } from "react";
import { loadPhoneRuntime } from "../phone/stock-phone";
import { portfolioMenu } from "../phone/stock-routes";

/** Live phone state for the surrounds. Before the firmware loads (and on the server) it is booting. */
export interface PhoneLive {
  /** phone-core path, e.g. `standby`, `menu/games/snake`. */
  path: string;
  /** What the LCD is drawing. */
  screen: ScreenModel;
  /** The phone's own titles down to `path`, e.g. ["Menu", "Phone book", "Search"]; [] at standby. */
  trail: string[];
}

function liveFrom(path: string, screen: ScreenModel): PhoneLive {
  return {
    path,
    screen,
    trail:
      path === "standby"
        ? []
        : [
            "Menu",
            ...(portfolioMenu.resolve(path) ?? []).map((entry) => entry.label.replace(/\s+/g, " ")),
          ],
  };
}

/** What the surrounds show until the firmware has loaded: it boots by itself once it has. */
const BOOTING: PhoneLive = liveFrom("standby", { kind: "boot", phase: "hands", frame: 0 });

export function usePhoneLive(): PhoneLive {
  const [live, setLive] = useState<PhoneLive>(BOOTING);
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let mounted = true;
    void loadPhoneRuntime().then(({ phone }) => {
      if (!mounted) return;
      setLive(liveFrom(phone.path, phone.screen));
      unsubscribe = phone.subscribe((snap) => {
        setLive(liveFrom(snap.path, snap.screen));
      });
    });
    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);
  return live;
}

/** Press and release a phone key, as a tap on the 3D keypad would. A tap while the firmware
 *  is still loading lands once it has. */
export function tapPhoneKey(key: PhoneKey): void {
  void loadPhoneRuntime().then((runtime) => {
    runtime.input(key, "down");
    window.setTimeout(() => {
      runtime.input(key, "up");
    }, 90);
  });
}

export { updateSettings, useSettings } from "../settings";

/** Hold a phone key down or let it go, for press-and-hold (power, C to standby). */
export function holdPhoneKey(key: PhoneKey, action: "down" | "up"): void {
  void loadPhoneRuntime().then((runtime) => {
    runtime.input(key, action);
  });
}
