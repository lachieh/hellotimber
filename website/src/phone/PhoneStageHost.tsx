import { PhoneStage } from "@hellotimber/phone-3d";
import type { Nokia3310Key } from "@hellotimber/phone-3d";
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

  // Desktop keyboard → runtime input funnel, alive exactly as long as the
  // stage. Keyboard-held keys also depress the 3D keypad (pressedKeys);
  // pointer presses don't feed the set — the key mesh already animates itself.
  const [pressedKeys, setPressedKeys] = useState<ReadonlySet<Nokia3310Key>>(new Set());
  useEffect(
    () =>
      attachKeyboard((key, action) => {
        setPressedKeys((prev) => {
          const next = new Set(prev);
          if (action === "down") next.add(key);
          else next.delete(key);
          return next;
        });
        input(key, action);
      }),
    [input],
  );

  return (
    <PhoneStage
      className="phone-stage"
      screenCanvas={renderer.canvas}
      screenVersion={version}
      backlightOn={settings.backlight}
      pressedKeys={pressedKeys}
      onKey={(key, action) => {
        input(key, action);
      }}
    />
  );
}
