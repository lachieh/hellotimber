// The internal stock settings store (plan 14 Task 8, D9), its virgin-EEPROM state (D10), and its
// persistent record with the factory state (plan 15 Task 5, D3, D5).
import { describe, expect, it } from "vite-plus/test";
import {
  FACTORY_DEFAULTS,
  PHONE_SECURITY_KEY,
  RESTORE_KEEPS,
  settingAlias,
  WELCOME_NOTE_KEY,
} from "../src/firmware/bindings";
import { StockEeprom } from "../src/firmware/eeprom";
import {
  createMemorySettings,
  createStockSettings,
  SETTINGS_RECORD,
  settingsRecordKeys,
  stockPageValue,
  virginSettings,
  type SettingsOverrides,
  type StockSettingsSnapshot,
} from "../src/firmware/settings";
import { createMemoryStorage, STOCK_STORAGE_PREFIX, type StockStorage } from "../src/index";

const SNAPSHOT: StockSettingsSnapshot = {
  choices: {
    "tones/ringing-volume": { options: 5, chosen: null },
    "phone-book/options/type-of-view": { options: 3, chosen: 2 },
  },
  marks: { "messages/info-service/language": [true, false, true] },
  texts: { "tones/ringing-volume": "Level 1", "messages/voice-mailbox-number": "793000333" },
  numbers: { "games/snake/level": 175, "games/snake/top-score": 45 },
  aliases: { "tones/keypad-tones": "tones/ringing-volume" },
};

describe("createMemorySettings", () => {
  it("returns the initial state: null for a choice never written, marks, texts", () => {
    const settings = createMemorySettings(SNAPSHOT);
    expect(settings.choice("tones/ringing-volume")).toBeNull();
    expect(settings.choice("phone-book/options/type-of-view")).toBe(2);
    expect(settings.marks("messages/info-service/language")).toEqual([true, false, true]);
    expect(settings.text("messages/voice-mailbox-number")).toBe("793000333");
    expect(settings.text("phone-book/options/type-of-view")).toBeUndefined();
  });

  it("writes a choice, which replaces the key's virgin display text", () => {
    const settings = createMemorySettings(SNAPSHOT);
    settings.choose("tones/ringing-volume", 2);
    expect(settings.choice("tones/ringing-volume")).toBe(2);
    expect(settings.text("tones/ringing-volume")).toBeUndefined();
  });

  it("validates choices and names unknown keys", () => {
    const settings = createMemorySettings(SNAPSHOT);
    expect(() => settings.choose("tones/ringing-volume", 5)).toThrow(
      'Setting "tones/ringing-volume" has 5 options; got index 5.',
    );
    expect(() => settings.choose("tones/ringing-volume", -1)).toThrow(/got index -1/);
    expect(() => settings.choose("tones/ringing-volume", 1.5)).toThrow(/got index 1.5/);
    expect(() => settings.choice("tones/nope")).toThrow('No single-choice setting "tones/nope".');
    expect(() => settings.marks("tones/ringing-volume")).toThrow(
      'No multi-select setting "tones/ringing-volume".',
    );
  });

  it("toggles one mark at a time and validates the index", () => {
    const settings = createMemorySettings(SNAPSHOT);
    settings.toggle("messages/info-service/language", 1);
    settings.toggle("messages/info-service/language", 0);
    expect(settings.marks("messages/info-service/language")).toEqual([false, true, true]);
    expect(() => settings.toggle("messages/info-service/language", 3)).toThrow(
      'Setting "messages/info-service/language" has 3 options; got index 3.',
    );
  });

  it("reads and writes an aliased key through its target", () => {
    const settings = createMemorySettings(SNAPSHOT);
    expect(settings.choice("tones/keypad-tones")).toBeNull();
    expect(settings.text("tones/keypad-tones")).toBe("Level 1");
    settings.choose("tones/keypad-tones", 3);
    expect(settings.choice("tones/ringing-volume")).toBe(3);
  });

  it("keeps separate instances apart, and never mutates the snapshot", () => {
    const a = createMemorySettings(SNAPSHOT);
    const b = createMemorySettings(SNAPSHOT);
    a.choose("phone-book/options/type-of-view", 0);
    a.toggle("messages/info-service/language", 0);
    a.setNumber("games/snake/level", 3);
    expect(b.choice("phone-book/options/type-of-view")).toBe(2);
    expect(b.marks("messages/info-service/language")).toEqual([true, false, true]);
    expect(b.number("games/snake/level")).toBe(175);
    expect(SNAPSHOT.choices["phone-book/options/type-of-view"]!.chosen).toBe(2);
    expect(SNAPSHOT.marks["messages/info-service/language"]).toEqual([true, false, true]);
    expect(SNAPSHOT.numbers["games/snake/level"]).toBe(175);
  });

  it("reads and writes numeric values (plan 23 D9)", () => {
    const settings = createMemorySettings(SNAPSHOT);
    expect(settings.number("games/snake/level")).toBe(175);
    settings.setNumber("games/snake/level", 1);
    settings.setNumber("games/snake/top-score", 105);
    expect(settings.number("games/snake/level")).toBe(1);
    expect(settings.number("games/snake/top-score")).toBe(105);
  });

  it("validates numbers as non-negative integers and names unknown keys", () => {
    const settings = createMemorySettings(SNAPSHOT);
    expect(() => settings.setNumber("games/snake/level", 1.5)).toThrow(
      'Setting "games/snake/level" takes a non-negative integer; got 1.5.',
    );
    expect(() => settings.setNumber("games/snake/level", -1)).toThrow(/got -1/);
    expect(() => settings.number("games/nope")).toThrow('No numeric setting "games/nope".');
    expect(() => settings.setNumber("games/nope", 1)).toThrow('No numeric setting "games/nope".');
  });
});

