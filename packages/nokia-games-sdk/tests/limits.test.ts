import { describe, expect, it } from "vite-plus/test";
import { PACKED_FRAME_BYTES, SCREEN_HEIGHT, SCREEN_WIDTH } from "../src/index";

describe("limits", () => {
  it("packs the 84×48 LCD into 504 bytes", () => {
    expect((SCREEN_WIDTH * SCREEN_HEIGHT) / 8).toBe(PACKED_FRAME_BYTES);
  });
});
