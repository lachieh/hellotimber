import { createFileRoute } from "@tanstack/react-router";
import ContentPanel from "../../../../components/ContentPanel";
import { writeMessage } from "../../../../content";
import { pageHead } from "../../../../seo";

export const Route = createFileRoute("/_phone/menu/messages/write")({
  head: () => pageHead({ section: "Write message", description: "Send a message." }),
  component: WritePanel,
});

function WritePanel() {
  const mailto = `mailto:${writeMessage.destinationEmail}?subject=${encodeURIComponent(writeMessage.subject)}`;
  return (
    <ContentPanel title="Write messages">
      <p>
        On the handset this opens a real multi-tap SMS editor — one key, many presses, 160
        characters of commitment. Accepting the message (NaviKey) hands it to your mail client.
      </p>
      <p>
        Prefer the easy way? <a href={mailto}>Email me directly</a>.
      </p>
    </ContentPanel>
  );
}
