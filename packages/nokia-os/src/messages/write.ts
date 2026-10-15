// Write messages (2-1, plan 18 Task 10): the multi-tap SMS editor and its Options as Task 0
// recorded them (`text/options`, `sms/*`), sending through the phone's network port (D9) and
// saving to Outbox (D8). Reply, Edit and Forward (Task 11) open the same editor.
import type { StockServices } from "../firmware/features/feature";
import { timelineById, timelineByName } from "../firmware/timelines";
import type { WidgetModel } from "../display/widgets";
import { SAVING_MS } from "../resources";
import { editor, type EditorControl } from "../widgets/editor";
import type { Flow, Widget } from "../widgets/flow";
import { BLANK, interlude, softkeyAlone } from "../widgets/interlude";
import { note } from "../widgets/note";
import { numberEntry } from "../widgets/number-entry";
import { OptionListWidget } from "../widgets/option-list";
import { Playback } from "../widgets/playback";
import { textInput } from "../widgets/text-input";
import { COMPOSED_FLOWS, DICTIONARY_KEY, DICTIONARY_LABELS, EDITOR_OPTIONS } from "./bindings";
import type { StockSms } from "./network";

/** An SMS holds 459 characters in three parts (`text/counter` 459: `0/3`). */
export const SMS_LIMIT = 459;

/** Set 2's message centre number (empty in the virgin SIM). */
const SET_2_CENTRE_KEY = "messages/message-settings/set-2/message-centre-number";

/** Before `Saving message` the LCD is blank for 32 ms (`sms/save` frame 1). */
export const SAVE_BLANK_MS = 32;
/** Before `Message memory full` the LCD is blank for 68 ms (`sms/full-save` frame 1). */
export const FULL_BLANK_MS = 68;
/** Send to many draws its note's `OK` alone first for 168 ms (`sms/send-to-many` frame 1). */
export const SEND_TO_MANY_SOFTKEY_MS = 168;
/** Exit draws standby without its operator for 83 ms before standby (`sms/exit` frame 1). */
export const EXIT_STANDBY_DRAW_MS = 83;
/** A set's Numeric/Alphanumeric list draws its `OK` alone first for 115 ms (`send-by-set-set-2`). */
export const SET_SOFTKEY_MS = 115;
/**
 * The Routing address text input's limit (UNVERIFIED: the capture types four characters and
 * shows no counter).
 */
export const ROUTING_ADDRESS_LIMIT = 20;

/**
 * Where the editor starts (Reply, Edit, Forward): its text, and the number Send's prompt starts
 * with (Reply: the sender, `sms/inbox-option-typed` reply-prompt).
 */
export interface SmsDraft {
  readonly text?: string;
  readonly number?: string;
}

/** The Requesting bar's timeline (plan 14's 7-6: `Sending message` shows the same sprites). */
const SENDING_BAR = "7-6";

/**
 * `Sending message` (D9, D10): the Requesting bar looping under `Sending` / `message` with no
 * soft key, until the send settles; then `Message sent` (or the composed failure note, D14) and
 * back to the editor below. Keys do nothing while it sends.
 */
