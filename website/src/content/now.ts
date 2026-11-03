import type { PageSection } from "./section";

const ITEMS = [
  "Build tambo's generative UI",
  "Ship the Space impact port",
  "Play Snake II. Beat 4032.",
];

export const NOW = {
  kind: "page",
  id: "now",
  label: "Now",
  route: "/now",
  summary: "What Lachlan is doing now.",
  description: "What Lachlan Heywood is working on now.",
  specs: ITEMS.map((value, i) => ({ label: String(i + 1), value })),
  lcd: { kind: "reader", text: ITEMS.join(" ") },
  page: [{ kind: "list", items: ITEMS }],
} as const satisfies PageSection;
