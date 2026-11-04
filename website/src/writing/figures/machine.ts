// The pure parts of the figures: the menu tree a StateMachine draws, where the phone's focus is in
// it, and the key sequences a KeyReplay plays. No phone code: the figures load that lazily.
import type { PhoneKey, ScreenModel } from "@hellotimber/phone-core";

/** A tree node as a firmware gives it (`Firmware.tree`). */
export interface TreeSource {
  readonly number: string;
  readonly slug: string;
  readonly label: string;
  readonly children?: readonly TreeSource[];
}

/** One state in the diagram: a menu node and the phone path that is it. */
export interface MachineNode {
  readonly path: string;
  readonly label: string;
  /** The menu number the LCD shows in its corner: "3-1". */
  readonly number: string;
  readonly children: readonly MachineNode[];
}

/** The firmware's tree as phone paths, `depth` levels deep (1: the top level only). */
export function machineTree(tree: readonly TreeSource[], depth: number): MachineNode[] {
  const build = (node: TreeSource, parent: string, level: number): MachineNode => {
    const path = `${parent}/${node.slug}`;
    return {
      path,
      label: node.label.replace(/\s+/g, " ").trim(),
      number: node.number,
      children:
        level < depth ? (node.children ?? []).map((child) => build(child, path, level + 1)) : [],
    };
  };
  return tree.map((node) => build(node, "menu", 1));
}

function findNode(nodes: readonly MachineNode[], path: string): MachineNode | undefined {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (path.startsWith(`${node.path}/`)) return findNode(node.children, path);
  }
  return undefined;
}

/**
 * Where the phone's attention is, as a path in `tree`: the carousel's highlighted item, the
 * selected row of a submenu, else the screen it's on. `standby` at standby; `off` before power.
 */
export function focusPath(
  phone: { readonly path: string; readonly screen: ScreenModel },
  tree: readonly MachineNode[],
): string {
  const { path, screen } = phone;
  if (screen.kind === "off" || screen.kind === "boot") return "off";
  if (screen.kind === "menu-carousel") return tree[screen.menuNumber - 1]?.path ?? "menu";
  if (screen.kind === "list") {
    const row = findNode(tree, path)?.children[screen.selected];
    if (row !== undefined) return row.path;
  }
  return path;
}

/** `path` and every node above it: `menu/a/b` → `menu`, `menu/a`, `menu/a/b`. */
export function pathAndAncestors(path: string): string[] {
  const parts = path.split("/");
  return parts.map((_, i) => parts.slice(0, i + 1).join("/"));
}

const KEYS: readonly PhoneKey[] = [
  "navi",
  "c",
  "up",
  "down",
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "*",
  "#",
];

/** One press of a recorded sequence: the key and how long it's held. */
export interface RecordedPress {
  readonly key: PhoneKey;
  readonly holdMs: number;
}

/** A short press; a long one (`c:long`) is held past the firmware's long-press threshold. */
const SHORT_MS = 120;
const LONG_MS = 1200;

/** `"navi down down navi c:long"` → presses. Throws on a key the phone doesn't have. */
export function parseKeys(sequence: string): RecordedPress[] {
  return sequence
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      const [key, hold] = token.split(":");
      if (!KEYS.includes(key as PhoneKey)) throw new Error(`"${key}" isn't a phone key.`);
      if (hold !== undefined && hold !== "long") throw new Error(`"${token}": only ":long" holds.`);
      return { key: key as PhoneKey, holdMs: hold === "long" ? LONG_MS : SHORT_MS };
    });
}

/** What a key is called on the phone, for keycaps and labels. */
export function keyName(key: PhoneKey): string {
  switch (key) {
    case "navi":
      return "Navi";
    case "c":
      return "C";
    case "up":
      return "▲";
    case "down":
      return "▼";
    case "power":
      return "Power";
    default:
      return key;
  }
}

/** A KeyReplay's place in its sequence: `next` presses have been sent. */
export interface ReplayState {
  readonly next: number;
  readonly playing: boolean;
}

export type ReplayAction = "play" | "pause" | "step" | "reset";

export const REPLAY_START: ReplayState = { next: 0, playing: false };

/** The replay after `action` on a sequence of `length` presses; it stops by itself at the end. */
export function replay(state: ReplayState, action: ReplayAction, length: number): ReplayState {
  switch (action) {
    case "reset":
      return REPLAY_START;
    case "pause":
      return { ...state, playing: false };
    case "play":
      // Playing from the end starts over.
      return state.next >= length ? { next: 0, playing: true } : { ...state, playing: true };
    case "step": {
      const next = Math.min(length, state.next + 1);
      return { next, playing: state.playing && next < length };
    }
  }
}
