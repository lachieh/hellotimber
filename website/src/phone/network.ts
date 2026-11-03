import type { StockIncomingSms, StockNetworkPort, StockStorage } from "@hellotimber/nokia-os";
import { personByNumber } from "../content/people";
import { hostTimestamp } from "./host-clock";
import { createThreads } from "./threads";

export const NO_ANSWER_MS = 30_000;
interface NetworkOptions {
  storage: Pick<StockStorage, "getItem" | "setItem">;
  simId: string;
  fetch?: typeof fetch;
  now?: () => Date;
}
/** The site's cell: texts to a persona get its reply over `/api/sms`; a persona's phone rings out. */
export function createPortfolioNetwork(options: NetworkOptions): StockNetworkPort {
  const threads = createThreads(options.storage, options.simId);
  const subscribers = new Set<(sms: StockIncomingSms) => void>();
  const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
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
      let timer: ReturnType<typeof setTimeout> | undefined;
      if (personByNumber(call.number) !== undefined) {
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
