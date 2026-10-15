// A stock phone driven on a virtual clock, for acceptance scenarios against timeline goldens
// (plan 13 "Scenario harness and coverage guard").
import type { Phone, PhoneKey, ScreenModel } from "@hellotimber/phone-core";
import { Framebuffer } from "@hellotimber/phone-screen";
import { WELCOME_NOTE_KEY } from "../../src/firmware/features/settings";
import { PHONE_SECURITY_KEY } from "../../src/firmware/security";
import { StockEeprom } from "../../src/firmware/eeprom";
import { createStockPhoneWith, type StockPhoneInternals } from "../../src/firmware/phone";
import { createStockSettings } from "../../src/firmware/settings";
import {
  createMemoryStorage,
  paintStockScreen,
  type StockPhoneConfig,
  type StockSoundEvent,
  type StockStorage,
} from "../../src/index";
import type { RecordedFrame, RecordedTimeline } from "./golden.ts";
import { T9_FIXTURE } from "./t9-fixture.ts";

export interface Rig {
  readonly phone: Phone;
  /** Virtual time in ms; the phone has seen tick(now). */
  readonly now: number;
  /** Every sound event the phone has emitted (plan 16), also passed on to `config.sound`. */
  readonly sounds: readonly StockSoundEvent[];
  /** Key down, `holdMs` of 1 ms ticks, key up. */
  press(key: PhoneKey, holdMs?: number): void;
  hold(key: PhoneKey): void;
  release(key: PhoneKey): void;
  /**
   * Ticks the phone every `stepMs` (default 1 ms) for `ms`. Coarser steps (replays between
   * their events) let timers fire up to a step late.
   */
  advance(ms: number, stepMs?: number): void;
  /** The current screen, painted by the stock painter. */
  paint(): Framebuffer;
  /**
   * Records the distinct frames shown while `trigger` runs and for `durationMs` after it, like
   * the capture harness's `record ... start`, key, `run`. Frame 0 is the screen when recording
   * starts, 1 ms before `trigger` runs. A frame is kept only when its pixels change, except
   * that power-on always starts a frame: boot's first image is as blank as the powered-off LCD,
   * but the golden starts a frame there. The trigger time is the rig time when `trigger`
   * returns (without a trigger: when recording starts).
   */
  record(
    durationMs: number,
    trigger?: () => void,
    schedule?: readonly { readonly atMs: number; readonly run: () => void }[],
  ): RecordedTimeline;
}

export function createRig(config: StockPhoneConfig, internals: StockPhoneInternals = {}): Rig {
  const sounds: StockSoundEvent[] = [];
  const sound = {
    change(event: StockSoundEvent) {
      sounds.push(event);
      config.sound?.change(event);
    },
  };
  const phone = createStockPhoneWith({ ...config, sound }, internals);
  let now = 0;
  phone.tick(now);

  // A stock flow returns the same `custom` frame object until its widget changes, so a frame
  // already painted is reused (performance only: the pixels are the frame's).
  let painted: { frame: object; fb: Framebuffer } | undefined;
  const paintScreen = (screen: ScreenModel): Framebuffer => {
    if (screen.kind === "custom" && painted?.frame === screen.frame) return painted.fb;
    const fb = new Framebuffer();
    paintStockScreen(fb, screen);
    if (screen.kind === "custom") painted = { frame: screen.frame, fb };
    return fb;
  };

  const rig: Rig = {
    phone,
    get now() {
      return now;
    },
    sounds,
    press(key, holdMs = 0) {
      rig.hold(key);
      rig.advance(holdMs);
      rig.release(key);
    },
    hold(key) {
      phone.send({ type: "down", key });
    },
    release(key) {
      phone.send({ type: "up", key });
    },
    advance(ms, stepMs = 1) {
      const end = now + ms;
      while (now < end) {
        now = Math.min(end, now + stepMs);
        phone.tick(now);
      }
    },
    paint: () => paintScreen(phone.screen),
    record(durationMs, trigger, schedule = []) {
      const frames: RecordedFrame[] = [{ startMs: now, pixels: rig.paint().pixels }];
      const powerFrames = new Set<RecordedFrame>();
      let poweredOn = phone.screen.kind !== "off";
      // Painting happens only on snapshots, so long recordings of a settled screen stay cheap.
      const unsubscribe = phone.subscribe((snapshot) => {
        const pixels = paintScreen(snapshot.screen).pixels;
        const powerChanged = snapshot.poweredOn !== poweredOn;
        poweredOn = snapshot.poweredOn;
        const last = frames[frames.length - 1]!;
        // A screen replaced within the same millisecond was never visible.
        if (frames.length > 1 && last.startMs === now && !powerFrames.has(last)) frames.pop();
        const shown = frames[frames.length - 1]!.pixels;
        if (!powerChanged && (shown === pixels || samePixels(shown, pixels))) return;
        const frame = { startMs: now, pixels };
        if (powerChanged) powerFrames.add(frame);
        frames.push(frame);
      });
      if (trigger !== undefined) {
        rig.advance(1);
        trigger();
      }
      const triggerMs = now;
      // Scheduled actions run on the tick `atMs` after the trigger, in order.
      const pending = [...schedule].sort((a, b) => a.atMs - b.atMs);
      for (let t = 1; t <= durationMs; t++) {
        rig.advance(1);
        while (pending.length > 0 && pending[0]!.atMs <= t) pending.shift()!.run();
      }
      unsubscribe();
      return { triggerMs, endMs: now, frames };
    },
  };
  return rig;
}

