import { createFileRoute } from "@tanstack/react-router";
import ContentPanel from "../../../components/ContentPanel";

export const Route = createFileRoute("/_phone/menu/tones")({ component: TonesPanel });

function TonesPanel() {
  return (
    <ContentPanel title="Tones">
      <p>
        Ringtone picker and sound settings — monophonic, as nature intended. WebAudio playback
        arrives with plan 06.
      </p>
    </ContentPanel>
  );
}
