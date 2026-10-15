// Chat and Messages content (plan 18c): a deterministic Chat partner on the messages panel's
// synthetic network. Chat sends each line as an SMS `<name>: <text>` to the chat's number; an SMS
// delivered from that same number while Chat runs is the partner's line (`>text` in the history,
// not stored in Inbox). The partner below answers every chat line sent to its number, as a host
// such as the website's LLM contacts would through `StockNetworkPort`. Templates, Smileys and an
// empty Topics list appear after Factory settings (the storage panel): the virgin EEPROM has none.
import { byId, html, type DemoPanel } from "../panel";
import { network, now } from "./messages";

/** A chat line on the air: `<name>: <text>` (`: <text>` with no name). */
const CHAT_LINE = /^([^:]*): ([\s\S]*)$/;

/** The partner's reply to `text` from `name`: deterministic, within one SMS. */
function partnerReply(name: string, text: string): string {
  const reply = `${name === "" ? "Hi" : `Hi ${name}`}, you said "${text}"`;
  return reply.length <= 160 ? reply : `${reply.slice(0, 159)}"`;
}

let partner: HTMLInputElement | undefined;
let answering: HTMLInputElement | undefined;
let seen = 0;
let answered = 0;

/** Answers the chat lines phones sent to the partner's number since the last frame. */
function answer(): void {
  const sent = network.sent;
  for (const sms of sent.slice(seen)) {
    if (answering?.checked !== true || sms.number !== partner?.value) continue;
    const line = CHAT_LINE.exec(sms.text);
    if (line === null) continue;
    network.deliver({ number: sms.number, text: partnerReply(line[1]!, line[2]!), sentAt: now() });
    answered++;
  }
  seen = sent.length;
}

export const chatAndContentPanel: DemoPanel = {
  name: "chat-and-content",
  plan: 18,
  mount(slots) {
    const form = html(`
      <div class="chat-partner" aria-label="Chat partner">
        <label>
          Chat partner's number
          <input id="chat-partner" value="0412345678" autocomplete="off" spellcheck="false" />
        </label>
        <label><input id="chat-answer" type="checkbox" checked /> Answer chat lines</label>
        <p class="note">
          Menu 3 (Chat): type this number, a chat name and a line, then Options › Send. The
          partner answers each line about 2.3 s later (the phone's receive link time).
          Templates and Smileys (Messages 5 and 6) appear after Factory settings.
        </p>
      </div>`);
    partner = byId<HTMLInputElement>(form, "chat-partner");
    answering = byId<HTMLInputElement>(form, "chat-answer");
    seen = network.sent.length;
    slots.control(form);
  },
  frame: answer,
  status: () => `Chat replies: ${answered}`,
};
