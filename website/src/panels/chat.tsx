import ContentPanel from "../components/ContentPanel";
import { chatMessages } from "../content";

export default function ChatPanel() {
  return (
    <ContentPanel title="Chat">
      <p>
        A live 3310 chat session: <code>&gt;</code> is them, <code>&lt;</code> is you. On the
        handset, press the NaviKey to write a line — an AI standing in for Lachlan texts back a few
        seconds later, right in the session. (No API key configured? You get his canned replies
        instead.)
      </p>
      <p>The session opens with what people say:</p>
      <ul className="list-none pl-0">
        {chatMessages.map((line, i) => (
          <li key={i}>
            <code aria-hidden="true">{line.who === "them" ? ">" : "<"}</code>{" "}
            <strong>{line.nickname}:</strong> {line.text}
          </li>
        ))}
      </ul>
    </ContentPanel>
  );
}
