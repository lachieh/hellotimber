// A firmware's menu (plan 14 D4): its tree (the stock v6.39 one: `generated/stock-tree.ts`) as
// phone-core entries. Submenus keep their presentation, soft key, opening selection, page values
// and game splash; leaves open stock widget flows, a feature's screens or the placeholder of the
// plan that owns them (`leaves.ts`, `firmware.ts`, `features/`).
import { normaliseSim, type NormalisedSimCard, type StockSimCard } from "../phone-book/sim-card";
import { simServicesEntry } from "./features/sim-services";
import { StockPhoneBook } from "@hellotimber/phone-services/phone-book/store";
import {
  ApplicationEntry,
  MenuGraphic,
  MenuLevel,
  MenuOrder,
  MenuSlug,
  PhoneMenu,
  SubmenuEntry,
  TopLevelEntry,
  type MenuEntry,
  type SubmenuOptions,
} from "@hellotimber/phone-core";
import {
  RECEIVE_LINK_MS,
  SEND_LINK_MS,
  stockMenuGraphic,
} from "@hellotimber/nokia-kit/ui/resources";
import type { StockServices } from "./features/feature";
import { createStockGames, type StockGames } from "./features/games";
import type { StockTreeNode } from "./generated/stock-tree";
import type { Firmware } from "./firmware";
import { LeafBinder, type LeafPlace } from "./leaves";
import { createMemoryStorage, StockEeprom } from "./eeprom";
import type { StockPorts } from "@hellotimber/nokia-kit/system/ports";
import { StockSecurity } from "@hellotimber/nokia-kit/system/security";
import { createStockSettings, stockPageValue, type StockSettings } from "./settings";
import { firmwareRecords } from "./records";
import { STOCK_FIRMWARE } from "./stock";
import { settingKey } from "./tree";
import { SoundSequencer } from "@hellotimber/nokia-kit/ui/sound/sequencer";
import { StockSounder } from "@hellotimber/nokia-kit/system/sounder";
import {
  createSyntheticNetwork,
  type StockNetworkPort,
} from "@hellotimber/phone-services/messaging/network";
import { StockMessaging, type MessagingLinks } from "@hellotimber/phone-services/messaging/service";
import { StockMessages } from "@hellotimber/phone-services/messaging/store";
import { SET_1_CENTRE_KEY } from "./features/messages";
import { NO_T9_VIRGIN_CHOICES } from "../messages/bindings";
import { stockT9, type StockT9 } from "@hellotimber/nokia-kit/system/t9/service";

/** The first-digit dots turn into the menu number 2948 ms after Menu (menu/01-phone-book.anim). */
export const STOCK_SHORTCUT_WINDOW_MS = 2948;

interface Builder {
  readonly firmware: Firmware;
  readonly ports: StockPorts;
  readonly settings: StockSettings;
  readonly services: StockServices;
  readonly leaves: LeafBinder;
}

/**
 * The value a stock page shows: the host's where a feature reads it (the Clock pages: the clock
 * in the chosen Time format), else the settings' (D9).
 */
function pageDetail(key: string, b: Builder): string | undefined {
  const host = b.firmware.settings.hostValues[key];
  return host === undefined
    ? stockPageValue(b.settings, key, b.firmware)
    : host(b.ports, b.settings);
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
    const setter = parent === undefined ? undefined : b.firmware.setterLevel(parent.number);
    const setterIndex = setter?.indexOf(node.slug) ?? -1;
    const application =
      setterIndex >= 0
        ? b.leaves.setter(place, settingKey(path.slice(0, -1)), setterIndex)
        : b.leaves.application(place);
    return new ApplicationEntry(slug, order, node.label, application);
  }

  // A feature's lead entry heads the level while it is shown, and the level opens on it then
  // (Snake II's Continue, plan 23 D10); the tree's children follow it (orders 2.., slugs
  // unchanged), numbered by position. A lead `after` a child follows that child instead (plan
  // 18c: Topics' Add topic after Select).
  const lead = b.firmware.leads[node.number];
  const treeChildren = node.children ?? [];
  const leadAt =
    lead?.after === undefined ? 0 : treeChildren.findIndex((c) => c.slug === lead.after) + 1;
  if (lead?.after !== undefined && leadAt === 0) {
    throw new Error(`${node.number}: no child "${lead.after}" for its lead to follow.`);
  }
  const leadEntry =
    lead === undefined
      ? undefined
      : new ApplicationEntry(
          new MenuSlug(lead.slug),
          new MenuOrder(leadAt + 1),
          lead.label,
          b.leaves.lead(path, lead),
        );
  const children = treeChildren.map((child, i) =>
    entryOf([...path, child], i, b, leadEntry !== undefined && i >= leadAt ? 1 : 0),
  );
  if (leadEntry !== undefined) children.splice(leadAt, 0, leadEntry);
  const key = settingKey(path);
  const setter = b.firmware.setterLevel(node.number);
  const bySlug = (s: string | undefined) => children.find((child) => child.slug.value === s);
  // A feature's level options (plan 17: the Profiles level shows the stored names and opens on
  // the active profile).
  const level = b.firmware.levels[node.number]?.(b.services);
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
            pageDetail(`${key}/${child.slug.value}`, b),
        }
      : {}),
    ...(opening === undefined ? {} : { opening }),
    ...(lead === undefined && level?.shown === undefined
      ? {}
      : {
          shown: (child: MenuEntry) =>
            child === leadEntry
              ? b.leaves.leadShown(lead!)
              : (level?.shown?.(child.slug.value) ?? true),
        }),
    ...(spec.intro ? { intro: b.leaves.intro(node, path.map((n) => n.slug).join("/")) } : {}),
    ...(b.firmware.showsEntryIndicator(node.number)
      ? { entryIndicatorMs: STOCK_SHORTCUT_WINDOW_MS }
      : {}),
    ...(level?.label === undefined
      ? {}
      : { label: (child: MenuEntry) => level.label!(child.slug.value, child.order.value) }),
  };
  return new SubmenuEntry(slug, order, node.label, new MenuLevel(children), undefined, options);
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
  phoneBook?: StockPhoneBook,
  sim?: NormalisedSimCard,
): PhoneMenu {
  const services = stockServices(
    ports,
    settings,
    games,
    security,
    sounder,
    eeprom,
    messaging,
    t9,
    phoneBook,
    sim,
  );
  return firmwareMenu(services, sim);
}

