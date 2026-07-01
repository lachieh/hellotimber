import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect } from "react";
import ContentPanel from "../../components/ContentPanel";
import { siteMenu } from "../../content/menu";
import { site } from "../../content/site";
import GenericPanel from "../../panels/GenericPanel";
import MenuPanel from "../../panels/menu";
import { PANELS } from "../../panels/registry";
import { getPhoneRuntime } from "../../phone/phone";
import { resolveSitePath } from "../../phone/site-tree";
import { pageHead } from "../../seo";

/** The "/menu" carousel page has no tree node of its own — fixed head copy. */
const MENU_PAGE = { title: "Menu", description: "Browse the phone menu." };

/**
 * THE dynamic route (plan 07): every /menu/… URL resolves against the one
 * SiteNode tree. A URL 404s ONLY when the path is not in the tree — valid
 * phone screens always render a real page, so the handset is never hijacked.
 */
export const Route = createFileRoute("/_phone/$")({
  loader: ({ params }) => {
    const chain = resolveSitePath(siteMenu, params._splat ?? "");
    if (chain === null) throw notFound();
    const node = chain.at(-1);
    if (node === undefined) return { ...MENU_PAGE, noindex: false };
    return {
      title: node.label,
      description: node.web?.description ?? null,
      noindex: node.web?.noindex === true,
    };
  },
  head: ({ loaderData }) => {
    // Loader threw notFound() — the 404 page is never indexed.
    if (loaderData === undefined) {
      return {
        meta: [{ name: "robots", content: "noindex" }, { title: `${site.name} — No service` }],
      };
    }
    const { title, description, noindex } = loaderData;
    // Valid phone screen without SEO copy (stubs, pickers): real page, noindex.
    if (description === null) {
      return {
        meta: [{ name: "robots", content: "noindex" }, { title: `${site.name} — ${title}` }],
      };
    }
    const head = pageHead({ section: title, description });
    if (noindex) head.meta.push({ name: "robots", content: "noindex" });
    return head;
  },
  notFoundComponent: NotFoundPanel, // the ONLY place that steers to menu/sim-services
  component: ResolvedPanel,
});

function ResolvedPanel() {
  const params = Route.useParams();
  const chain = resolveSitePath(siteMenu, params._splat ?? "") ?? [];
  const node = chain.at(-1);
  if (node === undefined) return <MenuPanel />; // "/menu"
  const Panel = (node.web?.panel !== undefined && PANELS[node.web.panel]) || GenericPanel;
  return <Panel chain={chain} />;
}

function NotFoundPanel() {
  // Unknown URL → steer the handset to SIM services (VISION 404). This can
  // only mount for tree-invalid URLs now — never for valid phone screens.
  // Client-only: getPhoneRuntime() throws under SSR, so guard with typeof window.
  useEffect(() => {
    if (typeof window === "undefined") return;
    getPhoneRuntime().phone.navigate("menu/sim-services");
  }, []);
  return (
    <ContentPanel title="SIM services">
      <p>Page not found. This phone accepts no SIM cards from strangers.</p>
      <p>
        If the phone screen shows something here, it is a phone-only screen with no page of its own
        — keep browsing on the handset, or go back <Link to="/">to standby</Link>.
      </p>
    </ContentPanel>
  );
}
