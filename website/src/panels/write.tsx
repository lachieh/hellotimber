import ContentPanel from "../components/ContentPanel";
import { writeMessage } from "../content";

export default function WritePanel() {
  const mailto = `mailto:${writeMessage.destinationEmail}?subject=${encodeURIComponent(writeMessage.subject)}`;
  return (
    <ContentPanel title="Write messages">
      <p>
        On the handset this opens a real multi-tap SMS editor — one key, many presses, 160
        characters of commitment. Press the NaviKey for Options, Send it to a contact, and
        they&apos;ll text you back in a few seconds.
      </p>
      <p>
        Prefer the easy way? <a href={mailto}>Email me directly</a>.
      </p>
    </ContentPanel>
  );
}
