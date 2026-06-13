import { createFileRoute } from "@tanstack/react-router";
import ContentPanel from "../../../components/ContentPanel";
import { chatMessages } from "../../../content";
import { pageHead } from "../../../seo";

export const Route = createFileRoute("/_phone/menu/chat")({
  head: () => pageHead({ section: "Chat", description: "What people say." }),
  component: ChatPanel,
});

function ChatPanel() {
  return (
    <ContentPanel title="Chat">
      <p>
        Testimonials, rendered as a 3310 chat session: <code>&gt;</code> is them, <code>&lt;</code>{" "}
        is me.
      </p>
      <ul className="list-none pl-0">
        {chatMessages.map((line, i) => (
          <li key={i}>
            <code aria-hidden="true">{line.who === "them" ? ">" : "<"}</code>{" "}
            <strong>{line.nickname}:</strong> {line.text}
          </li>
        ))}
      </ul>
    </ContentPanel>
  );
}
