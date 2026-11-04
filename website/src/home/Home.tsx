// The homepage's parts around the phone (plan 32 D8, D9, D11, D12), set as a Braun-style product
// catalogue (website/DESIGN.md): the running head, the index, the exhibit's caption, the spread,
// the section pages and the key guides.
import { HANDSET } from "@hellotimber/phone-3d/sketch";
import { Link } from "@tanstack/react-router";
import { createContext, useContext } from "react";
import type { PageBlock, PageSection, PhoneSection, Section, Spec } from "../content/section";
import { SECTIONS } from "../content/sections";
import { site } from "../content/site";
import { REPOSITORIES } from "../content/links";
import { updateSettings, useSettings } from "../settings";
import type { HomeView } from "./view";

export const HomeViewContext = createContext<HomeView | undefined>(undefined);

/** The section's number on the phone's menu, as its LCD shows it in the top right corner. */
const menuNumber = (section: Section) => SECTIONS.indexOf(section) + 1;

/** The handset's size and weight, as a spec sheet gives them. */
const HANDSET_SIZE = `${HANDSET.heightMm} × ${HANDSET.widthMm} × ${HANDSET.depthMm} mm, ${HANDSET.weightG} g`;

/** The running head across the top of every page. */
export function RunningHead() {
  return (
    <header className="cat-head">
      <Link to="/" className="cat-head__name">
        {site.name}
      </Link>
      <p className="cat-head__line">{site.jobTitle}, Atlanta</p>
    </header>
  );
}

/**
 * The index: every section as a plain link, with or without the phone. The section the phone is
 * on is marked with the signal colour.
 */
export function Contents({ marked }: { marked: Section | undefined }) {
  return (
    <nav className="cat-index" aria-labelledby="cat-index-title">
      <h2 id="cat-index-title" className="cat-label">
        Contents
      </h2>
      <ol>
        {SECTIONS.map((section) => (
          <li key={section.id} data-marked={section === marked ? "" : undefined}>
            <Link to={section.route} activeProps={{ "aria-current": "page" }}>
              <span className="cat-num">{menuNumber(section)}</span>
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
    <footer className="cat-colophon">
      <button
        type="button"
        role="switch"
        aria-checked={!muted}
        className="cat-switch"
        onClick={() => updateSettings({ muted: !muted })}
      >
        <span className="cat-switch__lamp" aria-hidden="true" />
        Sound
        <span className="cat-switch__state" aria-hidden="true">
          {muted ? "Off" : "On"}
        </span>
      </button>
      <ul>
        <li>
          <a href="/exp/nokia-emulator">Nokia 3310 emulator</a>
        </li>
        <li>
          <a href={REPOSITORIES.source.href}>Source</a>
        </li>
      </ul>
    </footer>
  );
}

/** The caption under the phone: the figure on the index pages, what it shows beside a page. */
export function ExhibitCaption({ view }: { view: HomeView | undefined }) {
  if (view?.kind === "docked") {
    return (
      <p className="cat-caption">
        The phone at {view.section.label}. <kbd>C</kbd> goes back to the menu.
      </p>
    );
  }
  return (
    <p className="cat-caption">
      <span className="cat-caption__fig">Fig. 1</span> Nokia 3310, front. {HANDSET_SIZE}. Shown at
      about actual size.
    </p>
  );
}

function SpecSheet({ specs, label }: { specs: readonly Spec[]; label: string }) {
  return (
    <dl className="cat-specs" aria-label={label}>
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

function Heading({ section }: { section: Section }) {
  return (
    <h1 className="cat-display">
      <span className="cat-display__num">{menuNumber(section)}</span> {section.label}
    </h1>
  );
}

/** `/`: the spread for the item the phone has highlighted, or the introduction. */
export function Spread() {
  const view = useContext(HomeViewContext);
  const section: Section | undefined = view?.kind === "spread" ? view.section : undefined;
  if (section === undefined) {
    return (
      <article className="cat-spread" key="intro">
        <h1 className="cat-display">{site.name}</h1>
        <p className="cat-standfirst">{site.tagline}</p>
        <SpecSheet specs={INTRO_SPECS} label="The phone" />
      </article>
    );
  }
  return (
    <article className="cat-spread" key={section.id} data-section={section.id}>
      <Heading section={section} />
      <p className="cat-standfirst">{section.summary}</p>
      <SpecSheet specs={section.specs} label={section.label} />
      <p className="cat-more">
        <Link to={section.route}>Open {section.label}</Link>, or Select (Enter) on the phone.
      </p>
    </article>
  );
}

function Block({ block }: { block: PageBlock }) {
  switch (block.kind) {
    case "text":
      return <p>{block.text}</p>;
    case "list":
      return (
        <ul className="cat-list">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    case "links":
      return (
        <dl className="cat-specs">
          {block.links.map((link) => (
            <div key={link.href}>
              <dt>{link.name}</dt>
              <dd>
                <a href={link.href} rel={link.rel}>
                  {link.label}
                </a>
              </dd>
            </div>
          ))}
        </dl>
      );
    case "entries":
      return (
        <ul className="cat-entries">
          {block.entries.map((entry) => (
            <li key={entry.title}>
              <h2>{entry.title}</h2>
              <p className="cat-entries__when">
                {entry.datetime === undefined ? (
                  entry.when
                ) : (
                  <time dateTime={entry.datetime}>{entry.when}</time>
                )}
              </p>
              <p className="cat-entries__body">
                {entry.body}
                {entry.link !== undefined && (
                  <>
                    {" "}
                    <a href={entry.link.href} rel={entry.link.rel}>
                      {entry.link.label}
                    </a>
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      );
  }
}

/** A section's page, beside the docked phone. */
export function SectionPage({ section }: { section: PageSection }) {
  return (
    <article className="cat-page">
      <Heading section={section} />
      <p className="cat-standfirst">{section.summary}</p>
      <div className="cat-page__body">
        {section.page.map((block, i) => (
          <Block key={i} block={block} />
        ))}
      </div>
    </article>
  );
}

/** Chat and Snake: the keys beside the centred phone. */
export function KeyGuide({ section }: { section: PhoneSection }) {
  return (
    <article className="cat-spread cat-guide">
      <Heading section={section} />
      <p className="cat-standfirst">{section.summary}</p>
      <dl className="cat-specs cat-keys" aria-label="Keys">
        {section.guide.map((key) => (
          <div key={key.label}>
            <dt>
              <kbd>{key.label}</kbd>
            </dt>
            <dd>{key.value}</dd>
          </div>
        ))}
      </dl>
      <SpecSheet specs={section.specs} label={`${section.label} details`} />
    </article>
  );
}
