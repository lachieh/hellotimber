import { createFileRoute } from "@tanstack/react-router";
import ContentPanel from "../../components/ContentPanel";

export const Route = createFileRoute("/_phone/")({ component: StandbyPanel });

function StandbyPanel() {
  return (
    <ContentPanel title="Lachlan Heywood">
      {/* SAMPLE DATA — replace with real copy (plan 06) */}
      <p>
        Software engineer. This portfolio is a working Nokia 3310: every menu on the phone is a page
        on this site, and every page is a menu on the phone.
      </p>
      <p>
        Drive it with your mouse on the 3D keypad, or with your keyboard: arrow keys scroll, Enter
        is the NaviKey, Backspace goes back. Press Enter to open the menu.
      </p>
    </ContentPanel>
  );
}
