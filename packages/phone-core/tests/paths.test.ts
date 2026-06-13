import { describe, expect, it } from "vite-plus/test";
import {
  childrenOf,
  isValidPath,
  joinMenuPath,
  normalizePath,
  parsePath,
  resolveIds,
} from "../src/paths";
import type { MenuNode } from "../src/types";

const menu: MenuNode[] = [
  {
    type: "submenu",
    id: "phone-book",
    label: "Phone book",
    children: [
      {
        type: "list",
        id: "search",
        label: "Search",
        items: [{ id: "a", label: "A", body: "a" }],
      },
      { type: "reader", id: "memory-status", label: "Memory status", body: "SIM 2/2 used." },
    ],
  },
  { type: "app", id: "calculator", label: "Calculator", appId: "calculator" },
];

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

  it("resolves ids to nodes through submenus only", () => {
    const nodes = resolveIds(menu, ["phone-book", "search"]);
    expect(nodes?.map((n) => n.id)).toEqual(["phone-book", "search"]);
    expect(resolveIds(menu, [])).toEqual([]);
    expect(resolveIds(menu, ["phone-book", "missing"])).toBeNull();
    expect(resolveIds(menu, ["calculator", "child"])).toBeNull(); // apps have no children
  });

  it("validates full paths and joins ids back", () => {
    expect(isValidPath(menu, "standby")).toBe(true);
    expect(isValidPath(menu, "menu")).toBe(true);
    expect(isValidPath(menu, "menu/phone-book/memory-status")).toBe(true);
    expect(isValidPath(menu, "menu/games")).toBe(false);
    expect(isValidPath(menu, "garbage")).toBe(false);
    expect(joinMenuPath([])).toBe("menu");
    expect(joinMenuPath(["a", "b"])).toBe("menu/a/b");
  });

  it("childrenOf returns children for submenus, [] otherwise", () => {
    expect(childrenOf(menu[0]!)).toHaveLength(2);
    expect(childrenOf(menu[1]!)).toEqual([]);
  });
});
