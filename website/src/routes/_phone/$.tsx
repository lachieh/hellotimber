import { createFileRoute, Link } from "@tanstack/react-router";
import ContentPanel from "../../components/ContentPanel";

export const Route = createFileRoute("/_phone/$")({ component: NotFoundPanel });

function NotFoundPanel() {
  return (
    <ContentPanel title="SIM services">
      <p>Page not found. This phone accepts no SIM cards from strangers.</p>
      <p>
        If the phone screen shows something here, it is a phone-only screen with no page of its own
        — keep browsing on the handset, or go back <Link to="/">to standby</Link>.
      </p>
    </ContentPanel>
  );
}
