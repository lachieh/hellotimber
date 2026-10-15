// The keyguard's sounds (plan 25 D12, Task 9): the lock's warning tone in place of the `*`'s
// beep, silent locked keys. The captures themselves are this plan's acceptance scenarios
// (`keyguardSound`); these tests pin what they do not show.
import type { PhoneKey } from "@hellotimber/phone-core";
import { describe, expect, it } from "vite-plus/test";
import { KEYGUARD_TIMES } from "../src/firmware/features/keyguard";
import { NOTE_SOUNDS } from "../src/resources";
import { darkStandbyRig, lockedRig } from "./support/keyguard.ts";
import { seededStorage } from "./support/rig.ts";
import { soundStorage } from "./support/sound-scenarios.ts";

const factory = () => ({ storage: seededStorage({ factory: true }) });

describe("the lock (D12)", () => {
  it("plays Keypad locked's warning tone at the `*`, not the `*`'s beep", () => {
    expect(NOTE_SOUNDS["Keypad locked"]?.steps).toEqual([
      { ms: 293, tone: { hz: 1750, volume: expect.any(Number) } },
    ]);
    const rig = darkStandbyRig(factory());
    rig.press("navi");
    rig.advance(300);
    const from = rig.sounds.length;
    const at = rig.now;
    rig.press("*");
    rig.advance(1000);
    const tones = rig.sounds
      .slice(from)
      .flatMap((e) => (e.output === "tone" ? [[e.atMs - at, e.hz]] : []));
    expect(tones).toEqual([
      [0, 1750],
      [293, null],
    ]);
  });

  it("is silent with Warning tones Off", () => {
    const rig = darkStandbyRig({
      // Warning tones: On, Off.
      storage: soundStorage("factory", { "tones/warning-tones": 1 }),
    });
    rig.press("navi");
    rig.advance(300);
    const from = rig.sounds.length;
    rig.press("*");
    rig.advance(1000);
    expect(rig.sounds.slice(from)).toEqual([]);
  });
});

describe("the locked phone (D12)", () => {
  it("keeps every key silent, held keys and the power key included", () => {
    for (const [key, holdMs] of [
      ["5", 0],
      ["c", 1500],
      ["up", 1500],
      ["power", 100],
      ["#", 0],
    ] as [PhoneKey, number][]) {
      const rig = lockedRig("dark", factory());
      const from = rig.sounds.length;
      rig.press(key, holdMs);
      rig.advance(KEYGUARD_TIMES.hintMs + 100);
      expect(rig.sounds.slice(from), key).toEqual([]);
    }
  });
});
