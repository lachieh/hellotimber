import { createFileRoute } from "@tanstack/react-router";
import ContentPanel from "../../../components/ContentPanel";
import { missedCalls, projects, roles } from "../../../content";
import { pageHead } from "../../../seo";

export const Route = createFileRoute("/_phone/menu/call-register")({
  head: () => pageHead({ section: "Call register", description: "Work history and projects." }),
  component: CallRegisterPanel,
});

function CallRegisterPanel() {
  return (
    <ContentPanel title="Call register">
      <section aria-labelledby="received-calls">
        <h2 id="received-calls">Received calls — roles held</h2>
        <dl>
          {roles.map((r) => (
            <div key={r.id}>
              <dt>
                <strong>{r.title}</strong>, {r.org} <time dateTime={r.periodStart}>{r.period}</time>
              </dt>
              <dd>{r.summary}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section aria-labelledby="dialled-numbers">
        <h2 id="dialled-numbers">Dialled numbers — projects shipped</h2>
        <dl>
          {projects.map((p) => (
            <div key={p.id}>
              <dt>
                {p.url ? (
                  <a href={p.url} target="_blank" rel="noopener noreferrer">
                    {p.name}
                  </a>
                ) : (
                  <strong>{p.name}</strong>
                )}{" "}
                <time dateTime={p.year}>{p.year}</time>
              </dt>
              <dd>{p.blurb}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section aria-labelledby="missed-calls">
        <h2 id="missed-calls">Missed calls — ones that got away</h2>
        <ul>
          {missedCalls.map((m) => (
            <li key={m.id}>
              <strong>{m.label}</strong> — {m.note}
            </li>
          ))}
        </ul>
      </section>
    </ContentPanel>
  );
}
