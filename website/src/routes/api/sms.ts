// Loads the @tanstack/start server-route type augmentation (`server.handlers`)
// onto createFileRoute's options — it isn't otherwise in the TS program.
import "@tanstack/react-start";
import Anthropic from "@anthropic-ai/sdk";
import { createFileRoute } from "@tanstack/react-router";
import { generateReply, validateSmsRequest } from "../../messages/generate-reply";

/**
 * POST /api/sms (plan 08): { contactId, text, history } → { reply }.
 * claude-haiku-4-5 answers in persona when ANTHROPIC_API_KEY is set; canned
 * replies otherwise. Handled failures never 5xx — the handset always gets an
 * answer (generateReply falls back internally on any API error).
 */

// Soft per-instance rate limit: ≤10 requests/min per IP (best-effort on
// serverless — each instance keeps its own map, which is fine at this scale).
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 1000) {
    // Bounded memory: drop stale IPs once in a while.
    for (const [key, times] of hits) {
      if (times.every((t) => now - t >= RATE_WINDOW_MS)) hits.delete(key);
    }
  }
  return recent.length > RATE_LIMIT;
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "local";
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export const Route = createFileRoute("/api/sms")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (rateLimited(clientIp(request))) {
          return json({ error: "rate limited" }, 429);
        }
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json({ error: "invalid JSON" }, 400);
        }
        const validated = validateSmsRequest(body);
        if (!validated.ok) return json({ error: validated.error }, 400);
        const reply = await generateReply(
          // new Anthropic() reads ANTHROPIC_API_KEY; without it → canned mode.
          { createClient: () => (process.env.ANTHROPIC_API_KEY ? new Anthropic() : null) },
          validated.contact,
          validated.request.history,
          validated.request.text,
        );
        return json({ reply });
      },
    },
  },
});
