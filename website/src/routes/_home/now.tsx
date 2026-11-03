import { createFileRoute } from "@tanstack/react-router";
import { NOW } from "../../content/now";
import { SectionPage } from "../../home/Home";
import { sectionHead } from "../../home/head";

export const Route = createFileRoute("/_home/now")({
  head: () => sectionHead(NOW),
  component: () => <SectionPage section={NOW} />,
});
