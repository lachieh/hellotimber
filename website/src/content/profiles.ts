import type { ProfileMode } from "./types";

/** Visitor modes are a VISION stretch goal; only the copy ships for now. */
export const profileModes: ProfileMode[] = [
  // SAMPLE DATA — replace with real copy ───────────────────────────────────
  {
    id: "general",
    label: "General",
    description: "The default profile. Everything in original menu order.",
  },
  {
    id: "recruiter",
    label: "Recruiter",
    description: "(Stretch) Would foreground Call register and the CV.",
  },
  {
    id: "engineer",
    label: "Engineer",
    description: "(Stretch) Would foreground projects and this codebase.",
  },
  // ── end SAMPLE DATA ──────────────────────────────────────────────────────
];
