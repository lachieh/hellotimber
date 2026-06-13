import { createFileRoute } from "@tanstack/react-router";
import ContentPanel from "../../../components/ContentPanel";
import { content } from "../../../content";

export const Route = createFileRoute("/_phone/menu/reminders")({ component: RemindersPanel });

function RemindersPanel() {
  return (
    <ContentPanel title="Reminders">
      <p>What I'm doing now:</p>
      <ul>
        {content.reminders.map((r) => (
          <li key={r.id}>
            <strong>{r.label}</strong> — {r.body}
          </li>
        ))}
      </ul>
    </ContentPanel>
  );
}