describe("virgin-EEPROM settings (D10)", () => {
  const virgin = virginSettings();

  it("opens option lists on their captured value; unset lists are null with a page hint", () => {
    expect(virgin.choices["phone-book/options/type-of-view"]).toEqual({ options: 3, chosen: 2 });
    expect(virgin.choices["profiles/general/personalise/ringing-volume"]).toEqual({
      options: 5,
      chosen: null,
    });
    expect(virgin.texts["profiles/general/personalise/ringing-volume"]).toBe("Level 1");
    // Shakes opens on On while its page reads `1 player` (uninitialised game EEPROM).
    expect(virgin.choices["games/settings/shakes"]).toEqual({ options: 2, chosen: 1 });
    expect(virgin.texts["games/settings/shakes"]).toBe("1 player");
  });

  it("keeps multi-select marks and free-text values as captured", () => {
    expect(virgin.marks["messages/info-service/language"]!.slice(0, 3)).toEqual([
      true,
      true,
      false,
    ]);
    expect(virgin.texts).toMatchObject({
      "messages/message-settings/set-1/message-centre-number": "+1234567890",
      "messages/voice-mailbox-number": "793000333",
      "phone-book/options/memory-status/free": "50 free",
      "phone-book/options/memory-status/used": "0 in use",
      "games/pairs-ii/puzzle/top-score": "0",
      "games/snake/score-ids/last-score-id": "ç",
      "games/snake/score-ids/top-score-id": "ÆG",
      "games/settings/club-nokia-id": "T",
      "messages/info-service": "Off",
    });
  });

  it("stores Snake II's level and top score as numbers: 175 and 45 (plan 23 D2, D9)", () => {
    expect(virgin.numbers).toEqual({ "games/snake/level": 175, "games/snake/top-score": 45 });
    expect(virgin.texts["games/snake/top-score"]).toBeUndefined();
  });

  it("leaves the Clock pages to the host ports", () => {
    expect(virgin.texts["clock/clock-settings"]).toBeUndefined();
    expect(virgin.texts["clock/date-setting"]).toBeUndefined();
  });

  it("shares Tones with the General profile's Personalise settings, and only those (P11)", () => {
    expect(settingAlias("tones/ringing-volume")).toBe(
      "profiles/general/personalise/ringing-volume",
    );
    expect(settingAlias("tones/screen-saver/timeout")).toBe(
      "profiles/general/personalise/screen-saver/timeout",
    );
    expect(settingAlias("profiles/silent/personalise/ringing-volume")).toBe(
      "profiles/silent/personalise/ringing-volume",
    );
    expect(Object.keys(virgin.aliases).sort()).toEqual(
      [
        "tones/incoming-call-alert",
        "tones/keypad-tones",
        "tones/message-alert-tone",
        "tones/ringing-tone",
        "tones/ringing-volume",
        "tones/screen-saver",
        "tones/screen-saver/timeout",
        "tones/vibrating-alert",
        "tones/warning-tones",
      ].sort(),
    );
    // Composer (5-4) has no Personalise counterpart (12-n-2-4 is a hidden number).
    expect(virgin.aliases["tones/composer"]).toBeUndefined();
    const settings = createMemorySettings(virgin);
    settings.choose("tones/ringing-volume", 2);
    expect(stockPageValue(settings, "profiles/general/personalise/ringing-volume")).toBe("Level 3");
    expect(stockPageValue(settings, "profiles/silent/personalise/ringing-volume")).toBe("Level 1");
  });

  it("shows a page's virgin text until its first choice, then the chosen label", () => {
    const settings = createMemorySettings(virgin);
    expect(stockPageValue(settings, "phone-book/options/type-of-view")).toBe("Large font");
    expect(stockPageValue(settings, "tones/ringing-volume")).toBe("Level 1");
    expect(stockPageValue(settings, "games/settings/shakes")).toBe("1 player");
    expect(stockPageValue(settings, "tones/ringing-tone")).toBeUndefined();
    settings.choose("tones/incoming-call-alert", 0);
    expect(stockPageValue(settings, "tones/incoming-call-alert")).toBe("Ringing");
    expect(stockPageValue(settings, "messages/write")).toBeUndefined();
    // Only pages that showed a value in the virgin capture show one.
    expect(stockPageValue(settings, "messages/voice-mailbox-number")).toBeUndefined();
    expect(stockPageValue(settings, "call-register/erase-recent-call-lists")).toBeUndefined();
    settings.choose("games/settings/shakes", 0);
    expect(stockPageValue(settings, "games/settings/shakes")).toBe("Off");
    settings.choose("phone-book/options/type-of-view", 0);
    expect(stockPageValue(settings, "phone-book/options/type-of-view")).toBe("Name list");
  });

  it("stores setter levels as choices: Info service and Screen saver On/Off (Task 12)", () => {
    const virgin = virginSettings();
    expect(virgin.choices["messages/info-service"]).toEqual({ options: 3, chosen: 1 });
    expect(virgin.choices["profiles/general/personalise/screen-saver"]).toEqual({
      options: 2,
      chosen: 0,
    });
    expect(virgin.aliases["tones/screen-saver"]).toBe("profiles/general/personalise/screen-saver");
    const settings = createMemorySettings(virgin);
    expect(stockPageValue(settings, "messages/info-service")).toBe("Off");
    settings.choose("messages/info-service", 0);
    expect(stockPageValue(settings, "messages/info-service")).toBe("On");
    settings.choose("tones/screen-saver", 1);
    expect(stockPageValue(settings, "profiles/general/personalise/screen-saver")).toBe("On");
    expect(stockPageValue(settings, "profiles/silent/personalise/screen-saver")).toBe("Off");
  });
});

