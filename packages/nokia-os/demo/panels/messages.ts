// The phone's network for SMS (plan 18): a synthetic network that accepts every send (the list of
// sent messages below) and a "Receive SMS" form that delivers one, time-stamped by the browser's
// clock. A host would back `StockNetworkPort` with its own service instead.
import { createSyntheticNetwork, type StockTimestamp } from "../../src/index";
import { byId, html, type DemoPanel } from "../panel";

/** One network for the page: it outlives restarts, so sent messages stay listed. */
const network = createSyntheticNetwork();

/** The browser's local time as an SMS service-centre time stamp. */
function now(): StockTimestamp {
  const d = new Date();
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    hour: d.getHours(),
    minute: d.getMinutes(),
    second: d.getSeconds(),
  };
}

let sentList: HTMLOListElement | undefined;
let shown = 0;

/** Appends the messages phones sent since the list was last drawn. */
function refreshSent(): void {
  if (sentList === undefined || network.sent.length === shown) return;
  for (const sms of network.sent.slice(shown)) {
    const item = document.createElement("li");
    item.textContent = `${sms.number}: ${sms.text}`;
    sentList.append(item);
  }
  shown = network.sent.length;
}

export const messagesPanel: DemoPanel = {
  name: "messages",
  plan: 18,
  mount(slots) {
    const form = html<HTMLFormElement>(`
      <form id="sms-form" aria-label="Receive SMS">
        <label>
          From
          <input id="sms-number" value="0412345678" autocomplete="off" spellcheck="false" />
        </label>
        <label>
          Text
          <input id="sms-text" value="Hello from the network" autocomplete="off" />
        </label>
        <button type="submit">Receive SMS</button>
        <p id="sms-error" class="error" role="alert" hidden></p>
      </form>`);
    const number = byId<HTMLInputElement>(form, "sms-number");
    const text = byId<HTMLInputElement>(form, "sms-text");
    const error = byId<HTMLParagraphElement>(form, "sms-error");
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      try {
        network.deliver({ number: number.value, text: text.value, sentAt: now() });
        error.hidden = true;
      } catch (failure) {
        error.textContent = (failure as Error).message;
        error.hidden = false;
      }
    });
    const sent = html(`
      <div class="sent-sms">
        <p class="note">Sent SMS (the synthetic network accepts every one):</p>
        <ol id="sms-sent"></ol>
      </div>`);
    sentList = byId<HTMLOListElement>(sent, "sms-sent");
    slots.control(form);
    slots.control(sent);
  },
  config: () => ({ network }),
  frame: refreshSent,
  status: () => `SMS sent: ${network.sent.length}`,
};
