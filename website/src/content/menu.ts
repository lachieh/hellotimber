import { missedCalls, projects, roles } from "./call-register";
import { chatMessages } from "./chat";
import { clock } from "./clock";
import { diverts } from "./divert";
import { inbox } from "./messages";
import { phonebook } from "./phonebook";
import { nowItems } from "./reminders";
import type { SiteNode } from "./types";

/**
 * THE menu tree (plan 07): the verified Nokia 3310 menu — 13 top-level menus
 * in manual order (docs/specs/nokia-3310.md §5) — with the portfolio content
 * injected and website metadata (`web`) attached. Everything derives from
 * this one structure: the handset menus (via `toMenuNodes`), the URL space,
 * per-path <head> metadata, content panels, and the sitemap.
 */

function reader(id: string, label: string, body: string): SiteNode {
  return { type: "reader", id, label, body };
}

/** Telephony-only submenu placeholder, kept for authentic menu shape. */
function stub(id: string, label: string): SiteNode {
  return reader(id, label, `${label}: not available. No network connection.`);
}

const chatBody =
  chatMessages.map((m) => `${m.who === "them" ? ">" : "<"} ${m.nickname}: ${m.text}`).join("\n") ||
  "No chat history.";

export const siteMenu: SiteNode[] = [
  {
    type: "submenu",
    id: "phone-book",
    label: "Phone book",
    iconId: "phone-book",
    web: { description: "Contact details: email, GitHub, LinkedIn, CV.", panel: "phone-book" },
    children: [
      {
        type: "list",
        id: "search",
        label: "Search",
        items: phonebook.map((c) => ({
          id: c.id,
          label: c.label,
          body: `${c.label}: ${c.value}`,
        })),
      },
      stub("service-nos", "Service Nos."),
      stub("add-name", "Add name"),
      stub("erase", "Erase"),
      stub("edit", "Edit"),
      stub("assign-tone", "Assign tone"),
      stub("send-bcard", "Send b'card"),
      stub("options", "Options"),
      stub("speed-dials", "Speed dials"),
      stub("voice-tags", "Voice tags"),
    ],
  },
  {
    type: "submenu",
    id: "messages",
    label: "Messages",
    iconId: "messages",
    web: { description: "About me, in SMS form.", panel: "messages" },
    children: [
      {
        type: "app",
        id: "write",
        label: "Write messages",
        appId: "write-message",
        web: { description: "Send a message.", panel: "write" },
      },
      {
        type: "list",
        id: "inbox",
        label: "Inbox",
        items: inbox.map((m) => ({ id: m.id, label: m.label, body: m.text })),
        web: { description: "Short intros.", panel: "inbox" },
      },
      { type: "list", id: "outbox", label: "Outbox", items: [] },
      stub("picture-messages", "Picture messages"),
      stub("templates", "Templates"),
      stub("smileys", "Smileys"),
      stub("message-settings", "Message settings"),
      stub("info-service", "Info service"),
      stub("voice-mailbox-number", "Voice mailbox number"),
      stub("service-command-editor", "Service command editor"),
    ],
  },
  {
    type: "reader",
    id: "chat",
    label: "Chat",
    body: chatBody,
    web: { description: "What people say.", panel: "chat" },
  },
  {
    type: "submenu",
    id: "call-register",
    label: "Call register",
    iconId: "call-register",
    web: { description: "Work history and projects.", panel: "call-register" },
    children: [
      {
        type: "list",
        id: "missed-calls",
        label: "Missed calls",
        items: missedCalls.map((m) => ({ id: m.id, label: m.label, body: m.note })),
      },
      {
        type: "list",
        id: "received-calls",
        label: "Received calls",
        items: roles.map((r) => ({
          id: r.id,
          label: `${r.org} ${r.period}`,
          body: `${r.title}. ${r.summary}`,
        })),
      },
      {
        type: "list",
        id: "dialled-numbers",
        label: "Dialled numbers",
        items: projects.map((p) => ({
          id: p.id,
          label: p.name,
          body: `${p.blurb} (${p.year})`,
        })),
      },
      stub("erase-recent-call-lists", "Erase recent call lists"),
      stub("show-call-duration", "Show call duration"),
      stub("show-call-costs", "Show call costs"),
      stub("call-cost-settings", "Call cost settings"),
      stub("prepaid-credit", "Prepaid credit"),
    ],
  },
  {
    type: "submenu",
    id: "tones",
    label: "Tones",
    iconId: "tones",
    web: { description: "Sound settings and ringtones.", panel: "tones" },
    children: [
      // Working apps declared directly in data (plan 07 kills patchNode).
      { type: "app", id: "ringing-tone", label: "Ringing tone", appId: "ringing-tone" },
      stub("ringing-volume", "Ringing volume"),
      stub("incoming-call-alert", "Incoming call alert"),
      stub("composer", "Composer"),
      stub("message-alert-tone", "Message alert tone"),
      { type: "app", id: "keypad-tones", label: "Keypad tones", appId: "keypad-tones" },
      stub("warning-and-game-tones", "Warning and game tones"),
      stub("vibrating-alert", "Vibrating alert"),
      { type: "app", id: "screen-saver", label: "Screen saver", appId: "screen-saver" },
    ],
  },
  {
    type: "submenu",
    id: "settings",
    label: "Settings",
    iconId: "settings",
    web: {
      description: "Phone settings: keypad tones, backlight, welcome note.",
      panel: "settings",
    },
    children: [
      // Stub readers 6-1/6-3 show the authentic spec §5 child lists.
      reader(
        "call-settings",
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
      {
        type: "submenu",
        id: "phone-settings",
        label: "Phone settings",
        children: [
          { type: "app", id: "welcome-note", label: "Welcome note", appId: "welcome-note" },
          { type: "app", id: "lights", label: "Lights", appId: "lights" },
        ],
      },
      reader(
        "security-settings",
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
      stub("restore-factory-settings", "Restore factory settings"),
    ],
  },
  {
    type: "submenu",
    id: "call-divert",
    label: "Call divert",
    iconId: "call-divert",
    web: { description: "External profiles.", panel: "call-divert" },
    children: [
      ...diverts.map(
        (d): SiteNode => ({
          type: "action",
          id: d.id,
          label: d.label,
          action: { kind: "href", value: d.href },
        }),
      ),
      stub("cancel-all-diverts", "Cancel all diverts"),
    ],
  },
  {
    type: "submenu",
    id: "games",
    label: "Games",
    iconId: "games",
    web: { description: "Snake II and more.", panel: "games" },
    children: [
      {
        type: "app",
        id: "snake",
        label: "Snake II",
        appId: "snake",
        web: { description: "Play Snake.", panel: "snake" },
      },
      stub("space-impact", "Space Impact"),
      stub("bantumi", "Bantumi"),
      stub("pairs-ii", "Pairs II"),
    ],
  },
  {
    type: "app",
    id: "calculator",
    label: "Calculator",
    appId: "calculator",
    web: { description: "A working 3310 calculator.", panel: "calculator" },
  },
  {
    type: "list",
    id: "reminders",
    label: "Reminders",
    items: nowItems.map((n) => ({ id: n.id, label: n.label, body: n.detail })),
    web: { description: "What I'm doing now.", panel: "reminders" },
  },
  {
    type: "reader",
    id: "clock",
    label: "Clock",
    body: `${clock.availability} (${clock.timeZone})`,
    web: { description: "My local time and availability.", panel: "clock" },
  },
  {
    type: "list",
    id: "profiles",
    label: "Profiles",
    items: [
      { id: "general", label: "General", body: "Profile: General (active)." },
      { id: "silent", label: "Silent", body: "Profile: Silent." },
      { id: "discreet", label: "Discreet", body: "Profile: Discreet." },
      { id: "loud", label: "Loud", body: "Profile: Loud." },
      { id: "empty", label: "(empty)", body: "Replace with a profile you have received." },
    ],
    web: { description: "Visitor modes.", panel: "profiles" },
  },
  {
    type: "reader",
    id: "sim-services",
    label: "SIM services",
    body: "SIM services: page not found. This phone accepts no SIM cards from strangers.",
    web: { description: "No service.", panel: "sim-services", noindex: true },
  },
];
