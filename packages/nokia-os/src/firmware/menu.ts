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
import type { StockGames } from "../widgets/snake";
import {
  HOST_VALUES,
  settingKey,
  setterLevel,
  showsEntryIndicator,
  SNAKE_LEVEL,
  STOCK_SHORTCUT_WINDOW_MS,
  TIME_FORMAT,
  twelveHourClock,
  type StockPorts,
} from "./bindings";
import { NO_CUES } from "./cues";
import { STOCK_TREE, type StockTreeNode } from "./generated/stock-tree";
import { LeafBinder, type LeafPlace } from "./leaves";
import { seedFromClock } from "../games/snake/seed";
import {
  createMemorySettings,
  stockPageValue,
  virginSettings,
  type StockSettings,
} from "./settings";

interface Builder {
  readonly ports: StockPorts;
  readonly settings: StockSettings;
  readonly games: StockGames;
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

function entryOf(
  path: readonly StockTreeNode[],
  index: number,
  b: Builder,
  orderOffset = 0,
): MenuEntry {
  const node = path[path.length - 1]!;
  const parent = path[path.length - 2];
  const slug = new MenuSlug(node.slug);
  const order = new MenuOrder(Number(node.number.split("-").at(-1)) + orderOffset);
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

  // Snake II's level: Continue heads it while a game is suspended (plan 23 D10); the tree's
  // children follow it (orders 2..7, slugs unchanged), numbered by position.
  const snake = node.number === SNAKE_LEVEL.number;
  const continueEntry = snake
    ? new ApplicationEntry(
        new MenuSlug(SNAKE_LEVEL.continue.slug),
        new MenuOrder(1),
        SNAKE_LEVEL.continue.label,
        b.leaves.snakeContinue(path),
      )
    : undefined;
  const children = [
    ...(continueEntry === undefined ? [] : [continueEntry]),
    ...(node.children ?? []).map((child, i) => entryOf([...path, child], i, b, snake ? 1 : 0)),
  ];
  const key = settingKey(path);
  const setter = setterLevel(node.number);
  const bySlug = (s: string | undefined) => children.find((child) => child.slug.value === s);
  const opening =
    continueEntry !== undefined
      ? () => (b.games.snake === undefined ? undefined : continueEntry)
      : setter !== undefined
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
    ...(continueEntry === undefined
      ? {}
      : { shown: (child: MenuEntry) => child !== continueEntry || b.games.snake !== undefined }),
    ...(spec.intro ? { intro: b.leaves.intro(node, path.map((n) => n.slug).join("/")) } : {}),
    ...(showsEntryIndicator(node.number) ? { entryIndicatorMs: STOCK_SHORTCUT_WINDOW_MS } : {}),
  };
  return new SubmenuEntry(slug, order, node.label, new MenuLevel(children), undefined, options);
}

/**
 * A phone's games holder: no suspended game, New game seeded from the clock port's minutes of
 * the day (D4 fallback, UNVERIFIED; 0 without a clock), no cue sink, and a clock that reads 0
 * unless the phone supplies the kernel time.
 */
export function createStockGames(ports: StockPorts = {}, now: () => number = () => 0): StockGames {
  return {
    snake: undefined,
    seed: () => seedFromClock(ports.clock?.()) ?? 0,
    cues: NO_CUES,
    now,
  };
}

/**
 * The stock menu, with Clock pages reading `ports` for their clock and date values, the other
 * pages, option lists and setters reading and writing `settings` (default: a fresh store in the
 * virgin-EEPROM state), and the games keeping their suspended game in `games` (default: fresh).
 */
export function createStockMenu(
  ports: StockPorts = {},
  settings: StockSettings = createMemorySettings(virginSettings()),
  games: StockGames = createStockGames(ports),
): PhoneMenu {
  const builder: Builder = { ports, settings, games, leaves: new LeafBinder(settings, games) };
  return new PhoneMenu(
    STOCK_TREE.map(
      (node, i) => new TopLevelEntry(entryOf([node], i, builder), stockMenuGraphic(node.slug)),
    ),
  );
}

/** The whole v6.39 menu tree (no host ports, its own virgin settings store). */
export const stockMenu: PhoneMenu = createStockMenu();
