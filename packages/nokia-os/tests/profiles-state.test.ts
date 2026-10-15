// Plan 17 Task 5: the active profile as stored state (D1), Tones following it, the profiles'
// names (D2), persistence and Restore factory settings (D12).
import { describe, expect, it } from "vite-plus/test";
import {
  ACTIVE_PROFILE_KEY,
  activateProfile,
  activeProfile,
  PROFILE_SLUGS,
  profileAlias,
  profileName,
  renameProfile,
  type ProfileSlug,
} from "../src/firmware/features/profiles";
import { StockEeprom } from "../src/firmware/eeprom";
import {
  createStockSettings,
  SETTINGS_RECORD,
  stockPageValue,
  virginSettings,
} from "../src/firmware/settings";
import { createMemoryStorage, STOCK_STORAGE_PREFIX, type StockStorage } from "../src/index";

const RECORD_KEY = `${STOCK_STORAGE_PREFIX}settings`;

function persistent(storage: StockStorage = createMemoryStorage()) {
  return { storage, settings: createStockSettings(new StockEeprom(storage)) };
}

/** Every Tones key that has a Personalise counterpart (all but Composer). */
const TONES_KEYS = Object.keys(virginSettings().aliases).filter((key) => key.startsWith("tones/"));

describe("the active profile (D1)", () => {
  it("is General on the virgin EEPROM", () => {
    const { settings } = persistent();
    expect(activeProfile(settings)).toBe("general");
    expect(settings.choice(ACTIVE_PROFILE_KEY)).toBeNull();
    expect(virginSettings().choices[ACTIVE_PROFILE_KEY]).toEqual({ options: 6, chosen: null });
  });

  it("decodes a record without the key (plan 15's) as General", () => {
    const storage = createMemoryStorage();
    storage.setItem(
      RECORD_KEY,
      '{"version":1,"choices":{"profiles/general/personalise/keypad-tones":3}}',
    );
    const { settings } = persistent(storage);
    expect(activeProfile(settings)).toBe("general");
    expect(settings.choice("tones/keypad-tones")).toBe(3);
  });

  it("is stored at once and survives a new store over the same storage", () => {
    const { storage, settings } = persistent();
    activateProfile(settings, "loud");
    expect(activeProfile(settings)).toBe("loud");
    expect(JSON.parse(storage.getItem(RECORD_KEY)!).choices).toEqual({ [ACTIVE_PROFILE_KEY]: 3 });
    expect(activeProfile(persistent(storage).settings)).toBe("loud");
  });

  it("lists the six v6.39 slots in order (D13: no Meeting, Outdoor or Pager)", () => {
    expect(PROFILE_SLUGS).toEqual(["general", "silent", "discreet", "loud", "empty", "empty-2"]);
  });
});

describe("Tones are the active profile's Personalise settings (D1)", () => {
  it("routes every Tones key but Composer to the active profile", () => {
    expect(TONES_KEYS).toHaveLength(9);
    expect(TONES_KEYS).not.toContain("tones/composer");
    for (const slug of PROFILE_SLUGS) {
      for (const key of TONES_KEYS) {
        expect(profileAlias(key, slug)).toBe(
          `profiles/${slug}/personalise/${key.slice("tones/".length)}`,
        );
      }
    }
    expect(profileAlias("profiles/silent/personalise/keypad-tones", "loud")).toBe(
      "profiles/silent/personalise/keypad-tones",
    );
  });

  it("reads and writes the active profile's settings, and the others keep their own", () => {
    const { settings } = persistent();
    settings.restoreFactory();
    const factory = (slug: ProfileSlug) =>
      stockPageValue(settings, `profiles/${slug}/personalise/keypad-tones`);
    for (const slug of PROFILE_SLUGS) {
      activateProfile(settings, slug);
      expect(stockPageValue(settings, "tones/keypad-tones"), slug).toBe(factory(slug));
    }
    activateProfile(settings, "silent");
    expect(stockPageValue(settings, "tones/incoming-call-alert")).toBe("Off");
    settings.choose("tones/keypad-tones", 3); // P2: Tones › Keypad tones → Level 3
    expect(stockPageValue(settings, "profiles/silent/personalise/keypad-tones")).toBe("Level 3");
    expect(stockPageValue(settings, "profiles/general/personalise/keypad-tones")).toBe("Level 2");
    activateProfile(settings, "general");
    expect(stockPageValue(settings, "tones/keypad-tones")).toBe("Level 2");
    expect(settings.label("tones/incoming-call-alert")).toBe("Ringing");
  });

  it("stores a Tones write under the active profile's key", () => {
    const { storage, settings } = persistent();
    activateProfile(settings, "discreet");
    settings.choose("tones/warning-tones", 1);
    expect(JSON.parse(storage.getItem(RECORD_KEY)!).choices).toEqual({
      [ACTIVE_PROFILE_KEY]: 2,
      "profiles/discreet/personalise/warning-tones": 1,
    });
  });
});

describe("profile names (D2)", () => {
  it("are the Rename texts; General's is constant; the virgin slot 6 is two boxes", () => {
    const { settings } = persistent();
    expect(PROFILE_SLUGS.map((slug) => profileName(settings, slug))).toEqual([
      "General",
      "Silent",
      "Discreet",
      "Loud",
      "(empty)",
      "",
    ]);
  });

  it("renames a profile, ten characters at most", () => {
    const { storage, settings } = persistent();
    renameProfile(settings, "silent", "Silenth");
    expect(profileName(settings, "silent")).toBe("Silenth");
    expect(stockPageValue(settings, "profiles/silent/personalise/rename")).toBe("Silenth");
    renameProfile(settings, "empty-2", "Discreetad");
    expect(profileName(persistent(storage).settings, "empty-2")).toBe("Discreetad");
    expect(() => renameProfile(settings, "loud", "Loudloudlou")).toThrow(/10/);
    expect(() => renameProfile(settings, "general", "Mine")).toThrow(/General/);
  });

  it("restores the slot's factory name for an empty name (P6)", () => {
    const { settings } = persistent();
    settings.restoreFactory();
    for (const slug of PROFILE_SLUGS.slice(1)) {
      renameProfile(settings, slug, "Ab");
      renameProfile(settings, slug, "");
      expect(profileName(settings, slug)).toBe(
        { silent: "Silent", discreet: "Discreet", loud: "Loud" }[slug as string] ?? "(empty)",
      );
    }
  });
});

describe("Restore factory settings (D12, P7)", () => {
  it("makes General active, resets the names and gives slot 6 (empty)", () => {
    const { storage, settings } = persistent();
    activateProfile(settings, "empty-2");
    renameProfile(settings, "silent", "Silenth");
    renameProfile(settings, "empty-2", "Ab");
    settings.restoreFactory();
    expect(activeProfile(settings)).toBe("general");
    expect(profileName(settings, "silent")).toBe("Silent");
    expect(profileName(settings, "empty-2")).toBe("(empty)");
    expect(stockPageValue(settings, "tones/keypad-tones")).toBe("Level 2");
    const again = persistent(storage).settings;
    expect(activeProfile(again)).toBe("general");
    expect(profileName(again, "empty-2")).toBe("(empty)");
  });

  it("keeps the record's shape: the factory record decodes to itself", () => {
    const { settings, storage } = persistent();
    settings.restoreFactory();
    const stored = JSON.parse(storage.getItem(RECORD_KEY)!);
    const { version: _version, ...value } = stored;
    expect(SETTINGS_RECORD.decode(value, 1)).toEqual(value);
    expect(value.texts).toEqual({ "profiles/empty-2/personalise/rename": "(empty)" });
  });
});
