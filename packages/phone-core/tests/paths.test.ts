import { describe, expect, it } from "vite-plus/test";
import {
  childrenOf,
  isValidPath,
  joinMenuPath,
  normalizePath,
  parsePath,
  resolveIds,
} from "../src/paths";
import { testMenu } from "./fixtures";

const menu = testMenu();

describe("paths", () => {
  it("normalizes slashes and blanks", () => {
    expect(normalizePath("/menu/phone-book/")).toBe("menu/phone-book");
    expect(normalizePath("")).toBe("standby");
    expect(normalizePath("   ")).toBe("standby");
    expect(normalizePath("standby")).toBe("standby");
  });

  it("parses standby and menu paths; rejects everything else", () => {
    expect(parsePath("standby")).toEqual({ kind: "standby" });
    expect(parsePath("/")).toEqual({ kind: "standby" });
    expect(parsePath("menu")).toEqual({ kind: "menu", ids: [] });
    expect(parsePath("menu/phone-book/search")).toEqual({
      kind: "menu",
      ids: ["phone-book", "search"],
    });
    expect(parsePath("nope")).toBeNull();
    expect(parsePath("menu//x")).toBeNull();
  });

  it("resolves slugs through submenus only", () => {
    const entries = resolveIds(menu, ["phone-book", "search"]);
    expect(entries?.map((entry) => entry.slug.value)).toEqual(["phone-book", "search"]);
    expect(resolveIds(menu, [])).toEqual([]);
    expect(resolveIds(menu, ["phone-book", "missing"])).toBeNull();
    expect(resolveIds(menu, ["chat", "child"])).toBeNull();
  });

  it("validates full paths and joins slugs back", () => {
    expect(isValidPath(menu, "standby")).toBe(true);
    expect(isValidPath(menu, "menu")).toBe(true);
    expect(isValidPath(menu, "menu/phone-book/memory-status")).toBe(true);
    expect(isValidPath(menu, "menu/games")).toBe(false);
    expect(isValidPath(menu, "garbage")).toBe(false);
    expect(joinMenuPath([])).toBe("menu");
    expect(joinMenuPath(["a", "b"])).toBe("menu/a/b");
  });

  it("childrenOf returns canonical submenu children and [] otherwise", () => {
    expect(childrenOf(menu.entries[0]!.entry)).toHaveLength(2);
    expect(childrenOf(menu.entries[2]!.entry)).toEqual([]);
  });
});
