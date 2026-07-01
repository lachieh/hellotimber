import { contactById } from "../content/contacts";
import { inbox } from "../content/messages";

/**
 * SMS thread store (plan 08): every message the handset sends or receives,
 * keyed by contact id, persisted to localStorage. Same pattern as
 * `src/settings.ts` — module singleton, lazy load, snapshot-notify.
 * SSR-safe: without `window` reads return the seeded state and writes stay
 * in memory.
 */

export interface MessageEntry {
  who: "me" | "them";
  text: string;
  at: number; // epoch ms
  /** Display-label override — used by the seeded sample inbox ("Hello!"). */
  label?: string;
  /** Chat-session entries (Menu 3) stay out of the Inbox/Outbox lists. */
  via?: "chat";
}

export interface MessagesState {
  threads: Record<string, MessageEntry[]>;
  unread: number;
}

/** Pseudo-thread holding the seeded "about me" inbox (not a persona thread). */
const SEED_THREAD = "hellotimber";
const STORAGE_KEY = "hellotimber.messages";

const listeners = new Set<() => void>();
let cached: MessagesState | null = null;

/** First-run state: the sample inbox from content/messages.ts, already read. */
function seedState(): MessagesState {
  return {
    threads: {
      [SEED_THREAD]: inbox.map((m) => ({
        who: "them" as const,
        text: m.text,
        at: Date.parse(m.timestamp),
        label: m.label,
      })),
    },
    unread: 0,
  };
}

function persist(state: MessagesState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage unavailable (SSR/private mode/quota) — state stays in-memory
  }
}

function load(): MessagesState {
  if (typeof window === "undefined") return seedState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw) as Partial<MessagesState>;
      return { threads: parsed.threads ?? {}, unread: parsed.unread ?? 0 };
    }
  } catch {
    // corrupt storage — fall through to a fresh seed
  }
  const seeded = seedState();
  persist(seeded); // seeding happens exactly once per browser
  return seeded;
}

function notify(): void {
  // Snapshot so a listener that unsubscribes mid-notify can't skip siblings.
  // oxlint-disable-next-line no-useless-spread
  for (const listener of [...listeners]) listener();
}

function mutate(fn: (state: MessagesState) => void): void {
  const state = getMessages();
  fn(state);
  persist(state);
  notify();
}

export function getMessages(): MessagesState {
  cached ??= load();
  return cached;
}

/** The (possibly empty) thread for one contact, oldest first. */
export function threadOf(contactId: string): MessageEntry[] {
  return getMessages().threads[contactId] ?? [];
}

/** Strictly monotonic timestamp: same-ms records still sort newest-first. */
function nextAt(state: MessagesState): number {
  let latest = 0;
  for (const thread of Object.values(state.threads)) {
    for (const entry of thread) latest = Math.max(latest, entry.at);
  }
  return Math.max(Date.now(), latest + 1);
}

export interface RecordOpts {
  /** Chat-session traffic: excluded from Inbox/Outbox lists and unread. */
  chat?: boolean;
}

/** Record a message the visitor sent (Outbox). */
export function sendRecorded(contactId: string, text: string, opts?: RecordOpts): void {
  mutate((state) => {
    (state.threads[contactId] ??= []).push({
      who: "me",
      text,
      at: nextAt(state),
      ...(opts?.chat ? { via: "chat" as const } : {}),
    });
  });
}

/** Record a message a contact sent back (Inbox); counts as unread. */
export function receiveRecorded(contactId: string, text: string, opts?: RecordOpts): void {
  mutate((state) => {
    (state.threads[contactId] ??= []).push({
      who: "them",
      text,
      at: nextAt(state),
      ...(opts?.chat ? { via: "chat" as const } : {}),
    });
    if (!opts?.chat) state.unread += 1; // in the chat session nothing is "unread"
  });
}

/** Seed a thread once (Chat, Menu 3): no-op when it already has entries. */
export function ensureThread(
  contactId: string,
  entries: { who: "me" | "them"; text: string }[],
): void {
  if (threadOf(contactId).length > 0) return;
  mutate((state) => {
    const thread = (state.threads[contactId] ??= []);
    for (const entry of entries) {
      thread.push({ who: entry.who, text: entry.text, at: nextAt(state), via: "chat" });
    }
  });
}

export function markAllRead(): void {
  mutate((state) => {
    state.unread = 0;
  });
}

export function subscribeMessages(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Test hook: drop the cache so the next read goes back to localStorage. */
export function resetMessagesForTests(): void {
  cached = null;
}

// ── item mapping for the tree's lazy list nodes ────────────────────────────

const pad = (n: number): string => String(n).padStart(2, "0");

/** Nokia-style timestamp line, local time: "01.09.2000 09:03". */
function stamp(at: number): string {
  const d = new Date(at);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function contactName(contactId: string): string {
  return contactById(contactId)?.name ?? contactId;
}

function firstWords(text: string): string {
  return text.split(/\s+/).slice(0, 3).join(" ");
}

function toItem(
  contactId: string,
  entry: MessageEntry,
  index: number,
): { id: string; label: string; body: string } {
  return {
    id: `${contactId}-${entry.at}-${index}`,
    label: entry.label ?? `${contactName(contactId)} ${firstWords(entry.text)}`,
    body: `${entry.text}\n${stamp(entry.at)}`,
  };
}

function items(who: MessageEntry["who"]): { id: string; label: string; body: string }[] {
  const all: { contactId: string; entry: MessageEntry; index: number }[] = [];
  for (const [contactId, thread] of Object.entries(getMessages().threads)) {
    thread.forEach((entry, index) => {
      if (entry.who === who && entry.via !== "chat") all.push({ contactId, entry, index });
    });
  }
  all.sort((a, b) => b.entry.at - a.entry.at); // newest first
  return all.map(({ contactId, entry, index }) => toItem(contactId, entry, index));
}

/** Messages → Inbox (2-2): every received message, newest first. */
export function inboxItems(): { id: string; label: string; body: string }[] {
  return items("them");
}

/** Messages → Outbox (2-3): every sent message, newest first. */
export function outboxItems(): { id: string; label: string; body: string }[] {
  return items("me");
}
