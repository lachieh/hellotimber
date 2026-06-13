import { createFileRoute } from "@tanstack/react-router";
import ContentPanel from "../../../components/ContentPanel";
import { diverts } from "../../../content";

export const Route = createFileRoute("/_phone/menu/call-divert")({ component: CallDivertPanel });

function CallDivertPanel() {
  return (
    <ContentPanel title="Call divert">
      <p>
        Divert this visit to one of my profiles elsewhere (selecting one on the handset opens it
        too):
      </p>
      <ul>
        {diverts.map((d) => (
          <li key={d.id}>
            <a href={d.href} target="_blank" rel="me noopener noreferrer">
              {d.label}
            </a>
          </li>
        ))}
      </ul>
    </ContentPanel>
  );
}
