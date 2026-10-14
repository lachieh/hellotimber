import {
  ActionEntry,
  ApplicationEntry,
  DynamicMenuListSource,
  ListEntry,
  MenuGraphic,
  MenuLevel,
  MenuOrder,
  MenuSlug,
  PhoneMenu,
  ReaderEntry,
  StaticMenuListSource,
  SubmenuEntry,
  TopLevelEntry,
} from "@hellotimber/phone-core";
import type { MenuEntry, MenuListSource, PhoneApplication } from "@hellotimber/phone-core";
import { cannedReply, MAX_HISTORY, MAX_SMS_CHARS } from "../messages/generate-reply";
import { inboxItems, outboxItems } from "../messages/store";
import { ensureThread, receiveRecorded, sendRecorded, threadOf } from "../messages/store";
import { getSettings, updateSettings } from "../settings";
import { CalculatorApplication } from "../phone/applications/calculator";
import { ChatApplication } from "../phone/applications/chat";
import { ConfiguredEditorApplication } from "../phone/applications/editor";
import { PickerApplication } from "../phone/applications/picker";
import { SmsApplication } from "../phone/applications/sms";
import { SnakeApplication } from "../phone/applications/snake";
import { handleSound, playMessageAlert } from "../phone/audio";
import { notifyPhone } from "../phone/notice-binding";
import { TONES } from "../phone/tones";
import { missedCalls, projects, roles } from "./call-register";
import { chatMessages } from "./chat";
import { clock } from "./clock";
import { contactById, contacts } from "./contacts";
import { diverts } from "./divert";
import { phonebook } from "./phonebook";
import { nowItems } from "./reminders";
import type { PanelId, WebMetadata } from "./types";

function indexed(description: string, panel?: PanelId): WebMetadata {
  return { indexing: "index", description, ...(panel === undefined ? {} : { panel }) };
}

function reader(
  slug: string,
  order: number,
  label: string,
  body: string,
  metadata?: WebMetadata,
): ReaderEntry<WebMetadata> {
  return new ReaderEntry(new MenuSlug(slug), new MenuOrder(order), label, body, metadata);
}

function stub(slug: string, order: number, label: string): ReaderEntry<WebMetadata> {
  return reader(slug, order, label, `${label}: not available. No network connection.`);
}

function list(
  slug: string,
  order: number,
  label: string,
  source: MenuListSource,
  metadata?: WebMetadata,
): ListEntry<WebMetadata> {
  return new ListEntry(new MenuSlug(slug), new MenuOrder(order), label, source, metadata);
}

function application(
  slug: string,
  order: number,
  label: string,
  definition: PhoneApplication,
  metadata?: WebMetadata,
): ApplicationEntry<WebMetadata> {
  return new ApplicationEntry(
    new MenuSlug(slug),
    new MenuOrder(order),
    label,
    definition,
    metadata,
  );
}

function submenu(
  slug: string,
  order: number,
  label: string,
  children: readonly MenuEntry<WebMetadata>[],
  metadata?: WebMetadata,
): SubmenuEntry<WebMetadata> {
  return new SubmenuEntry(
    new MenuSlug(slug),
    new MenuOrder(order),
    label,
    new MenuLevel(children),
    metadata,
  );
}

async function sendSms(contactId: string, text: string): Promise<string> {
  const contact = contactById(contactId);
  const history = threadOf(contactId)
    .slice(-MAX_HISTORY)
    .map((entry) => ({ who: entry.who, text: entry.text }));
  try {
    const response = await fetch("/api/sms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contactId, text, history }),
    });
    if (!response.ok) throw new Error(`sms ${response.status}`);
    const data = (await response.json()) as { reply?: unknown };
    if (typeof data.reply !== "string" || data.reply === "") throw new Error("empty reply");
    return data.reply.slice(0, MAX_SMS_CHARS);
  } catch {
    return contact === undefined ? "OK." : cannedReply(contact, history);
  }
}

const smsApplication = new SmsApplication({
  contacts: contacts.map((contact) => ({ id: contact.id, name: contact.name })),
  send: sendSms,
  recordSend: sendRecorded,
  recordReceive: receiveRecorded,
  notify: notifyPhone,
  playAlert: playMessageAlert,
});

const chatApplication = new ChatApplication({
  nickname: "Lachlan",
  thread: () => threadOf("lachlan"),
  seed: () =>
    ensureThread(
      "lachlan",
      chatMessages.map((message) => ({
        who: message.who,
        text: `${message.nickname}: ${message.text}`,
      })),
    ),
  send: (text) => sendSms("lachlan", text),
  recordSend: (text) => sendRecorded("lachlan", text, { chat: true }),
  recordReceive: (text) => receiveRecorded("lachlan", text, { chat: true }),
  playAlert: playMessageAlert,
});

