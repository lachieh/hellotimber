import type { StockSimToolkit, StockToolkitStep } from "@hellotimber/nokia-os";
import { LINKS, SOURCE_LINK } from "./links";

// SAMPLE DATA - existing projects; the URLs remain placeholders.
export const PROJECTS = [
  {
    id: "this-site",
    name: "hellotimber",
    blurb: "A Nokia 3310 that is also a website. You are holding it.",
    year: "2026",
    linkId: "source",
  },
  {
    id: "project-x",
    name: "Project X",
    blurb: "A made-up data pipeline that processed made-up terabytes.",
    year: "2024",
    linkId: "project-x",
  },
  {
    id: "tool-y",
    name: "tool-y",
    blurb: "A fictional CLI with 12 imaginary GitHub stars.",
    year: "2023",
    linkId: undefined,
  },
];
export const COLOPHON =
  "This site is a working Nokia 3310 in three.js. Stock firmware runs the menus; a SIM card holds the portfolio. Built with TypeScript, React and TanStack Start.";
export const TOOLKIT: StockSimToolkit = {
  title: "LACHLAN",
  items: [
    {
      id: "projects",
      label: "Projects",
      steps: [
        {
          kind: "select",
          items: PROJECTS.map((project) => {
            const link = LINKS.find((link) => link.id === project.linkId);
            const steps: StockToolkitStep[] = [
              { kind: "text", text: `${project.name} (${project.year}). ${project.blurb}` },
            ];
            if (link)
              steps.push({ kind: "call", number: link.number, confirm: `Open ${project.name}?` });
            return { id: project.id, label: project.name, steps };
          }),
        },
      ],
    },
    {
      id: "about",
      label: "About this site",
      steps: [
        { kind: "text", text: COLOPHON },
        { kind: "call", number: SOURCE_LINK.number, confirm: "Open Source code?" },
      ],
    },
  ],
};
