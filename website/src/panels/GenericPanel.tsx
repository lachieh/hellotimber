import { SubmenuEntry } from "@hellotimber/phone-core";
import ContentPanel from "../components/ContentPanel";
import SiteLink from "../components/SiteLink";
import { portfolioMenu } from "../phone/stock-routes";
import type { PanelProps } from "./registry";
export default function GenericPanel({ chain }: PanelProps) {
  const node = chain.at(-1);
  const path = ["menu", ...chain.map((entry) => entry.slug.value)].join("/");
  const entries =
    node === undefined
      ? portfolioMenu.entries.map((slot) => slot.entry)
      : node instanceof SubmenuEntry
        ? node.children.entries
        : [];
  return (
    <ContentPanel title={node?.label ?? "Menu"}>
      <p>Use the phone keys to explore {node?.label ?? "the menu"}.</p>
      <ul>
        {entries.map((child) => (
          <li key={child.slug.value}>
            <SiteLink path={`${path}/${child.slug.value}`}>
              {child.label.replace(/\s+/g, " ")}
            </SiteLink>
          </li>
        ))}
      </ul>
    </ContentPanel>
  );
}
