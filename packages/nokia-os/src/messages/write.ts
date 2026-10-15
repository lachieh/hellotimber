// Write messages (2-1, plan 18 Task 10): the multi-tap SMS editor and its Options as Task 0
// recorded them (`text/options`, `sms/*`), sending through the phone's network port (D9) and
// saving to Outbox (D8). Reply, Edit and Forward (Task 11) open the same editor. Plan 18b: while
// Dictionary is English (and the host gave a T9 dictionary) the editor writes in T9, with the T9
// Options (Matches, Insert word, Insert number, Insert symbol) and the Spell prompt.
import type { StockServices } from "../firmware/features/feature";
import { timelineById, timelineByName } from "../firmware/timelines";
import type { WidgetModel } from "../display/widgets";
import { SAVING_MS } from "../resources";
import type { T9Context } from "../text/t9/editing";
import { editor, smsCounter, type EditorControl, type T9EditorControl } from "../widgets/editor";
import { symbolTable } from "../widgets/symbol-table";
import type { Flow, Widget } from "../widgets/flow";
import { BLANK, interlude, softkeyAlone } from "../widgets/interlude";
import { note } from "../widgets/note";
import { numberEntry } from "../widgets/number-entry";
import { OptionListWidget } from "../widgets/option-list";
import { Playback } from "../widgets/playback";
import { textInput } from "../widgets/text-input";
import {
  COMPOSED_FLOWS,
  DICTIONARY_KEY,
  DICTIONARY_LABELS,
  DICTIONARY_OWNERS,
  EDITOR_OPTIONS,
  T9_EDITOR_OPTIONS,
} from "./bindings";
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

const ENGLISH = DICTIONARY_LABELS.indexOf("English");

/**
 * Options › Dictionary (`text/dictionary-off`, `t9/dictionary-list`, `t9/dictionary-off-on`): the
 * list opens on the stored dictionary. Dictionary off shows `T9 dictionary deactivated`, English
 * `T9 dictionary activated` (the same tick note; plan 18b: the golden shows it where the spec
 * said none), then the editor in its new mode. The Cyrillic dictionaries are plan 26's
 * placeholders, and English is the host's (`config.t9`, D5) without a T9 dictionary.
 */
function dictionary(services: StockServices): Widget {
  const { settings, noteSound } = services;
  const notes = [
    { lines: ["T9", "dictionary", "deactivated"], timeline: "t9-dictionary-deactivated" },
    { lines: ["T9", "dictionary", "activated"], timeline: "t9-dictionary-activated" },
  ] as const;
  return new OptionListWidget({
    labels: DICTIONARY_LABELS,
    opening: settings.choice(DICTIONARY_KEY),
    softkey: "OK",
    numbering: "option",
    choose(index, flow) {
      const label = DICTIONARY_LABELS[index]!;
      const owned = index === ENGLISH && services.t9.english !== undefined ? undefined : label;
      if (owned !== undefined && DICTIONARY_OWNERS[owned] !== undefined) {
        flow.push(placeholder(label));
        return;
      }
      settings.choose(DICTIONARY_KEY, index);
      const shown = notes[index === 0 ? 0 : 1];
      // The list closes, its note replaces Options, then the editor.
      flow.back();
      flow.replace(
        note({ lines: shown.lines, timeline: timelineByName(shown.timeline), sound: noteSound }),
      );
    },
  });
}

/** The editor's T9 context: the host's English dictionary while Dictionary is English (18b). */
function t9Context(services: StockServices): T9Context | undefined {
  const english = services.t9.english;
  if (english === undefined || services.settings.choice(DICTIONARY_KEY) !== ENGLISH) {
    return undefined;
  }
  return { dictionary: english, user: services.t9.userWords() };
}

/**
 * Options › Matches (spec 10.2, `t9/g-matches`): the composing word's other candidates, then
 * itself; Use shows the chosen one, still composing, in the editor; C goes back to Options.
 */
function matches(t9: T9EditorControl): Widget {
  return new OptionListWidget({
    labels: t9.matches(),
    opening: 0,
    softkey: "Use",
    numbering: "option",
    choose(index, flow) {
      t9.useMatch(index);
      flow.back(2);
    },
  });
}

/**
 * The `Insert word:` prompt (spec 10.3; Options › Insert word, and Spell): plan 18's text input
 * with the multi-tap header, its case the editor's at the word, its counter the message's
 * (`t9/g-insert-word/04-typed`: `455/1` for `Hovo`). OK with text inserts it (Spell: in place
 * of the composing word) and stores the word around the cursor as a user word; OK or C on the
 * empty prompt goes back (`t9/insert-word-empty`).
 */
function insertWord(services: StockServices, entry: EditorControl, spell: boolean): Widget {
  const t9 = entry.t9!;
  const used = Array.from(spell ? t9.textBesideWord : entry.text).length;
  return textInput({
    label: ["Insert word:"],
    limit: SMS_LIMIT - used,
    counter: (length) => smsCounter(used + length, SMS_LIMIT),
    mode: (spell ? t9.wordSentenceStart : t9.sentenceStart) ? "Abc" : "abc",
    done(text, flow) {
      if (text !== "") services.t9.learn(spell ? t9.spell(text) : t9.insertWord(text));
      flow.back();
    },
  });
}

/**
 * Options › Insert number (the menu-tree crawl: `Insert number:` with OK; UNVERIFIED beyond it):
 * plan 18's number entry; OK inserts the number at the cursor.
 */
function insertNumber(entry: EditorControl): Widget {
  return numberEntry({
    label: ["Insert number:"],
    done(number, flow) {
      entry.insert(number);
      flow.back();
    },
  });
}

/**
 * Options › Send by set (`text/input`, `sms/send-by-set-*`): Set 1, Set 2 (indicator `6-k`), each
 * opening Numeric (a number prompt) and Alphanumeric (`Routing address:`, a text input in ABC).
 */
function sendBySet(services: StockServices, text: string, number: number): Widget {
  const prefix = [number];
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

/**
 * The editor's Options over the editor whose text is `entry`'s: multi-tap's nine
 * (`text/options`), or T9's twelve, thirteen with Matches while a word composes (plan 18b).
 */
function editorOptions(services: StockServices, entry: EditorControl, draft: SmsDraft): Widget {
  const t9 = entry.t9;
  const labels =
    t9 === undefined
      ? EDITOR_OPTIONS.map((option) => option.label)
      : T9_EDITOR_OPTIONS.filter((option) => !option.composing || t9.composing).map(
          (option) => option.label,
        );
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
    Matches: (flow) => flow.push(matches(t9!)),
    "Insert word": (flow) => flow.replace(insertWord(services, entry, false)),
    "Insert number": (flow) => flow.replace(insertNumber(entry)),
    "Insert symbol": (flow) =>
      flow.replace(symbolTable((symbol) => entry.insert(symbol), { t9: true })),
    Dictionary: (flow) => flow.push(dictionary(services)),
    "Send by set": (flow) =>
      flow.push(sendBySet(services, entry.text, labels.indexOf("Send by set") + 1)),
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
    labels,
    opening: 0,
    softkey: "OK",
    numbering: "option",
    choose: (index, flow) => actions[labels[index]!]!(flow),
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
    t9: () => t9Context(services),
    spell: (flow, entry) => flow.push(insertWord(services, entry, true)),
  });
}
