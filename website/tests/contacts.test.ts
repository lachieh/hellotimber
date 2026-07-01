import { describe, expect, it } from "vite-plus/test";
import { contacts } from "../src/content/contacts";

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

describe("contact personas (plan 08)", () => {
  it("has 3–4 personas with kebab-case, unique ids", () => {
    expect(contacts.length).toBeGreaterThanOrEqual(3);
    expect(contacts.length).toBeLessThanOrEqual(4);
    const ids = contacts.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(KEBAB);
  });

  it("includes the lachlan persona (Chat / Menu 3 depends on it)", () => {
    expect(contacts.some((c) => c.id === "lachlan")).toBe(true);
  });

  it("every persona has non-empty canned replies, all ≤160 chars", () => {
    for (const c of contacts) {
      expect(c.canned.length, c.id).toBeGreaterThan(0);
      for (const reply of c.canned) {
        expect(reply.length, `${c.id}: "${reply}"`).toBeLessThanOrEqual(160);
        expect(reply.trim().length, c.id).toBeGreaterThan(0);
      }
    }
  });

  it("every persona system prompt states the 160-char SMS limit", () => {
    for (const c of contacts) {
      expect(c.system, c.id).toContain("160");
    }
  });
});