const ringingToneApplication = new PickerApplication("ringing-tone", {
  title: "Ringing tone",
  options: TONES.map((tone) => tone.label),
  selected: () =>
    Math.max(
      0,
      TONES.findIndex((tone) => tone.id === getSettings().ringtone),
    ),
  onPick: (index) => {
    const tone = TONES[index]!;
    updateSettings({ ringtone: tone.id });
    handleSound({ kind: "tone", id: tone.id });
  },
});

const keypadTonesApplication = new PickerApplication("keypad-tones", {
  title: "Keypad tones",
  options: ["On", "Off"],
  selected: () => (getSettings().keypadTones ? 0 : 1),
  onPick: (index) => updateSettings({ keypadTones: index === 0 }),
});

const screenSaverApplication = new PickerApplication("screen-saver", {
  title: "Screen saver",
  options: ["On", "Off"],
  selected: () => (getSettings().screenSaver ? 0 : 1),
  onPick: (index) => updateSettings({ screenSaver: index === 0 }),
});

const lightsApplication = new PickerApplication("lights", {
  title: "Lights",
  options: ["On", "Off"],
  selected: () => (getSettings().backlight ? 0 : 1),
  onPick: (index) => updateSettings({ backlight: index === 0 }),
});

const welcomeNoteApplication = new ConfiguredEditorApplication("welcome-note", {
  title: "Welcome note",
  initial: () => getSettings().welcomeNote,
  onAccept: (text) => updateSettings({ welcomeNote: text.trim() }),
});

const phoneBook = submenu(
  "phone-book",
  1,
  "Phone book",
  [
    list(
      "search",
      1,
      "Search",
      new StaticMenuListSource([
        ...phonebook.map((entry) => ({
          id: entry.id,
          label: entry.label,
          body: `${entry.label}: ${entry.value}`,
        })),
        ...contacts.map((contact) => ({
          id: contact.id,
          label: contact.name,
          body: `${contact.name}: SMS contact. Text via Messages, Write messages.`,
        })),
      ]),
    ),
    stub("service-nos", 2, "Service Nos."),
    stub("add-name", 3, "Add name"),
    stub("erase", 4, "Erase"),
    stub("edit", 5, "Edit"),
    stub("assign-tone", 6, "Assign tone"),
    stub("send-bcard", 7, "Send b'card"),
    stub("options", 8, "Options"),
    stub("speed-dials", 9, "Speed dials"),
    stub("voice-tags", 10, "Voice tags"),
  ],
  indexed("Contact details: email, GitHub, LinkedIn, CV.", "phone-book"),
);

const messages = submenu(
  "messages",
  2,
  "Messages",
  [
    application("write", 1, "Write messages", smsApplication, indexed("Send a message.", "write")),
    list(
      "inbox",
      2,
      "Inbox",
      new DynamicMenuListSource(inboxItems),
      indexed("Short intros.", "inbox"),
    ),
    list("outbox", 3, "Outbox", new DynamicMenuListSource(outboxItems)),
    stub("picture-messages", 4, "Picture messages"),
    stub("templates", 5, "Templates"),
    stub("smileys", 6, "Smileys"),
    stub("message-settings", 7, "Message settings"),
    stub("info-service", 8, "Info service"),
    stub("voice-mailbox-number", 9, "Voice mailbox number"),
    stub("service-command-editor", 10, "Service command editor"),
  ],
  indexed("About me, in SMS form.", "messages"),
);

const chat = application(
  "chat",
  3,
  "Chat",
  chatApplication,
  indexed("What people say — and a live chat.", "chat"),
);

const callRegister = submenu(
  "call-register",
  4,
  "Call register",
  [
    list(
      "missed-calls",
      1,
      "Missed calls",
      new StaticMenuListSource(
        missedCalls.map((call) => ({ id: call.id, label: call.label, body: call.note })),
      ),
    ),
    list(
      "received-calls",
      2,
      "Received calls",
      new StaticMenuListSource(
        roles.map((role) => ({
          id: role.id,
          label: `${role.org} ${role.period}`,
          body: `${role.title}. ${role.summary}`,
        })),
      ),
    ),
    list(
      "dialled-numbers",
      3,
      "Dialled numbers",
      new StaticMenuListSource(
        projects.map((project) => ({
          id: project.id,
          label: project.name,
          body: `${project.blurb} (${project.year})`,
        })),
      ),
    ),
    stub("erase-recent-call-lists", 4, "Erase recent call lists"),
    stub("show-call-duration", 5, "Show call duration"),
    stub("show-call-costs", 6, "Show call costs"),
    stub("call-cost-settings", 7, "Call cost settings"),
    stub("prepaid-credit", 8, "Prepaid credit"),
  ],
  indexed("Work history and projects.", "call-register"),
);

const tones = submenu(
  "tones",
  5,
  "Tones",
  [
    application("ringing-tone", 1, "Ringing tone", ringingToneApplication),
    stub("ringing-volume", 2, "Ringing volume"),
    stub("incoming-call-alert", 3, "Incoming call alert"),
    stub("composer", 4, "Composer"),
    stub("message-alert-tone", 5, "Message alert tone"),
    application("keypad-tones", 6, "Keypad tones", keypadTonesApplication),
    stub("warning-and-game-tones", 7, "Warning and game tones"),
    stub("vibrating-alert", 8, "Vibrating alert"),
    application("screen-saver", 9, "Screen saver", screenSaverApplication),
  ],
  indexed("Sound settings and ringtones.", "tones"),
);

