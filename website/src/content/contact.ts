import { PROFILES } from "./links";
import { PEOPLE } from "./people";
import type { PageSection } from "./section";

const LINKS = [PROFILES.github, PROFILES.linkedin, PROFILES.bluesky, PROFILES.x];
const HOURS = "Generally reachable 9-5 ET; LinkedIn lands anytime.";
/** Lachlan's persona number on the phone, spaced as it's read. */
export const LACHLAN_NUMBER = PEOPLE[0].number.replace(/^(\d{4})(\d{3})(\d{3})$/, "$1 $2 $3");

export const CONTACT = {
  kind: "page",
  id: "contact",
  label: "Contact",
  route: "/contact",
  summary: "GitHub, LinkedIn, Bluesky and X, or a text from the phone.",
  description: "Reach Lachlan Heywood on GitHub, LinkedIn, Bluesky or X.",
  specs: [
    { label: "GitHub", value: "lachieh" },
    { label: "LinkedIn", value: "lachlanh" },
    { label: "Bluesky", value: "heywood.dev" },
    { label: "Hours", value: "9-5 ET" },
  ],
  lcd: {
    kind: "list",
    items: [
      ...LINKS.map((link) => ({
        slug: link.name.toLowerCase(),
        label: link.name,
        opens: { kind: "link", href: link.href } as const,
      })),
      { slug: "hours", label: "Hours", opens: { kind: "reader", text: HOURS } },
    ],
  },
  page: [
    { kind: "links", links: LINKS },
    { kind: "text", text: `Or text Lachlan from Chat on the phone: ${LACHLAN_NUMBER}.` },
    { kind: "text", text: `${HOURS} He's in Atlanta, on US Eastern time.` },
  ],
} as const satisfies PageSection;