// ---------------------------------------------------------------- plan 15 Task 5

const OVERRIDE_KEY = `${STOCK_STORAGE_PREFIX}settings`;

/** A settings store over a fresh EEPROM on `storage`. */
function persistent(storage: StockStorage = createMemoryStorage()) {
  return { storage, settings: createStockSettings(new StockEeprom(storage)) };
}

describe("SETTINGS_RECORD (D3)", () => {
  it("starts with no overrides: the virgin snapshot is the initial state", () => {
    expect(SETTINGS_RECORD.initial()).toEqual({ choices: {}, marks: {}, texts: {}, numbers: {} });
    const { settings } = persistent();
    expect(settings.choice("phone-book/options/type-of-view")).toBe(2);
    expect(settings.number("games/snake/top-score")).toBe(45);
    expect(settings.text("tones/ringing-volume")).toBe("Level 1");
  });

  it("stores only what was written, aliased keys once under their target", () => {
    const { storage, settings } = persistent();
    settings.choose("tones/keypad-tones", 2);
    settings.setNumber("games/snake/top-score", 105);
    expect(storage.getItem(OVERRIDE_KEY)).toBe(
      '{"choices":{"profiles/general/personalise/keypad-tones":2},"marks":{},' +
        '"numbers":{"games/snake/top-score":105},"texts":{},"version":1}',
    );
  });

  it("removes a key's virgin text when its stored choice is loaded, as in memory", () => {
    const storage = createMemoryStorage();
    storage.setItem(
      OVERRIDE_KEY,
      '{"version":1,"choices":{"profiles/general/personalise/ringing-volume":2}}',
    );
    const { settings } = persistent(storage);
    expect(settings.choice("tones/ringing-volume")).toBe(2);
    expect(settings.text("tones/ringing-volume")).toBeUndefined();
    expect(stockPageValue(settings, "tones/ringing-volume")).toBe("Level 3");
  });

  it("drops stale content: unknown keys, indexes out of range, marks of the wrong length", () => {
    const decoded = SETTINGS_RECORD.decode(
      {
        choices: {
          "tones/nope": 1,
          "tones/keypad-tones": 1,
          "profiles/general/personalise/keypad-tones": 4,
          "phone-book/options/type-of-view": 0,
          "games/settings/shakes": 0.5,
        },
        marks: {
          "messages/info-service/language": [true, false],
          "messages/info-service/topics/select": [false, false, false, false, "x"],
        },
        texts: { "settings/phone-settings/welcome-note": "Hi", "nope/text": "x", "tones/x": 3 },
        numbers: { "games/snake/level": 9, "games/snake/top-score": -1, "games/nope": 1 },
      },
      1,
    );
    expect(decoded).toEqual({
      choices: { "phone-book/options/type-of-view": 0 },
      marks: {},
      texts: { "settings/phone-settings/welcome-note": "Hi" },
      numbers: { "games/snake/level": 9 },
    });
  });

  it("throws on a bad shape, which the EEPROM reports with its key", () => {
    expect(() => SETTINGS_RECORD.decode({ choices: [] }, 1)).toThrow(/choices/);
    const storage = createMemoryStorage();
    storage.setItem(OVERRIDE_KEY, '{"version":1,"marks":"x"}');
    expect(() => new StockEeprom(storage)).toThrow(`EEPROM record ${OVERRIDE_KEY}:`);
  });

  it("pins the keys a record can hold (a renamed slug must bump the version)", () => {
    expect(settingsRecordKeys()).toMatchSnapshot();
  });
});

