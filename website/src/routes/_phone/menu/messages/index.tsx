import { createFileRoute, Link } from "@tanstack/react-router";
import ContentPanel from "../../../../components/ContentPanel";
import { inbox } from "../../../../content";
import { pageHead } from "../../../../seo";

export const Route = createFileRoute("/_phone/menu/messages/")({
  head: () => pageHead({ section: "Messages", description: "About me, in SMS form." }),
  component: MessagesPanel,
});

function MessagesPanel() {
  return (
    <ContentPanel title="Messages">
      <p>About me, delivered as SMS.</p>
      <ul>
        <li>
          <Link to="/menu/messages/inbox">Inbox</Link> — {inbox.length} short messages about me.
        </li>
        <li>
          <Link to="/menu/messages/write">Write messages</Link> — send me one, multi-tap and all.
        </li>
      </ul>
    </ContentPanel>
  );
}
