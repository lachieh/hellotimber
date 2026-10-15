// The stock v6.39 menu (plan 14 D4): the generated tree (`generated/stock-tree.ts`) as phone-core
// entries. Submenus keep their presentation, soft key, opening selection, page values and game
// splash; leaves open stock widget flows, a feature's screens or the placeholder of the plan that
// owns them (`leaves.ts`, `stock.ts`, `features/`).
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
import { NO_CUES } from "./cues";
import type { StockServices } from "./features/feature";
import { STOCK_TREE, type StockTreeNode } from "./generated/stock-tree";
import { LeafBinder, type LeafPlace } from "./leaves";
import { seedFromClock } from "../games/snake/seed";
import { createMemoryStorage, StockEeprom } from "./eeprom";
import type { StockPorts } from "./ports";
import { StockSecurity } from "./security";
import { createStockSettings, stockPageValue, type StockSettings } from "./settings";
import { LEADS, LEVELS, setterLevel, showsEntryIndicator, STOCK_SETTINGS } from "./stock";
import { settingKey } from "./tree";
import { SoundSequencer } from "../sound/sequencer";
import { StockSounder } from "../sound/sounder";
import { createSyntheticNetwork, type StockNetworkPort } from "../messages/network";
import { StockMessaging } from "../messages/service";
import { StockMessages } from "../messages/store";
import { SET_1_CENTRE_KEY } from "./features/messages";
import { NO_T9_VIRGIN_CHOICES } from "../messages/bindings";
import { stockT9, type StockT9 } from "../text/t9/service";

/** The first-digit dots turn into the menu number 2948 ms after Menu (menu/01-phone-book.anim). */
export const STOCK_SHORTCUT_WINDOW_MS = 2948;

interface Builder {
  readonly ports: StockPorts;
  readonly settings: StockSettings;
  readonly services: StockServices;
  readonly leaves: LeafBinder;
}

/**
 * The value a stock page shows: the host's where a feature reads it (the Clock pages: the clock
 * in the chosen Time format), else the settings' (D9).
 */
function pageDetail(key: string, ports: StockPorts, settings: StockSettings): string | undefined {
  const host = STOCK_SETTINGS.hostValues[key];
  return host === undefined ? stockPageValue(settings, key) : host(ports, settings);
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

  // A feature's lead entry heads the level while it is shown, and the level opens on it then
  // (Snake II's Continue, plan 23 D10); the tree's children follow it (orders 2.., slugs
  // unchanged), numbered by position.
  const lead = LEADS[node.number];
  const leadEntry =
    lead === undefined
      ? undefined
      : new ApplicationEntry(
          new MenuSlug(lead.slug),
          new MenuOrder(1),
          lead.label,
          b.leaves.lead(path, lead),
        );
  const children = [
    ...(leadEntry === undefined ? [] : [leadEntry]),
    ...(node.children ?? []).map((child, i) =>
      entryOf([...path, child], i, b, leadEntry === undefined ? 0 : 1),
    ),
  ];
  const key = settingKey(path);
  const setter = setterLevel(node.number);
  const bySlug = (s: string | undefined) => children.find((child) => child.slug.value === s);
  // A feature's level options (plan 17: the Profiles level shows the stored names and opens on
  // the active profile).
  const level = LEVELS[node.number]?.(b.services);
  const opening =
    level?.opening !== undefined
      ? () => bySlug(level.opening!())
      : lead !== undefined
        ? () => (b.leaves.leadShown(lead) ? leadEntry : undefined)
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
            b.leaves.pageValue(`${key}/${child.slug.value}`) ??
            pageDetail(`${key}/${child.slug.value}`, b.ports, b.settings),
        }
      : {}),
    ...(opening === undefined ? {} : { opening }),
    ...(lead === undefined
      ? {}
      : { shown: (child: MenuEntry) => child !== leadEntry || b.leaves.leadShown(lead) }),
    ...(spec.intro ? { intro: b.leaves.intro(node, path.map((n) => n.slug).join("/")) } : {}),
    ...(showsEntryIndicator(node.number) ? { entryIndicatorMs: STOCK_SHORTCUT_WINDOW_MS } : {}),
    ...(level?.label === undefined
      ? {}
      : { label: (child: MenuEntry) => level.label!(child.slug.value, child.order.value) }),
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
 * pages, option lists and setters reading and writing `settings` (default: a fresh store over
 * `eeprom`), and the games keeping their suspended game in `games` (default: fresh), the
 * security-code leaves verifying against `security` (default: the virgin code, over its own
 * in-memory EEPROM), previews and note tones going to `sounder` (default: a sounder whose
 * sequencer nothing advances: silent), features' records in `eeprom` (default: an empty
 * in-memory EEPROM, the virgin state) and SMS through `messaging` (default: the security's SIM's
 * messages over `eeprom` and a synthetic network nothing ticks), and T9 from `t9` (default: no
 * dictionary, the user words over `eeprom`; plan 18b).
 */
export function createStockMenu(
  ports: StockPorts = {},
  settings?: StockSettings,
  games: StockGames = createStockGames(ports),
  security?: StockSecurity,
  sounder?: StockSounder,
  eeprom: StockEeprom = new StockEeprom(createMemoryStorage()),
  messaging?: StockMessaging,
  t9?: StockT9,
): PhoneMenu {
  const services = stockServices(ports, settings, games, security, sounder, eeprom, messaging, t9);
  const builder: Builder = {
    ports,
    settings: services.settings,
    services,
    leaves: new LeafBinder(services),
  };
  return new PhoneMenu(
    STOCK_TREE.map(
      (node, i) => new TopLevelEntry(entryOf([node], i, builder), stockMenuGraphic(node.slug)),
    ),
  );
}

/** What feature bindings see: `createStockMenu`'s services, its defaults filled in over `eeprom`. */
export function stockServices(
  ports: StockPorts,
  settings: StockSettings | undefined,
  games: StockGames,
  security: StockSecurity | undefined,
  sounder: StockSounder | undefined,
  eeprom: StockEeprom,
  messaging?: StockMessaging,
  t9: StockT9 = stockT9(eeprom),
): StockServices {
  const store = settings ?? createStockSettings(eeprom, t9.english ? {} : NO_T9_VIRGIN_CHOICES);
  const sound = sounder ?? new StockSounder(new SoundSequencer(() => {}), store, () => games.now());
  const code = security ?? new StockSecurity(new StockEeprom(createMemoryStorage()), store);
  return {
    ports,
    settings: store,
    games,
    security: code,
    sounder: sound,
    noteSound: (lines) => sound.note(lines),
    eeprom,
    messaging: messaging ?? stockMessaging(eeprom, store, code.sim, createSyntheticNetwork()),
    t9,
  };
}

/** A phone's messaging: `sim`'s messages over `eeprom`, Set 1's centre from `settings`. */
export function stockMessaging(
  eeprom: StockEeprom,
  settings: StockSettings,
  sim: string,
  network: StockNetworkPort,
): StockMessaging {
  const centre = () => settings.text(SET_1_CENTRE_KEY) ?? "";
  return new StockMessaging(new StockMessages(eeprom, sim), network, centre);
}

/** The whole v6.39 menu tree (no host ports, its own virgin settings store). */
export const stockMenu: PhoneMenu = createStockMenu();
