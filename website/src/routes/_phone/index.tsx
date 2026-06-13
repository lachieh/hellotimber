import { createFileRoute, Link } from "@tanstack/react-router";
import ContentPanel from "../../components/ContentPanel";

export const Route = createFileRoute("/_phone/")({ component: StandbyPanel });

function StandbyPanel() {
  return (
    <ContentPanel title="Lachlan Heywood">
      {/* SAMPLE DATA — replace with real copy (the bio) */}
      <p>
        Software engineer at Acme Pixel Co. (which is not a real company — this paragraph is a
        placeholder for Lachlan's real bio). I build web things with hard package boundaries and a
        soft spot for 84×48 displays.
      </p>
      {/* end SAMPLE DATA */}
      <p>
        This portfolio is a working Nokia 3310. Every menu on the phone is a page on this site, and
        every page is a menu on the phone. Start at the <Link to="/menu">menu</Link>, or drive the
        handset directly: arrow keys scroll, Enter is the NaviKey, Backspace is C.
      </p>
    </ContentPanel>
  );
}
