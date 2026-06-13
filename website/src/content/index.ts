import type { ChatLine, Nokia3310Content } from "@hellotimber/phone-core";
import { missedCalls, projects, roles } from "./call-register";
import { chatMessages } from "./chat";
import { clock } from "./clock";
import { diverts } from "./divert";
import { inbox, writeMessage } from "./messages";
import { phonebook } from "./phonebook";
import { profileModes } from "./profiles";
import { nowItems } from "./reminders";
import { site } from "./site";

export type * from "./types";
export {
  chatMessages,
  clock,
  diverts,
  inbox,
  missedCalls,
  nowItems,
  phonebook,
  profileModes,
  projects,
  roles,
  site,
  writeMessage,
};

/**
 * Adapter: the rich section modules → phone-core's Nokia3310Content.
 * This is the no-drift seam (VISION): nokia3310Menu(content) builds the
 * handset menus from EXACTLY the data the HTML panels render.
 */
export function nokiaContent(): Nokia3310Content {
  return {
    phonebook: phonebook.map((c) => ({
      id: c.id,
      label: c.label,
      body: `${c.label}: ${c.value}`,
    })),
    inbox: inbox.map((m) => ({ id: m.id, label: m.label, body: m.text })),
    chat: chatMessages.map((m): ChatLine => ({ who: m.who, text: `${m.nickname}: ${m.text}` })),
    missedCalls: missedCalls.map((m) => ({ id: m.id, label: m.label, body: m.note })),
    receivedCalls: roles.map((r) => ({
      id: r.id,
      label: `${r.org} ${r.period}`,
      body: `${r.title}. ${r.summary}`,
    })),
    dialledNumbers: projects.map((p) => ({
      id: p.id,
      label: p.name,
      body: `${p.blurb} (${p.year})`,
    })),
    diverts: diverts.map((d) => ({ id: d.id, label: d.label, href: d.href })),
    reminders: nowItems.map((n) => ({ id: n.id, label: n.label, body: n.detail })),
    clockNote: `${clock.availability} (${clock.timeZone})`,
    // ringtones omitted: nokia3310Menu's defaults ("Nokia tune", "Ring ring",
    // "Grande valse") match the tone ids Task 4 ships.
  };
}

/** The one object both the handset menu and the HTML panels are built from. */
export const content: Nokia3310Content = nokiaContent();
