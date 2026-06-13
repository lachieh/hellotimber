import { createFileRoute } from "@tanstack/react-router";
import ContentPanel from "../../../../components/ContentPanel";

export const Route = createFileRoute("/_phone/menu/messages/write")({ component: WritePanel });

function WritePanel() {
  return (
    <ContentPanel title="Write messages">
      {/* SAMPLE DATA — plan 06 wires the multi-tap editor to real delivery */}
      <p>
        On the phone this opens a multi-tap SMS editor — type a message the way it was meant to be
        typed: one key, many presses.
      </p>
      <p>
        Prefer the easy way? <a href="mailto:lachlan@example.com">Email me</a>.
      </p>
    </ContentPanel>
  );
}