function samePixels(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** The frame on screen at `atMs`: the last one that started at or before it. */
export function frameAt(recording: RecordedTimeline, atMs: number): RecordedFrame {
  let shown = recording.frames[0]!;
  for (const frame of recording.frames) if (frame.startMs <= atMs) shown = frame;
  return shown;
}

/**
 * The emulator's operator, clock and setup date are artefacts used as test inputs (D11). The
 * Task 11 captures set the clock to 19:48 and 07:59 instead of 10:10. The phone has a T9
 * dictionary, as the virgin firmware writes in T9 (plan 18b D5: the hand-made fixture; scenarios
 * whose screens show candidate lists pass `englishT9`, and `t9: {}` makes a phone without one).
 */
export function stockRig(
  config: Partial<StockPhoneConfig> = {},
  internals: StockPhoneInternals = { seed: SEED_1010 },
): Rig {
  return createRig(
    {
      carrier: "Orange F",
      clock: () => "10:10",
      date: () => "13.10.2026",
      t9: { english: T9_FIXTURE },
      ...config,
    },
    internals,
  );
}

/**
 * Snake II's seed at the captures' 10:10 on 13.10.2026 (plan 23 Task 5): the stock phone seeds
 * from the minutes of the day (UNVERIFIED), so rigs inject the recovered seed.
 */
export const SEED_1010 = 44530;

/** A phone at standby, booted with `boot: "skip"`, every timer settled. */
export function standbyRig(
  config: Partial<StockPhoneConfig> = {},
  internals?: StockPhoneInternals,
): Rig {
  const rig = stockRig({ boot: "skip", ...config }, internals);
  rig.press("power", 1000);
  rig.advance(1000);
  return rig;
}

/**
 * A storage holding what the plan 15 boot captures had in their EEPROM: Phone security On (the
 * virgin prompt reproduced as the gate, with no recent SIM) and, optionally, a welcome note. With
 * `factory`, the factory state first (plan 16 D7: the sound captures' image; Phone security then
 * defaults to Off, as Restore factory settings leaves it).
 */
export function seededStorage(
  seed: {
    readonly factory?: boolean;
    readonly phoneSecurity?: boolean;
    readonly welcomeNote?: string;
  } = {},
): StockStorage {
  const storage = createMemoryStorage();
  const settings = createStockSettings(new StockEeprom(storage));
  if (seed.factory) settings.restoreFactory();
  // Phone security's list is `Off`, `On` (the security feature's code setting).
  if (seed.phoneSecurity ?? !seed.factory) settings.choose(PHONE_SECURITY_KEY, 1);
  if (seed.welcomeNote !== undefined) settings.setText(WELCOME_NOTE_KEY, seed.welcomeNote);
  return storage;
}
