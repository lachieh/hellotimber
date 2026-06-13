import { createFileRoute } from "@tanstack/react-router";
import ContentPanel from "../../../components/ContentPanel";
import { pageHead } from "../../../seo";

export const Route = createFileRoute("/_phone/menu/calculator")({
  head: () => pageHead({ section: "Calculator", description: "A working 3310 calculator." }),
  component: CalculatorPanel,
});

function CalculatorPanel() {
  return (
    <ContentPanel title="Calculator">
      <p>
        The 3310 calculator: press * once for +, twice for −, three times for ×, four for ÷; # is
        the decimal point. Limited accuracy, as the manual proudly disclaims.
      </p>
    </ContentPanel>
  );
}
