import { LACHLAN_NUMBER } from "./contact";
import type { PhoneSection } from "./section";

export const CHAT = {
  kind: "phone",
  id: "chat",
  label: "Chat",
  route: "/chat",
  summary: "Text Lachlan from the phone. Replies arrive as SMS.",
  description: "Text Lachlan Heywood, or a recruiter from 2000, from a working Nokia 3310.",
  specs: [
    { label: "Lachlan", value: LACHLAN_NUMBER },
    { label: "Replies", value: "One SMS, 160 characters" },
    { label: "Also on", value: "Recruiter Rachel, Y2K Support" },
  ],
  guide: [
    { label: "Search", value: "Pick Lachlan from the phone book" },
    { label: "0-9", value: `Or type ${LACHLAN_NUMBER}` },
    { label: "OK", value: "Middle key (Enter), then type with 0-9" },
    { label: "C", value: "Back (Esc or Backspace)" },
  ],
} as const satisfies PhoneSection;
