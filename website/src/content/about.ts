import type { PageSection } from "./section";

export const ABOUT = {
  kind: "page",
  id: "about",
  label: "About",
  route: "/about",
  summary: "Aussie software engineer in Atlanta, GA.",
  description:
    "Lachlan Heywood is an Aussie software engineer in Atlanta, GA, building web tooling, SDKs and developer experience.",
  specs: [
    { label: "Based", value: "Atlanta, GA" },
    { label: "From", value: "Australia" },
    { label: "Builds", value: "Web tooling, SDKs, DX" },
    { label: "Now", value: "tambo" },
  ],
  lcd: {
    kind: "reader",
    text: "Lachlan Heywood. Aussie software engineer in Atlanta, GA. Builds web tooling, SDKs and developer experience.",
  },
  page: [
    {
      kind: "text",
      text: "Hi, I'm Lachlan. I build software for the web and, apparently, phones. The phone on this page is a working Nokia 3310.",
    },
    {
      kind: "text",
      text: "I'm an Aussie software engineer in Atlanta, GA, building web tooling, SDKs and developer experience. I'm at tambo now; before that, Cosmonic and Real Theory.",
    },
    {
      kind: "text",
      text: "Daily drivers: TypeScript, React, three.js and an 84×48 pixel grid. I like hard boundaries and small packages.",
    },
  ],
} as const satisfies PageSection;
