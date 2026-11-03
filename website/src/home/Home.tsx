// The homepage's parts around the phone (plan 32 D8, D9, D11, D12), plain and provisional: the
// Braun catalogue design (Phase 3) restyles them.
import { Link } from "@tanstack/react-router";
import { createContext, useContext } from "react";
import type { PageBlock, PageSection, PhoneSection, Section, Spec } from "../content/section";
import { SECTIONS } from "../content/sections";
import { site } from "../content/site";
import { REPOSITORIES } from "../content/links";
import { updateSettings, useSettings } from "../settings";
import type { HomeView } from "./view";

export const HomeViewContext = createContext<HomeView | undefined>(undefined);

/** The contents column: every section as a plain link, with or without the phone. */
export function Contents() {
  return (
    <nav className="home-contents" aria-label="Contents">
      <Link to="/" className="home-contents__name">
        {site.name}
      </Link>
      <ol>
        {SECTIONS.map((section) => (
          <li key={section.id}>
            <Link to={section.route} activeProps={{ "aria-current": "page" }}>
              {section.label}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Sound and where things come from. */
export function Colophon() {
  const { muted } = useSettings();
  return (
    <footer className="home-colophon">
      <button type="button" aria-pressed={muted} onClick={() => updateSettings({ muted: !muted })}>
        Sound off
      </button>
      <a href="/exp/nokia-emulator">Nokia 3310 emulator</a>
      <a href={REPOSITORIES.source.href}>Source</a>
    </footer>
  );
}

function SpecSheet({ specs, label }: { specs: readonly Spec[]; label: string }) {
  return (
    <dl className="home-specs" aria-label={label}>
      {specs.map((spec) => (
        <div key={spec.label}>
          <dt>{spec.label}</dt>
          <dd>{spec.value}</dd>
        </div>
      ))}
    </dl>
  );
}

const INTRO_SPECS: readonly Spec[] = [
  { label: "Model", value: "Nokia 3310" },
  { label: "Display", value: "84 × 48 pixels" },
  { label: "Start", value: "Menu: Enter, or the middle key" },
];

/** `/`: the spread for the item the phone has highlighted, or the introduction. */
export function Spread() {
  const view = useContext(HomeViewContext);
  const section: Section | undefined = view?.kind === "spread" ? view.section : undefined;
  if (section === undefined) {
    return (
      <article className="home-spread">
        <h1>{site.name}</h1>
        <p>{site.tagline}</p>
        <SpecSheet specs={INTRO_SPECS} label="The phone" />
      </article>
    );
  }
  const number = SECTIONS.indexOf(section) + 1;
  return (
    <article className="home-spread" data-section={section.id}>
      <p className="home-spread__number">Menu {number}</p>
      <h1>{section.label}</h1>
      <p>{section.summary}</p>
      <SpecSheet specs={section.specs} label={section.label} />
      <Link to={section.route}>Open {section.label}</Link>
    </article>
  );
}

function Block({ block }: { block: PageBlock }) {
  switch (block.kind) {
    case "text":
      return <p>{block.text}</p>;
    case "list":
      return (
        <ul>
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    case "links":
      return (
        <ul className="home-links">
          {block.links.map((link) => (
            <li key={link.href}>
              <a href={link.href} rel={link.rel}>
                {link.name}
              </a>{" "}
              {link.label}
            </li>
          ))}
        </ul>
      );
    case "entries":
      return (
        <ul className="home-entries">
          {block.entries.map((entry) => (
            <li key={entry.title}>
              <h2>{entry.title}</h2>
              {entry.when !== undefined && <p className="home-entries__when">{entry.when}</p>}
              <p>{entry.body}</p>
              {entry.link !== undefined && (
                <a href={entry.link.href} rel={entry.link.rel}>
                  {entry.link.label}
                </a>
              )}
            </li>
          ))}
        </ul>
      );
  }
}

/** A section's page, beside the docked phone. */
export function SectionPage({ section }: { section: PageSection }) {
  return (
    <article className="home-page">
      <h1>{section.label}</h1>
      <p className="home-page__summary">{section.summary}</p>
      {section.page.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </article>
  );
}

/** Chat and Snake: the keys beside the centred phone. */
export function KeyGuide({ section }: { section: PhoneSection }) {
  return (
    <article className="home-guide">
      <h1>{section.label}</h1>
      <p>{section.summary}</p>
      <SpecSheet specs={section.guide} label="Keys" />
      <SpecSheet specs={section.specs} label={`${section.label} details`} />
    </article>
  );
}
