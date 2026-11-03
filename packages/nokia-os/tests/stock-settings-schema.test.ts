// Plan 32 Phase 0: the handset registers the settings and records it needs itself, and a tree's
// option lists bind to them. The stock firmware must compose to exactly the schema it had before
// that split: the same virgin settings (keys, option counts, chosen values, texts, numbers,
// aliases), the same option labels, the same record keys, the same EEPROM records (by name: their order only orders independent writes) and the same
// factory state. The file snapshot was written before the registry existed.
import { describe, expect, it } from "vite-plus/test";
import { firmwareRecords } from "../src/firmware/records";
import { createMemorySettings, settingsRecordKeys, virginSettings } from "../src/firmware/settings";
import { STOCK_FIRMWARE } from "../src/firmware/stock";

describe("the stock settings schema", () => {
  it("is the schema the stock firmware had before the handset registry", async () => {
    const records = firmwareRecords(STOCK_FIRMWARE);
    const virgin = virginSettings(STOCK_FIRMWARE);
    // Every single choice's option labels, through a store: each option chosen in turn.
    const store = createMemorySettings(virgin, STOCK_FIRMWARE);
    const labels = Object.fromEntries(
      Object.entries(virgin.choices).map(([key, { options }]) => [
        key,
        Array.from({ length: options }, (_, index) => {
          store.choose(key, index);
          return store.label(key) ?? null;
        }),
      ]),
    );
    const schema = {
      virgin,
      labels,
      recordKeys: settingsRecordKeys(STOCK_FIRMWARE),
      records: [...records]
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
        .map((record) => {
          const initial = record.initial();
          return {
            name: record.name,
            version: record.version,
            initial: record.encode(initial),
            factory: record.factory === undefined ? null : record.encode(record.factory(initial)),
          };
        }),
    };
    await expect(`${JSON.stringify(schema, null, 2)}\n`).toMatchFileSnapshot(
      "__snapshots__/stock-settings-schema.json",
    );
  });
});
