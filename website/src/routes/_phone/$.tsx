import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { portfolioMenu, redirectFor } from "../../phone/stock-routes";
import { site } from "../../content/site";
import { PANELS } from "../../panels/registry";
import GenericPanel from "../../panels/GenericPanel";
import NotFoundPanel from "../../panels/NotFoundPanel";
import { projectStockRoute } from "../../phone/stock-routes";
import { pageHead } from "../../seo";

/**
 * THE dynamic route (plan 07): every /menu/… URL resolves against the one
 * PhoneMenu graph. A URL 404s ONLY when the path is not in the graph — valid
 * phone screens always render a real page, so the handset is never hijacked.
 */
export const Route = createFileRoute("/_phone/$")({
  loader: ({ params }) => {
    const target = redirectFor(`/${params._splat ?? ""}`);
    if (target) throw redirect({ to: target, statusCode: 301 });
    const projection = projectStockRoute(params._splat ?? "");
    if (projection === null) throw notFound();
    return projection;
  },
  head: ({ loaderData }) => {
    // Loader threw notFound() — the 404 page is never indexed.
    if (loaderData === undefined) {
      return {
        meta: [{ name: "robots", content: "noindex" }, { title: `${site.name} — No service` }],
      };
    }
    const { title, description, indexing } = loaderData;
    // Valid phone screen without SEO copy (stubs, pickers): real page, noindex.
    if (description === null) {
      return {
        meta: [{ name: "robots", content: "noindex" }, { title: `${site.name} — ${title}` }],
      };
    }
    const head = pageHead({ section: title, description });
    if (indexing === "noindex") head.meta.push({ name: "robots", content: "noindex" });
    return head;
  },
  notFoundComponent: NotFoundPanel, // the ONLY place that steers to menu/sim-services
  component: ResolvedPanel,
});

function ResolvedPanel() {
  const params = Route.useParams();
  const { panel } = Route.useLoaderData();
  const chain = portfolioMenu.resolve(params._splat ?? "");
  if (chain === null) return null;
  const Panel = PANELS[panel] ?? GenericPanel;
  return <Panel chain={chain} />;
}
