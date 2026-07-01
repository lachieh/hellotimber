import ContentPanel from "../components/ContentPanel";

export default function SnakePanel() {
  return (
    <ContentPanel title="Snake II">
      <p>The real thing: wraparound edges, the bonus bug, one life.</p>
      <ul>
        <li>Steer: 2 / 4 / 6 / 8 on the keypad, or the arrow keys.</li>
        <li>Pause and leave: Backspace (the C key). Come back to continue.</li>
        <li>Your top score is saved in this browser.</li>
      </ul>
    </ContentPanel>
  );
}