describe("createStockSettings (D3, D11)", () => {
  it("persists every write at once: a second store over the same storage reads it", () => {
    const { storage, settings } = persistent();
    settings.choose("settings/phone-settings/cell-info-display", 0);
    settings.toggle("messages/info-service/language", 1);
    settings.setText(WELCOME_NOTE_KEY, "Hi");
    settings.setNumber("games/snake/level", 3);
    const again = persistent(storage).settings;
    expect(again.choice("settings/phone-settings/cell-info-display")).toBe(0);
    expect(again.marks("messages/info-service/language").slice(0, 2)).toEqual([true, false]);
    expect(again.text(WELCOME_NOTE_KEY)).toBe("Hi");
    expect(again.number("games/snake/level")).toBe(3);
  });

  it("setText writes and, with undefined, clears a text (virgin texts included)", () => {
    const { storage, settings } = persistent();
    expect(settings.text(WELCOME_NOTE_KEY)).toBeUndefined();
    settings.setText(WELCOME_NOTE_KEY, "Welcome to my phone");
    expect(settings.text(WELCOME_NOTE_KEY)).toBe("Welcome to my phone");
    settings.setText(WELCOME_NOTE_KEY, undefined);
    expect(settings.text(WELCOME_NOTE_KEY)).toBeUndefined();
    settings.setText("messages/voice-mailbox-number", undefined);
    expect(persistent(storage).settings.text("messages/voice-mailbox-number")).toBeUndefined();
    expect(() => settings.setText("nope/text", "x")).toThrow('No text setting "nope/text".');
  });

  it("label() is the chosen option's label of a single-choice setting, if chosen", () => {
    const { settings } = persistent();
    expect(settings.label("tones/keypad-tones")).toBeUndefined();
    expect(settings.label("phone-book/options/type-of-view")).toBe("Large font");
    settings.choose("tones/keypad-tones", 2);
    expect(settings.label("tones/keypad-tones")).toBe("Level 2");
    expect(settings.label("messages/info-service")).toBe("Off");
    expect(() => settings.label("nope")).toThrow('No single-choice setting "nope".');
  });

  it("keeps the in-memory rules: validation, aliases, a choice removes the virgin text", () => {
    const { settings } = persistent();
    expect(() => settings.choose("tones/ringing-volume", 5)).toThrow(/has 5 options; got index 5/);
    settings.choose("tones/ringing-volume", 1);
    expect(settings.text("tones/ringing-volume")).toBeUndefined();
    expect(settings.choice("profiles/general/personalise/ringing-volume")).toBe(1);
  });

  it("keeps working in memory when storage refuses writes", () => {
    const base = createMemoryStorage();
    const storage: StockStorage = {
      ...base,
      getItem: (key) => base.getItem(key),
      setItem() {
        throw new Error("QuotaExceededError");
      },
    };
    const { settings } = persistent(storage);
    settings.choose("tones/keypad-tones", 3);
    expect(settings.choice("tones/keypad-tones")).toBe(3);
  });
});

