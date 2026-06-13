import { createFileRoute } from "@tanstack/react-router";
import ContentPanel from "../../../components/ContentPanel";
import { clock } from "../../../content";
import { pageHead } from "../../../seo";

export const Route = createFileRoute("/_phone/menu/clock")({
  head: () => pageHead({ section: "Clock", description: "My local time and availability." }),
  component: ClockPanel,
});

function ClockPanel() {
  return (
    <ContentPanel title="Clock">
      <p>
        My time zone: <strong>{clock.timeZone}</strong>.
      </p>
      <p>{clock.availability}</p>
      <p>The handset's standby clock shows your local time, just like a real SIM would not.</p>
    </ContentPanel>
  );
}
