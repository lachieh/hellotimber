import {
  createFirmwarePhone,
  createMemoryStorage,
  describeFirmwareScreen,
  firmwarePainter,
} from "@hellotimber/nokia-os";
import type { PhoneKey, ScreenModel } from "@hellotimber/phone-core";
import { Framebuffer } from "@hellotimber/phone-screen";
import { describe, expect, it, vi } from "vite-plus/test";
import { POSTS } from "../src/writing/posts";
import { homeFirmware } from "../src/home/firmware";
import { readerPages } from "../src/home/lcd";

function boot(open = vi.fn()) {
  const firmware = homeFirmware(open);
  const phone = createFirmwarePhone(firmware, {
    carrier: "LACHLAN",
    boot: "skip",
    t9: {},
    storage: createMemoryStorage(),
    sim: { id: "home-test", phoneBook: { entries: [{ name: "Lachlan", number: "0491570006" }] } },
    preload: { snakeLevel: 5 },
  });
  let now = 0;
  const wait = (ms: number) => {
    const end = now + ms;
    while (now < end) phone.tick(++now);
  };
  const press = (key: PhoneKey, settle = 1000) => {
    phone.send({ type: "down", key });
    wait(50);
    phone.send({ type: "up", key });
    wait(settle);
  };
  phone.tick(0);
  phone.send({ type: "down", key: "power" });
  wait(1000);
  phone.send({ type: "up", key: "power" });
  wait(1000);
  const paint = firmwarePainter(firmware);
  const lcd = () => {
    const fb = new Framebuffer(84, 48);
    paint(fb, phone.screen);
    return fb;
  };
  const text = () => describeFirmwareScreen(firmware, phone.screen);
  return { phone, firmware, press, wait, lcd, text, open };
}

const carousel = (screen: ScreenModel) =>
  screen.kind === "menu-carousel" ? `${screen.menuNumber} ${screen.label}` : screen.kind;

describe("the homepage firmware", () => {
  it("boots to standby", () => {
    expect(boot().phone.screen.kind).toBe("standby");
  });

  it("carries its sections in order on the carousel, and wraps", () => {
    const { phone, press } = boot();
    press("navi");
    const seen = [carousel(phone.screen)];
    for (let i = 0; i < 7; i++) {
      press("down");
      seen.push(carousel(phone.screen));
    }
    expect(seen).toEqual([
      "1 About",
      "2 Work",
      "3 Writing",
      "4 Now",
      "5 Contact",
      "6 Chat",
      "7 Games",
      "1 About",
    ]);
  });

  it("paints every carousel item with its graphic", () => {
    const { press, lcd } = boot();
    press("navi");
    for (let i = 0; i < 7; i++) {
      const fb = lcd();
      let lit = 0;
      for (let y = 23; y < 37; y++) for (let x = 0; x < 84; x++) lit += fb.getPixel(x, y) ? 1 : 0;
      expect(lit).toBeGreaterThan(40);
      press("down");
    }
  });

  it("reads About as reader pages", () => {
    const { phone, press, text } = boot();
    press("navi");
    press("navi");
    expect(phone.path).toBe("menu/about");
    expect(text()).toMatch(/^Lachlan Heywood\. Aussie software .*\[More\]$/);
  });

  it("lists Work and reads an entry", () => {
    const { phone, press, text } = boot();
    press("navi");
    press("down");
    press("navi");
    expect(phone.path).toBe("menu/work");
    expect(text()).toContain("tambo");
    press("navi");
    expect(phone.path).toBe("menu/work/tambo");
    expect(text()).toContain("tambo, 2025-now.");
    press("c");
    expect(phone.path).toBe("menu/work");
  });

  it("lists Writing's posts; Select opens the post's page and the list stays", () => {
    const { phone, press, text, open } = boot();
    press("navi");
    press("down");
    press("down");
    press("navi");
    expect(text()).toContain(POSTS[0]!.row);
    press("navi");
    expect(open).toHaveBeenCalledWith(`/writing/${POSTS[0]!.slug}`);
    expect(phone.path).toBe("menu/writing");
  });

  it("reads Now", () => {
    const { phone, press, text } = boot();
    press("navi");
    for (let i = 0; i < 3; i++) press("down");
    press("navi");
    expect(phone.path).toBe("menu/now");
    expect(text()).toContain("Build tambo's");
  });

  it("opens Contact's links", () => {
    const { phone, press, open } = boot();
    phone.navigate("menu/contact");
    press("navi");
    expect(open).toHaveBeenCalledWith("https://github.com/lachieh");
    press("down");
    press("navi");
    expect(open).toHaveBeenLastCalledWith("https://www.linkedin.com/in/lachlanh/");
    expect(phone.path).toBe("menu/contact");
  });

  it("opens the stock Chat, finds Lachlan with Search, and C returns to the carousel", () => {
    const { phone, press, text } = boot();
    phone.navigate("menu/chat");
    expect(text()).toBe("Phone number: [Search]");
    press("c");
    expect(carousel(phone.screen)).toBe("6 Chat");
    press("navi");
    press("navi");
    expect(text()).toContain("Lachlan");
  });

  it("plays Snake II from Games", () => {
    const { phone, press, text, wait } = boot();
    phone.navigate("menu/games/snake");
    wait(3000);
    press("navi", 3000);
    expect(text()).toBe("Snake II, score 0");
    expect(phone.path).toBe("menu/games/snake/new-game");
  });
});

describe("reader pages", () => {
  it("wrap to three lines of the thin font", () => {
    const pages = readerPages("one two three four five six seven eight nine ten eleven twelve");
    expect(pages.flat().join(" ")).toBe(
      "one two three four five six seven eight nine ten eleven twelve",
    );
    for (const page of pages) expect(page.length).toBeLessThanOrEqual(3);
  });
  it("throw on a character the LCD can't draw", () => {
    expect(() => readerPages("2025–now")).toThrow("thin font lacks");
  });
});
