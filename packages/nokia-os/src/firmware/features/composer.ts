// Composer (Tones › Composer, 5-4-1 … 5-4-7; plan 27): each slot's editor (D1), the slots named by
// their saved tones (D13), and the saved tones' EEPROM record (D7). One StockComposer and one
// cursor blink per phone (per EEPROM).
import { COMPOSER_RECORD, COMPOSER_SLOTS, StockComposer } from "../../composer/store";
import { composerEditor, type ComposerBlink, type ComposerServices } from "../../widgets/composer";
import type { EepromRecord, StockEeprom } from "../eeprom";
import { timelineByName } from "../timelines";
import type { ScreenBinding, StockFeature, StockServices } from "./feature";

/** The Composer level (Tones › Composer) and its slots. */
const COMPOSER_LEVEL = "5-4";

const composers = new WeakMap<StockEeprom, StockComposer>();
const blinks = new WeakMap<StockEeprom, ComposerBlink>();

/** The phone's Composer (its saved tones over its EEPROM, the new tone's tempo). */
export function composerOf(services: Pick<StockServices, "eeprom">): StockComposer {
  let found = composers.get(services.eeprom);
  if (found === undefined) {
    found = new StockComposer(services.eeprom);
    composers.set(services.eeprom, found);
  }
  return found;
}

function composerServices(services: StockServices): ComposerServices {
  let blink = blinks.get(services.eeprom);
  if (blink === undefined) {
    // Task 0: the blink flag starts shown at power-on.
    blink = { shown: true, used: false };
    blinks.set(services.eeprom, blink);
  }
  return {
    composer: composerOf(services),
    now: () => services.games.now(),
    sounder: services.sounder,
    settings: services.settings,
    blink,
    timelines: {
      saved: timelineByName("composer-tone-saved"),
      done: timelineByName("composer-tempo-done"),
    },
  };
}

const slotScreen =
  (slot: number): ScreenBinding =>
  (services) => {
    const composer = composerServices(services);
    return () => composerEditor(composer, slot);
  };

export const composerFeature: StockFeature = {
  name: "composer",
  screens: Object.fromEntries(
    Array.from({ length: COMPOSER_SLOTS }, (_, i) => [
      `${COMPOSER_LEVEL}-${i + 1}`,
      slotScreen(i + 1),
    ]),
  ),
  // D13: a slot shows its saved tone's name, else the tree's `(empty)`.
  levelLabels: {
    [COMPOSER_LEVEL]: (services) => {
      const composer = composerOf(services);
      return (order) => composer.slot(order)?.name;
    },
  },
  // Restore factory settings empties every slot (K13).
  records: [COMPOSER_RECORD as EepromRecord<unknown>],
};
