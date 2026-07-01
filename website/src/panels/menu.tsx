import ContentPanel from "../components/ContentPanel";
import SiteLink from "../components/SiteLink";
import { siteMenu } from "../content/menu";

/** The "/menu" carousel page — the 13 menus, straight from the tree. */
export default function MenuPanel() {
  return (
    <ContentPanel title="Menu">
      <p>All 13 menus, in genuine year-2000 order:</p>
      <ol>
        {siteMenu.map((n) => (
          <li key={n.id}>
            <SiteLink path={`menu/${n.id}`}>{n.label}</SiteLink>
            {n.web?.description ? <> — {n.web.description}</> : null}
          </li>
        ))}
      </ol>
    </ContentPanel>
  );
}