/**
 * The menu of `services.firmware` over one phone's services: its tree's top level as the
 * carousel, each node with its own graphic or its slug's stock icon, and (plan 30 D5) SIM
 * services after it when the firmware has the slot and `sim` has a toolkit.
 */
export function firmwareMenu(services: StockServices, sim?: NormalisedSimCard): PhoneMenu {
  const builder: Builder = {
    firmware: services.firmware,
    ports: services.ports,
    settings: services.settings,
    services,
    leaves: new LeafBinder(services),
  };
  const { tree, simServices } = services.firmware;
  const entries = tree.map(
    (node, i) =>
      new TopLevelEntry(
        entryOf([node], i, builder),
        node.graphic === undefined
          ? stockMenuGraphic(node.slug)
          : new MenuGraphic(node.slug, node.graphic.timeline),
      ),
  );
  // Plan 30 D5: a SIM with a toolkit adds SIM services (stock: Menu 14) after the last item.
  const toolkit = sim?.toolkit;
  return new PhoneMenu(
    toolkit === undefined || simServices === undefined
      ? entries
      : [...entries, simServicesEntry(toolkit, services, simServices)],
  );
}

/**
 * Plan 30 D5: the stock menu for the inserted SIM: `stockMenu`, and SIM services (Menu 14) when
 * the SIM has a toolkit. Validates the SIM as `createStockPhone` does (throws naming the field).
 */
export function stockMenuFor(sim: string | StockSimCard): PhoneMenu {
  const card = normaliseSim(sim);
  const eeprom = new StockEeprom(createMemoryStorage());
  return createStockMenu(
    {},
    undefined,
    undefined,
    undefined,
    undefined,
    eeprom,
    undefined,
    undefined,
    undefined,
    card,
  );
}

/**
 * What feature bindings see: `createStockMenu`'s services, its defaults filled in over `eeprom`,
 * running `firmware` (default the stock firmware; a default settings store is that firmware's).
 */
export function stockServices(
  ports: StockPorts,
  settings: StockSettings | undefined,
  games: StockGames,
  security: StockSecurity | undefined,
  sounder: StockSounder | undefined,
  eeprom: StockEeprom,
  messaging?: StockMessaging,
  t9: StockT9 = stockT9(eeprom),
  phoneBook?: StockPhoneBook,
  sim?: NormalisedSimCard,
  firmware: Firmware = STOCK_FIRMWARE,
): StockServices {
  const store =
    settings ?? createStockSettings(eeprom, t9.english ? {} : NO_T9_VIRGIN_CHOICES, firmware);
  const sound = sounder ?? new StockSounder(new SoundSequencer(() => {}), store, () => games.now());
  const code =
    security ??
    new StockSecurity(new StockEeprom(createMemoryStorage(), firmwareRecords(firmware)), store);
  return {
    firmware,
    ports,
    settings: store,
    games,
    security: code,
    sounder: sound,
    noteSound: (lines) => sound.note(lines),
    eeprom,
    messaging:
      messaging ?? stockMessaging(eeprom, store, sim ?? code.sim, createSyntheticNetwork()),
    t9,
    phoneBook: phoneBook ?? new StockPhoneBook(eeprom, sim ?? normaliseSim(code.sim)),
  };
}

/** The synthetic cell's SMS link times (plan 18 D9), as captured. */
export const STOCK_MESSAGE_LINKS: MessagingLinks = {
  sendMs: SEND_LINK_MS,
  receiveMs: RECEIVE_LINK_MS,
};

/**
 * A phone's messaging: `sim`'s messages over `eeprom` (plan 30: the SIM's own until the phone
 * first writes them), Set 1's centre from `settings`.
 */
export function stockMessaging(
  eeprom: StockEeprom,
  settings: StockSettings,
  sim: string | NormalisedSimCard,
  network: StockNetworkPort,
): StockMessaging {
  const centre = () => settings.text(SET_1_CENTRE_KEY) ?? "";
  return new StockMessaging(new StockMessages(eeprom, sim), network, {
    links: STOCK_MESSAGE_LINKS,
    centre,
  });
}

/** The whole v6.39 menu tree (no host ports, its own virgin settings store). */
export const stockMenu: PhoneMenu = createStockMenu();
