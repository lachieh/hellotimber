import { createFileRoute } from "@tanstack/react-router";
import { CHAT } from "../../content/chat";
import { KeyGuide } from "../../home/Home";
import { sectionHead } from "../../home/head";

export const Route = createFileRoute("/_home/chat")({
  head: () => sectionHead(CHAT),
  component: () => <KeyGuide section={CHAT} />,
});
