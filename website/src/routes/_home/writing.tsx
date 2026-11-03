import { createFileRoute } from "@tanstack/react-router";
import { WRITING } from "../../content/writing";
import { SectionPage } from "../../home/Home";
import { sectionHead } from "../../home/head";

export const Route = createFileRoute("/_home/writing")({
  head: () => sectionHead(WRITING),
  component: () => <SectionPage section={WRITING} />,
});
