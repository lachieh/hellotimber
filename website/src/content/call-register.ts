import type { MissedCall, Project, Role } from "./types";

export const roles: Role[] = [
  // SAMPLE DATA — replace with real copy ───────────────────────────────────
  {
    id: "acme-pixel",
    org: "Acme Pixel Co.",
    title: "Senior Software Engineer",
    period: "2022–now",
    periodStart: "2022-03",
    summary: "Led the imaginary platform team. Shipped imaginary things at scale.",
  },
  {
    id: "globex-web",
    org: "Globex Web Ltd.",
    title: "Full-stack Engineer",
    period: "2019–2022",
    periodStart: "2019-01",
    summary: "Built the fictional checkout, twice, the second time correctly.",
  },
  // ── end SAMPLE DATA ──────────────────────────────────────────────────────
];

export const projects: Project[] = [
  // SAMPLE DATA — replace with real copy ───────────────────────────────────
  {
    id: "this-site",
    name: "hellotimber",
    url: "https://github.com/example-handle/hellotimber",
    blurb: "A Nokia 3310 that is also a website. You are holding it.",
    year: "2026",
  },
  {
    id: "project-x",
    name: "Project X",
    url: "https://example.com/project-x",
    blurb: "A made-up data pipeline that processed made-up terabytes.",
    year: "2024",
  },
  {
    id: "tool-y",
    name: "tool-y",
    blurb: "A fictional CLI with 12 imaginary GitHub stars.",
    year: "2023",
  },
  // ── end SAMPLE DATA ──────────────────────────────────────────────────────
];

export const missedCalls: MissedCall[] = [
  // SAMPLE DATA — replace with real copy ───────────────────────────────────
  {
    id: "rockstar",
    label: "Rockstar role 2018",
    note: "They wanted a ninja. I am at best a polite gardener.",
  },
  { id: "crypto", label: "That crypto startup", note: "Missed on purpose. No regrets." },
  // ── end SAMPLE DATA ──────────────────────────────────────────────────────
];
