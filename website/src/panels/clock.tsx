import ContentPanel from "../components/ContentPanel";
import { clock } from "../content";

export default function ClockPanel() {
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
