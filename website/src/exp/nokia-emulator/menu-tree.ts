import { SubmenuEntry, type MenuEntry, type PhoneMenu } from "@hellotimber/phone-core";

/** One menu entry, for the Inspector's tree. */
export interface TreeNode {
  /** The phone path that opens it (`phone.navigate`). */
  readonly path: string;
  readonly label: string;
  /** The stock menu number, as the phone shows it while scrolling: "4-2-1". */
  readonly number: string;
  readonly children: readonly TreeNode[];
}

/** The menu as a tree of paths, labels and menu numbers. */
export function menuTree(menu: PhoneMenu): readonly TreeNode[] {
  const build = (entry: MenuEntry, parentPath: string, parentNumber: string): TreeNode => {
    const path = `${parentPath}/${entry.slug.value}`;
    const number =
      parentNumber === "" ? String(entry.order.value) : `${parentNumber}-${entry.order.value}`;
    const children =
      entry instanceof SubmenuEntry
        ? entry.children.entries.map((child) => build(child, path, number))
        : [];
    return { path, label: entry.label.replace(/\s+/g, " ").trim(), number, children };
  };
  return menu.entries.map((slot) => build(slot.entry, "menu", ""));
}

/** The paths above `path` in the menu, nearest last: "menu/a/b/c" → ["menu/a", "menu/a/b"]. */
export function ancestorPaths(path: string): string[] {
  const segments = path.split("/");
  const ancestors: string[] = [];
  for (let i = 2; i < segments.length; i++) ancestors.push(segments.slice(0, i).join("/"));
  return ancestors;
}

/** Every node in the tree, depth first. */
export function countNodes(nodes: readonly TreeNode[]): number {
  return nodes.reduce((sum, node) => sum + 1 + countNodes(node.children), 0);
}