const settings = submenu(
  "settings",
  6,
  "Settings",
  [
    reader(
      "call-settings",
      1,
      "Call settings",
      [
        "Call settings: no network connection.",
        "Automatic redial",
        "Speed dialling",
        "Call waiting options",
        "Own number sending",
        "Phone line in use",
        "Automatic answer",
      ].join("\n"),
    ),
    submenu("phone-settings", 2, "Phone settings", [
      application("welcome-note", 1, "Welcome note", welcomeNoteApplication),
      application("lights", 2, "Lights", lightsApplication),
    ]),
    reader(
      "security-settings",
      3,
      "Security settings",
      [
        "Security settings: no network connection.",
        "PIN code request",
        "Call barring service",
        "Fixed dialling",
        "Closed user group",
        "Security level",
        "Access codes",
      ].join("\n"),
    ),
    stub("restore-factory-settings", 4, "Restore factory settings"),
  ],
  indexed("Phone settings: keypad tones, backlight, welcome note.", "settings"),
);

const github = diverts.find((divert) => divert.id === "github")!;
const linkedin = diverts.find((divert) => divert.id === "linkedin")!;
const x = diverts.find((divert) => divert.id === "x")!;

const callDivert = submenu(
  "call-divert",
  7,
  "Call divert",
  [
    new ActionEntry(new MenuSlug("github"), new MenuOrder(1), github.label, {
      kind: "href",
      value: github.href,
    }),
    new ActionEntry(new MenuSlug("linkedin"), new MenuOrder(2), linkedin.label, {
      kind: "href",
      value: linkedin.href,
    }),
    new ActionEntry(new MenuSlug("x"), new MenuOrder(3), x.label, { kind: "href", value: x.href }),
    stub("cancel-all-diverts", 4, "Cancel all diverts"),
  ],
  indexed("External profiles.", "call-divert"),
);

const games = submenu(
  "games",
  8,
  "Games",
  [
    application("snake", 1, "Snake II", new SnakeApplication(), indexed("Play Snake.", "snake")),
    stub("space-impact", 2, "Space Impact"),
    stub("bantumi", 3, "Bantumi"),
    stub("pairs-ii", 4, "Pairs II"),
  ],
  indexed("Snake II and more.", "games"),
);

const calculator = application(
  "calculator",
  9,
  "Calculator",
  new CalculatorApplication(),
  indexed("A working 3310 calculator.", "calculator"),
);

const reminders = list(
  "reminders",
  10,
  "Reminders",
  new StaticMenuListSource(
    nowItems.map((item) => ({ id: item.id, label: item.label, body: item.detail })),
  ),
  indexed("What I'm doing now.", "reminders"),
);

const clockEntry = reader(
  "clock",
  11,
  "Clock",
  `${clock.availability} (${clock.timeZone})`,
  indexed("My local time and availability.", "clock"),
);

const profiles = list(
  "profiles",
  12,
  "Profiles",
  new StaticMenuListSource([
    { id: "general", label: "General", body: "Profile: General (active)." },
    { id: "silent", label: "Silent", body: "Profile: Silent." },
    { id: "discreet", label: "Discreet", body: "Profile: Discreet." },
    { id: "loud", label: "Loud", body: "Profile: Loud." },
    { id: "empty", label: "(empty)", body: "Replace with a profile you have received." },
  ]),
  indexed("Visitor modes.", "profiles"),
);

const simServices = reader(
  "sim-services",
  13,
  "SIM services",
  "SIM services: page not found. This phone accepts no SIM cards from strangers.",
  { indexing: "noindex", description: "No service.", panel: "sim-services" },
);

export const siteMenu: PhoneMenu<WebMetadata> = new PhoneMenu([
  new TopLevelEntry(phoneBook, new MenuGraphic("phone-book")),
  new TopLevelEntry(messages, new MenuGraphic("messages")),
  new TopLevelEntry(chat, new MenuGraphic("chat")),
  new TopLevelEntry(callRegister, new MenuGraphic("call-register")),
  new TopLevelEntry(tones, new MenuGraphic("tones")),
  new TopLevelEntry(settings, new MenuGraphic("settings")),
  new TopLevelEntry(callDivert, new MenuGraphic("call-divert")),
  new TopLevelEntry(games, new MenuGraphic("games")),
  new TopLevelEntry(calculator, new MenuGraphic("calculator")),
  new TopLevelEntry(reminders, new MenuGraphic("reminders")),
  new TopLevelEntry(clockEntry, new MenuGraphic("clock")),
  new TopLevelEntry(profiles, new MenuGraphic("profiles")),
  new TopLevelEntry(simServices, new MenuGraphic("sim-services")),
]);
