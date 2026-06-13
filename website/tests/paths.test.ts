import { describe, expect, it } from "vite-plus/test";
import { phonePathFromUrl, urlFromPhonePath } from "../src/phone/paths";

describe("phonePathFromUrl", () => {
  it("maps the root URL to standby", () => {
    expect(phonePathFromUrl("/")).toBe("standby");
    expect(phonePathFromUrl("")).toBe("standby");
  });

  it("strips trailing slashes", () => {
    expect(phonePathFromUrl("/menu/")).toBe("menu");
    expect(phonePathFromUrl("/menu/games/snake///")).toBe("menu/games/snake");
  });

  it("maps menu URLs to phone paths", () => {
    expect(phonePathFromUrl("/menu")).toBe("menu");
    expect(phonePathFromUrl("/menu/phone-book")).toBe("menu/phone-book");
    expect(phonePathFromUrl("/menu/messages/inbox")).toBe("menu/messages/inbox");
  });

  it("maps anything outside the scheme to standby", () => {
    expect(phonePathFromUrl("/about")).toBe("standby");
    expect(phonePathFromUrl("/menus")).toBe("standby");
    expect(phonePathFromUrl("/MENU/games")).toBe("standby");
    expect(phonePathFromUrl("/menu//games")).toBe("standby");
    expect(phonePathFromUrl("/menu/Games!")).toBe("standby");
  });
});

describe("urlFromPhonePath", () => {
  it("maps standby to the root URL", () => {
    expect(urlFromPhonePath("standby")).toBe("/");
  });

  it("prefixes phone paths with a slash", () => {
    expect(urlFromPhonePath("menu")).toBe("/menu");
    expect(urlFromPhonePath("menu/games/snake")).toBe("/menu/games/snake");
  });

  it("round-trips every sitemap path", () => {
    for (const p of ["standby", "menu", "menu/phone-book", "menu/messages/write"]) {
      expect(phonePathFromUrl(urlFromPhonePath(p))).toBe(p);
    }
  });
});
