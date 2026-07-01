import ContentPanel from "../components/ContentPanel";
import SiteLink from "../components/SiteLink";
import type { SiteNode } from "../content/types";

/**
 * Fallback panel for tree nodes without a bespoke panel: stubs, deep
 * submenus, pickers. Every valid phone screen gets a real HTML page.
 */
export default function GenericPanel({ chain }: { chain: SiteNode[] }) {
  const node = chain.at(-1);
  if (node === undefined) return null; // "/menu" renders MenuPanel, not this
  const path = `menu/${chain.map((n) => n.id).join("/")}`;
  return (
    <ContentPanel title={node.label}>
      {node.type === "reader" && node.body.split("\n").map((line, i) => <p key={i}>{line}</p>)}
      {node.type === "list" &&
        (node.items.length === 0 ? (
          <p>Empty.</p>
        ) : (
          <ul>
            {node.items.map((item) => (
              <li key={item.id}>
                <strong>{item.label}</strong> — {item.body}
              </li>
            ))}
          </ul>
        ))}
      {node.type === "submenu" && (
        <ul>
          {node.children.map((child) => (
            <li key={child.id}>
              <SiteLink path={`${path}/${child.id}`}>{child.label}</SiteLink>
            </li>
          ))}
        </ul>
      )}
      {node.type === "app" && (
        <p>{node.label} is interactive on the handset — drive it with the phone keys.</p>
      )}
      {node.type === "action" && (
        <p>
          <a href={node.action.value} target="_blank" rel="noopener noreferrer">
            {node.label}
          </a>
        </p>
      )}
    </ContentPanel>
  );
}
