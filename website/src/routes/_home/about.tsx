import { createFileRoute } from "@tanstack/react-router";
import { ABOUT } from "../../content/about";
import { SectionPage } from "../../home/Home";
import { sectionHead } from "../../home/head";

export const Route = createFileRoute("/_home/about")({
  head: () => sectionHead(ABOUT),
  component: () => <SectionPage section={ABOUT} />,
});
