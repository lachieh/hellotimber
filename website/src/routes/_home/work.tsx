import { createFileRoute } from "@tanstack/react-router";
import { WORK } from "../../content/work";
import { SectionPage } from "../../home/Home";
import { sectionHead } from "../../home/head";

export const Route = createFileRoute("/_home/work")({
  head: () => sectionHead(WORK),
  component: () => <SectionPage section={WORK} />,
});
