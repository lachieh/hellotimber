/** A link off the site: Lachlan's profiles and his projects' repositories. */
export interface ExternalLink {
  readonly name: string;
  /** What the link shows: a handle or a short name. */
  readonly label: string;
  readonly href: string;
  readonly rel?: string;
}

export const PROFILES = {
  github: {
    name: "GitHub",
    label: "github.com/lachieh",
    href: "https://github.com/lachieh",
    rel: "me",
  },
  linkedin: {
    name: "LinkedIn",
    label: "linkedin.com/in/lachlanh",
    href: "https://www.linkedin.com/in/lachlanh/",
    rel: "me",
  },
  bluesky: {
    name: "Bluesky",
    label: "heywood.dev",
    href: "https://bsky.app/profile/heywood.dev",
    rel: "me",
  },
  x: { name: "X", label: "x.com/lachie_h", href: "https://x.com/lachie_h", rel: "me" },
} as const satisfies Record<string, ExternalLink>;

export const REPOSITORIES = {
  tambo: { name: "tambo", label: "tambo-ai/tambo", href: "https://github.com/tambo-ai/tambo" },
  wasmcloudTs: {
    name: "wasmCloud TS",
    label: "wasmCloud/typescript",
    href: "https://github.com/wasmCloud/typescript",
  },
  herdrCmux: {
    name: "herdr-plugin-cmux",
    label: "lachieh/herdr-plugin-cmux",
    href: "https://github.com/lachieh/herdr-plugin-cmux",
  },
  source: {
    name: "Source code",
    label: "lachieh/hellotimber",
    href: "https://github.com/lachieh/hellotimber",
  },
} as const satisfies Record<string, ExternalLink>;
