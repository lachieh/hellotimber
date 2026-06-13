import { createFileRoute } from "@tanstack/react-router";
import ContentPanel from "../../../components/ContentPanel";
import { profileModes } from "../../../content";

export const Route = createFileRoute("/_phone/menu/profiles")({ component: ProfilesPanel });

function ProfilesPanel() {
  return (
    <ContentPanel title="Profiles">
      <p>Visitor modes that re-weight the content are a stretch goal. The lineup:</p>
      <dl>
        {profileModes.map((p) => (
          <div key={p.id}>
            <dt>
              <strong>{p.label}</strong>
            </dt>
            <dd>{p.description}</dd>
          </div>
        ))}
      </dl>
      <p>For now, every visitor gets General — the authentic default.</p>
    </ContentPanel>
  );
}
