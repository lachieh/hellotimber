import { describe, expect, it } from "vite-plus/test";
import { missingStockGlyphs } from "@hellotimber/nokia-os";
import { PEOPLE, personById, personByNumber } from "../src/content/people";

describe("portfolio personas", () => {
  it("keeps the three existing personas with stable ids and fiction numbers", () => {
    expect(PEOPLE.map(({ id }) => id)).toEqual(["lachlan", "recruiter-rachel", "y2k-support"]);
    expect(PEOPLE.map(({ number }) => number)).toEqual(["0491570006", "0491570156", "0491570157"]);
    for (const person of PEOPLE) {
      expect(personById(person.id)).toBe(person);
      expect(personByNumber(person.number)).toBe(person);
      expect(person.system).toContain("160");
      expect(person.system).toContain("plain ASCII");
      expect(person.canned.length).toBeGreaterThan(0);
      for (const reply of person.canned) {
        expect(reply.length).toBeLessThanOrEqual(160);
        expect(reply).toMatch(/^[\x20-\x7e]+$/);
        expect(missingStockGlyphs(reply, "small")).toEqual([]);
      }
    }
    expect(personById("missing")).toBeUndefined();
    expect(personByNumber("112")).toBeUndefined();
  });
});
