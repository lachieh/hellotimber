import ContentPanel from "../components/ContentPanel";
import { LINKS, SOURCE_LINK, type PortfolioLink } from "../content/links";
import { PEOPLE, personByNumber } from "../content/people";
import { SIM_MESSAGES, INTRO_MESSAGE, STACK_MESSAGE, BIO_MESSAGE } from "../content/sim-messages";
import { PROJECTS, COLOPHON, TOOLKIT } from "../content/toolkit";
import { NOW } from "../content/now";
import { clock } from "../content/clock";

function LinkContact({ link }: { link: PortfolioLink }) {
  return (
    <a href={link.href} rel={link.rel} download={link.download}>
      {link.name}: {link.label}
    </a>
  );
}
export function ContactsPanel() {
  return (
    <ContentPanel title="Phone book">
      <p>Contacts and links. Call a link on the phone to open it.</p>
      <address>
        {PEOPLE.map((person) => (
          <p key={person.id}>
            {person.name}: {person.number}
          </p>
        ))}
        {LINKS.filter((link) => link.kind === "social").map((link) => (
          <p key={link.id}>
            <LinkContact link={link} />
          </p>
        ))}
      </address>
    </ContentPanel>
  );
}
export function ServiceNumbersPanel() {
  return (
    <ContentPanel title="Service numbers">
      <LinkContact link={SOURCE_LINK} />
    </ContentPanel>
  );
}
export function MessagesPanel() {
  return (
    <ContentPanel title="Messages">
      <p>Messages on Lachlan's SIM: introductions, work history and open source.</p>
      {SIM_MESSAGES.map((message, index) => {
        const t = message.sentAt;
        const pad = (value: number) => String(value).padStart(2, "0");
        const timestamp = `${t.year}-${pad(t.month)}-${pad(t.day)}T${pad(t.hour)}:${pad(t.minute)}:${pad(t.second)}+10:00`;
        return (
          <article key={index}>
            <h2>Sender: {personByNumber(message.number)?.name ?? message.number}</h2>
            <time dateTime={timestamp}>{timestamp}</time>
            <p>{message.text}</p>
          </article>
        );
      })}
    </ContentPanel>
  );
}
export function MessagingPanel() {
  return (
    <ContentPanel title="Text a persona">
      <p>
        Use Messages › Write messages or Chat. Type with 0–9, then Options › Send › Search to choose
        a recipient. Replies arrive as SMS.
      </p>
      <ul>
        {PEOPLE.map((person) => (
          <li key={person.id}>
            {person.name}: {person.number}
          </li>
        ))}
      </ul>
      <ul>
        {LINKS.filter((link) => link.kind === "social").map((link) => (
          <li key={link.id}>
            <LinkContact link={link} />
          </li>
        ))}
      </ul>
    </ContentPanel>
  );
}
export function NowPanel() {
  return (
    <ContentPanel title="Now">
      <p>Notes preloaded in Reminders.</p>
      <ul>
        {NOW.map((item) => (
          <li key={item.text}>{item.text}</li>
        ))}
      </ul>
    </ContentPanel>
  );
}
export function ClockPanel() {
  return (
    <ContentPanel title="Clock">
      <p>The phone shows US Eastern time (ET), with daylight saving time.</p>
      <p>Availability: {clock.availability}</p>
    </ContentPanel>
  );
}
export function ProjectsPanel() {
  return (
    <ContentPanel title="Projects">
      {PROJECTS.map((project) => {
        const link = LINKS.find((link) => link.id === project.linkId);
        return (
          <article key={project.id}>
            <h2>{project.name}</h2>
            <time>{project.year}</time>
            <p>{project.blurb}</p>
            {link && <LinkContact link={link} />}
          </article>
        );
      })}
    </ContentPanel>
  );
}
export function AboutPanel() {
  return (
    <ContentPanel title="About this site">
      <p>{COLOPHON}</p>
      <LinkContact link={SOURCE_LINK} />
    </ContentPanel>
  );
}
export function ToolkitPanel() {
  return (
    <ContentPanel title="SIM services">
      <ul>
        {TOOLKIT.items.map((item) => (
          <li key={item.id}>
            <a href={`/menu/sim-services/${item.id}`}>{item.label}</a>
          </li>
        ))}
      </ul>
    </ContentPanel>
  );
}
export function GamesPanel() {
  return (
    <ContentPanel title="Games">
      <p>Play the stock Nokia 3310 games on the handset.</p>
      <a href="/menu/games/snake">Snake II</a>
    </ContentPanel>
  );
}
export function SnakePanel() {
  return (
    <ContentPanel title="Snake II">
      <p>
        Collect food and keep growing. Steer with 2, 4, 6 and 8. Avoid the walls and your own tail.
      </p>
    </ContentPanel>
  );
}
export function CalculatorPanel() {
  return (
    <ContentPanel title="Calculator">
      <p>Enter numbers with the keypad. Use Options for arithmetic and # for a decimal point.</p>
    </ContentPanel>
  );
}
export function StandbyPanel() {
  return (
    <ContentPanel title="Lachlan Heywood">
      <p>{INTRO_MESSAGE}</p>
      <p>{STACK_MESSAGE}</p>
      <p>{BIO_MESSAGE}</p>
      <p>
        Use arrows to scroll, Enter for the NaviKey, Escape or Backspace for C. Digits, * and # are
        the phone keypad; hold P for power.
      </p>
      <a href="/menu/phone-book/search">Contacts</a>
      <a href="/menu">Menu</a>
    </ContentPanel>
  );
}
