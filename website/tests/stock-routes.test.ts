import { expect, it } from "vite-plus/test";
import { stockMenuFor } from "@hellotimber/nokia-os";
import { PORTFOLIO_SIM } from "../src/content/sim";
import { ROUTE_CONTENT, REDIRECTS } from "../src/content/routes";
import {
  projectStockRoute,
  indexablePaths,
  redirectFor,
  stockSitemapPaths,
} from "../src/phone/stock-routes";
import { LEGACY_PATHS } from "./fixtures/legacy-paths";
const EXPECTED = [
  "/",
  "/menu",
  "/menu/phone-book",
  "/menu/phone-book/search",
  "/menu/phone-book/service-nos",
  "/menu/messages",
  "/menu/messages/inbox",
  "/menu/messages/write",
  "/menu/chat",
  "/menu/reminders",
  "/menu/reminders/view-all",
  "/menu/clock",
  "/menu/games",
  "/menu/games/snake",
  "/menu/calculator",
  "/menu/sim-services",
  "/menu/sim-services/projects",
  "/menu/sim-services/about",
];
const paths = stockMenuFor(PORTFOLIO_SIM)
  .paths()
  .map((path) => `/${path}`);
it("indexes exactly D14 in stock order", () => {
  expect(Object.keys(ROUTE_CONTENT).sort()).toEqual([...EXPECTED].sort());
  expect(stockSitemapPaths()).toEqual(["/", ...paths.filter((path) => EXPECTED.includes(path))]);
  expect(indexablePaths()).toEqual(stockSitemapPaths().slice(1));
});
it("projects stock titles, metadata, slug chains and generic noindex pages", () => {
  expect(projectStockRoute("menu/phone-book/search")).toMatchObject({
    title: "Search",
    indexing: "index",
    panel: "contacts",
    slugChain: ["phone-book", "search"],
  });
  expect(projectStockRoute("/menu/messages/inbox")?.description).toBe(
    ROUTE_CONTENT["/menu/messages/inbox"]?.description,
  );
  expect(projectStockRoute("menu/tones")).toMatchObject({
    title: "Tones",
    indexing: "noindex",
    panel: "generic",
  });
  expect(projectStockRoute("menu")).toMatchObject({ title: "Menu", indexing: "index" });
  expect(projectStockRoute("nope")).toBeNull();
});
it("covers all 66 legacy URLs with stock routes or redirects", () => {
  expect(LEGACY_PATHS).toHaveLength(66);
  for (const path of LEGACY_PATHS)
    expect(path === "/" || paths.includes(path) || redirectFor(path) !== null, path).toBe(true);
  for (const path of Object.keys(ROUTE_CONTENT))
    expect(path === "/" || paths.includes(path), path).toBe(true);
  for (const target of Object.values(REDIRECTS)) expect(paths).toContain(target);
  expect(redirectFor("/menu/call-divert/github")).toBe("/menu/phone-book/search");
  expect(redirectFor("/nope")).toBeNull();
  expect(redirectFor("toString")).toBeNull();
});
