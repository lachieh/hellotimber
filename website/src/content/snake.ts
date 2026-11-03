import type { PhoneSection } from "./section";

export const SNAKE = {
  kind: "phone",
  id: "snake",
  label: "Snake",
  route: "/snake",
  summary: "Snake II, as it shipped on the 3310.",
  description: "Play Snake II on a working Nokia 3310.",
  specs: [
    { label: "Game", value: "Snake II" },
    { label: "Level", value: "5" },
    { label: "To beat", value: "4032" },
  ],
  guide: [
    { label: "Select", value: "New game: the middle key (Enter)" },
    { label: "2 4 6 8", value: "Steer up, left, right, down" },
    { label: "C", value: "Pause and back (Esc or Backspace)" },
  ],
} as const satisfies PhoneSection;
