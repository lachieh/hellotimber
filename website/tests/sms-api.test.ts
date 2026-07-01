import { describe, expect, it } from "vite-plus/test";
import { contactById, contacts } from "../src/content/contacts";
import {
  cannedReply,
  generateReply,
  MAX_HISTORY,
  MAX_SMS_CHARS,
  SMS_MODEL,
  validateSmsRequest,
} from "../src/messages/generate-reply";
import type { MessagesClient, SmsTurn } from "../src/messages/generate-reply";

const lachlan = contactById("lachlan")!;

function fakeClient(reply: string | Error) {
  const calls: {
    model: string;
    max_tokens: number;
    system: string;
    messages: { role: "user" | "assistant"; content: string }[];
  }[] = [];
  const client: MessagesClient = {
    messages: {
      create(req) {
        calls.push(req);
        if (reply instanceof Error) return Promise.reject(reply);
        return Promise.resolve({ content: [{ type: "text", text: reply }] });
      },
    },
  };
  return { client, calls };
}

describe("validateSmsRequest", () => {
  it("accepts a valid request and resolves the contact", () => {
    const result = validateSmsRequest({
      contactId: "lachlan",
      text: "hi there",
      history: [{ who: "me", text: "earlier" }],
    });
    if (!result.ok) throw new Error(`expected ok, got: ${result.error}`);
    expect(result.contact.id).toBe("lachlan");
    expect(result.request.history).toHaveLength(1);
  });

  it("treats a missing history as empty", () => {
    const result = validateSmsRequest({ contactId: "lachlan", text: "hi" });
    if (!result.ok) throw new Error(`expected ok, got: ${result.error}`);
    expect(result.request.history).toEqual([]);
  });

  it("rejects unknown contacts", () => {
    expect(validateSmsRequest({ contactId: "nobody", text: "hi", history: [] }).ok).toBe(false);
  });

  it("rejects text over 160 chars and empty text", () => {
    expect(validateSmsRequest({ contactId: "lachlan", text: "x".repeat(161) }).ok).toBe(false);
    expect(validateSmsRequest({ contactId: "lachlan", text: "   " }).ok).toBe(false);
  });

  it("rejects oversized history and malformed entries", () => {
    const long: SmsTurn[] = Array.from({ length: MAX_HISTORY + 1 }, () => ({
      who: "me",
      text: "x",
    }));
    expect(validateSmsRequest({ contactId: "lachlan", text: "hi", history: long }).ok).toBe(false);
    expect(
      validateSmsRequest({
        contactId: "lachlan",
        text: "hi",
        history: [{ who: "someone", text: "x" }],
      }).ok,
    ).toBe(false);
    expect(validateSmsRequest(null).ok).toBe(false);
    expect(validateSmsRequest("nope").ok).toBe(false);
  });
});

describe("cannedReply", () => {
  it("cycles per thread based on how many replies were already sent", () => {
    expect(cannedReply(lachlan, [])).toBe(lachlan.canned[0]);
    const oneReply: SmsTurn[] = [
      { who: "me", text: "a" },
      { who: "them", text: "b" },
    ];
    expect(cannedReply(lachlan, oneReply)).toBe(lachlan.canned[1]);
    const wrap: SmsTurn[] = Array.from({ length: lachlan.canned.length }, () => ({
      who: "them" as const,
      text: "x",
    }));
    expect(cannedReply(lachlan, wrap)).toBe(lachlan.canned[0]);
  });
});

describe("generateReply", () => {
  it("returns the canned reply when no client is available (no API key)", async () => {
    const reply = await generateReply({ createClient: () => null }, lachlan, [], "hi");
    expect(reply).toBe(lachlan.canned[0]);
  });

  it("returns the canned reply when the SDK call throws", async () => {
    const { client } = fakeClient(new Error("boom"));
    const reply = await generateReply({ createClient: () => client }, lachlan, [], "hi");
    expect(reply).toBe(lachlan.canned[0]);
  });

  it("returns the canned reply when the model returns empty text", async () => {
    const { client } = fakeClient("");
    const reply = await generateReply({ createClient: () => client }, lachlan, [], "hi");
    expect(reply).toBe(lachlan.canned[0]);
  });

  it("truncates model replies to 160 chars", async () => {
    const { client } = fakeClient("y".repeat(400));
    const reply = await generateReply({ createClient: () => client }, lachlan, [], "hi");
    expect(reply).toBe("y".repeat(MAX_SMS_CHARS));
  });

  it("maps history to alternating roles with the new text last", async () => {
    const { client, calls } = fakeClient("gday!");
    const history: SmsTurn[] = [
      { who: "me", text: "first" },
      { who: "them", text: "second" },
    ];
    const reply = await generateReply({ createClient: () => client }, lachlan, history, "third");
    expect(reply).toBe("gday!");
    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.model).toBe(SMS_MODEL);
    expect(call.system).toContain(lachlan.system);
    expect(call.messages).toEqual([
      { role: "user", content: "first" },
      { role: "assistant", content: "second" },
      { role: "user", content: "third" },
    ]);
  });

  it("drops leading 'them' turns so the message list starts with a user turn", async () => {
    const { client, calls } = fakeClient("ok");
    const history: SmsTurn[] = [
      { who: "them", text: "seeded testimonial" },
      { who: "me", text: "hello" },
      { who: "them", text: "reply" },
    ];
    await generateReply({ createClient: () => client }, lachlan, history, "next");
    expect(calls[0]!.messages[0]).toEqual({ role: "user", content: "hello" });
  });
});

describe("contacts sanity for the API", () => {
  it("every contact has canned replies for fallback mode", () => {
    for (const c of contacts) expect(c.canned.length, c.id).toBeGreaterThan(0);
  });
});