function sending(services: StockServices, sms: StockSms): Widget {
  const bar = new Playback(timelineById(SENDING_BAR, "Sending message's bar"));
  let outcome: "sent" | "failed" | undefined;
  services.messaging.send(sms, (settled) => {
    outcome = settled;
  });
  return {
    render() {
      const frame = bar.frame;
      if (frame.kind !== "sprite") throw new Error(`Sending's bar cannot show "${frame.kind}".`);
      return { kind: "progress", text: ["Sending", "message"], bar: frame.sprite, softkey: "" };
    },
    tick(dtMs, flow) {
      bar.advance(dtMs);
      if (outcome === undefined) return;
      const failed = COMPOSED_FLOWS.sendFailed;
      flow.replace(
        outcome === "sent"
          ? note({
              lines: ["Message", "sent"],
              timeline: timelineByName("message-sent"),
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

/**
 * Sends `text` to `number`: the screens above the editor (`above` of them, the top one included)
 * give way to `Sending message`.
 */
function send(
  services: StockServices,
  flow: Flow,
  above: number,
  number: string,
  text: string,
): void {
  if (above > 1) flow.back(above - 1);
  flow.replace(sending(services, { number, text }));
}

/** The number prompt of Send and of Send by set › Numeric (`text/number`). */
function phoneNumber(
  services: StockServices,
  text: string,
  number: string,
  above: number,
  set2: boolean,
): Widget {
  return numberEntry({
    label: ["Phone number:"],
    number,
    done: (typed, flow) =>
      set2 && (services.settings.text(SET_2_CENTRE_KEY) ?? "") === ""
        ? flow.push(set2Centre(services, text, typed, above + 1))
        : send(services, flow, above, typed, text),
  });
}

/**
 * Set 2 without a message centre asks for one before sending (Task 0 evidence
 * `sms/fail/set-2`, not imported: `Message centre` / `number:`, Search). OK stores it and sends
 * (UNVERIFIED: the capture stops at the prompt).
 */
function set2Centre(services: StockServices, text: string, number: string, above: number): Widget {
  return numberEntry({
    label: ["Message centre", "number:"],
    counter: false,
    done(centre, flow) {
      services.settings.setText(SET_2_CENTRE_KEY, centre);
      send(services, flow, above, number, text);
    },
  });
}

/** A choice another plan implements, inside the flow (C goes back). */
function placeholder(label: string): Widget {
  return {
    render: () => ({ kind: "placeholder", label }),
    onKey(key, flow) {
      if (key === "c") flow.back();
    },
  };
}

/**
 * Options › Dictionary (`text/dictionary-off`): the list opens on the stored dictionary
 * (Dictionary off, D3); Dictionary off shows `T9 dictionary deactivated`, then the editor; the
 * T9 dictionaries are plan 18b's.
 */
function dictionary(services: StockServices): Widget {
  const { settings, noteSound } = services;
  const deactivated = timelineByName("t9-dictionary-deactivated");
  return new OptionListWidget({
    labels: DICTIONARY_LABELS,
    opening: settings.choice(DICTIONARY_KEY),
    softkey: "OK",
    numbering: "option",
    choose(index, flow) {
      if (index !== 0) {
        flow.push(placeholder(DICTIONARY_LABELS[index]!));
        return;
      }
      settings.choose(DICTIONARY_KEY, index);
      // The list closes, its note replaces Options, then the editor.
      flow.back();
      flow.replace(
        note({
          lines: ["T9", "dictionary", "deactivated"],
          timeline: deactivated,
          sound: noteSound,
        }),
      );
    },
  });
}

/**
 * Options › Send by set (`text/input`, `sms/send-by-set-*`): Set 1, Set 2 (indicator `6-k`), each
 * opening Numeric (a number prompt) and Alphanumeric (`Routing address:`, a text input in ABC).
 */
function sendBySet(services: StockServices, text: string): Widget {
  const prefix = [EDITOR_OPTIONS.findIndex((o) => o.label === "Send by set") + 1];
  const kinds = (set2: boolean): Widget =>
    new OptionListWidget({
      labels: ["Numeric", "Alphanumeric"],
      opening: 0,
      softkey: "OK",
      indicatorPrefix: prefix,
      choose(index, flow) {
        // Above the editor: Options, the sets, this list (replaced by the prompt).
        const above = 3;
        flow.replace(
          index === 0
            ? phoneNumber(services, text, "", above, set2)
            : textInput({
                label: ["Routing address:"],
                limit: ROUTING_ADDRESS_LIMIT,
                mode: "ABC",
                done: (address, inner) => send(services, inner, above, address, text),
              }),
        );
      },
    });
  return new OptionListWidget({
    labels: ["Set 1", "Set 2"],
    opening: 0,
    softkey: "Select",
    indicatorPrefix: prefix,
    choose(index, flow) {
      flow.push(
        interlude(softkeyAlone("OK"), SET_SOFTKEY_MS, (inner) => inner.replace(kinds(index === 1))),
      );
    },
  });
}

/**
 * Options › Save (D8, `sms/save`): a blank moment, `Saving message` under the bar's first
 * frame, `Message saved`, the editor; with every slot used, `Message memory full`
 * (`sms/full-save`).
 */
function save(services: StockServices, flow: Flow, text: string, number?: string): void {
  const { messaging, noteSound } = services;
  const result = messaging.store.save(text, number);
  if (result === "full") {
    flow.replace(
      interlude(BLANK, FULL_BLANK_MS, (inner) =>
        inner.replace(
          note({
            lines: ["Message", "memory", "full"],
            timeline: timelineByName("message-memory-full"),
            sound: noteSound,
          }),
        ),
      ),
    );
    return;
  }
  const savingScreen = interlude(
    { kind: "progress", text: "Saving message", bar: "progress-1", softkey: "" },
    SAVING_MS,
    (inner) =>
      inner.replace(
        note({
          lines: ["Message", "saved"],
          timeline: timelineByName("message-saved"),
          sound: noteSound,
        }),
      ),
  );
  flow.replace(interlude(BLANK, SAVE_BLANK_MS, (inner) => inner.replace(savingScreen)));
}

/** Standby's first draw (`sms/exit` frame 1): no operator, the host's clock. */
function standbyDraw({ ports }: StockServices): WidgetModel {
  const clock = ports.clock?.();
  return { kind: "standby-draw", ...(clock === undefined ? {} : { clock }) };
}

/** The multi-tap editor's Options (`text/options`), over the editor whose text is `entry`'s. */
function editorOptions(services: StockServices, entry: EditorControl, draft: SmsDraft): Widget {
  const actions: Readonly<Record<string, (flow: Flow) => void>> = {
    Send: (flow) => flow.replace(phoneNumber(services, entry.text, draft.number ?? "", 1, false)),
    "Send to many": (flow) =>
      flow.replace(
        interlude(softkeyAlone("OK"), SEND_TO_MANY_SOFTKEY_MS, (inner) =>
          inner.replace(
            note({
              lines: ["No phone", "numbers"],
              timeline: timelineByName("no-phone-numbers"),
              sound: services.noteSound,
            }),
          ),
        ),
      ),
    // No response in the captured state (`sms/template`, `sms/insert-smiley`).
    Template: () => {},
    "Insert smiley": () => {},
    Dictionary: (flow) => flow.push(dictionary(services)),
    "Send by set": (flow) => flow.push(sendBySet(services, entry.text)),
    Save: (flow) => save(services, flow, entry.text, draft.number),
    Erase: (flow) => {
      entry.clear();
      flow.back();
    },
    Exit: (flow) =>
      flow.replace(
        interlude(standbyDraw(services), EXIT_STANDBY_DRAW_MS, (inner) => inner.standby()),
      ),
  };
  return new OptionListWidget({
    labels: EDITOR_OPTIONS.map((option) => option.label),
    opening: 0,
    softkey: "OK",
    numbering: "option",
    choose: (index, flow) => actions[EDITOR_OPTIONS[index]!.label]!(flow),
  });
}

/** The SMS editor (2-1, Reply, Edit, Forward) with its Options. */
export function smsEditor(services: StockServices, draft: SmsDraft = {}): Widget {
  return editor({
    counter: "sms",
    limit: SMS_LIMIT,
    layout: "sms",
    softkey: "Options",
    ...(draft.text === undefined ? {} : { text: draft.text }),
    options: (flow, entry) => flow.push(editorOptions(services, entry, draft)),
  });
}
