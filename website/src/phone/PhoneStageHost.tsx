import { PhoneStage } from "@hellotimber/phone-3d";
import { useEffect, useState } from "react";
import { useSettings } from "../settings";
import { attachKeyboard } from "./keyboard";
import { getPhoneRuntime } from "./phone";

/**
 * Bridges the phone runtime to the 3D stage. Client-only (lives under
 * <ClientOnly> in routes/_phone.tsx) and mounted ONCE for the whole session.
 */
export default function PhoneStageHost() {
  // `input` is a closure on the runtime object, not a class method — no `this`.
  // oxlint-disable-next-line unbound-method
  const { renderer, input } = getPhoneRuntime();
  const settings = useSettings();
  const [version, setVersion] = useState(renderer.version);

  // rAF-driven version observation: re-render only when the LCD actually
  // changed (setState with the same value is a React bail-out).
  useEffect(() => {
    let raf = requestAnimationFrame(function loop() {
      setVersion(renderer.version);
      raf = requestAnimationFrame(loop);
    });
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [renderer]);

  // Desktop keyboard → runtime input funnel, alive exactly as long as the stage.
  useEffect(() => attachKeyboard(input), [input]);

  return (
    <PhoneStage
      className="phone-stage"
      screenCanvas={renderer.canvas}
      screenVersion={version}
      backlightOn={settings.backlight}
      onKey={(key, action) => {
        input(key, action);
      }}
    />
  );
}
