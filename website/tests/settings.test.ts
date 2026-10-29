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
    updateSettings({ muted: true });
    const raw = window.localStorage.getItem("hellotimber.settings");
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toMatchObject({ muted: true });
  });

  it("removes superseded settings and legacy messages", () => {
    window.localStorage.setItem("hellotimber.settings", JSON.stringify({ backlight: false }));
    resetSettingsForTests();
    window.localStorage.setItem("hellotimber.messages", "legacy");
    expect(getSettings()).toEqual({ muted: false });
    expect(window.localStorage.getItem("hellotimber.messages")).toBeNull();
    expect(JSON.parse(window.localStorage.getItem("hellotimber.settings")!)).toEqual({
      muted: false,
    });
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
