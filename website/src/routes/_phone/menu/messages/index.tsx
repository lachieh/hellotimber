import { createFileRoute, Link } from "@tanstack/react-router";
import ContentPanel from "../../../../components/ContentPanel";

export const Route = createFileRoute("/_phone/menu/messages/")({ component: MessagesPanel });

function MessagesPanel() {
  return (
    <ContentPanel title="Messages">
      <p>About me, delivered as SMS.</p>
      <ul>
        <li>
          <Link to="/menu/messages/inbox">Inbox</Link> — short intros about me.
        </li>
        <li>
          <Link to="/menu/messages/write">Write messages</Link> — send me one.
        </li>
      </ul>
    </ContentPanel>
  );
}
