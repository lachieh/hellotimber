import { createFileRoute, Link } from "@tanstack/react-router";
import ContentPanel from "../../../../components/ContentPanel";
import { pageHead } from "../../../../seo";

export const Route = createFileRoute("/_phone/menu/games/")({
  head: () => pageHead({ section: "Games", description: "Snake II and more." }),
  component: GamesPanel,
});

function GamesPanel() {
  return (
    <ContentPanel title="Games">
      <ul>
        <li>
          <Link to="/menu/games/snake">Snake II</Link> — playable, top score persisted.
        </li>
        <li>Space Impact — listed, not playable (stretch).</li>
        <li>Bantumi — listed, not playable (stretch).</li>
        <li>Pairs II — listed, not playable (stretch).</li>
      </ul>
    </ContentPanel>
  );
}
