export interface PortfolioLink {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly number: string;
  readonly href: string;
  readonly rel?: string;
  readonly download?: boolean;
}

// SAMPLE DATA - replace with real links and the CV file.
// Fiction numbers: https://www.acma.gov.au/phone-numbers-use-tv-shows-films-and-creative-works
export const SOURCE_LINK = {
  id: "source",
  name: "Source code",
  label: "Source code",
  number: "0755507687",
  href: "https://github.com/example-handle/hellotimber",
} satisfies PortfolioLink;

export const LINKS = [
  {
    id: "email",
    name: "Email",
    label: "lachlan@example.com",
    number: "0755506245",
    href: "mailto:lachlan@example.com",
  },
  {
    id: "github",
    name: "GitHub",
    label: "github.com/example-handle",
    number: "0755504484",
    href: "https://github.com/example-handle",
    rel: "me",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    label: "linkedin.com/in/example-handle",
    number: "0755505465",
    href: "https://www.linkedin.com/in/example-handle",
    rel: "me",
  },
  {
    id: "x",
    name: "X",
    label: "x.com/example-handle",
    number: "0755500009",
    href: "https://x.com/example-handle",
    rel: "me",
  },
  {
    id: "cv",
    name: "CV",
    label: "Download CV (PDF)",
    number: "0755500028",
    href: "/cv.pdf",
    download: true,
  },
  SOURCE_LINK,
  {
    id: "project-x",
    name: "Project X",
    label: "Project X",
    number: "0755507765",
    href: "https://example.com/project-x",
  },
] satisfies readonly PortfolioLink[];
