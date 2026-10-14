// The stock v6.39 menu (plan 14 D4): the generated tree (`generated/stock-tree.ts`) as phone-core
// entries. Submenus keep their presentation, soft key, opening selection, page values and game
// splash; leaves open stock widget flows or the placeholder of the plan that owns them
// (`leaves.ts`, `bindings.ts`).
import {
  ApplicationEntry,
  MenuLevel,
  MenuOrder,
  MenuSlug,
  PhoneMenu,
  SubmenuEntry,
  TopLevelEntry,
  type MenuEntry,
  type SubmenuOptions,
} from "@hellotimber/phone-core";
import { stockMenuGraphic } from "../resources";
import {
  HOST_VALUES,
  settingKey,
  setterLevel,
  TIME_FORMAT,
  twelveHourClock,
  type StockPorts,
} from "./bindings";
import { STOCK_TREE, type StockTreeNode } from "./generated/stock-tree";
import { LeafBinder, type LeafPlace } from "./leaves";
import {
  createMemorySettings,
  stockPageValue,
  virginSettings,
  type StockSettings,
} from "./settings";

interface Builder {
  readonly ports: StockPorts;
  readonly settings: StockSettings;
  readonly leaves: LeafBinder;
}

/**
 * The value a stock page shows: the host's for the Clock pages (the clock in the chosen Time
 * format), else the settings' (D9).
 */
function pageDetail(key: string, ports: StockPorts, settings: StockSettings): string | undefined {
  const port = HOST_VALUES[key];
  if (port === undefined) return stockPageValue(settings, key);
  const value = ports[port]?.();
  const twelveHour = settings.choice(TIME_FORMAT.key) === TIME_FORMAT.twelveHour;
  return port === "clock" && twelveHour && value !== undefined ? twelveHourClock(value) : value;
}

/**
 * The siblings ▲/▼ select after a child's note is dismissed (P6), on pages levels only (see
 * `LeafPlace.moves`); circular, like the level.
 */
function movesOf(parent: StockTreeNode | undefined, index: number): LeafPlace["moves"] | undefined {
  const siblings = parent?.children;
  if (parent === undefined || siblings === undefined) return undefined;
  if (parent.opens.kind !== "submenu" || parent.opens.presentation !== "pages") return undefined;
  const count = siblings.length;
  return {
    up: siblings[(index + count - 1) % count]!.slug,
    down: siblings[(index + 1) % count]!.slug,
  };
}

function entryOf(path: readonly StockTreeNode[], index: number, b: Builder): MenuEntry {
  const node = path[path.length - 1]!;
  const parent = path[path.length - 2];
  const slug = new MenuSlug(node.slug);
  const order = new MenuOrder(Number(node.number.split("-").at(-1)));
  const spec = node.opens;
  if (spec.kind !== "submenu") {
    const moves = movesOf(parent, index);
    const place: LeafPlace = { path, ...(moves === undefined ? {} : { moves }) };
    const setter = parent === undefined ? undefined : setterLevel(parent.number);
    const setterIndex = setter?.indexOf(node.slug) ?? -1;
    const application =
      setterIndex >= 0
        ? b.leaves.setter(place, settingKey(path.slice(0, -1)), setterIndex)
        : b.leaves.application(place);
    return new ApplicationEntry(slug, order, node.label, application);
  }

  const children = (node.children ?? []).map((child, i) => entryOf([...path, child], i, b));
  const key = settingKey(path);
  const setter = setterLevel(node.number);
  const bySlug = (s: string | undefined) => children.find((child) => child.slug.value === s);
  const opening =
    setter !== undefined
      ? () => {
          const chosen = b.settings.choice(key);
          return bySlug(chosen === null ? undefined : setter[chosen]);
        }
      : spec.opening !== undefined
        ? () => bySlug(spec.opening)
        : undefined;
  const options: SubmenuOptions = {
    presentation: spec.presentation,
    softkey: spec.softkey,
    ...(spec.presentation === "pages"
      ? {
          detail: (child: MenuEntry) =>
            pageDetail(`${key}/${child.slug.value}`, b.ports, b.settings),
        }
      : {}),
    ...(opening === undefined ? {} : { opening }),
    ...(spec.intro ? { intro: b.leaves.intro(node, path.map((n) => n.slug).join("/")) } : {}),
  };
  return new SubmenuEntry(slug, order, node.label, new MenuLevel(children), undefined, options);
}

/**
 * The stock menu, with Clock pages reading `ports` for their clock and date values and the other
 * pages, option lists and setters reading and writing `settings` (default: a fresh store in the
 * virgin-EEPROM state).
 */
export function createStockMenu(
  ports: StockPorts = {},
  settings: StockSettings = createMemorySettings(virginSettings()),
): PhoneMenu {
  const builder: Builder = { ports, settings, leaves: new LeafBinder(settings) };
  return new PhoneMenu(
    STOCK_TREE.map(
      (node, i) => new TopLevelEntry(entryOf([node], i, builder), stockMenuGraphic(node.slug)),
    ),
  );
}

/** The whole v6.39 menu tree (no host ports, its own virgin settings store). */
export const stockMenu: PhoneMenu = createStockMenu();
