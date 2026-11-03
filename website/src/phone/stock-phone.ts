import {
  createStockPhone,
  paintStockScreen,
  createMemoryStorage,
  type T9Dictionary,
} from "@hellotimber/nokia-os";
import type { PhoneKey } from "@hellotimber/phone-core";
import { createScreenRenderer } from "@hellotimber/phone-screen";
import { PORTFOLIO_SIM, PRELOAD } from "../content/sim";
import { getSettings, subscribeSettings } from "../settings";
import { hostClock, hostDate } from "./host-clock";
import { imeiForHash } from "./imei";
import { createPortfolioNetwork } from "./network";
import { WebAudioSound } from "./stock-sound";

async function createRuntime(english: T9Dictionary | undefined) {
  let storage;
  try {
    storage = window.localStorage;
  } catch {
    storage = createMemoryStorage();
  }
  const sound = new WebAudioSound();
  sound.muted = getSettings().muted;
  subscribeSettings(() => {
    sound.muted = getSettings().muted;
  });
  const lights = { display: false, keypad: false, enabled: true };
  const phone = createStockPhone({
    carrier: "LACHLAN",
    storage,
    sim: PORTFOLIO_SIM,
    preload: PRELOAD,
    imei: imeiForHash(__BUILD_HASH__),
    clock: hostClock,
    date: hostDate,
    boot: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "skip" : "animated",
    ...(english ? { t9: { english } } : {}),
    sound,
    lights: {
      change(event) {
        lights[event.light] = event.on;
      },
    },
    network: createPortfolioNetwork({ storage, simId: PORTFOLIO_SIM.id }),
  });
  const renderer = createScreenRenderer({ paint: paintStockScreen });
  renderer.render(phone.screen);
  phone.subscribe((snapshot) => renderer.render(snapshot.screen));
  const start = performance.now();
  phone.tick(start);
  phone.send({ type: "down", key: "power" });
  const loop = (now: number) => {
    sound.phoneNow = now;
    phone.tick(now);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  await new Promise<void>((resolve) => {
    window.setTimeout(() => {
      sound.phoneNow = performance.now();
      phone.tick(sound.phoneNow);
      phone.send({ type: "up", key: "power" });
      resolve();
    }, 1000);
  });
  return {
    phone,
    renderer,
    lights,
    input(key: PhoneKey, action: "down" | "up") {
      sound.start();
      phone.send({ type: action, key });
    },
  };
}
export type PhoneRuntime = Awaited<ReturnType<typeof createRuntime>>;
let runtime: PhoneRuntime | undefined;
let loading: Promise<PhoneRuntime> | undefined;
export function loadPhoneRuntime(): Promise<PhoneRuntime> {
  if (typeof window === "undefined") throw new Error("Phone runtime is client-only");
  return (loading ??= import("@hellotimber/nokia-kit/t9-english")
    .then(
      ({ englishT9 }) => englishT9,
      () => undefined,
    )
    .then(createRuntime)
    .then((ready) => (runtime = ready)));
}
export function getPhoneRuntime(): PhoneRuntime {
  if (runtime) return runtime;
  throw loadPhoneRuntime();
}
