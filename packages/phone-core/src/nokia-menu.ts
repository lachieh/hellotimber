import type { MenuNode } from "./types";

/** A content entry surfaced as a list item that opens as a reader. */
export interface ContentItem {
  id: string; // kebab-case, stable
  label: string;
  body: string;
}

/** One line of the Chat (Menu 3) conversation: '>' them, '<' Lachlan. */
export interface ChatLine {
  who: "them" | "me";
  text: string;
}

/** A Call divert target — becomes an href action node. */
export interface DivertTarget {
  id: string;
  label: string;
  href: string;
}

/** Portfolio content injected into the authentic 3310 menu tree. */
export interface Nokia3310Content {
  /** Phone book → Search entries (contact cards). */
  phonebook: ContentItem[];
  /** Messages → Inbox ("SMS" intros). */
  inbox: ContentItem[];
  /** Messages → Outbox (optional). */
  outbox?: ContentItem[];
  /** Chat (Menu 3): testimonials as a chat session. */
  chat: ChatLine[];
  /** Call register 4-1 Missed calls ("ones that got away"). */
  missedCalls: ContentItem[];
  /** Call register 4-2 Received calls (roles held). */
  receivedCalls: ContentItem[];
  /** Call register 4-3 Dialled numbers (projects shipped). */
  dialledNumbers: ContentItem[];
  /** Tones → Ringing tone names (optional; defaults provided). */
  ringtones?: string[];
  /** Call divert → external profile links. */
  diverts: DivertTarget[];
  /** Reminders (Menu 10): the "Now" page entries. */
  reminders: ContentItem[];
  /** Clock (Menu 11) reader body — local time / availability blurb (optional). */
  clockNote?: string;
}

function reader(id: string, label: string, body: string): MenuNode {
  return { type: "reader", id, label, body };
}

/** Telephony-only submenu placeholder, kept for authentic menu shape. */
function stub(id: string, label: string): MenuNode {
  return reader(id, label, `${label}: not available. No network connection.`);
}

function kebab(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * The verified Nokia 3310 menu tree (docs/specs/nokia-3310.md §5):
 * 13 top-level menus in manual order, portfolio content injected.
 */
export function nokia3310Menu(content: Nokia3310Content): MenuNode[] {
  const chatBody =
    content.chat.map((l) => `${l.who === "them" ? ">" : "<"} ${l.text}`).join("\n") ||
    "No chat history.";
  const ringtones = content.ringtones ?? ["Nokia tune", "Ring ring", "Grande valse"];

  return [
    {
      type: "submenu",
      id: "phone-book",
      label: "Phone book",
      iconId: "phone-book",
      children: [
        { type: "list", id: "search", label: "Search", items: content.phonebook },
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
      children: [
        { type: "app", id: "write", label: "Write messages", appId: "write-message" },
        { type: "list", id: "inbox", label: "Inbox", items: content.inbox },
        { type: "list", id: "outbox", label: "Outbox", items: content.outbox ?? [] },
        stub("picture-messages", "Picture messages"),
        stub("templates", "Templates"),
        stub("smileys", "Smileys"),
        stub("message-settings", "Message settings"),
        stub("info-service", "Info service"),
        stub("voice-mailbox-number", "Voice mailbox number"),
        stub("service-command-editor", "Service command editor"),
      ],
    },
    reader("chat", "Chat", chatBody),
    {
      type: "submenu",
      id: "call-register",
      label: "Call register",
      iconId: "call-register",
      children: [
        { type: "list", id: "missed-calls", label: "Missed calls", items: content.missedCalls },
        {
          type: "list",
          id: "received-calls",
          label: "Received calls",
          items: content.receivedCalls,
        },
        {
          type: "list",
          id: "dialled-numbers",
          label: "Dialled numbers",
          items: content.dialledNumbers,
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
      children: [
        {
          type: "list",
          id: "ringing-tone",
          label: "Ringing tone",
          items: ringtones.map((name) => ({ id: kebab(name), label: name, body: `♪ ${name}` })),
        },
        stub("ringing-volume", "Ringing volume"),
        stub("incoming-call-alert", "Incoming call alert"),
        stub("composer", "Composer"),
        stub("message-alert-tone", "Message alert tone"),
        stub("keypad-tones", "Keypad tones"),
        stub("warning-and-game-tones", "Warning and game tones"),
        stub("vibrating-alert", "Vibrating alert"),
        stub("screen-saver", "Screen saver"),
      ],
    },
    {
      type: "submenu",
      id: "settings",
      label: "Settings",
      iconId: "settings",
      children: [
        stub("call-settings", "Call settings"),
        stub("phone-settings", "Phone settings"),
        stub("security-settings", "Security settings"),
        stub("restore-factory-settings", "Restore factory settings"),
      ],
    },
    {
      type: "submenu",
      id: "call-divert",
      label: "Call divert",
      iconId: "call-divert",
      children: [
        ...content.diverts.map(
          (d): MenuNode => ({
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
      children: [
        { type: "app", id: "snake", label: "Snake II", appId: "snake" },
        stub("space-impact", "Space Impact"),
        stub("bantumi", "Bantumi"),
        stub("pairs-ii", "Pairs II"),
      ],
    },
    { type: "app", id: "calculator", label: "Calculator", appId: "calculator" },
    { type: "list", id: "reminders", label: "Reminders", items: content.reminders },
    reader("clock", "Clock", content.clockNote ?? "Clock not set."),
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
    },
    reader(
      "sim-services",
      "SIM services",
      "SIM services: page not found. This phone accepts no SIM cards from strangers.",
    ),
  ];
}
