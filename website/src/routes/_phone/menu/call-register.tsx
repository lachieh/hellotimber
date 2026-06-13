import { createFileRoute } from "@tanstack/react-router";
import ContentPanel from "../../../components/ContentPanel";
import { content } from "../../../content";

export const Route = createFileRoute("/_phone/menu/call-register")({
  component: CallRegisterPanel,
});

function CallRegisterPanel() {
  const sections = [
    ["Received calls — roles held", content.receivedCalls],
    ["Dialled numbers — projects shipped", content.dialledNumbers],
    ["Missed calls — ones that got away", content.missedCalls],
  ] as const;
  return (
    <ContentPanel title="Call register">
      {sections.map(([heading, items]) => (
        <section key={heading}>
          <h2>{heading}</h2>
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                <strong>{item.label}</strong> — {item.body}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </ContentPanel>
  );
}
