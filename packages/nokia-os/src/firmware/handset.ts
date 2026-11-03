// The handset's own settings and records (plan 32 Phase 0): what the phone around the menu reads
// and writes whatever tree it runs (boot, standby, the power key's profiles, sound, lights, the
// clock, calls, messaging, T9). Every firmware composes them (`composeFirmware`): a tree's option
// list, setter level or code setting at one of these keys binds to it and must list the same
// options with the same virgin choice, so the stock tree composes to the settings it always had;
// a tree that lists none of them still gets a working handset. The virgin values are v6.39's.
import type { VirginChoice } from "./features/feature";
import type { Handset } from "./firmware";
import { AUTO_UPDATE } from "./features/clock";
import { CLOCK_RECORD } from "./features/clock/record";
import { TIME_FORMAT } from "./features/clock/service";
import { GAMES_LIGHTS_KEY } from "./features/backlight";
import { SPEED_DIALLING_KEY } from "./features/dialling";
import { ACTIVE_PROFILE_KEY, PROFILE_SLUGS, profileAlias } from "./features/profiles";
import { REMINDERS_RECORD } from "./features/reminders/store";
import { WELCOME_NOTE_KEY } from "./features/settings";
import { PHONE_SECURITY_KEY, SECURITY_RECORD } from "./security";
import { COMPOSER_RECORD, COMPOSER_SLOTS } from "../composer/store";
import { RINGING_TONES } from "../kit/ui/resources";
import { T9_USER_RECORD } from "../kit/system/t9/user";
import { DICTIONARY_KEY, DICTIONARY_LABELS, VIRGIN_DICTIONARY } from "../messages/bindings";
import { CALLS_RECORD } from "../services/calls/log";
import { OWN_NUMBER_SENDING_KEY } from "../services/calls/telephone";
import { MESSAGES_RECORD } from "../services/messaging/store";
import { PHONE_BOOK_RECORD } from "../services/phone-book/store";
import type { EepromRecord } from "../services/storage";
import { GAMES_SHAKES_KEY, GAMES_SOUNDS_KEY } from "../sound/sounder";
import { TYPE_OF_VIEW_KEY } from "../widgets/name-list";

const OFF_ON = ["Off", "On"] as const;
const ON_OFF = ["On", "Off"] as const;

/**
 * A profile's Personalise settings the sounder and standby read (plan 16, plan 17 D1): the
 * options and the virgin choice, the same in every profile. Ringing tone lists the stock tones,
 * then the Composer's slots (plan 27 D8).
 */
const PERSONALISE: readonly (Omit<VirginChoice, "key"> & { readonly slug: string })[] = [
  {
    slug: "ringing-tone",
    labels: [
      ...RINGING_TONES.map((tone) => tone.name),
      ...Array<string>(COMPOSER_SLOTS).fill("(empty)"),
    ],
    chosen: null,
  },
  {
    slug: "ringing-volume",
    labels: ["Level 1", "Level 2", "Level 3", "Level 4", "Level 5"],
    chosen: null,
  },
  {
    slug: "incoming-call-alert",
    labels: ["Ringing", "Ascending", "Ring once", "Beep once", "Off"],
    chosen: null,
  },
  {
    slug: "message-alert-tone",
    labels: ["No tone", "Standard", "Special", "Beep once", "Ascending"],
    chosen: 0,
  },
  { slug: "keypad-tones", labels: ["Off", "Level 1", "Level 2", "Level 3"], chosen: null },
  { slug: "warning-tones", labels: ON_OFF, chosen: null },
  { slug: "vibrating-alert", labels: ON_OFF, chosen: null },
];

const TONES = "tones/";

/** The stock handset: what `createStockPhone` and `createFirmwarePhone` wire around the menu. */
export const STOCK_HANDSET: Handset = {
  settings: {
    choices: [
      // Plan 18b D6: the editor's Dictionary (a phone without a T9 dictionary starts with
      // Dictionary off, `NO_T9_VIRGIN_CHOICES`, D5).
      { key: DICTIONARY_KEY, labels: DICTIONARY_LABELS, chosen: VIRGIN_DICTIONARY },
      // Plan 17 D1: the active profile; never written = General.
      { key: ACTIVE_PROFILE_KEY, labels: PROFILE_SLUGS, chosen: null },
      ...PROFILE_SLUGS.flatMap((profile) =>
        PERSONALISE.map(({ slug, labels, chosen }) => ({
          key: `${profileAlias(TONES, profile)}${slug}`,
          labels,
          chosen,
        })),
      ),
      // Plan 15 D6: the boot asks for the security code while it is On.
      { key: PHONE_SECURITY_KEY, labels: OFF_ON, chosen: 0 },
      // Plan 22: a call's caller identity.
      { key: OWN_NUMBER_SENDING_KEY, labels: ["Set by network", "On", "Off"], chosen: 1 },
      // Plan 22: a held digit at standby speed-dials while it is On.
      { key: SPEED_DIALLING_KEY, labels: ON_OFF, chosen: 1 },
      // Plan 19 D5: standby's ▼ opens the name list in this view.
      { key: TYPE_OF_VIEW_KEY, labels: ["Name list", "Name, number", "Large font"], chosen: 2 },
      // Plan 21 D10, D13: standby's clock format; the update at the end of power-on.
      { key: TIME_FORMAT.key, labels: ["24-hour", "12-hour"], chosen: 0 },
      { key: AUTO_UPDATE.key, labels: ["On", "Confirm first", "Off"], chosen: 2 },
      // Plans 16, 25: the games' cues sound, shake and light by these.
      { key: GAMES_SOUNDS_KEY, labels: OFF_ON, chosen: 1 },
      { key: GAMES_LIGHTS_KEY, labels: OFF_ON, chosen: 1 },
      { key: GAMES_SHAKES_KEY, labels: OFF_ON, chosen: 1 },
    ],
    // Plan 17 D1: Tones are the active profile's Personalise settings (every key under the
    // active profile's prefix has its `tones/` alias). Composer has no Personalise counterpart, so
    // a tree's Tones › Composer keeps its own.
    aliases: [
      {
        prefix: TONES,
        target: (choice) => profileAlias(TONES, PROFILE_SLUGS[choice(ACTIVE_PROFILE_KEY) ?? 0]!),
      },
    ],
    // Plan 15 D9: the boot shows the welcome note (Restore keeps it, `plan15/accept/c4-*`); Restore
    // keeps the Dictionary too (`sms/restore`, plan 18b).
    typedTexts: [WELCOME_NOTE_KEY],
    restoreKeeps: [DICTIONARY_KEY, WELCOME_NOTE_KEY],
  },
  // The security code, the phone's time and alarms, the call register, the SIM's messages, the T9
  // user words, the phone book, the reminders and the Composer's tones (ringing tones 36-42).
  records: [
    SECURITY_RECORD as EepromRecord<unknown>,
    CLOCK_RECORD as EepromRecord<unknown>,
    CALLS_RECORD as EepromRecord<unknown>,
    MESSAGES_RECORD as EepromRecord<unknown>,
    T9_USER_RECORD as EepromRecord<unknown>,
    PHONE_BOOK_RECORD as EepromRecord<unknown>,
    REMINDERS_RECORD as EepromRecord<unknown>,
    COMPOSER_RECORD as EepromRecord<unknown>,
  ],
};
