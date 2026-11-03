import { useEffect, useState } from "react";
import type { PhoneRuntime } from "../../phone/runtime";
import type { Emulator } from "./emulator";

/** What changes too often to publish through the emulator's state: sampled ten times a second. */
export interface LiveReadings {
  uptime: number;
  frames: number;
  display: boolean;
  keypad: boolean;
}

const IDLE: LiveReadings = { uptime: 0, frames: 0, display: false, keypad: false };
const SAMPLE_MS = 100;

export function useLive(emulator: Emulator, runtime: PhoneRuntime | undefined): LiveReadings {
  const [live, setLive] = useState(IDLE);
  useEffect(() => {
    if (runtime === undefined) {
      setLive(IDLE);
      return;
    }
    const sample = () =>
      setLive({
        uptime: emulator.uptime(),
        frames: runtime.renderer.version,
        display: runtime.lights.display,
        keypad: runtime.lights.keypad,
      });
    sample();
    const timer = window.setInterval(sample, SAMPLE_MS);
    return () => window.clearInterval(timer);
  }, [emulator, runtime]);
  return live;
}
