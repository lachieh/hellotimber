import {
  createFirmwarePhone,
  createStockPhone,
  describeFirmwareScreen,
  describeStockScreen,
  firmwarePainter,
  paintStockScreen,
  type Firmware,
  type StockPhoneConfig,
  type T9Dictionary,
} from "@hellotimber/nokia-os";
import type { PhoneKey, ScreenModel } from "@hellotimber/phone-core";
import { createScreenRenderer } from "@hellotimber/phone-screen";
import { getSettings, subscribeSettings } from "../settings";
import { WebAudioSound } from "./stock-sound";

/**
 * What a host chooses about its phone; the runtime supplies sound, lights and the boot. Without a
 * `firmware` the phone runs the stock v6.39 firmware.
 */
export type RuntimeConfig = Omit<StockPhoneConfig, "sound" | "lights" | "boot" | "t9"> & {
  english: T9Dictionary | undefined;
  firmware?: Firmware;
};

/**
 * A phone running in the browser: its LCD canvas, Web Audio sound (following the site's mute),
 * its LED state and a frame loop, powered on with a held power key. `stop()` ends the loop and
 * silences it, for a host that replaces or leaves it.
 */
export async function startPhoneRuntime({ english, firmware, ...config }: RuntimeConfig) {
  const sound = new WebAudioSound();
  sound.muted = getSettings().muted;
  const unmute = subscribeSettings(() => {
    sound.muted = getSettings().muted;
  });
  const lights = { display: false, keypad: false, enabled: true };
  const phoneConfig: StockPhoneConfig = {
    ...config,
    boot: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "skip" : "animated",
    ...(english ? { t9: { english } } : {}),
    sound,
    lights: {
      change(event) {
        lights[event.light] = event.on;
      },
    },
  };
  const phone =
    firmware === undefined
      ? createStockPhone(phoneConfig)
      : createFirmwarePhone(firmware, phoneConfig);
  const renderer = createScreenRenderer({
    paint: firmware === undefined ? paintStockScreen : firmwarePainter(firmware),
  });
  renderer.render(phone.screen);
  phone.subscribe((snapshot) => renderer.render(snapshot.screen));
  const start = performance.now();
  phone.tick(start);
  phone.send({ type: "down", key: "power" });
  let frame = 0;
  let stopped = false;
  const loop = (now: number) => {
    sound.phoneNow = now;
    phone.tick(now);
    frame = requestAnimationFrame(loop);
  };
  frame = requestAnimationFrame(loop);
  await new Promise<void>((resolve) => {
    window.setTimeout(() => {
      if (!stopped) {
        sound.phoneNow = performance.now();
        phone.tick(sound.phoneNow);
        phone.send({ type: "up", key: "power" });
      }
      resolve();
    }, 1000);
  });
  return {
    phone,
    renderer,
    lights,
    /** The LCD as text, for the accessibility mirror. */
    describe: (screen: ScreenModel): string =>
      firmware === undefined
        ? describeStockScreen(screen)
        : describeFirmwareScreen(firmware, screen),
    input(key: PhoneKey, action: "down" | "up") {
      sound.start();
      phone.send({ type: action, key });
    },
    stop() {
      stopped = true;
      cancelAnimationFrame(frame);
      unmute();
      sound.muted = true;
    },
  };
}
export type PhoneRuntime = Awaited<ReturnType<typeof startPhoneRuntime>>;

/** The English T9 dictionary, or none where its chunk fails to load. */
export function loadEnglishT9(): Promise<T9Dictionary | undefined> {
  return import("@hellotimber/nokia-kit/t9-english").then(
    ({ englishT9 }) => englishT9,
    () => undefined,
  );
}