describe("Phone security is a single choice (CODE_SETTINGS)", () => {
  it("stores Off/On, virgin Off, and the page reads it like a setter level", () => {
    const virgin = virginSettings();
    expect(virgin.choices[PHONE_SECURITY_KEY]).toEqual({ options: 2, chosen: 0 });
    const { settings } = persistent();
    expect(stockPageValue(settings, PHONE_SECURITY_KEY)).toBe("Off");
    settings.choose(PHONE_SECURITY_KEY, 1);
    expect(stockPageValue(settings, PHONE_SECURITY_KEY)).toBe("On");
    expect(settings.label(PHONE_SECURITY_KEY)).toBe("On");
  });
});

describe("factory state (D5)", () => {
  const written = (): SettingsOverrides => {
    const { storage, settings } = persistent();
    settings.choose("tones/keypad-tones", 0);
    settings.choose("settings/phone-settings/cell-info-display", 0);
    settings.choose(PHONE_SECURITY_KEY, 1);
    settings.choose("games/settings/shakes", 0);
    settings.toggle("messages/info-service/language", 7);
    settings.setText(WELCOME_NOTE_KEY, "Hi");
    settings.setText("messages/voice-mailbox-number", "123");
    settings.setNumber("games/snake/top-score", 105);
    settings.setNumber("games/snake/level", 3);
    return new StockEeprom(storage).read(SETTINGS_RECORD);
  };

  it("cites a v6.39 capture for every default, and every label is one of its list's", () => {
    for (const entry of FACTORY_DEFAULTS) {
      expect(entry.evidence, entry.key).toBe("v6.39");
      expect(entry.capture, entry.key).toMatch(/^plan15\/factory\/scroll\/[\d-]+\/01\.png$/);
    }
    expect(() => SETTINGS_RECORD.factory!(SETTINGS_RECORD.initial())).not.toThrow();
  });

  it("returns choices and marks to virgin, then applies FACTORY_DEFAULTS", () => {
    const factory = SETTINGS_RECORD.factory!(written());
    const storage = createMemoryStorage();
    const eeprom = new StockEeprom(storage);
    eeprom.write(SETTINGS_RECORD, factory);
    const settings = createStockSettings(eeprom);
    // Factory values that differ from the virgin EEPROM (Task 0 0c).
    expect(settings.label("tones/ringing-tone")).toBe("Nokia tune");
    expect(settings.label("tones/ringing-volume")).toBe("Level 4");
    expect(settings.label("tones/incoming-call-alert")).toBe("Ringing");
    expect(settings.label("tones/message-alert-tone")).toBe("Standard");
    expect(settings.label("tones/keypad-tones")).toBe("Level 2");
    expect(settings.label("tones/warning-tones")).toBe("On");
    expect(settings.label("tones/vibrating-alert")).toBe("On");
    expect(settings.label("tones/screen-saver/timeout")).toBe("5 seconds");
    expect(settings.label("profiles/silent/personalise/incoming-call-alert")).toBe("Off");
    expect(settings.label("profiles/discreet/personalise/message-alert-tone")).toBe("Beep once");
    expect(settings.label("profiles/loud/personalise/ringing-volume")).toBe("Level 5");
    expect(settings.label("profiles/empty/personalise/ringing-tone")).toBe("Get cool");
    expect(settings.label("profiles/empty-2/personalise/screen-saver")).toBe("Off");
    expect(settings.label("profiles/silent/personalise/screen-saver")).toBe("On");
    expect(settings.label("settings/call-settings/own-number-sending")).toBe("Set by network");
    expect(settings.label("call-divert/divert-if-not-answered/set-delay")).toBe("30 seconds");
    expect(settings.marks("messages/info-service/language").filter(Boolean)).toHaveLength(1);
    expect(settings.marks("messages/info-service/language")[0]).toBe(true);
    // Lists with no factory default keep their virgin opening.
    expect(settings.choice("settings/phone-settings/cell-info-display")).toBe(1);
    expect(settings.choice("games/settings/shakes")).toBe(1);
    expect(settings.text("games/settings/shakes")).toBe("1 player");
    expect(settings.choice(PHONE_SECURITY_KEY)).toBe(0);
    expect(stockPageValue(settings, PHONE_SECURITY_KEY)).toBe("Off");
  });

  it("keeps RESTORE_KEEPS (the welcome note, the top score) and resets other texts", () => {
    const factory = SETTINGS_RECORD.factory!(written());
    expect(factory.texts).toEqual({ [WELCOME_NOTE_KEY]: "Hi" });
    expect(factory.numbers).toEqual({ "games/snake/top-score": 105 });
    expect(RESTORE_KEEPS).toEqual([WELCOME_NOTE_KEY, "games/snake/top-score"]);
  });
});
