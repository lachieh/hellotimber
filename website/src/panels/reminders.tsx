import ContentPanel from "../components/ContentPanel";
import { nowItems } from "../content";

export default function RemindersPanel() {
  return (
    <ContentPanel title="Reminders">
      <p>What I'm doing now:</p>
      <dl>
        {nowItems.map((n) => (
          <div key={n.id}>
            <dt>
              <strong>{n.label}</strong>
            </dt>
            <dd>{n.detail}</dd>
          </div>
        ))}
      </dl>
    </ContentPanel>
  );
}
