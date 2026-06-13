// Loads the @tanstack/start server-route type augmentation (`server.handlers`)
// onto createFileRoute's options — it isn't otherwise in the TS program.
import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { site } from "../content/site";
import { SITEMAP_PATHS } from "../seo";

function renderSitemap(): string {
  const urls = SITEMAP_PATHS.map(
    (p) => `  <url><loc>${site.url}${p === "/" ? "" : p}</loc></url>`,
  ).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () =>
        new Response(renderSitemap(), {
          headers: { "content-type": "application/xml; charset=utf-8" },
        }),
    },
  },
});
