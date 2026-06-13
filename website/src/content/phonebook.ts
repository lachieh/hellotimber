import type { ContactEntry } from "./types";

export const phonebook: ContactEntry[] = [
  // SAMPLE DATA — replace with real copy ───────────────────────────────────
  {
    id: "email",
    label: "Email",
    value: "lachlan@example.com",
    href: "mailto:lachlan@example.com",
  },
  {
    id: "github",
    label: "GitHub",
    value: "github.com/example-handle",
    href: "https://github.com/example-handle",
    rel: "me",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    value: "linkedin.com/in/example-handle",
    href: "https://www.linkedin.com/in/example-handle",
    rel: "me",
  },
  {
    id: "cv",
    label: "CV",
    value: "Download CV (PDF)",
    href: "/cv.pdf", // file to be provided — see Task 11 handoff
    download: true,
  },
  // ── end SAMPLE DATA ──────────────────────────────────────────────────────
];
