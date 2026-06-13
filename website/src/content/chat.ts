import type { ChatMessage } from "./types";

export const chatMessages: ChatMessage[] = [
  // SAMPLE DATA — replace with real copy (testimonials, with permission) ───
  { who: "them", nickname: "CTO@Acme", text: "Lachlan shipped the impossible. Twice." },
  { who: "me", nickname: "Lachlan", text: "The second one was easier." },
  {
    who: "them",
    nickname: "PM@Globex",
    text: "Writes code AND tickets. Would staff again, 10/10.",
  },
  {
    who: "them",
    nickname: "CTO@Acme",
    text: "Also he made our build 4 minutes faster and never mentioned it.",
  },
  { who: "me", nickname: "Lachlan", text: "I'm mentioning it now." },
  // ── end SAMPLE DATA ──────────────────────────────────────────────────────
];
