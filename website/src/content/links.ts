export interface PortfolioLink {
  readonly kind: "social" | "service" | "project";
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly number: string;
  readonly href: string;
  readonly rel?: string;
  readonly download?: boolean;
}

// Fiction numbers: https://www.acma.gov.au/phone-numbers-use-tv-shows-films-and-creative-works
export const SOURCE_LINK = {
  kind: "service",
  id: "source",
  name: "Source code",
  label: "Source code",
  number: "0755507687",
  href: "https://github.com/lachieh/hellotimber",
} satisfies PortfolioLink;

export const LINKS = [
  {
    kind: "social",
    id: "github",
    name: "GitHub",
    label: "github.com/lachieh",
    number: "0755504484",
    href: "https://github.com/lachieh",
    rel: "me",
  },
  {
    kind: "social",
    id: "linkedin",
    name: "LinkedIn",
    label: "linkedin.com/in/lachlanh",
    number: "0755505465",
    href: "https://www.linkedin.com/in/lachlanh/",
    rel: "me",
  },
  {
    kind: "social",
    id: "x",
    name: "X",
    label: "x.com/lachie_h",
    number: "0755500009",
    href: "https://x.com/lachie_h",
    rel: "me",
  },
  {
    kind: "social",
    id: "bluesky",
    name: "Bluesky",
    label: "lachieh.bsky.social",
    number: "0755502583",
    href: "https://bsky.app/profile/lachieh.bsky.social",
    rel: "me",
  },
  {
    kind: "project",
    id: "tambo",
    name: "tambo",
    label: "tambo",
    number: "0755508262",
    href: "https://github.com/tambo-ai/tambo",
  },
  {
    kind: "project",
    id: "wasmcloud-ts",
    name: "wasmCloud TS",
    label: "wasmCloud TS",
    number: "0755509276",
    href: "https://github.com/wasmCloud/typescript",
  },
  {
    kind: "project",
    id: "herdr-cmux",
    name: "herdr-plugin-cmux",
    label: "herdr-plugin-cmux",
    number: "0755504373",
    href: "https://github.com/lachieh/herdr-plugin-cmux",
  },
  SOURCE_LINK,
] satisfies readonly PortfolioLink[];
