// Info service › Topics (2-8-4) and the Service command editor (2-10), plan 18c Task 9 as Task 0
// I and X captured them (`topics/*`, `service-command/*`, plan 14's `tree/02-messages/2-8-4-*`).
import type { PhoneKey } from "@hellotimber/phone-core";
import type { EditorModel } from "@hellotimber/nokia-kit/ui/display/widgets";
import type { StockServices } from "../firmware/features/feature";
import { nodeTimeline, timelineByName } from "@hellotimber/nokia-kit/ui/timelines";
import { TEXT_TIMINGS } from "@hellotimber/nokia-kit/ui/resources";
import {
  textClear,
  textDelete,
  textInsert,
  textMove,
  textTick,
  type TextState,
} from "@hellotimber/nokia-kit/ui/text/multitap";
import { editorModel, MODE_SPRITES, T9_MODE_X } from "@hellotimber/nokia-kit/ui/widgets/editor";
import { t9Context } from "../messages/write";
import type { Flow, Widget } from "@hellotimber/nokia-kit/ui/widgets/flow";
import { HeldC } from "@hellotimber/nokia-kit/ui/widgets/held-c";
import { multiSelect } from "../widgets/multi-select";
import { note, type NoteEnd } from "@hellotimber/nokia-kit/ui/widgets/note";
import { DIAL_CYCLE, numberEntry } from "@hellotimber/nokia-kit/ui/widgets/number-entry";
import { OptionListWidget } from "../widgets/option-list";
import { serviceRequest } from "../widgets/service-request";
import { Playback } from "@hellotimber/nokia-kit/ui/widgets/playback";
import { blinkShown } from "@hellotimber/nokia-kit/ui/widgets/text-entry";
import { textInput } from "@hellotimber/nokia-kit/ui/widgets/text-input";
import { StockTopics } from "./topics";

/** `Topic number:` types three digits (`topics/factory-numbers` 1000). */
export const TOPIC_NUMBER_LIMIT = 3;
/** `Topic name:`'s length (UNVERIFIED: the captures type five characters). */
export const TOPIC_NAME_LIMIT = 10;

function topicsOf(services: StockServices): StockTopics {
  return new StockTopics(services.eeprom);
}

/** The Topics level's entries as shown now (`topics/level-*`). */
function levelSlugs(topics: StockTopics): string[] {
  if (topics.list().length === 0) return ["add-topic"];
  return ["select", ...(topics.full() ? [] : ["add-topic"]), "edit", "erase"];
}

/**
 * Where a change of the level's entries leaves its highlight: on the same row of the window, the
 * entry now there (`topics/erase-1`: Erase's place shows Edit once Add topic is back;
 * `topics/add-name-ok`, `topics/factory-add-ok`).
 */
function samePlace(before: readonly string[], from: string, topics: StockTopics): NoteEnd {
  const after = levelSlugs(topics);
  // The same entries: the level as it was (`topics/factory-adds`).
  if (after.join() === before.join()) return "back";
  const index = Math.min(Math.max(before.indexOf(from), 0), after.length - 1);
  return { levels: 1, select: after[index]!, row: index === 0 ? "top" : "bottom" };
}

/**
 * `Topic number:` then `Topic name:` (ABC), then `done` (`topics/edit`, `topics/add-*`). The empty
 * number's OK does nothing; an empty name is accepted.
 */
function topicPrompts(
  number: string,
  name: string,
  blink: ReturnType<typeof nodeTimeline>,
  done: (number: string, name: string, flow: Flow) => void,
): Widget {
  return numberEntry({
    label: ["Topic number:"],
    limit: TOPIC_NUMBER_LIMIT,
    counter: false,
    number,
    emptySoftkey: "OK",
    search: () => {},
    ...(blink === undefined ? {} : { blink }),
    done(typed, flow) {
      flow.replace(
        textInput({
          label: ["Topic name:"],
          limit: TOPIC_NAME_LIMIT,
          text: name,
          mode: "ABC",
          done: (named, inner) => done(typed, named, inner),
        }),
      );
    },
  });
}

/** Topics › Select (2-8-4-1): plan 14's multi-select over the topics' names and marks. */
export function selectTopics(services: StockServices): Widget {
  const topics = topicsOf(services);
  return multiSelect({
    key: "info-topics",
    labels: topics.list().map((topic) => topic.name),
    opening: 0,
    settings: {
      marks: () => topics.list().map((topic) => topic.marked),
      toggle: (_key, index) => topics.mark(index, !topics.list()[index]!.marked),
    },
  });
}

/** Topics › Edit (2-8-4-2): the names, then the topic's number and name, `Saved`. */
export function editTopics(services: StockServices): Widget {
  const topics = topicsOf(services);
  return new OptionListWidget({
    labels: topics.list().map((topic) => topic.name),
    opening: 0,
    softkey: "OK",
    choose(index, flow) {
      const topic = topics.list()[index]!;
      flow.replace(
        topicPrompts(
          topic.number,
          topic.name,
          nodeTimeline(`2-8-4-2-${index + 1}`),
          (n, name, f) => {
            topics.edit(index, n, name);
            f.replace(
              note({
                lines: ["Saved"],
                timeline: timelineByName("topic-saved"),
                sound: services.noteSound,
              }),
            );
          },
        ),
      );
    },
  });
}

/** Topics › Erase (2-8-4-3): the names; no query, `Topic erased`, the level. */
export function eraseTopics(services: StockServices): Widget {
  const topics = topicsOf(services);
  return new OptionListWidget({
    labels: topics.list().map((topic) => topic.name),
    opening: 0,
    softkey: "OK",
    choose(index, flow) {
      const before = levelSlugs(topics);
      topics.erase(index);
      flow.replace(
        note({
          lines: ["Topic", "erased"],
          timeline: timelineByName("topic-erased"),
          end: samePlace(before, "erase", topics),
          sound: services.noteSound,
        }),
      );
    },
  });
}

