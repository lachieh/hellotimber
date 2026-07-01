import ContentPanel from "../components/ContentPanel";
import SiteLink from "../components/SiteLink";
import { inbox } from "../content";

export default function MessagesPanel() {
  return (
    <ContentPanel title="Messages">
      <p>About me, delivered as SMS.</p>
      <ul>
        <li>
          <SiteLink path="menu/messages/inbox">Inbox</SiteLink> — {inbox.length} short messages
          about me.
        </li>
        <li>
          <SiteLink path="menu/messages/write">Write messages</SiteLink> — send me one, multi-tap
          and all.
        </li>
      </ul>
    </ContentPanel>
  );
}
