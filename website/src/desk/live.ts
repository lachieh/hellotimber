import type { ScreenModel } from "@hellotimber/phone-core";
import { useEffect, useState } from "react";
import { loadPhoneRuntime } from "../phone/stock-phone";

/** Live phone state for the surrounds. Before the firmware loads (and on the server) it is booting. */
export interface PhoneLive {
  /** phone-core path, e.g. `standby`, `menu/games/snake`. */
  path: string;
  /** What the LCD is drawing. */
  screen: ScreenModel;
}

function liveFrom(path: string, screen: ScreenModel): PhoneLive {
  return { path, screen };
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
