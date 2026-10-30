// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vite-plus/test";
import { PANELS } from "../src/panels/registry";
import { ROUTE_CONTENT } from "../src/content/routes";
import { LINKS } from "../src/content/links";
import { SIM_MESSAGES } from "../src/content/sim-messages";
import { PROJECTS, COLOPHON } from "../src/content/toolkit";
import { NOW } from "../src/content/now";
vi.mock("../src/components/SiteLink", () => ({
  default: ({ path, children }: { path: string; children: import("react").ReactNode }) => (
    <a href={`/${path}`}>{children}</a>
  ),
}));
function panel(id: string) {
  const Panel = PANELS[id]!;
  const root = document.createElement("div");
  root.innerHTML = renderToStaticMarkup(<Panel chain={[]} />);
  return root;
}
it("accounts for every content panel without unused registrations", () => {
  expect(Object.keys(PANELS).sort()).toEqual(
    [...new Set(Object.values(ROUTE_CONTENT).map((entry) => entry.panel))].sort(),
  );
  for (const id of Object.keys(PANELS)) expect(panel(id).textContent?.length).toBeGreaterThan(0);
});
it("renders contacts as actual links including rel=me", () => {
  const root = panel("contacts");
  for (const link of LINKS.filter((link) => link.kind === "social")) {
    const anchor = root.querySelector(`a[href="${link.href}"]`);
    expect(anchor).not.toBeNull();
    if ("rel" in link) expect(anchor?.getAttribute("rel")).toBe(link.rel);
    if ("download" in link) expect(anchor?.hasAttribute("download")).toBe(true);
  }
});
it("renders every seeded SMS with sender and semantic timestamp", () => {
  const root = panel("messages");
  for (const message of SIM_MESSAGES) expect(root.textContent).toContain(message.text);
  expect(root.querySelectorAll("time")).toHaveLength(SIM_MESSAGES.length);
  expect(root.textContent).toContain("Lachlan");
});
it("renders project blurbs, years, links, now items and colophon", () => {
  for (const project of PROJECTS) {
    expect(panel("projects").textContent).toContain(project.blurb);
    expect(panel("projects").textContent).toContain(project.year);
  }
  expect(panel("projects").querySelectorAll("a").length).toBeGreaterThan(0);
  for (const item of NOW) expect(panel("now").textContent).toContain(item.text);
  expect(panel("about").textContent).toContain(COLOPHON);
});
