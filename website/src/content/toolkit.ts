import type { StockSimToolkit, StockToolkitStep } from "@hellotimber/nokia-os";
import { LINKS, SOURCE_LINK } from "./links";

export const PROJECTS = [
  {
    id: "this-site",
    name: "hellotimber",
    blurb: "A Nokia 3310 that is also a website. You are holding it.",
    year: "2026",
    linkId: "source",
  },
  {
    id: "tambo",
    name: "tambo",
    blurb: "Generative UI SDK for React. Contributor: SDK, web app, monorepo and security.",
    year: "2025",
    linkId: "tambo",
  },
  {
    id: "wasmcloud-ts",
    name: "wasmCloud TS",
    blurb: "Libraries, tooling and the washboard UI for wasmCloud.",
    year: "2024",
    linkId: "wasmcloud-ts",
  },
  {
    id: "herdr-cmux",
    name: "herdr-plugin-cmux",
    blurb: "A cmux plugin for herdr.",
    year: "2026",
    linkId: "herdr-cmux",
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
