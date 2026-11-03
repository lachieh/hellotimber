import type { ScreenModel } from "@hellotimber/phone-core";
import { describe, expect, it } from "vite-plus/test";
import { SECTIONS } from "../src/content/sections";
import { homeFirmware } from "../src/home/firmware";
import {
  onRoute,
  routeOfPhonePath,
  SECTION_PHONE_PATHS,
  SECTION_SLUGS,
  sectionOfRoute,
} from "../src/home/routes";
import { highlightedSection, homeView } from "../src/home/view";

const carousel = (menuNumber: number): ScreenModel =>
  ({ kind: "menu-carousel", menuNumber, label: "" }) as unknown as ScreenModel;
const standby = { kind: "standby" } as unknown as ScreenModel;
const list = { kind: "list" } as unknown as ScreenModel;

describe("the route map", () => {
  it("maps each section's route to its phone path and back", () => {
    for (const section of SECTIONS) {
      const path = SECTION_PHONE_PATHS[section.id];
      expect(sectionOfRoute(section.route)).toBe(section.id);
      expect(routeOfPhonePath(path)).toBe(section.route);
      expect(routeOfPhonePath(`${path}/deeper/still`)).toBe(section.route);
    }
  });

  it("puts standby and the carousel on /", () => {
    expect(routeOfPhonePath("standby")).toBe("/");
    expect(routeOfPhonePath("menu")).toBe("/");
    expect(sectionOfRoute("/")).toBe("home");
  });

  it("knows no other route, the old /menu ones included", () => {
    for (const path of ["/menu", "/menu/games/snake", "/exp/nokia-emulator", "/writing/x"]) {
      expect(sectionOfRoute(path)).toBeUndefined();
    }
  });

  it("ignores a trailing slash", () => {
    expect(onRoute("/work/", "menu/work/tambo")).toBe(true);
    expect(onRoute("/", "menu/work")).toBe(false);
  });

  it("agrees with the firmware's tree", () => {
    const firmware = homeFirmware(() => {});
    expect(firmware.tree.map((node) => node.slug)).toEqual(
      SECTIONS.map((section) => SECTION_SLUGS[section.id]),
    );
    for (const section of SECTIONS) {
      const slugs = SECTION_PHONE_PATHS[section.id].split("/").slice(1);
      let nodes = firmware.tree;
      for (const slug of slugs) {
        const node = nodes.find((n) => n.slug === slug);
        expect(node, `${section.id}: ${slug}`).toBeDefined();
        nodes = node!.children ?? [];
      }
    }
  });
});

describe("the homepage view", () => {
  it("highlights the carousel's item, or the section the phone is in", () => {
    expect(highlightedSection({ path: "menu", screen: carousel(1) })).toBe("about");
    expect(highlightedSection({ path: "menu", screen: carousel(7) })).toBe("snake");
    expect(highlightedSection({ path: "menu/work/tambo", screen: list })).toBe("work");
    expect(highlightedSection({ path: "menu/games/snake", screen: list })).toBe("snake");
    expect(highlightedSection({ path: "standby", screen: standby })).toBeUndefined();
    expect(highlightedSection(undefined)).toBeUndefined();
  });

  it("shows / as the highlighted item's spread, or the introduction", () => {
    expect(homeView("/", undefined)).toEqual({ kind: "spread", section: undefined });
    const view = homeView("/", "contact");
    expect(view?.kind === "spread" && view.section?.id).toBe("contact");
  });

  it("docks the phone beside a page section, whatever the phone highlights", () => {
    for (const id of ["about", "work", "writing", "now", "contact"] as const) {
      const view = homeView(`/${id}`, "chat");
      expect(view?.kind).toBe("docked");
      expect(view?.section?.id).toBe(id);
    }
  });

  it("centres the phone for Chat and Snake", () => {
    expect(homeView("/chat", "chat")?.kind).toBe("centred");
    expect(homeView("/snake", undefined)?.kind).toBe("centred");
  });

  it("has no view off the phone's routes", () => {
    expect(homeView("/exp/nokia-emulator", "about")).toBeUndefined();
  });
});
