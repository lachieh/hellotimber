// Info service › Topics (2-8-4), plan 18c D11 as Task 0 I measured it. The virgin EEPROM holds
// five junk topics: names of six U+E000 boxes, empty numbers but topic 4's `p9` (plan 14's
// `tree/02-messages/2-8-4-*` goldens, `topics/edit`), the first one marked. Restore factory
// settings empties the list (plan 15's factory scroll, `content/restore-topics`). Five topics at
// most: Add topic shows while there is room (`topics/level-after-erase`, `-after-add`).
//
// A topic's number is kept as the text its prompt shows (the virgin junk is not a valid topic
// ID); the prompt types three digits at most (`topics/factory-numbers` 1000).
import type { EepromRecord, StockEeprom } from "../firmware/eeprom";

/** Topics at most (the virgin list is full; one erased brings Add topic back). */
export const TOPIC_CAPACITY = 5;

export interface Topic {
  /** The number as its prompt shows it. */
  readonly number: string;
  readonly name: string;
  /** Select's mark. */
  readonly marked: boolean;
}

export interface TopicsState {
  readonly topics: readonly Topic[];
}

const BOXES = "\uE000".repeat(6);

/** The virgin EEPROM's topics (plan 14's goldens). */
export const VIRGIN_TOPICS: readonly Topic[] = ["", "", "", "p9", ""].map((number, i) => ({
  number,
  name: BOXES,
  marked: i === 0,
}));

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const INFO_TOPICS_RECORD: EepromRecord<TopicsState> = {
  name: "info-topics",
  version: 1,
  initial: () => ({ topics: VIRGIN_TOPICS }),
  decode(data) {
    if (!isObject(data) || !Array.isArray(data.topics)) throw new Error("topics must be a list.");
    if (data.topics.length > TOPIC_CAPACITY) {
      throw new Error(`at most ${TOPIC_CAPACITY} topics.`);
    }
    const topics = data.topics.map((topic: unknown, i) => {
      if (
        !isObject(topic) ||
        typeof topic.number !== "string" ||
        typeof topic.name !== "string" ||
        typeof topic.marked !== "boolean"
      ) {
        throw new Error(`topics.${i} must hold a number, a name and a mark.`);
      }
      return { number: topic.number, name: topic.name, marked: topic.marked };
    });
    return { topics };
  },
  encode: (value) => ({ topics: value.topics }),
  factory: () => ({ topics: [] }),
};

/** The phone's Info service topics in its EEPROM. */
export class StockTopics {
  readonly #eeprom: StockEeprom;

  constructor(eeprom: StockEeprom) {
    this.#eeprom = eeprom;
  }

  list(): readonly Topic[] {
    return this.#eeprom.read(INFO_TOPICS_RECORD).topics;
  }

  full(): boolean {
    return this.list().length >= TOPIC_CAPACITY;
  }

  #write(topics: readonly Topic[]): void {
    this.#eeprom.write(INFO_TOPICS_RECORD, { topics });
  }

  #at(index: number): Topic {
    const topic = this.list()[index];
    if (topic === undefined) throw new RangeError(`No topic ${index}.`);
    return topic;
  }

  /** Add topic: at the end, unmarked. */
  add(number: string, name: string): void {
    if (this.full()) throw new Error(`The topic list is full (${TOPIC_CAPACITY}).`);
    this.#write([...this.list(), { number, name, marked: false }]);
  }

  /** Edit: the topic's number and name, its mark kept. */
  edit(index: number, number: string, name: string): void {
    const topic = this.#at(index);
    this.#write(this.list().map((t, i) => (i === index ? { ...topic, number, name } : t)));
  }

  /** Select's Save changes: the marks. */
  mark(index: number, marked: boolean): void {
    const topic = this.#at(index);
    this.#write(this.list().map((t, i) => (i === index ? { ...topic, marked } : t)));
  }

  erase(index: number): void {
    this.#at(index);
    this.#write(this.list().filter((_, i) => i !== index));
  }
}
