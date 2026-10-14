import { describe, expect, it } from "vite-plus/test";
import { PANELS } from "../src/panels/registry";

describe("panel registry", () => {
  it("contains every typed panel in canonical metadata order", () => {
    expect(Object.keys(PANELS)).toEqual([
      "phone-book",
      "messages",
      "inbox",
      "write",
      "chat",
      "call-register",
      "tones",
      "settings",
      "call-divert",
      "games",
      "snake",
      "calculator",
      "reminders",
      "clock",
      "profiles",
      "sim-services",
    ]);
  });
});
