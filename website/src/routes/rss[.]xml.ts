// Loads the @tanstack/start server-route type augmentation (`server.handlers`).
import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { renderFeed } from "../writing/feed";
import { POSTS } from "../writing/posts";

export const Route = createFileRoute("/rss.xml")({
  server: {
    handlers: {
      GET: () =>
        new Response(renderFeed(POSTS), {
          headers: { "content-type": "application/rss+xml; charset=utf-8" },
        }),
    },
  },
});
