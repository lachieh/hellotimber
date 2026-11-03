// Lachlan's own firmware for the homepage phone (plan 32 D1, D2): the stock handset, look and
// navigation with a menu tree of his sections. Each section's LCD form comes from its content
// record (D14). Chat and Snake II are the stock features, remounted from their stock places
// (Chat 3, Games 8) to theirs here.
import {
  composeFirmware,
  remountFeature,
  STOCK_FIRMWARE,
  STOCK_HANDSET,
  type Firmware,
  type FirmwareNode,
  type StockFeature,
  type StockTreeNode,
} from "@hellotimber/nokia-os";
import type { Lcd, PageSection, SectionId } from "../content/section";
import { SECTIONS } from "../content/sections";
import { HOME_ICONS } from "./icons";
import { readerPages } from "./lcd";
import { SECTION_SLUGS } from "./routes";

/** Where a link leaf goes: an absolute URL or a site path. */
export type OpenLink = (href: string) => void;

const STOCK_CHAT = "3";
const STOCK_GAMES = "8";
const STOCK_SNAKE = "8-1";

/** `node` and its subtree renumbered from `from` to `to`. */
function renumber(node: StockTreeNode, from: string, to: string): StockTreeNode {
  return {
    ...node,
    number: to + node.number.slice(from.length),
    ...(node.children === undefined
      ? {}
      : { children: node.children.map((child) => renumber(child, from, to)) }),
  };
}

function stockNode(number: string): StockTreeNode {
  return STOCK_FIRMWARE.treePath(number).at(-1)!;
}

function stockFeature(name: string): StockFeature {
  const feature = STOCK_FIRMWARE.features.find((f) => f.name === name);
  if (feature === undefined) throw new Error(`No stock feature "${name}".`);
  return feature;
}

/**
 * The stock Games feature's Snake II part: Continue after a paused game, and Top score's return
 * to New game. The rest binds the games this firmware leaves out (Space impact, Bantumi, Pairs II).
 */
function snakeGames(): StockFeature {
  const games = stockFeature("games");
  const lead = games.leads?.[STOCK_SNAKE];
  const topScore = games.widgets?.noteEnds?.[`${STOCK_SNAKE}-4`];
  if (lead === undefined || topScore === undefined) throw new Error("Stock Games has no Snake II.");
  return {
    name: "games",
    leads: { [STOCK_SNAKE]: lead },
    widgets: { noteEnds: { [`${STOCK_SNAKE}-4`]: topScore } },
  };
}

/** A section's node: reader pages, or a rows list of readers and links. */
function pageNode(section: PageSection, number: string): FirmwareNode {
  const base = { number, slug: SECTION_SLUGS[section.id], label: section.label };
  const graphic = HOME_ICONS[section.id as keyof typeof HOME_ICONS];
  return {
    ...base,
    ...(graphic === undefined ? {} : { graphic }),
    ...lcdNode(section.lcd, number),
  };
}

function lcdNode(lcd: Lcd, number: string): Pick<StockTreeNode, "opens" | "children"> {
  if (lcd.kind === "reader") return { opens: { kind: "text-pages", pages: readerPages(lcd.text) } };
  return {
    opens: { kind: "submenu", presentation: "rows", softkey: "Select" },
    children: lcd.items.map((item, i) => ({
      number: `${number}-${i + 1}`,
      slug: item.slug,
      label: item.label,
      opens:
        item.opens.kind === "reader"
          ? { kind: "text-pages", pages: readerPages(item.opens.text) }
          : // Bound by the links feature: Select opens the link and the list stays.
            { kind: "no-response", lines: [] },
    })),
  };
}

/** The tree: one top-level item per section, in the sections' order. */
function homeTree(): { tree: FirmwareNode[]; links: Record<string, string> } {
  const links: Record<string, string> = {};
  const tree = SECTIONS.map((section, i): FirmwareNode => {
    const number = String(i + 1);
    if (section.kind === "page") {
      if (section.lcd.kind === "list") {
        section.lcd.items.forEach((item, j) => {
          if (item.opens.kind === "link") links[`${number}-${j + 1}`] = item.opens.href;
        });
      }
      return pageNode(section, number);
    }
    if (section.id === "chat") return renumber(stockNode(STOCK_CHAT), STOCK_CHAT, number);
    // Games with Snake II only.
    const games = stockNode(STOCK_GAMES);
    return renumber(
      { ...games, children: games.children!.filter((node) => node.number === STOCK_SNAKE) },
      STOCK_GAMES,
      number,
    );
  });
  return { tree, links };
}

/** The tree position of `section` (its top-level number). */
export function sectionNumber(section: SectionId): string {
  return String(SECTIONS.findIndex((s) => s.id === section) + 1);
}

/** The homepage firmware; its link items call `open`. */
export function homeFirmware(open: OpenLink): Firmware {
  const { tree, links } = homeTree();
  const chat = sectionNumber("chat");
  const games = sectionNumber("snake");
  const linksFeature: StockFeature = {
    name: "home-links",
    screens: Object.fromEntries(
      Object.entries(links).map(([number, href]) => [
        number,
        () => () => {
          open(href);
          return undefined;
        },
      ]),
    ),
  };
  return composeFirmware({
    handset: STOCK_HANDSET,
    tree,
    features: [
      remountFeature(stockFeature("chat"), STOCK_CHAT, chat),
      remountFeature(snakeGames(), STOCK_GAMES, games),
      remountFeature(stockFeature("games-snake"), STOCK_GAMES, games),
      // The stock notes' timelines by text (`Done`): no node numbers to move.
      stockFeature("note-styles"),
      linksFeature,
    ],
  });
}
