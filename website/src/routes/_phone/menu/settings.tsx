import { createFileRoute } from "@tanstack/react-router";
import ContentPanel from "../../../components/ContentPanel";

export const Route = createFileRoute("/_phone/menu/settings")({ component: SettingsPanel });

function SettingsPanel() {
  return (
    <ContentPanel title="Settings">
      <p>
        Site settings dressed as phone settings: keypad tones, backlight, welcome note. The working
        toggles arrive with plan 06.
      </p>
    </ContentPanel>
  );
}
