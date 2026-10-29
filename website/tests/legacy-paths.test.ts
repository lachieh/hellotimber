import { expect, it } from "vite-plus/test";
import { siteMenu } from "../src/content/menu";
import { LEGACY_PATHS } from "./fixtures/legacy-paths";

it("preserves every legacy menu URL in its original order", () => {
  expect(LEGACY_PATHS).toEqual(["/", ...siteMenu.paths().map((path) => `/${path}`)]);
});
