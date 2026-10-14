// Feature bindings see the phone's EEPROM (`StockServices.eeprom`), the one its settings store,
// Restore factory settings and the features' registered records live in.
import { describe, expect, it } from "vite-plus/test";
import { CALCULATOR_RECORD } from "../src/calculator/rate";
import { createMemoryStorage, StockEeprom } from "../src/firmware/eeprom";
import { createStockGames, stockServices } from "../src/firmware/menu";
import { createStockSettings } from "../src/firmware/settings";

describe("StockServices.eeprom", () => {
  it("is the EEPROM the menu was built over, under its default settings store", () => {
    const storage = createMemoryStorage();
    const eeprom = new StockEeprom(storage);
    const services = stockServices(
      {},
      undefined,
      createStockGames({}),
      undefined,
      undefined,
      eeprom,
    );
    expect(services.eeprom).toBe(eeprom);
    expect(storage.getItem("nokia-os/settings")).toBeNull();
    services.settings.choose("tones/warning-tones", 1);
    expect(storage.getItem("nokia-os/settings")).not.toBeNull();
  });

  it("holds the records a feature registers, which Restore factory settings reaches", () => {
    const eeprom = new StockEeprom(createMemoryStorage());
    const settings = createStockSettings(eeprom);
    const services = stockServices(
      {},
      settings,
      createStockGames({}),
      undefined,
      undefined,
      eeprom,
    );
    services.eeprom.write(CALCULATOR_RECORD, { direction: "domestic", rate: "2" });
    services.settings.restoreFactory();
    expect(services.eeprom.read(CALCULATOR_RECORD)).toEqual({ direction: "foreign", rate: "1" });
  });
});
