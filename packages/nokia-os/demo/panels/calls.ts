// Calls (plan 22) over the page's synthetic network (the messages panel's): "Incoming call" rings
// the phone from a number, "Far end hangs up" ends the call the network rang, and the numbers the
// phone dialled are listed with the phone book name it knew. A host would back
// `StockNetworkPort.dial`/`subscribeCalls` with its own service (README "Calls").
import type { SyntheticRing } from "../../src/index";
import { byId, html, type DemoPanel } from "../panel";
import { network } from "./messages";

let ring: SyntheticRing | undefined;
let dialledList: HTMLOListElement | undefined;
let shown = 0;

function refreshDialled(): void {
  if (dialledList === undefined || network.dialled.length === shown) return;
  for (const call of network.dialled.slice(shown)) {
    const item = document.createElement("li");
    const name = call.name === undefined ? "" : ` (${call.name})`;
    item.textContent = `${call.number}${name}${call.emergency ? " — emergency" : ""}`;
    dialledList.append(item);
  }
  shown = network.dialled.length;
}

export const callsPanel: DemoPanel = {
  name: "calls",
  plan: 22,
  mount(slots) {
    const form = html<HTMLFormElement>(`
      <form id="call-form" aria-label="Incoming call">
        <label>
          From
          <input id="call-number" value="0412345678" autocomplete="off" spellcheck="false" />
        </label>
        <button type="submit">Incoming call</button>
        <button type="button" id="call-hangup">Far end hangs up</button>
      </form>`);
    const number = byId<HTMLInputElement>(form, "call-number");
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      ring = network.ring(number.value);
    });
    byId<HTMLButtonElement>(form, "call-hangup").addEventListener("click", () => {
      ring?.hangUp();
    });
    const dialled = html(`
      <div class="dialled-calls">
        <p class="note">Numbers the phone dialled (the synthetic cell answers every call):</p>
        <ol id="calls-dialled"></ol>
      </div>`);
    dialledList = byId<HTMLOListElement>(dialled, "calls-dialled");
    slots.control(form);
    slots.control(dialled);
  },
  frame: refreshDialled,
  status: () => `calls dialled: ${network.dialled.length}${ring ? `, ring ${ring.state}` : ""}`,
};
