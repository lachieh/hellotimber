import { contactById } from "../content/contacts";
import type { Contact } from "../content/contacts";

/**
 * Pure logic behind POST /api/sms (plan 08). Kept out of the route file so
 * node-env tests can exercise validation + reply generation without pulling
 * in the router. The Anthropic client is injected via `ReplyDeps` — with no
 * API key (or on any API error) the contact's canned replies are used, so
 * the route never 5xxs for handled failures.
 */

export const SMS_MODEL = "claude-haiku-4-5";
export const MAX_SMS_CHARS = 160;
export const MAX_HISTORY = 12;

export interface SmsTurn {
  who: "me" | "them";
  text: string;
}

export interface SmsRequest {
  contactId: string;
  text: string;
  history: SmsTurn[];
}

/** The slice of the Anthropic SDK generateReply needs — injectable in tests. */
export interface MessagesClient {
  messages: {
    create(req: {
      model: string;
      max_tokens: number;
      system: string;
      messages: { role: "user" | "assistant"; content: string }[];
    }): Promise<{ content: { type: string; text?: string }[] }>;
  };
}

export interface ReplyDeps {
  /** Returns a client, or null when no API key is configured (canned mode). */
  createClient(): MessagesClient | null;
}

export type ValidationResult =
  | { ok: true; request: SmsRequest; contact: Contact }
  | { ok: false; error: string };

function isSmsTurn(value: unknown): value is SmsTurn {
  if (typeof value !== "object" || value === null) return false;
  const turn = value as Record<string, unknown>;
  return (turn.who === "me" || turn.who === "them") && typeof turn.text === "string";
}

/** Validate a JSON body for /api/sms. Failures map to a 400 response. */
export function validateSmsRequest(body: unknown): ValidationResult {
  if (typeof body !== "object" || body === null) return { ok: false, error: "invalid body" };
  const { contactId, text, history = [] } = body as Record<string, unknown>;
  if (typeof contactId !== "string") return { ok: false, error: "contactId required" };
  const contact = contactById(contactId);
  if (contact === undefined) return { ok: false, error: "unknown contact" };
  if (typeof text !== "string" || text.trim() === "") {
    return { ok: false, error: "text required" };
  }
  if (text.length > MAX_SMS_CHARS) {
    return { ok: false, error: `text must be <= ${MAX_SMS_CHARS} chars` };
  }
  if (!Array.isArray(history) || history.length > MAX_HISTORY || !history.every(isSmsTurn)) {
    return { ok: false, error: `history must be <= ${MAX_HISTORY} valid entries` };
  }
  return { ok: true, request: { contactId, text, history }, contact };
}

/** Next canned reply for this thread — cycles on how many replies it has. */
export function cannedReply(contact: Contact, history: SmsTurn[]): string {
  const replies = history.filter((turn) => turn.who === "them").length;
  return contact.canned[replies % contact.canned.length] ?? "OK.";
}

/**
 * Generate the contact's reply. LLM-backed when a client is available;
 * canned otherwise. Never throws — every failure path returns a canned reply.
 */
export async function generateReply(
  deps: ReplyDeps,
  contact: Contact,
  history: SmsTurn[],
  text: string,
): Promise<string> {
  const fallback = cannedReply(contact, history);
  let client: MessagesClient | null;
  try {
    client = deps.createClient();
  } catch {
    client = null;
  }
  if (client === null) return fallback;
  try {
    // The Messages API requires a user-first message list; the seeded chat
    // thread starts with "them" lines, so drop leading assistant turns.
    const firstMe = history.findIndex((turn) => turn.who === "me");
    const usable = firstMe === -1 ? [] : history.slice(firstMe);
    const res = await client.messages.create({
      model: SMS_MODEL,
      max_tokens: 120,
      system: `${contact.system}\nReply as one SMS: plain text, max 160 characters.`,
      messages: [
        ...usable.map(
          (turn) =>
            ({ role: turn.who === "me" ? "user" : "assistant", content: turn.text }) as const,
        ),
        { role: "user", content: text },
      ],
    });
    const block = res.content.find((b) => b.type === "text");
    const reply = (block?.text ?? "").slice(0, MAX_SMS_CHARS);
    return reply === "" ? fallback : reply;
  } catch {
    return fallback;
  }
}
