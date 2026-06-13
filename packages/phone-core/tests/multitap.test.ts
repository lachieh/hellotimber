import { describe, expect, it } from "vite-plus/test";
import {
  clearAll,
  commitPending,
  createMultitap,
  deleteLeft,
  holdDigit,
  moveCursor,
  MULTITAP_TIMEOUT_MS,
  pressDigit,
  pressHash,
  tickMultitap,
} from "../src/multitap";

describe("multitap", () => {
  it("starts empty in Abc (sentence case) mode", () => {
    expect(createMultitap()).toEqual({ text: "", cursor: 0, mode: "Abc", pending: null });
  });

  it("commitPending finalizes the pending letter and downshifts from Abc", () => {
    let s = pressDigit(createMultitap(), "2", 0); // "A", pending
    expect(s.pending).not.toBeNull();
    s = commitPending(s);
    expect(s.pending).toBeNull();
    expect(s.mode).toBe("abc");
    expect(commitPending(s)).toBe(s); // no pending → unchanged
  });

  it("cycles letters on repeated presses of the same key", () => {
    let s = createMultitap();
    s = pressDigit(s, "2", 0);
    expect(s.text).toBe("A");
    s = pressDigit(s, "2", 100);
    expect(s.text).toBe("B");
    s = pressDigit(s, "2", 200);
    expect(s.text).toBe("C");
    s = pressDigit(s, "2", 300);
    expect(s.text).toBe("2");
    s = pressDigit(s, "2", 400); // wraps
    expect(s.text).toBe("A");
    expect(s.cursor).toBe(1);
  });

  it("commits after the 1s timeout and downshifts out of Abc", () => {
    let s = pressDigit(createMultitap(), "4", 0); // G
    s = tickMultitap(s, MULTITAP_TIMEOUT_MS - 1);
    expect(s.pending).not.toBeNull();
    s = tickMultitap(s, MULTITAP_TIMEOUT_MS);
    expect(s.pending).toBeNull();
    expect(s.mode).toBe("abc");
    s = pressDigit(s, "4", 1100); // same key after commit starts a NEW letter
    expect(s.text).toBe("Gg");
  });

  it("a different key commits the pending letter", () => {
    let s = pressDigit(createMultitap(), "4", 0); // G
    s = pressDigit(s, "4", 100); // H
    s = pressDigit(s, "4", 200); // I
    s = pressDigit(s, "2", 300); // commit I, then lowercase a (sentence case downshift)
    expect(s.text).toBe("Ia");
  });

  it("1 cycles punctuation", () => {
    let s = pressHash(createMultitap()); // → abc
    s = pressDigit(s, "1", 0);
    expect(s.text).toBe(".");
    s = pressDigit(s, "1", 100);
    expect(s.text).toBe(",");
  });

  it("0 inserts a space; hold-0 toggles 123 mode", () => {
    let s = pressDigit(createMultitap(), "8", 0); // T
    s = pressDigit(s, "0", 100);
    expect(s.text).toBe("T ");
    s = holdDigit(s, "0");
    expect(s.mode).toBe("123");
    s = pressDigit(s, "5", 200); // digits insert directly in 123 mode
    expect(s.text).toBe("T 5");
    s = holdDigit(s, "0");
    expect(s.mode).toBe("abc");
  });

  it("hold-digit inserts the number even in letter mode", () => {
    let s = pressDigit(createMultitap(), "6", 0); // M
    s = holdDigit(s, "7");
    expect(s.text).toBe("M7");
    expect(s.pending).toBeNull();
  });

  it("# toggles upper/lower case (no-op in 123)", () => {
    let s = createMultitap(); // Abc
    s = pressHash(s);
    expect(s.mode).toBe("abc");
    s = pressDigit(s, "3", 0);
    expect(s.text).toBe("d");
    s = pressHash(s);
    expect(s.mode).toBe("Abc");
    s = holdDigit(s, "0"); // → 123
    s = pressHash(s);
    expect(s.mode).toBe("123");
  });

  it("C deletes left; hold-C clears; cursor moves commit and clamp", () => {
    let s = createMultitap();
    s = pressDigit(s, "4", 0); // "G" pending
    s = deleteLeft(s); // commits, then deletes the G
    expect(s.text).toBe("");
    expect(deleteLeft(s).text).toBe(""); // delete on empty is safe
    s = pressDigit(s, "2", 100); // downshifted to abc by the commit → "a"
    expect(s.text).toBe("a");
    s = pressDigit(s, "3", 1200); // commit a, insert d → "ad"
    s = moveCursor(s, -1);
    expect(s.cursor).toBe(1);
    s = moveCursor(s, -1);
    s = moveCursor(s, -1); // clamped at 0
    expect(s.cursor).toBe(0);
    s = pressDigit(s, "6", 1300); // insert at cursor → "mad"
    s = tickMultitap(s, 99_999);
    expect(s.text).toBe("mad");
    s = clearAll(s);
    expect(s).toMatchObject({ text: "", cursor: 0, pending: null });
  });
});
