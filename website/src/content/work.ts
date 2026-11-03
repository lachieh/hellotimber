import { REPOSITORIES } from "./links";
import type { PageEntry, PageSection } from "./section";

/** A job or project: its page entry, and its row and reader text on the LCD. */
interface Work extends PageEntry {
  readonly slug: string;
  /** The LCD row, where the title doesn't fit one. */
  readonly row?: string;
  readonly lcd: string;
}

const ENTRIES: readonly Work[] = [
  {
    slug: "tambo",
    title: "tambo",
    when: "2025–now",
    body: "A generative UI SDK for React. 100+ merged PRs across the SDK, the web app, monorepo builds and security upkeep.",
    link: { href: REPOSITORIES.tambo.href, label: REPOSITORIES.tambo.label },
    lcd: "tambo, 2025-now. Generative UI SDK for React. 100+ merged PRs.",
  },
  {
    slug: "cosmonic",
    title: "Cosmonic",
    when: "2024",
    body: "wasmCloud (CNCF): TypeScript libraries and tooling, the washboard UI, CI and the wasmcloud.com docs site.",
    link: { href: REPOSITORIES.wasmcloudTs.href, label: REPOSITORIES.wasmcloudTs.label },
    lcd: "Cosmonic, 2024. wasmCloud: TS libraries, tooling, the washboard UI, CI and docs.",
  },
  {
    slug: "real-theory",
    title: "Real Theory",
    body: "Before Cosmonic.",
    lcd: "Real Theory. Before Cosmonic.",
  },
  {
    slug: "open-source",
    title: "Open source",
    body: "Fixes in Perses (CNCF), Turborepo, Nitro and Raycast extensions, and a mise plugin for Raycast.",
    lcd: "Fixes in Perses, Turborepo, Nitro and Raycast extensions.",
  },
  {
    slug: "herdr-cmux",
    title: "herdr-plugin-cmux",
    row: "herdr cmux",
    when: "2026",
    body: "A cmux plugin for herdr.",
    link: { href: REPOSITORIES.herdrCmux.href, label: REPOSITORIES.herdrCmux.label },
    lcd: "herdr-plugin-cmux, 2026. A cmux plugin for herdr.",
  },
  {
    slug: "hellotimber",
    title: "hellotimber",
    when: "2026",
    body: "This site: a Nokia 3310 that is also a website.",
    link: { href: REPOSITORIES.source.href, label: REPOSITORIES.source.label },
    lcd: "hellotimber, 2026. This site: a Nokia 3310 that is also a website.",
  },
];

export const WORK = {
  kind: "page",
  id: "work",
  label: "Work",
  route: "/work",
  summary: "Jobs and projects, newest first.",
  description:
    "Lachlan Heywood's work: tambo, Cosmonic and wasmCloud, Real Theory, and open source.",
  specs: [
    { label: "Now", value: "tambo" },
    { label: "Before", value: "Cosmonic, Real Theory" },
    { label: "Open source", value: "Perses, Turborepo, Nitro" },
  ],
  lcd: {
    kind: "list",
    items: ENTRIES.map(({ slug, title, row, lcd }) => ({
      slug,
      label: row ?? title,
      opens: { kind: "reader", text: lcd },
    })),
  },
  page: [
    {
      kind: "entries",
      entries: ENTRIES.map(({ title, when, body, link }) => ({
        title,
        body,
        ...(when === undefined ? {} : { when }),
        ...(link === undefined ? {} : { link }),
      })),
    },
  ],
} as const satisfies PageSection;
