import { createFileRoute } from "@tanstack/react-router";
import { SNAKE } from "../../content/snake";
import { KeyGuide } from "../../home/Home";
import { sectionHead } from "../../home/head";

export const Route = createFileRoute("/_home/snake")({
  head: () => sectionHead(SNAKE),
  component: () => <KeyGuide section={SNAKE} />,
});