/** Topics › Add topic (while there is room): the prompts, `Topic added`, the level. */
export function addTopic(services: StockServices): Widget {
  const topics = topicsOf(services);
  return topicPrompts("", "", undefined, (number, name, flow) => {
    const before = levelSlugs(topics);
    topics.add(number, name);
    flow.replace(
      note({
        lines: ["Topic", "added"],
        timeline: timelineByName("topic-added"),
        end: samePlace(before, "add-topic", topics),
        sound: services.noteSound,
      }),
    );
  });
}

/** Whether Topics lists its tree entries (Select, Edit, Erase): only with topics. */
export function topicsListed(services: StockServices): boolean {
  return topicsOf(services).list().length > 0;
}

/** Whether Add topic shows: fewer than five topics. */
export function topicsHaveRoom(services: StockServices): boolean {
  return !topicsOf(services).full();
}

// ---------------------------------------------------------------- the Service command editor

/** The Service command editor holds 182 characters (`service-command/typed` empty: `182`). */
export const SERVICE_COMMAND_LIMIT = 182;
/**
 * Send's `Requesting` lasts this long before `Not done` (`service-command/send`: 14867 ms from
 * the first frame; the emulator answers no USSD, Task 0 X; UNVERIFIED live).
 */
export const SERVICE_REQUEST_MS = 14867;

/**
 * `Requesting` (7-6's bar, Quit) with standby's clock, then `Not done` and standby
 * (`service-command/send`).
 */

/**
 * The Service command editor (2-10, `service-command/*`): the editor's layout with the pen, `123`
 * and the characters left; keys as a number entry's (digits and # at once, * cycling `* + p w`);
 * `Back` while empty, `Send` with text.
 */
class ServiceCommandEditor implements Widget {
  readonly #services: StockServices;
  #state: TextState = { text: "", cursor: 0, mode: "123", pending: null, letters: "Abc" };
  #now = 0;
  #top = 0;
  /** Held C: when its deletion happened, until it clears or comes up. */
  #clearFrom: number | undefined;
  readonly #emptyC = new HeldC();
  /** The cursor's blink: the leaf's own recording (`tree/02-messages/2-10.leaf`). */
  readonly #blink: Playback | undefined;

  constructor(services: StockServices) {
    this.#services = services;
    const blink = nodeTimeline("2-10");
    this.#blink = blink === undefined ? undefined : new Playback(blink);
  }

  render(): EditorModel {
    const empty = this.#state.text === "";
    const { model, top } = editorModel(
      this.#state,
      {
        counter: "count",
        limit: SERVICE_COMMAND_LIMIT,
        layout: "sms",
        softkey: empty ? "Back" : "Send",
      },
      this.#top,
      blinkShown(this.#blink, this.#now),
    );
    this.#top = top;
    // The T9 pen while the Dictionary is English (`tree/02-messages/2-10.leaf`), the multi-tap
    // pen otherwise (`service-command/typed`); `123` either way.
    const t9 = t9Context(this.#services) !== undefined;
    return {
      ...model,
      icons: t9
        ? ["editor/t9-pen", { id: MODE_SPRITES["123"], x: T9_MODE_X }]
        : ["prompt/pen", MODE_SPRITES["123"]],
    };
  }

  #type(chars: string): void {
    if (Array.from(this.#state.text).length >= SERVICE_COMMAND_LIMIT) return;
    this.#state = textInsert(this.#state, chars, Number.POSITIVE_INFINITY);
  }

  #star(): void {
    const state = this.#state;
    const pending = state.pending;
    if (pending?.key === "*" && this.#now < pending.sinceMs + TEXT_TIMINGS.commitMs) {
      const index = (pending.index + 1) % DIAL_CYCLE.length;
      const chars = Array.from(state.text);
      chars[state.cursor - 1] = DIAL_CYCLE[index]!;
      this.#state = {
        ...state,
        text: chars.join(""),
        pending: { ...pending, index, sinceMs: this.#now },
      };
      return;
    }
    const before = state.text;
    this.#type("*");
    if (this.#state.text !== before) {
      this.#state = { ...this.#state, pending: { key: "*", index: 0, sinceMs: this.#now } };
    }
  }

  onKeyDown(key: PhoneKey): void {
    if ("0123456789#".includes(key)) {
      this.#state = textTick(this.#state, Number.POSITIVE_INFINITY);
      this.#type(key);
    } else if (key === "*") this.#star();
    else if (key === "up" || key === "down") this.#state = textMove(this.#state, key);
    else if (key === "c") {
      if (this.#state.text === "") this.#emptyC.down();
      else {
        this.#state = textDelete(this.#state);
        this.#clearFrom = this.#now;
      }
    }
  }

  onKey(key: PhoneKey, flow: Flow): void {
    if (key === "c") {
      this.#clearFrom = undefined;
      this.#emptyC.up(flow);
    }
    if (key !== "navi") return;
    if (this.#state.text === "") flow.back();
    else flow.replace(serviceRequest(this.#services, this.#state.text, true, false));
  }

  tick(dtMs: number, flow: Flow): void {
    this.#now += dtMs;
    this.#blink?.advance(dtMs);
    const from = this.#clearFrom;
    if (from !== undefined && this.#now - from >= TEXT_TIMINGS.clearAfterDeleteMs) {
      this.#clearFrom = undefined;
      this.#state = textClear(this.#state);
    }
    this.#state = textTick(this.#state, this.#now);
    this.#emptyC.tick(dtMs, flow);
  }
}

export function serviceCommandEditor(services: StockServices): Widget {
  return new ServiceCommandEditor(services);
}
