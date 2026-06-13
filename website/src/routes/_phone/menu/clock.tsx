import { createFileRoute } from "@tanstack/react-router";
import ContentPanel from "../../../components/ContentPanel";
import { content } from "../../../content";

export const Route = createFileRoute("/_phone/menu/clock")({ component: ClockPanel });

function ClockPanel() {
  return (
    <ContentPanel title="Clock">
      <p>{content.clockNote}</p>
      <p>The phone's standby clock shows your local time, just like a real SIM would not.</p>
    </ContentPanel>
  );
}
