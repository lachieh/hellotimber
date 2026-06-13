import { createFileRoute } from "@tanstack/react-router";
import ContentPanel from "../../../components/ContentPanel";
import { content } from "../../../content";

export const Route = createFileRoute("/_phone/menu/phone-book")({ component: PhoneBookPanel });

function PhoneBookPanel() {
  return (
    <ContentPanel title="Phone book">
      <p>Contact details — the same entries the phone shows under Search.</p>
      <ul>
        {content.phonebook.map((entry) => (
          <li key={entry.id}>
            <strong>{entry.label}</strong> — {entry.body}
          </li>
        ))}
      </ul>
    </ContentPanel>
  );
}
