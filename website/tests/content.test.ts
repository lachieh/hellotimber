import { isValidPath, nokia3310Menu } from "@hellotimber/phone-core";
import { describe, expect, it } from "vite-plus/test";
import { content } from "../src/content";
import { missedCalls, projects, roles } from "../src/content/call-register";
import { diverts } from "../src/content/divert";
import { inbox } from "../src/content/messages";
import { phonebook } from "../src/content/phonebook";
import { nowItems } from "../src/content/reminders";
import { site } from "../src/content/site";

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function ids(section: { id: string }[]): string[] {
  return section.map((s) => s.id);
}

describe("content model", () => {
  it("inbox is 3–5 SMS, each ≤160 chars with a parseable timestamp", () => {
    expect(inbox.length).toBeGreaterThanOrEqual(3);
    expect(inbox.length).toBeLessThanOrEqual(5);
    for (const m of inbox) {
      expect(m.text.length, m.id).toBeLessThanOrEqual(160);
      expect(Number.isFinite(Date.parse(m.timestamp)), m.id).toBe(true);
    }
  });

  it("every id is kebab-case and unique within its section", () => {
    for (const section of [phonebook, inbox, roles, projects, missedCalls, nowItems, diverts]) {
      const sectionIds = ids(section);
      expect(new Set(sectionIds).size).toBe(sectionIds.length);
      for (const id of sectionIds) expect(id).toMatch(KEBAB);
    }
  });

  it("every link target is mailto:, https://, or site-relative", () => {
    const hrefs = [...phonebook.map((c) => c.href), ...diverts.map((d) => d.href)];
    for (const href of hrefs) {
      expect(/^(mailto:|https:\/\/|\/)/.test(href), href).toBe(true);
    }
  });

  it("site.url is a bare https origin (no trailing slash)", () => {
    expect(site.url).toMatch(/^https:\/\/[^/]+$/);
  });

  it("the adapted content builds a menu where every sitemap path resolves", () => {
    const menu = nokia3310Menu(content);
    const required = [
      "menu/phone-book",
      "menu/phone-book/search",
      "menu/messages/inbox",
      "menu/messages/write",
      "menu/chat",
      "menu/call-register/received-calls",
      "menu/call-register/dialled-numbers",
      "menu/call-register/missed-calls",
      "menu/tones",
      "menu/settings",
      "menu/call-divert",
      "menu/games/snake",
      "menu/calculator",
      "menu/reminders",
      "menu/clock",
      "menu/profiles",
      "menu/sim-services",
    ];
    for (const path of required) expect(isValidPath(menu, path), path).toBe(true);
  });
});
