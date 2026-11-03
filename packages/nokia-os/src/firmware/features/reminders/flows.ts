// Reminders' screens (plan 21 Task 11, Task 0's `reminders/*`): Add new (`Remind about:`, `Alarm
// on`/`Alarm off`, `Reminder date:`, `Reminder time:`, `Reminder set`), the memory full query,
// View all (one reminder a screen, ▲/▼ round, Options: Erase, Edit, Send), Erase › One by one and
// Erase › All.
import type { PhoneKey } from "@hellotimber/phone-core";
import { textWidth } from "@hellotimber/phone-screen";
import { STOCK_FONTS } from "../../../kit/ui/resources";
import type { ReminderViewModel } from "../../../kit/ui/display/widgets";
import { pickNumber } from "../../../phone-book/flows";
import { confirmQuery } from "../../../kit/ui/widgets/confirm";
import type { Flow, Widget } from "../../../kit/ui/widgets/flow";
import { interlude, softkeyAlone } from "../../../kit/ui/widgets/interlude";
import { note } from "../../../kit/ui/widgets/note";
import { numberEntry } from "../../../kit/ui/widgets/number-entry";
import { OptionListWidget } from "../../../widgets/option-list";
import { Playback } from "../../../kit/ui/widgets/playback";
import type { ListNumbering } from "../../../kit/ui/widgets/rows";
import { textInput } from "../../../kit/ui/widgets/text-input";
import { timelineByName } from "../../../kit/ui/timelines";
import { clockEntry, clockNote, entryBlink, needsClock } from "../clock";
import { phoneClock } from "../../../kit/system/clock/registry";
import { formatDate, type PhoneTime } from "../../../kit/system/clock/time";
import type { StockServices } from "../feature";
import { phoneReminders } from "./service";
import { REMINDER_TEXT_LIMIT, type Reminder } from "./store";

/** The transmission after `Phone number:`: Smart Messaging's, not yet built (D14); C goes back. */
function sendPlaceholder(): Widget {
  return {
    render: () => ({ kind: "placeholder", label: "Send" }),
    onKey(key: PhoneKey, flow: Flow) {
      if (key === "c") flow.back();
    },
  };
}

/** Options › Send draws `OK` alone this long before `Phone number:` (`reminders/view-*-send`). */
const SEND_OK_MS = 120;

/**
 * `Phone number:` for the reminder (`Search`: the phone book's names with `OK`). It opens on the
 * cursor's hidden step, as Edit's prompt (`reminders/view-1-send`, `view-2-send`; `view-3-send`
 * opened shown: a known gap).
 */
function sendNumber(services: StockServices, number: string): Widget {
  const entry = numberEntry({
    label: ["Phone number:"],
    number,
    done: (_to, flow) => flow.replace(sendPlaceholder()),
    search: (flow) =>
      pickNumber(services, flow, (picked, inner) => inner.replace(sendNumber(services, picked))),
  });
  return withBlink(entry, hiddenFirstBlink());
}

