// Snake II's keys (plan 23 H4, H5; Task 0 C7): a key sets the pending heading, judged against
// the current heading, so no key sequence between two steps reverses the snake and the last
// key wins. 0, 5 and every other key do nothing.
import type { PhoneKey } from "@hellotimber/phone-core";
import type { Heading } from "./model";

const OPPOSITE: Readonly<Record<Heading, Heading>> = {
  right: "left",
  left: "right",
  up: "down",
  down: "up",
};

/** Clockwise order. */
const CLOCKWISE: readonly Heading[] = ["up", "right", "down", "left"];

const turn = (heading: Heading, by: 1 | 3): Heading =>
  CLOCKWISE[(CLOCKWISE.indexOf(heading) + by) % 4]!;

const vertical = (heading: Heading) => heading === "up" || heading === "down";

/** The heading `key` asks for while the snake heads `current`, before the reversal test. */
function asked(key: PhoneKey, current: Heading): Heading | undefined {
  switch (key) {
    case "2":
      return "up";
    case "8":
      return "down";
    case "4":
      return "left";
    case "6":
      return "right";
    case "1":
      return vertical(current) ? "left" : "up";
    case "3":
      return vertical(current) ? "right" : "up";
    case "7":
      return vertical(current) ? "left" : "down";
    case "9":
      return vertical(current) ? "right" : "down";
    case "#":
    case "down":
      return turn(current, 1);
    case "*":
    case "up":
      return turn(current, 3);
    default:
      return undefined;
  }
}

/** The pending heading after `key`, or undefined when the key changes nothing. */
export function headingFor(key: PhoneKey, current: Heading): Heading | undefined {
  const heading = asked(key, current);
  return heading === undefined || heading === OPPOSITE[current] ? undefined : heading;
}

export function opposite(heading: Heading): Heading {
  return OPPOSITE[heading];
}
