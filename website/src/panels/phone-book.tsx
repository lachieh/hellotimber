import ContentPanel from "../components/ContentPanel";
import { phonebook } from "../content";

export default function PhoneBookPanel() {
  return (
    <ContentPanel title="Phone book">
      <p>Contact details — the same entries the handset shows under Search.</p>
      <address className="not-italic">
        <ul>
          {phonebook.map((c) => {
            const external = c.href.startsWith("https://");
            return (
              <li key={c.id}>
                <strong>{c.label}</strong>
                {" — "}
                <a
                  href={c.href}
                  {...(external && {
                    target: "_blank",
                    rel: c.rel ? `${c.rel} noopener noreferrer` : "noopener noreferrer",
                  })}
                  {...(c.download && { download: true })}
                >
                  {c.value}
                </a>
              </li>
            );
          })}
        </ul>
      </address>
    </ContentPanel>
  );
}
