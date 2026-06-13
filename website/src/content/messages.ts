import type { SmsMessage, WriteMessageConfig } from "./types";

export const inbox: SmsMessage[] = [
  // SAMPLE DATA — replace with real copy ───────────────────────────────────
  {
    id: "hello",
    label: "Hello!",
    text: "Hi, I'm Lachlan. I build software for the web — and, apparently, phones. This whole site is a working Nokia 3310.",
    timestamp: "2000-09-01T09:03:00Z",
  },
  {
    id: "stack",
    label: "What I use",
    text: "Daily drivers: TypeScript, React, three.js, and an 84x48 pixel grid. I like hard boundaries and small packages.",
    timestamp: "2000-09-01T09:05:00Z",
  },
  {
    id: "work",
    label: "Work",
    text: "Currently at Acme Pixel Co. Before that: Globex Web Ltd. Full history under Call register.",
    timestamp: "2000-09-01T09:08:00Z",
  },
  {
    id: "say-hi",
    label: "Say hi",
    text: "Want to talk? Write messages sends me a real SMS-style note, or just email lachlan@example.com.",
    timestamp: "2000-09-01T09:12:00Z",
  },
  // ── end SAMPLE DATA ──────────────────────────────────────────────────────
];

export const writeMessage: WriteMessageConfig = {
  destinationEmail: "lachlan@example.com", // SAMPLE DATA — replace with real copy
  subject: "Message from hellotimber", // SAMPLE DATA — replace with real copy
};
