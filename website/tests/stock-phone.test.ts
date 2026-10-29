// @vitest-environment jsdom
import { expect, it, vi } from "vite-plus/test";
import { loadPhoneRuntime, getPhoneRuntime } from "../src/phone/stock-phone";
import { PORTFOLIO_SIM, PRELOAD } from "../src/content/sim";
const { configs, audioStart } = vi.hoisted(() => ({
  configs: [] as unknown[],
  audioStart: vi.fn(),
}));
vi.mock("@hellotimber/nokia-os", async (original) => {
  const stock = await original<typeof import("@hellotimber/nokia-os")>();
  return {
    ...stock,
    createStockPhone(config: import("@hellotimber/nokia-os").StockPhoneConfig) {
      configs.push(config);
      return stock.createStockPhone(config);
    },
  };
});
vi.mock("@hellotimber/nokia-os/t9-english", async () => {
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
it("creates one stock runtime with the SIM, ports, preload and reduced-motion boot", async () => {
  vi.stubGlobal("__BUILD_HASH__", "test");
  vi.stubGlobal("requestAnimationFrame", vi.fn());
  vi.stubGlobal("fetch", vi.fn());
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  const runtime = await loadPhoneRuntime();
  expect(await loadPhoneRuntime()).toBe(runtime);
  expect(getPhoneRuntime()).toBe(runtime);
  expect(configs).toHaveLength(1);
  expect(configs[0]).toMatchObject({
    storage: localStorage,
    sim: PORTFOLIO_SIM,
    preload: PRELOAD,
    boot: "skip",
    imei: expect.stringMatching(/^35\d{13}$/),
    t9: { english: expect.anything() },
  });
  expect(audioStart).not.toHaveBeenCalled();
  runtime.input("navi", "down");
  expect(audioStart).toHaveBeenCalledOnce();
  vi.unstubAllGlobals();
});
