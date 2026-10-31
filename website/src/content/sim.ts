import type { StockPreload, StockSimCard } from "@hellotimber/nokia-os";
import { LINKS } from "./links";
import { NOW } from "./now";
import { PEOPLE } from "./people";
import { SIM_MESSAGES } from "./sim-messages";
import { TOOLKIT } from "./toolkit";

export function simId(content: Omit<StockSimCard, "id">): string {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(JSON.stringify(content))) {
    hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
  }
  return `hellotimber-${hash.toString(16).padStart(8, "0")}`;
}

const content = {
  phoneBook: {
    locations: 50,
    nameLength: 16,
    entries: [...PEOPLE, ...LINKS.filter((link) => link.kind === "social")].map(
      ({ name, number }) => ({ name, number }),
    ),
  },
  serviceNumbers: LINKS.filter((link) => link.id === "source").map(({ name, number }) => ({
    name,
    number,
  })),
  messages: { slots: 15, entries: SIM_MESSAGES },
  toolkit: TOOLKIT,
} satisfies Omit<StockSimCard, "id">;

export const PORTFOLIO_SIM = { id: simId(content), ...content } satisfies StockSimCard;
// Snake II at level 5 (217 ms a step): the virgin EEPROM's level 175 steps every ≈7.7 ms.
export const PRELOAD = { reminders: NOW, snakeLevel: 5 } satisfies StockPreload;
