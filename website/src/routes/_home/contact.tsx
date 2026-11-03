import { createFileRoute } from "@tanstack/react-router";
import { CONTACT } from "../../content/contact";
import { SectionPage } from "../../home/Home";
import { sectionHead } from "../../home/head";

export const Route = createFileRoute("/_home/contact")({
  head: () => sectionHead(CONTACT),
  component: () => <SectionPage section={CONTACT} />,
});
