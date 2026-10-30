import type { StockIncomingSms, StockNetworkPort, StockStorage } from "@hellotimber/nokia-os";
import { LINKS, type PortfolioLink } from "../content/links";
import { personByNumber } from "../content/people";
import { hostTimestamp } from "./host-clock";
import { createThreads } from "./threads";

export const LINK_CALL_MS = 1500;
export const NO_ANSWER_MS = 30_000;
interface NetworkOptions {
  storage: Pick<StockStorage, "getItem" | "setItem">;
  simId: string;
  fetch?: typeof fetch;
  now?: () => Date;
  open?: (href: string, target: string, features: string) => unknown;
  assign?: (href: string) => void;
  download?: (href: string) => void;
}
export function createPortfolioNetwork(options: NetworkOptions): StockNetworkPort {
  const threads = createThreads(options.storage, options.simId);
  const subscribers = new Set<(sms: StockIncomingSms) => void>();
  const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
  const open = options.open ?? ((...args) => window.open(...args));
  const assign = options.assign ?? ((href) => window.location.assign(href));
  const download =
    options.download ??
    ((href) => {
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = "";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
    });
  return {
    subscribe(deliver) {
      subscribers.add(deliver);
      return () => {
        subscribers.delete(deliver);
      };
    },
    async send({ number, text }) {
      const person = personByNumber(number);
      if (person === undefined) return "sent";
      const history = threads.read(number);
      try {
        const response = await fetcher("/api/sms", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ contactId: person.id, text, history }),
        });
        if (!response.ok) return "failed";
        threads.append(number, { who: "me", text });
        void response
          .json()
          .then((body: unknown) => {
            if (
              typeof body !== "object" ||
              body === null ||
              !("reply" in body) ||
              typeof body.reply !== "string" ||
              body.reply === ""
            )
              return;
            threads.append(number, { who: "them", text: body.reply });
            const sms = {
              number,
              text: body.reply,
              sentAt: hostTimestamp((options.now ?? (() => new Date()))()),
            };
            for (const deliver of subscribers) deliver(sms);
          })
          .catch(() => {});
        return "sent";
      } catch {
        return "failed";
      }
    },
    dial(call, control) {
      const link: PortfolioLink | undefined = LINKS.find((link) => link.number === call.number);
      let timer: ReturnType<typeof setTimeout> | undefined;
      if (link !== undefined) {
        if (link.download) download(link.href);
        else if (link.href.startsWith("mailto:")) assign(link.href);
        else open(link.href, "_blank", "noopener,noreferrer");
        control.alerting();
        control.connected();
        timer = setTimeout(() => control.released(), LINK_CALL_MS);
      } else if (personByNumber(call.number) !== undefined) {
        control.alerting();
        timer = setTimeout(() => control.released(), NO_ANSWER_MS);
      } else if (!call.emergency) {
        control.released(1);
      }
      return {
        answer() {},
        hangUp() {
          clearTimeout(timer);
        },
      };
    },
  };
}
