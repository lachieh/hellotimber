import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import ContentPanel from "../../components/ContentPanel";
import { getPhoneRuntime } from "../../phone/phone";

export const Route = createFileRoute("/_phone/$")({
  // NOT pageHead — the 404 catch-all must be noindex (deviation 9).
  head: () => ({
    meta: [{ name: "robots", content: "noindex" }, { title: "Lachlan Heywood — No service" }],
  }),
  component: NotFoundPanel,
});

function NotFoundPanel() {
  // Unknown URL → steer the handset to SIM services (VISION 404; deviation 9).
  // Client-only: getPhoneRuntime() throws under SSR, so guard with typeof window.
  useEffect(() => {
    if (typeof window === "undefined") return;
    getPhoneRuntime().phone.navigate("menu/sim-services");
  }, []);
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
