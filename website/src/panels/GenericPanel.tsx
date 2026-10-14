import type { MenuEntryVisitor } from "@hellotimber/phone-core";
import type { ReactNode } from "react";
import ContentPanel from "../components/ContentPanel";
import SiteLink from "../components/SiteLink";
import type { WebMetadata } from "../content/types";
import type { PanelProps } from "./registry";

/**
 * Fallback panel for tree nodes without a bespoke panel: stubs, deep
 * submenus, pickers. Every valid phone screen gets a real HTML page.
 */
export default function GenericPanel({ chain }: PanelProps) {
  const node = chain.at(-1);
  if (node === undefined) return null; // "/menu" renders MenuPanel, not this
  const path = `menu/${chain.map((entry) => entry.slug.value).join("/")}`;
  const content = node.accept<ReactNode>({
    visitSubmenu: (entry) => (
      <ul>
        {entry.children.entries.map((child) => (
          <li key={child.slug.value}>
            <SiteLink path={`${path}/${child.slug.value}`}>{child.label}</SiteLink>
          </li>
        ))}
      </ul>
    ),
    visitList: (entry) => {
      // Dynamic sources are intentionally read afresh for every React render.
      const items = entry.source.read();
      return items.length === 0 ? (
        <p>Empty.</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <strong>{item.label}</strong> — {item.body}
            </li>
          ))}
        </ul>
      );
    },
    visitReader: (entry) => entry.body.split("\n").map((line, index) => <p key={index}>{line}</p>),
    visitAction: (entry) => (
      <p>
        <a href={entry.action.value} target="_blank" rel="noopener noreferrer">
          {entry.label}
        </a>
      </p>
    ),
    visitApplication: (entry) => (
      <p>{entry.label} is interactive on the handset — drive it with the phone keys.</p>
    ),
  } satisfies MenuEntryVisitor<WebMetadata, ReactNode>);

  return <ContentPanel title={node.label}>{content}</ContentPanel>;
}
