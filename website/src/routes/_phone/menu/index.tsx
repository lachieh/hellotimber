import { createFileRoute, Link } from "@tanstack/react-router";
import ContentPanel from "../../../components/ContentPanel";
import { pageHead } from "../../../seo";

export const Route = createFileRoute("/_phone/menu/")({
  head: () => pageHead({ section: "Menu", description: "Browse the phone menu." }),
  component: MenuPanel,
});

const MENUS = [
  ["/menu/phone-book", "Phone book — contact details"],
  ["/menu/messages", "Messages — about me"],
  ["/menu/chat", "Chat — testimonials"],
  ["/menu/call-register", "Call register — work history"],
  ["/menu/tones", "Tones — sound settings"],
  ["/menu/settings", "Settings"],
  ["/menu/call-divert", "Call divert — my profiles elsewhere"],
  ["/menu/games", "Games — Snake II"],
  ["/menu/calculator", "Calculator"],
  ["/menu/reminders", "Reminders — what I'm doing now"],
  ["/menu/clock", "Clock — time zone & availability"],
  ["/menu/profiles", "Profiles"],
  ["/menu/sim-services", "SIM services"],
] as const;

function MenuPanel() {
  return (
    <ContentPanel title="Menu">
      <p>All 13 menus, in genuine year-2000 order:</p>
      <ol>
        {MENUS.map(([to, label]) => (
          <li key={to}>
            <Link to={to}>{label}</Link>
          </li>
        ))}
      </ol>
    </ContentPanel>
  );
}
