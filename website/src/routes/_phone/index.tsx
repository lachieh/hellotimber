import { createFileRoute } from "@tanstack/react-router";
import { StandbyPanel } from "../../panels/content";
import { site } from "../../content/site";
import { pageHead } from "../../seo";

export const Route = createFileRoute("/_phone/")({
  head: () => pageHead({ description: site.tagline }),
  component: StandbyPanel,
});
