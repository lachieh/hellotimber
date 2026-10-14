// The stock v6.39 main menu and its level-1 screens (plan 13 "Stock firmware model"). Labels are
// the firmware text as read from the goldens, with firmware line breaks as `\n` (D10); every
// leaf below level 0/1 is a placeholder until a later plan implements it.
import {
  ApplicationEntry,
  MenuLevel,
  MenuOrder,
  MenuSlug,
  PhoneMenu,
  SubmenuEntry,
  TopLevelEntry,
  type MenuEntry,
  type MenuPresentation,
} from "@hellotimber/phone-core";
import { stockMenuGraphic } from "../resources";
import { HOST_VALUES, type StockPorts } from "./bindings";
import { PlaceholderApplication } from "./placeholder";
import {
  createMemorySettings,
  stockPageValue,
  virginSettings,
  type StockSettings,
} from "./settings";

/** A level-1 entry: its label, plus a slug or menu number when they are not derived. */
type ChildSpec = string | { label: string; slug?: string; order?: number };

interface TopSpec {
  slug: string;
  label: string;
  /** Absent for top-level applications (Chat, Calculator). */
  submenu?: { presentation: MenuPresentation; children: readonly ChildSpec[] };
}

const STOCK_LEVELS: readonly TopSpec[] = [
  {
    slug: "phone-book",
    label: "Phone book",
    submenu: {
      presentation: "rows",
      children: [
        "Search",
        "Service Nos.",
        "Add name",
        "Erase",
        "Edit",
        "Assign tone",
        "Send b'card",
        "Options",
        "Speed dials",
        "Voice tags",
      ],
    },
  },
  {
    slug: "messages",
    label: "Messages",
    submenu: {
      presentation: "pages",
      children: [
        { label: "Write\nmessages", slug: "write" },
        "Inbox",
        "Outbox",
        "Picture\nmessages",
        "Templates",
        "Smileys",
        "Message\nsettings",
        "Info\nservice",
        "Voice\nmailbox\nnumber",
        "Service\ncommand\neditor",
      ],
    },
  },
  { slug: "chat", label: "Chat" },
  {
    slug: "call-register",
    label: "Call register",
    submenu: {
      presentation: "pages",
      children: [
        "Missed\ncalls",
        "Received\ncalls",
        "Dialled\nnumbers",
        "Erase recent\ncall lists",
        "Show call\nduration",
        "Show call\ncosts",
        "Call cost\nsettings",
        "Prepaid credit",
      ],
    },
  },
  {
    slug: "tones",
    label: "Tones",
    submenu: {
      presentation: "pages",
      children: [
        "Ringing\ntone",
        "Ringing\nvolume",
        "Incoming\ncall alert",
        "Composer",
        "Message\nalert tone",
        "Keypad\ntones",
        "Warning tones",
        "Vibrating\nalert",
        "Screen saver",
      ],
    },
  },
  {
    slug: "settings",
    label: "Settings",
    submenu: {
      presentation: "pages",
      children: [
        "Call\nsettings",
        "Phone\nsettings",
        "Security\nsettings",
        "Restore\nfactory\nsettings",
      ],
    },
  },
  {
    slug: "call-divert",
    label: "Call divert",
    submenu: {
      presentation: "pages",
      children: [
        "Divert all\nvoice calls\nwithout ringing",
        "Divert\nwhen busy",
        "Divert if not\nanswered",
        "Divert when\nphone off\nor no coverage",
        // Menu number 5 is hidden; the firmware keeps this entry's number 6 (`7-6`).
        { label: "Cancel all\ndiverts", order: 6 },
      ],
    },
  },
  {
    slug: "games",
    label: "Games",
    submenu: {
      presentation: "rows",
      children: [
        { label: "Snake II", slug: "snake" },
        // The firmware writes "Space impact" with a lower-case i.
        "Space impact",
        "Bantumi",
        "Pairs II",
        // Menu number 5 is hidden; the firmware keeps this entry's number 6 (`8-6`).
        { label: "Settings", order: 6 },
      ],
    },
  },
  { slug: "calculator", label: "Calculator" },
  {
    slug: "reminders",
    label: "Reminders",
    submenu: { presentation: "rows", children: ["Add new", "View all", "Erase"] },
  },
  {
    slug: "clock",
    label: "Clock",
    submenu: {
      presentation: "pages",
      children: [
        "Alarm\nclock",
        "Clock\nsettings",
        "Date setting",
        "Stopwatch",
        "Countdown\ntimer",
        "Auto update of\ndate and time",
      ],
    },
  },
  {
    slug: "profiles",
    label: "Profiles",
    submenu: {
      presentation: "rows",
      children: [
        "General",
        "Silent",
        "Discreet",
        "Loud",
        "(empty)",
        // Slot 6 exists (it changes the rail) but its captured name is uninitialised EEPROM;
        // the label is UNVERIFIED until the profiles plan (17).
        { label: "(empty)", slug: "empty-2" },
      ],
    },
  },
];

/** Kebab-case slug of a label: line breaks become spaces, apostrophes vanish (`send-bcard`). */
function slugOf(label: string): string {
  return label
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function placeholder(slug: string, order: number, label: string, path: string): ApplicationEntry {
  return new ApplicationEntry(
    new MenuSlug(slug),
    new MenuOrder(order),
    label,
    new PlaceholderApplication(`placeholder:${path}`, label),
  );
}

/** The value a stock page shows: the host's for the Clock pages, else the settings' (D9). */
function pageDetail(key: string, ports: StockPorts, settings: StockSettings): string | undefined {
  const port = HOST_VALUES[key];
  return port === undefined ? stockPageValue(settings, key) : ports[port]?.();
}

function topEntry(
  spec: TopSpec,
  order: number,
  ports: StockPorts,
  settings: StockSettings,
): MenuEntry {
  if (spec.submenu === undefined) return placeholder(spec.slug, order, spec.label, spec.slug);
  const children = spec.submenu.children.map((child, i) => {
    const { label, slug, order: number } = typeof child === "string" ? { label: child } : child;
    const childSlug = slug ?? slugOf(label);
    return placeholder(childSlug, number ?? i + 1, label, `${spec.slug}/${childSlug}`);
  });
  return new SubmenuEntry(
    new MenuSlug(spec.slug),
    new MenuOrder(order),
    spec.label,
    new MenuLevel(children),
    undefined,
    {
      presentation: spec.submenu.presentation,
      detail: (child) => pageDetail(`${spec.slug}/${child.slug.value}`, ports, settings),
    },
  );
}

/**
 * The stock menu, with Clock pages reading `ports` for their clock and date values and the other
 * pages reading `settings` (default: a fresh store in the virgin-EEPROM state).
 */
export function createStockMenu(
  ports: StockPorts = {},
  settings: StockSettings = createMemorySettings(virginSettings()),
): PhoneMenu {
  return new PhoneMenu(
    STOCK_LEVELS.map(
      (spec, i) =>
        new TopLevelEntry(topEntry(spec, i + 1, ports, settings), stockMenuGraphic(spec.slug)),
    ),
  );
}

/** The 12-entry v6.39 main menu, level-1 screens and placeholder leaves (no host ports). */
export const stockMenu: PhoneMenu = createStockMenu();
