import { createFileRoute } from "@tanstack/react-router";
import ContentPanel from "../../../components/ContentPanel";
import { phonebook } from "../../../content";
import { pageHead } from "../../../seo";

export const Route = createFileRoute("/_phone/menu/phone-book")({
  head: () =>
    pageHead({
      section: "Phone book",
      description: "Contact details: email, GitHub, LinkedIn, CV.",
    }),
  component: PhoneBookPanel,
});

function PhoneBookPanel() {
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
