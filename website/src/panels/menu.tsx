import ContentPanel from "../components/ContentPanel";
import SiteLink from "../components/SiteLink";
import { siteMenu } from "../content/menu";

/** The "/menu" carousel page — the 13 menus, straight from the tree. */
export default function MenuPanel() {
  return (
    <ContentPanel title="Menu">
      <p>All 13 menus, in genuine year-2000 order:</p>
      <ol>
        {siteMenu.entries.map(({ entry }) => (
          <li key={entry.slug.value}>
            <SiteLink path={`menu/${entry.slug.value}`}>{entry.label}</SiteLink>
            {entry.metadata?.description ? <> — {entry.metadata.description}</> : null}
          </li>
        ))}
      </ol>
    </ContentPanel>
  );
}
