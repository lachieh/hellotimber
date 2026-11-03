// The stock v6.39 firmware: the stock handset and the generated tree with every feature of
// features/index.ts composed over it (`firmware.ts`). A node, key or text two features bind throws here, when the module
// loads. The other exports are STOCK_FIRMWARE's tables and lookups under their pre-composition
// names, for tests and tools that read the stock firmware.
import * as FEATURES from "./features/index";
import type { StockFeature } from "./features/feature";
import { byName, composeFirmware, type Firmware } from "./firmware";
import { STOCK_TREE } from "./generated/stock-tree";
import { STOCK_HANDSET } from "./handset";

/** Every registered feature, sorted by name (list tables concatenate in this order). */
export const STOCK_FEATURES: readonly StockFeature[] = byName(Object.values(FEATURES));

/** The stock v6.39 firmware. */
export const STOCK_FIRMWARE: Firmware = composeFirmware({
  handset: STOCK_HANDSET,
  tree: STOCK_TREE,
  features: STOCK_FEATURES,
});

/** Same-as subtrees (plan 14 S6). Equal to the importer's table (coverage guard). */
export const SAME_AS = STOCK_FIRMWARE.sameAs;
/** Leaves that open a later plan's placeholder. Equal to the importer's table (coverage guard). */
export const PLACEHOLDER_OWNERS = STOCK_FIRMWARE.placeholders;
export const SCREENS = STOCK_FIRMWARE.screens;
export const LEADS = STOCK_FIRMWARE.leads;
export const PROMPT_LAYOUTS = STOCK_FIRMWARE.promptLayouts;
export const NOTE_STYLES = STOCK_FIRMWARE.noteStyles;
export const EXIT_LEVELS = STOCK_FIRMWARE.exitLevels;
export const LEVEL_BARS = STOCK_FIRMWARE.levelBars;
export const STOCK_SETTINGS = STOCK_FIRMWARE.settings;

export const { placeholderOwner, optionListNumbering, promptLayout, noteTimelineId, settingAlias } =
  STOCK_FIRMWARE;
