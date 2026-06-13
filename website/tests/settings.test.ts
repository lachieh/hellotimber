// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vite-plus/test";
import {
  DEFAULT_SETTINGS,
  getSettings,
  resetSettingsForTests,
  subscribeSettings,
  updateSettings,
} from "../src/settings";

beforeEach(() => {
  window.localStorage.clear();
  resetSettingsForTests();
});

describe("settings store", () => {
  it("returns defaults when nothing is stored", () => {
    expect(getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("updates persist to localStorage under hellotimber.settings", () => {
    updateSettings({ keypadTones: false, welcomeNote: "G'day" });
    const raw = window.localStorage.getItem("hellotimber.settings");
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toMatchObject({ keypadTones: false, welcomeNote: "G'day" });
  });

  it("stored partial JSON merges over defaults", () => {
    window.localStorage.setItem("hellotimber.settings", JSON.stringify({ backlight: false }));
    resetSettingsForTests();
    expect(getSettings()).toEqual({ ...DEFAULT_SETTINGS, backlight: false });
  });

  it("corrupt stored JSON falls back to defaults", () => {
    window.localStorage.setItem("hellotimber.settings", "{not json");
    resetSettingsForTests();
    expect(getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("notifies subscribers once per update and supports unsubscribe", () => {
    let calls = 0;
    const off = subscribeSettings(() => {
      calls += 1;
    });
    updateSettings({ muted: true });
    expect(calls).toBe(1);
    expect(getSettings().muted).toBe(true);
    off();
    updateSettings({ muted: false });
    expect(calls).toBe(1);
  });
});
