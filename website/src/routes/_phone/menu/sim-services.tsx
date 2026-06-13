import { createFileRoute } from "@tanstack/react-router";
import ContentPanel from "../../../components/ContentPanel";
import { pageHead } from "../../../seo";

export const Route = createFileRoute("/_phone/menu/sim-services")({
  head: () => pageHead({ section: "SIM services", description: "No service." }),
  component: SimServicesPanel,
});

function SimServicesPanel() {
  return (
    <ContentPanel title="SIM services">
      <p>Operator-dependent. Your operator is LACHLAN, and LACHLAN provides no SIM services.</p>
      <p>(Lost visitors end up here too — this menu doubles as the 404 page.)</p>
      <p className="font-mono text-xs opacity-70">IMEI {__BUILD_HASH__}</p>
    </ContentPanel>
  );
}
