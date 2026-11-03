// The phone book's Send b'card (plan 19 Task 10, D10): a name's card to a typed number through
// the network port (`phone-book/bcard-*`).
import type { StockServices } from "../firmware/features/feature";
import { timelineById, timelineByName } from "../kit/ui/timelines";
import type { WidgetModel } from "../kit/ui/display/widgets";
import { COMPOSED_FLOWS } from "../messages/bindings";
import type { StockSendOutcome } from "../services/messaging/network";
import type { Flow, Widget } from "../kit/ui/widgets/flow";
import { interlude } from "../kit/ui/widgets/interlude";
import { note } from "../kit/ui/widgets/note";
import { numberEntry } from "../kit/ui/widgets/number-entry";
import { Playback } from "../kit/ui/widgets/playback";
import type { PhoneBookEntry } from "../services/phone-book/entries";
import { emptyNote, names, pickNumber } from "./flows";
import { BCARD_LINK_MS, BCARD_OK_MS } from "./timings";

/** Plan 14's Requesting bar (7-6), as plan 18's `Sending message` loops it. */
const SENDING_BAR = "7-6";

/**
 * `Sending b'card` (the bar looping, no soft key) until the port settles and BCARD_LINK_MS has
 * passed; then `Business card sent` (or plan 18's failure note) and the list.
 */
function sending(services: StockServices, entry: PhoneBookEntry, to: string): Widget {
  const bar = new Playback(timelineById(SENDING_BAR, "Sending b'card's bar"));
  let outcome: StockSendOutcome | undefined;
  services.messaging.sendBusinessCard(
    { to, card: { name: entry.name, number: entry.number } },
    BCARD_LINK_MS,
    (settled) => {
      outcome = settled;
    },
  );
  return {
    render(): WidgetModel {
      const frame = bar.frame;
      if (frame.kind !== "sprite") throw new Error(`Sending's bar cannot show "${frame.kind}".`);
      return { kind: "progress", text: ["Sending", "b'card"], bar: frame.sprite, softkey: "" };
    },
    tick(dtMs, flow) {
      bar.advance(dtMs);
      if (outcome === undefined) return;
      const failed = COMPOSED_FLOWS.sendFailed;
      flow.replace(
        outcome === "sent"
          ? note({
              lines: ["Business", "card sent"],
              timeline: timelineByName("bcard-sent"),
              sound: services.noteSound,
            })
          : note({
              lines: failed.lines,
              timeline: timelineByName(failed.timeline),
              sound: services.noteSound,
            }),
      );
    },
  };
}

/** `Phone number:` for the card (30 digits, `Search`: the name list with `OK`). */
function cardNumber(services: StockServices, entry: PhoneBookEntry, number: string): Widget {
  return numberEntry({
    label: ["Phone number:"],
    number,
    done: (to, flow) => flow.replace(sending(services, entry, to)),
    search: (flow) =>
      pickNumber(services, flow, (picked, inner) =>
        inner.replace(cardNumber(services, entry, picked)),
      ),
  });
}

/**
 * 1-7 Send b'card (S12): the list with `Send` → the list's icon and `OK` alone (114 ms) →
 * `Phone number:` → `Sending b'card` → `Business card sent` → the list. An empty SIM: plan 14's
 * note.
 */
export function sendBusinessCard(services: StockServices): Widget {
  if (services.phoneBook.entries().length === 0) return emptyNote(services, "1-7");
  return names(services, {
    softkey: "Send",
    choose(entry, flow) {
      flow.push(
        interlude(
          { kind: "name-list", view: "large", name: "", softkey: "OK" },
          BCARD_OK_MS,
          (inner: Flow) => inner.replace(cardNumber(services, entry, "")),
        ),
      );
    },
  });
}
