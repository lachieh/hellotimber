import { describe, expect, it } from "vite-plus/test";
import {
  createMemoryStorage,
  createStockPhone,
  missingStockGlyphs,
  type StockSimCard,
  type StockPreload,
  type StockToolkitItem,
} from "@hellotimber/nokia-os";
import { PORTFOLIO_SIM, PRELOAD, simId } from "../src/content/sim";
import { LINKS } from "../src/content/links";
import { PEOPLE } from "../src/content/people";

function check(sim: StockSimCard, preload: StockPreload = PRELOAD) {
  createStockPhone({
    carrier: "LACHLAN",
    sim,
    preload,
    imei: "490154203237518",
    boot: "skip",
    storage: createMemoryStorage(),
  });
  const contacts = [
    ...(sim.phoneBook?.entries ?? []).filter((c) => c !== null),
    ...(sim.serviceNumbers ?? []),
  ];
  const calls: string[] = [];
  function items(entries: readonly StockToolkitItem[]) {
    for (const item of entries)
      for (const step of item.steps) {
        if (step.kind === "call") calls.push(step.number);
        if (step.kind === "select") items(step.items);
      }
  }
  items(sim.toolkit?.items ?? []);
  const numbers = contacts.map((c) => c.number);
  expect(new Set(numbers).size).toBe(numbers.length);
  for (const number of [...numbers, ...calls]) {
    expect(number).toMatch(/^(0491570006|0491570156|0491570157|075550[0-9]{4})$/);
    expect([...LINKS, ...PEOPLE].some((c) => c.number === number)).toBe(true);
  }
  for (const link of LINKS) expect([...numbers, ...calls]).toContain(link.number);
  for (const contact of contacts) {
    expect(contact.name.length).toBeLessThanOrEqual(16);
    for (const face of ["small", "large"] as const)
      expect(missingStockGlyphs(contact.name, face)).toEqual([]);
  }
  const messages = sim.messages?.entries ?? [];
  expect(messages.length).toBeLessThanOrEqual((sim.messages?.slots ?? 15) - 5);
  for (const message of messages)
    if (message) {
      expect(message.text).toMatch(/^[\x20-\x7e]+$/);
      expect(message.number).toBe(PEOPLE[0]?.number);
      expect(message.sentAt.year).toBe(2000);
      expect(message.sentAt.month).toBe(9);
      expect(missingStockGlyphs(message.text, "small")).toEqual([]);
    }
}

describe("portfolio SIM content", () => {
  it("boots real stock firmware with room for five replies", () => check(PORTFOLIO_SIM));
  it("seeds seven messages and keeps project links out of the phone book", () => {
    expect(PORTFOLIO_SIM.messages.entries).toHaveLength(7);
    const names = PORTFOLIO_SIM.phoneBook.entries.map((entry) => entry?.name);
    expect(names).toEqual([
      "Lachlan",
      "Recruiter Rachel",
      "Y2K Support",
      "GitHub",
      "LinkedIn",
      "X",
      "Bluesky",
    ]);
    expect(PORTFOLIO_SIM.serviceNumbers.map((entry) => entry?.name)).toEqual(["Source code"]);
    for (const link of LINKS.filter((link) => link.kind === "project"))
      expect(names).not.toContain(link.name);
  });
  it("names the SIM by all its content, deterministically", () => {
    expect(PORTFOLIO_SIM.id).toMatch(/^hellotimber-[0-9a-f]{8}$/);
    const { id, ...content } = PORTFOLIO_SIM;
    expect(simId(content)).toBe(id);
    expect(simId({ ...content, serviceNumbers: [] })).not.toBe(id);
    expect(simId({})).toBe("hellotimber-5465b825");
  });
  const bad: [string, Partial<StockSimCard>, StockPreload?][] = [
    [
      "long name",
      { phoneBook: { entries: [{ name: "Seventeen letters!", number: "0491570006" }] } },
    ],
    ["undrawable name", { phoneBook: { entries: [{ name: "😀", number: "0491570006" }] } }],
    ["duplicate number", { serviceNumbers: [{ name: "Duplicate", number: "0491570006" }] }],
    ["real number", { serviceNumbers: [{ name: "Real", number: "0412345678" }] }],
    ["emergency number", { serviceNumbers: [{ name: "Emergency", number: "112" }] }],
    [
      "unknown call",
      {
        toolkit: {
          title: "LACHLAN",
          items: [{ id: "bad", label: "Bad", steps: [{ kind: "call", number: "0755509999" }] }],
        },
      },
    ],
    [
      "missing link",
      { phoneBook: { entries: PEOPLE.map(({ name, number }) => ({ name, number })) } },
    ],
    [
      "long SMS",
      {
        messages: {
          entries: [
            {
              number: "0491570006",
              text: "x".repeat(161),
              sentAt: { year: 2000, month: 9, day: 1, hour: 9, minute: 0, second: 0 },
            },
          ],
        },
      },
    ],
    [
      "non-GSM SMS",
      {
        messages: {
          entries: [
            {
              number: "0491570006",
              text: "hello—",
              sentAt: { year: 2000, month: 9, day: 1, hour: 9, minute: 0, second: 0 },
            },
          ],
        },
      },
    ],
    ["full SMS store", { messages: { slots: 5, entries: PORTFOLIO_SIM.messages?.entries } }],
    ["bad toolkit title", { toolkit: { title: "😀", items: [] } }],
    [
      "long toolkit text",
      {
        toolkit: {
          title: "LACHLAN",
          items: [{ id: "bad", label: "Bad", steps: [{ kind: "text", text: "x".repeat(274) }] }],
        },
      },
    ],
    ["long reminder", {}, { reminders: [{ text: "x".repeat(36) }] }],
    ["untypable reminder", {}, { reminders: [{ text: "😀" }] }],
  ];
  it.each(bad)("rejects %s", (_label, patch, preload) => {
    expect(() => check({ ...PORTFOLIO_SIM, ...patch }, preload)).toThrow();
  });
});
