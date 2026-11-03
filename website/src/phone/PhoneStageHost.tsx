import { PhoneStage } from "@hellotimber/phone-3d";
import type { FormPose, Nokia3310Key } from "@hellotimber/phone-3d";
import { useEffect, useState } from "react";
import { attachKeyboard } from "./keyboard";
import { DESK_FIT, MOBILE, MOBILE_FIT } from "./stage-frame";
import { getHomeRuntime } from "../home/runtime";

/**
 * Bridges the phone runtime to the 3D stage. Client-only (lives under
 * <ClientOnly> in PhoneSlot) and mounted ONCE for the whole session.
 */
export default function PhoneStageHost({
  onFormStart,
  pose,
}: {
  onFormStart: () => void;
  /** The entrance's pose each frame (PhoneSlot's reveal). */
  pose: () => FormPose;
}) {
  // `input` is a closure on the runtime object, not a class method — no `this`.
  // oxlint-disable-next-line unbound-method
  const { renderer, input } = getHomeRuntime();
  const { lights } = getHomeRuntime();
  const [leds, setLeds] = useState({ display: false, keypad: false });
  const [version, setVersion] = useState(renderer.version);

  // rAF-driven version observation: re-render only when the LCD actually
  // changed (setState with the same value is a React bail-out).
  useEffect(() => {
    let raf = requestAnimationFrame(function loop() {
      setVersion(renderer.version);
      setLeds((prev) => {
        const display = lights.display && lights.enabled;
        const keypad = lights.keypad && lights.enabled;
        return prev.display === display && prev.keypad === keypad ? prev : { display, keypad };
      });
      raf = requestAnimationFrame(loop);
    });
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [renderer, lights]);

  // Mobile: the phone spans 95% of the screen's limiting side (home.css's mobile breakpoint).
  const [mobile, setMobile] = useState(() => window.matchMedia(MOBILE).matches);
  useEffect(() => {
    const media = window.matchMedia(MOBILE);
    const change = () => setMobile(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);

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
      fit={mobile ? MOBILE_FIT : DESK_FIT}
      form
      onFormStart={onFormStart}
      pose={pose}
      screenCanvas={renderer.canvas}
      screenVersion={version}
      backlightOn={leds.display}
      keypadLightOn={leds.keypad}
      pressedKeys={pressedKeys}
      onKey={(key, action) => {
        input(key, action);
      }}
    />
  );
}
