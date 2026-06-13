/**
 * The portfolio content model. STRUCTURE is final; the values in the section
 * modules are SAMPLE DATA until Lachlan supplies real copy (see Task 11).
 */

/** Phone book entry: contact card on the handset, <address> link in HTML. */
export interface ContactEntry {
  id: string; // kebab-case, stable — doubles as the phone list-item id
  label: string; // "Email", "GitHub", …
  value: string; // human-readable: "lachlan@…", "github.com/…"
  href: string; // mailto:/https:/site-relative link target
  rel?: string; // extra rel tokens for the HTML link, e.g. "me"
  download?: boolean; // true for the CV download
}

/** Messages → Inbox: a short about-me "SMS". */
export interface SmsMessage {
  id: string;
  label: string; // sender/subject line in the handset list
  text: string; // body — MUST be ≤160 chars (tested)
  timestamp: string; // ISO 8601, rendered with <time>
}

/** Messages → Write messages: where the multi-tap contact form delivers. */
export interface WriteMessageConfig {
  destinationEmail: string;
  subject: string;
}

/** Chat (Menu 3): one testimonial line. '>' them, '<' Lachlan. */
export interface ChatMessage {
  who: "them" | "me";
  nickname: string; // the 3310 chat name
  text: string;
}

/** Call register → Received calls: a role held. */
export interface Role {
  id: string;
  org: string;
  title: string;
  period: string; // human-readable, e.g. "2022–2024"
  periodStart: string; // ISO for <time dateTime>, e.g. "2022-03"
  summary: string;
}

/** Call register → Dialled numbers: a project shipped. */
export interface Project {
  id: string;
  name: string;
  url?: string;
  blurb: string;
  year: string;
}

/** Call register → Missed calls: playful "ones that got away". */
export interface MissedCall {
  id: string;
  label: string;
  note: string;
}

/** Reminders (Menu 10): a "now" item. */
export interface NowItem {
  id: string;
  label: string;
  detail: string;
}

/** Clock (Menu 11). */
export interface ClockInfo {
  timeZone: string; // IANA, e.g. "Australia/Brisbane"
  availability: string; // one line
}

/** Profiles (Menu 12) — visitor modes, stretch; copy only for now. */
export interface ProfileMode {
  id: string;
  label: string;
  description: string;
}

/** Call divert (Menu 7): literal external redirect. */
export interface DivertLink {
  id: string;
  label: string;
  href: string;
}

/** Site-wide metadata for SEO/JSON-LD. */
export interface SiteMeta {
  url: string; // canonical origin, NO trailing slash
  name: string;
  jobTitle: string;
  description: string; // default meta description
  tagline: string; // short one-liner for the home head + JSON-LD
  sameAs: string[]; // social profile URLs for JSON-LD
}
