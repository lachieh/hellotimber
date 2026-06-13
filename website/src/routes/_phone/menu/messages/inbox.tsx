import { createFileRoute } from "@tanstack/react-router";
import ContentPanel from "../../../../components/ContentPanel";
import { content } from "../../../../content";

export const Route = createFileRoute("/_phone/menu/messages/inbox")({ component: InboxPanel });

function InboxPanel() {
  return (
    <ContentPanel title="Inbox">
      <ul>
        {content.inbox.map((msg) => (
          <li key={msg.id}>
            <strong>{msg.label}</strong> — {msg.body}
          </li>
        ))}
      </ul>
    </ContentPanel>
  );
}
