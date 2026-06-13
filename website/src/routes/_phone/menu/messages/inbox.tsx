import { createFileRoute } from "@tanstack/react-router";
import ContentPanel from "../../../../components/ContentPanel";
import { inbox } from "../../../../content";

export const Route = createFileRoute("/_phone/menu/messages/inbox")({ component: InboxPanel });

function InboxPanel() {
  return (
    <ContentPanel title="Inbox">
      <ol>
        {inbox.map((m) => (
          <li key={m.id}>
            <p>
              <strong>{m.label}</strong>{" "}
              <time dateTime={m.timestamp}>{m.timestamp.slice(0, 10)}</time>
            </p>
            <p>{m.text}</p>
          </li>
        ))}
      </ol>
    </ContentPanel>
  );
}
