import { createFileRoute } from "@tanstack/react-router";
import ContentPanel from "../../../components/ContentPanel";

export const Route = createFileRoute("/_phone/menu/sim-services")({
  component: SimServicesPanel,
});

function SimServicesPanel() {
  return (
    <ContentPanel title="SIM services">
      <p>Operator-dependent. Your operator is LACHLAN, and LACHLAN provides no SIM services.</p>
      <p>(Lost visitors end up here too — this menu doubles as the 404 page.)</p>
    </ContentPanel>
  );
}
