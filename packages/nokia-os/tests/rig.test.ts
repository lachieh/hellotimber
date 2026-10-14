// The acceptance scenario rig (tests/support/rig.ts): what a recording keeps.
import { describe, expect, it } from "vite-plus/test";
import { LONG_PRESS_MS } from "./support/acceptance.ts";
import { standbyRig, stockRig } from "./support/rig.ts";

describe("scenario rig", () => {
  it("starts a frame at power-on although boot's first image is as blank as off", () => {
    const rig = stockRig();
    rig.hold("power");
    rig.advance(LONG_PRESS_MS - 2);
    const recording = rig.record(10, () => rig.advance(1));
    expect(recording.frames.map((frame) => frame.startMs)).toEqual([LONG_PRESS_MS - 2, 800]);
    expect(recording.frames[1]!.pixels).toEqual(recording.frames[0]!.pixels);
    expect(recording.triggerMs).toBe(LONG_PRESS_MS);
  });

  it("keeps only frames whose pixels change", () => {
    // A placeholder application marks the screen dirty on every tick.
    const rig = standbyRig();
    rig.phone.navigate("menu/phone-book/search");
    const recording = rig.record(500);
    expect(recording.frames).toHaveLength(1);
  });
});
