import ContentPanel from "../components/ContentPanel";
import SiteLink from "../components/SiteLink";

export default function GamesPanel() {
  return (
    <ContentPanel title="Games">
      <ul>
        <li>
          <SiteLink path="menu/games/snake">Snake II</SiteLink> — playable, top score persisted.
        </li>
        <li>Space Impact — listed, not playable (stretch).</li>
        <li>Bantumi — listed, not playable (stretch).</li>
        <li>Pairs II — listed, not playable (stretch).</li>
      </ul>
    </ContentPanel>
  );
}
