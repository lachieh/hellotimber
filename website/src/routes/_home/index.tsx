import { createFileRoute } from "@tanstack/react-router";
import { site } from "../../content/site";
import { Spread } from "../../home/Home";
import { pageHead } from "../../seo";

export const Route = createFileRoute("/_home/")({
  head: () => pageHead({ description: site.tagline }),
  component: Spread,
});
