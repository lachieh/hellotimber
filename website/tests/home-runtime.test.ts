// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vite-plus/test";
import {
  getHomeRuntime,
  HOME_SIM,
  HOME_STORAGE_PREFIX,
  loadHomeRuntime,
  onSiteLink,
  openLink,
} from "../src/home/runtime";
const { configs, firmwares, audioStart } = vi.hoisted(() => ({
  configs: [] as unknown[],
  firmwares: [] as unknown[],
  audioStart: vi.fn(),
}));
vi.mock("@hellotimber/nokia-os", async (original) => {
  const stock = await original<typeof import("@hellotimber/nokia-os")>();
  return {
    ...stock,
    createFirmwarePhone(
      firmware: import("@hellotimber/nokia-os").Firmware,
      config: import("@hellotimber/nokia-os").StockPhoneConfig,
    ) {
      firmwares.push(firmware);
      configs.push(config);
      return stock.createFirmwarePhone(firmware, config);
    },
  };
});
vi.mock("@hellotimber/nokia-kit/t9-english", async () => {
  const { createT9Dictionary } = await import("@hellotimber/nokia-os");
  return { englishT9: createT9Dictionary("english", "#0\nhello\nworld") };
});
vi.mock("@hellotimber/phone-screen", async (original) => ({
  ...(await original<typeof import("@hellotimber/phone-screen")>()),
  createScreenRenderer: () => ({
    canvas: document.createElement("canvas"),
    version: 0,
    render() {},
  }),
}));
vi.mock("../src/phone/stock-sound", () => ({
  WebAudioSound: class {
    muted = false;
    phoneNow = 0;
    start = audioStart;
    change() {}
  },
}));
afterEach(() => vi.unstubAllGlobals());

it("creates one homepage runtime on its own EEPROM, with the personas' SIM and reduced-motion boot", async () => {
  vi.stubGlobal("__BUILD_HASH__", "test");
  vi.stubGlobal("requestAnimationFrame", vi.fn());
  vi.stubGlobal("fetch", vi.fn());
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  localStorage.setItem("nokia-os/settings", "an older visit's stock EEPROM");
  const runtime = await loadHomeRuntime();
  expect(await loadHomeRuntime()).toBe(runtime);
  expect(getHomeRuntime()).toBe(runtime);
  expect(configs).toHaveLength(1);
  expect(firmwares[0]).toMatchObject({ tree: expect.any(Array) });
  expect(configs[0]).toMatchObject({
    sim: HOME_SIM,
    preload: { snakeLevel: 5 },
    boot: "skip",
    imei: expect.stringMatching(/^35\d{13}$/),
    t9: { english: expect.anything() },
  });
  // The site's own mute setting and the older visit's key aside, everything is the phone's.
  const keys = Object.keys(localStorage).filter(
    (key) => key !== "nokia-os/settings" && key !== "hellotimber.settings",
  );
  expect(keys.length).toBeGreaterThan(0);
  expect(keys.filter((key) => !key.startsWith(HOME_STORAGE_PREFIX))).toEqual([]);
  expect(runtime.describe(runtime.phone.screen)).not.toBe("");
  expect(audioStart).not.toHaveBeenCalled();
  runtime.input("navi", "down");
  expect(audioStart).toHaveBeenCalledOnce();
});

it("opens absolute links in a new tab and hands site paths to the router", () => {
  const open = vi.fn();
  vi.stubGlobal("open", open);
  const follow = vi.fn();
  const stop = onSiteLink(follow);
  openLink("https://github.com/lachieh");
  expect(open).toHaveBeenCalledWith("https://github.com/lachieh", "_blank", "noopener,noreferrer");
  openLink("/writing/how-i-built-a-nokia-3310");
  expect(follow).toHaveBeenCalledWith("/writing/how-i-built-a-nokia-3310");
  expect(open).toHaveBeenCalledOnce();
  stop();
});