/** Options › Send: `OK` alone, then `Phone number:`, as the phone book's Send b'card. */
function send(services: StockServices): Widget {
  return interlude(softkeyAlone("OK"), SEND_OK_MS, (inner) =>
    inner.replace(sendNumber(services, "")),
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

/** `hh:mm dd.mm`, as View all's top row shows a reminder's alarm. */
export function whenOf(alarm: PhoneTime): string {
  return `${pad(alarm.hour)}:${pad(alarm.minute)} ${pad(alarm.day)}.${pad(alarm.month)}`;
}

const LCD_WIDTH = 84;

/**
 * How the `Alarm on` / `Alarm off` rows number themselves: Add new's by the tree (`10-1-1`), Edit's
 * after its Options row (`2-1`, `reminders/view-*-edit-ok`).
 */
type ChoiceNumbering =
  | { readonly numbering: ListNumbering }
  | { readonly indicatorPrefix: readonly number[] };

/** What a finished Add new (or Edit) does with the text and alarm. */
type Save = (text: string, alarm: PhoneTime | null, flow: Flow, levels: number) => void;

/**
 * `Remind about:` → `Alarm on` / `Alarm off` → (on) `Reminder date:` → `Reminder time:` → `save`.
 * C goes back one step; the text is kept. `levels`: the widgets below the text prompt in its flow.
 */
function reminderFlow(
  services: StockServices,
  numbering: ChoiceNumbering,
  save: Save,
  text = "",
  below = 0,
): Widget {
  return withBlink(
    textInput({
      label: ["Remind about:"],
      limit: REMINDER_TEXT_LIMIT,
      counter: true,
      text,
      restartBlinkOnKey: true,
      done: (typed, flow) => flow.push(alarmChoice(services, numbering, typed, save, below)),
    }),
    openingBlink(text),
  );
}

/**
 * The text prompt's first blink: Add new's as plan 14's recording of 10-1 (shown first); Edit's
 * opens on the hidden step (`reminders/view-1-edit`, `view-2-edit`; `view-3-edit` opened shown:
 * a known gap).
 */
function openingBlink(text: string): Playback {
  return text === "" ? new Playback(entryBlink("10-1")) : hiddenFirstBlink();
}

/** The 10-1 blink from its hidden step. */
function hiddenFirstBlink(): Playback {
  const blink = new Playback(entryBlink("10-1"));
  const first = blink.frame;
  while (blink.frame === first) blink.advance(1);
  return blink;
}

/**
 * `widget` (a prompt) with its cursor blinking on `blink` until the first key (plan 14's
 * recording of the node's, `tree/10-reminders/10-1.leaf`: its first step is 482 ms, not the
 * entry's 480); from the first key the entry's own blink.
 */
function withBlink(widget: Widget, blink: Playback): Widget {
  let touched = false;
  return {
    render: (flow) => {
      const model = widget.render(flow);
      return model.kind === "prompt" && !touched
        ? { ...model, cursor: blink.frame.kind === "cursor" }
        : model;
    },
    onKey: (key, flow) => widget.onKey?.(key, flow),
    onKeyDown: (key, flow) => {
      touched = true;
      widget.onKeyDown?.(key, flow);
    },
    reveal: () => {
      touched = true;
      widget.reveal?.();
    },
    tick: (dtMs, flow) => {
      blink.advance(dtMs);
      widget.tick?.(dtMs, flow);
    },
    close: () => widget.close?.(),
  };
}

/** `Alarm on` / `Alarm off` (`10-1-1`, `10-1-2`; plan21 reminders/alarm-choice). */
function alarmChoice(
  services: StockServices,
  numbering: ChoiceNumbering,
  text: string,
  save: Save,
  below: number,
): Widget {
  return new OptionListWidget({
    labels: ["Alarm on", "Alarm off"],
    opening: 0,
    softkey: "OK",
    ...numbering,
    choose: (index, flow) => {
      if (index === 1) {
        save(text, null, flow, below + 2);
        return;
      }
      flow.push(dateEntry(services, text, save, below));
    },
  });
}

/** `Reminder date:` on today; its cursor's blink carries on into `Reminder time:`. */
function dateEntry(services: StockServices, text: string, save: Save, below: number): Widget {
  const clock = phoneClock(services);
  const blink = new Playback(entryBlink("11-3"));
  return clockEntry(services, {
    blink,
    label: "Reminder date:",
    mask: "dd.mm.yyyy",
    initial: formatDate(clock.now()!),
    node: "11-3",
    done: (date, flow) => {
      const [day, month, year] = date.split(".").map(Number) as [number, number, number];
      flow.push(
        clockEntry(services, {
          blink,
          label: "Reminder time:",
          mask: "hh:mm",
          invalidAtField: true,
          node: "11-3",
          done: (time, inner) => {
            const alarm = {
              year,
              month,
              day,
              hour: Number(time.slice(0, 2)),
              minute: Number(time.slice(3)),
            };
            save(text, alarm, inner, below + 4);
          },
        }),
      );
    },
  });
}

/** `Reminder set`, back to the Reminders level (`levels` widgets closed). */
function reminderSet(services: StockServices, flow: Flow, levels: number): void {
  flow.replace(clockNote(services, ["Reminder", "set"], "reminder-set", { levels }));
}

/**
 * Add new (10-1): without a time `Clock needs to be set first`; with the memory full `Memory full.
 * Replace old reminder?` (OK: the reminders one by one with `Erase`, the one chosen replaced; C:
 * back); else the flow, saved as a new reminder.
 */
export function addNew(services: StockServices, numbering: ListNumbering): () => Widget {
  return () =>
    needsClock(services, () => {
      const reminders = phoneReminders(services);
      const add =
        (replacing?: Reminder): Save =>
        (text, alarm, flow, levels) => {
          if (replacing !== undefined) reminders.erased(replacing);
          reminders.store.add(text, alarm, replacing);
          reminderSet(services, flow, levels);
        };
      if (!reminders.store.full()) return reminderFlow(services, { numbering }, add());
      return confirmQuery({
        lines: ["Memory full.", "Replace old", "reminder?"],
        tops: [4, 13, 22],
        softkey: "OK",
        confirm: (flow) =>
          flow.push(
            new ReminderViewer(services, {
              softkey: "Erase",
              choose: (old, inner) =>
                inner.push(reminderFlow(services, { numbering }, add(old), "", 2)),
            }),
          ),
      });
    });
}

interface ViewerOptions {
  readonly softkey: string;
  /** Navi on `reminder`. */
  readonly choose: (reminder: Reminder, flow: Flow) => void;
}

/** One reminder a screen, in View all's order; ▲/▼ go round. */
class ReminderViewer implements Widget {
  readonly #services: StockServices;
  readonly #options: ViewerOptions;
  #index = 0;

  constructor(services: StockServices, options: ViewerOptions) {
    this.#services = services;
    this.#options = options;
  }

  #list(): readonly Reminder[] {
    return phoneReminders(this.#services).store.list();
  }

  /** The reminder shown (the list may have changed under it: an erase). */
  current(): Reminder | undefined {
    const list = this.#list();
    if (list.length === 0) return undefined;
    this.#index = Math.min(this.#index, list.length - 1);
    return list[this.#index];
  }

  render(): ReminderViewModel {
    const reminder = this.current();
    return {
      kind: "reminder-view",
      number: this.#index + 1,
      ...(reminder?.alarm ? { when: whenOf(reminder.alarm) } : {}),
      text: reminder?.text ?? "",
      softkey: this.#options.softkey,
    };
  }

  tick(_dtMs: number, flow: Flow): void {
    // Erased down to none: back to the level.
    if (this.current() === undefined) flow.back();
  }

  onKey(key: PhoneKey, flow: Flow): void {
    const count = this.#list().length;
    if (key === "down") this.#index = (this.#index + 1) % count;
    else if (key === "up") this.#index = (this.#index + count - 1) % count;
    else if (key === "c") flow.back();
    else if (key === "navi") {
      const reminder = this.current();
      if (reminder !== undefined) this.#options.choose(reminder, flow);
    }
  }
}

/**
 * `text` as a query's small-face lines: broken at spaces where they fit the screen, a word wider
 * than it at the edge; at most three lines (UNVERIFIED past one: no capture shows a longer text).
 */
function queryLines(text: string): string[] {
  const font = STOCK_FONTS.small;
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const joined = line === "" ? word : `${line} ${word}`;
    if (textWidth(font, joined) <= LCD_WIDTH) {
      line = joined;
      continue;
    }
    if (line !== "") lines.push(line);
    line = "";
    for (const ch of Array.from(word)) {
      if (line !== "" && textWidth(font, line + ch) > LCD_WIDTH) {
        lines.push(line);
        line = "";
      }
      line += ch;
    }
  }
  if (line !== "") lines.push(line);
  return lines.slice(0, 3);
}

/** `Erase? <text>` (OK), then `Reminder erased` and back to the screen below. */
function eraseQuery(services: StockServices, reminder: Reminder): Widget {
  const reminders = phoneReminders(services);
  return confirmQuery({
    lines: queryLines(`Erase? ${reminder.text}`),
    softkey: "OK",
    confirm: (flow) => {
      reminders.store.erase(reminder);
      reminders.erased(reminder);
      flow.replace(
        note({
          lines: ["Reminder", "erased"],
          timeline: timelineByName("reminder-erased"),
          end: "back",
          sound: services.noteSound,
        }),
      );
    },
  });
}

/**
 * View all (10-2; no reminder: it returns at once, `exitsWhen`): Options (`Erase`, `Edit`,
 * `Send`: `Phone number:`, then Smart Messaging's transmission, a placeholder).
 */
export function viewAll(services: StockServices): () => Widget {
  return () =>
    new ReminderViewer(services, {
      softkey: "Options",
      choose: (reminder, flow) =>
        flow.push(
          new OptionListWidget({
            labels: ["Erase", "Edit", "Send"],
            opening: 0,
            softkey: "OK",
            numbering: "option",
            choose: (index, inner) => {
              if (index === 0) inner.replace(eraseQuery(services, reminder));
              else if (index === 1) {
                const save: Save = (text, alarm, f, levels) => {
                  phoneReminders(services).store.edit(reminder, text, alarm);
                  f.replace(clockNote(services, ["Reminder", "set"], "reminder-set", { levels }));
                };
                inner.replace(
                  reminderFlow(services, { indicatorPrefix: [2] }, save, reminder.text, 1),
                );
              } else inner.replace(send(services));
            },
          }),
        ),
    });
}

/**
 * Erase (10-3): One by one (the reminders with `Erase`, ▼ to the next, OK: `Erase? <text>`) and
 * All (`Are you sure?`, `Reminder memory empty`; the junk reminder too, D8).
 */
export function erase(services: StockServices, numbering: ListNumbering): () => Widget {
  const reminders = phoneReminders(services);
  return () =>
    new OptionListWidget({
      labels: ["One by one", "All"],
      opening: 0,
      softkey: "OK",
      numbering,
      choose: (index, flow) => {
        if (index === 0) {
          // Only the dormant junk reminder: back to the level at once (plan21 virgin-erase-one).
          if (reminders.store.list().length === 0) flow.back();
          else
            flow.replace(
              new ReminderViewer(services, {
                softkey: "Erase",
                choose: (reminder, inner) => inner.push(eraseQuery(services, reminder)),
              }),
            );
          return;
        }
        flow.push(
          confirmQuery({
            lines: ["Are you", "sure?"],
            softkey: "Yes",
            confirm: (inner) => {
              for (const reminder of reminders.store.list()) reminders.erased(reminder);
              reminders.store.eraseAll();
              inner.back();
              inner.replace(
                note({
                  lines: ["Reminder", "memory", "empty"],
                  timeline: timelineByName("reminder-memory-empty"),
                  sound: services.noteSound,
                }),
              );
            },
          }),
        );
      },
    });
}
