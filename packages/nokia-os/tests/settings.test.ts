// The internal stock settings store (plan 14 Task 8, D9) and its virgin-EEPROM state (D10).
import { describe, expect, it } from "vite-plus/test";
import { settingAlias } from "../src/firmware/bindings";
import {
  createMemorySettings,
  stockPageValue,
  virginSettings,
  type StockSettingsSnapshot,
} from "../src/firmware/settings";

const SNAPSHOT: StockSettingsSnapshot = {
  choices: {
    "tones/ringing-volume": { options: 5, chosen: null },
    "phone-book/options/type-of-view": { options: 3, chosen: 2 },
  },
  marks: { "messages/info-service/language": [true, false, true] },
  texts: { "tones/ringing-volume": "Level 1", "messages/voice-mailbox-number": "793000333" },
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
    expect(b.choice("phone-book/options/type-of-view")).toBe(2);
    expect(b.marks("messages/info-service/language")).toEqual([true, false, true]);
    expect(SNAPSHOT.choices["phone-book/options/type-of-view"]!.chosen).toBe(2);
    expect(SNAPSHOT.marks["messages/info-service/language"]).toEqual([true, false, true]);
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
      "games/snake/top-score": "45",
      "games/pairs-ii/puzzle/top-score": "0",
      "games/snake/score-ids/last-score-id": "ç",
      "games/snake/score-ids/top-score-id": "ÆG",
      "games/settings/club-nokia-id": "T",
      "messages/info-service": "Off",
    });
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
