// A stock phone driven on a virtual clock, for acceptance scenarios against timeline goldens
// (plan 13 "Scenario harness and coverage guard").
import type { Phone, PhoneKey, ScreenModel } from "@hellotimber/phone-core";
import { Framebuffer } from "@hellotimber/phone-screen";
import { createStockPhone, paintStockScreen, type StockPhoneConfig } from "../../src/index";
import type { RecordedFrame, RecordedTimeline } from "./golden.ts";

export interface Rig {
  readonly phone: Phone;
  /** Virtual time in ms; the phone has seen tick(now). */
  readonly now: number;
  /** Key down, `holdMs` of 1 ms ticks, key up. */
  press(key: PhoneKey, holdMs?: number): void;
  hold(key: PhoneKey): void;
  release(key: PhoneKey): void;
  /** Ticks the phone every 1 ms for `ms`. */
  advance(ms: number): void;
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
  record(durationMs: number, trigger?: () => void): RecordedTimeline;
}

export function createRig(config: StockPhoneConfig): Rig {
  const phone = createStockPhone(config);
  let now = 0;
  phone.tick(now);

  const paintScreen = (screen: ScreenModel): Framebuffer => {
    const fb = new Framebuffer();
    paintStockScreen(fb, screen);
    return fb;
  };

  const rig: Rig = {
    phone,
    get now() {
      return now;
    },
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
    advance(ms) {
      for (let i = 0; i < ms; i++) phone.tick(++now);
    },
    paint: () => paintScreen(phone.screen),
    record(durationMs, trigger) {
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
        if (!powerChanged && samePixels(frames[frames.length - 1]!.pixels, pixels)) return;
        const frame = { startMs: now, pixels };
        if (powerChanged) powerFrames.add(frame);
        frames.push(frame);
      });
      if (trigger !== undefined) {
        rig.advance(1);
        trigger();
      }
      const triggerMs = now;
      rig.advance(durationMs);
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
