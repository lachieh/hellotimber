import { createFileRoute } from "@tanstack/react-router";
import ContentPanel from "../../../components/ContentPanel";

export const Route = createFileRoute("/_phone/menu/profiles")({ component: ProfilesPanel });

function ProfilesPanel() {
  return (
    <ContentPanel title="Profiles">
      <p>
        General, Silent, Discreet, Loud — and one (empty) slot. Visitor modes that re-weight the
        content are a stretch goal; for now every visitor gets General.
      </p>
    </ContentPanel>
  );
}
