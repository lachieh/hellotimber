import { createFileRoute } from "@tanstack/react-router";
import ContentPanel from "../../../components/ContentPanel";
import { content } from "../../../content";

export const Route = createFileRoute("/_phone/menu/chat")({ component: ChatPanel });

function ChatPanel() {
  return (
    <ContentPanel title="Chat">
      <p>Testimonials, rendered as a 3310 chat session.</p>
      <ul>
        {content.chat.map((line, i) => (
          <li key={i}>
            <strong>{line.who === "them" ? ">" : "<"}</strong> {line.text}
          </li>
        ))}
      </ul>
    </ContentPanel>
  );
}
