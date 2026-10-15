// Plan 17 Task 4: PhoneConfig.standbyLine, a second standby line re-read on every tick with the
// time since standby was last entered.
import { describe, expect, it } from "vite-plus/test";
import { createPhone, PhoneApplication } from "../src/index";
import type { ApplicationContext, PhoneSnapshot, PhoneApplicationSession } from "../src/index";
import { bootedPhone, testConfig } from "./fixtures";

/** A reader that shows `text` once standby has been shown for `delayMs`, recording each call. */
function delayed(
  text: string,
  delayMs: number,
): {
  line: (shownMs: number) => string | undefined;
  calls: number[];
} {
  const calls: number[] = [];
  return {
    calls,
    line: (shownMs) => {
      calls.push(shownMs);
      return shownMs >= delayMs ? text : undefined;
    },
  };
}

/** An application whose C key-up exits to standby. */
class ExitToStandby extends PhoneApplication {
  createSession(context: ApplicationContext): PhoneApplicationSession {
    return {
      onKey: (event) => {
        if (event.type === "up" && event.key === "c") context.exit({ to: "standby" });
      },
      tick: () => {},
      render: () => ({ kind: "confirm", text: "App", softkey: "OK" }),
    };
  }
}

describe("standbyLine", () => {
  it("leaves the models unchanged without a reader", () => {
    const phone = bootedPhone();
    expect(phone.screen).toEqual({
      kind: "standby",
      carrier: "",
      clock: undefined,
      signal: 4,
      battery: 4,
    });
  });

  it("emits the line on standby once the reader returns it, with the time since standby", () => {
    const reader = delayed("Silent", 1900);
    const phone = createPhone(testConfig({ standbyLine: reader.line }));
    phone.tick(0);
    phone.pressKey("power", 1000); // standby entered at 1000 (bootMs 0)
    expect(phone.screen).not.toHaveProperty("line");
    phone.tick(2899);
    expect(phone.screen).not.toHaveProperty("line");
    phone.tick(2900);
    expect(phone.screen).toMatchObject({ kind: "standby", line: "Silent" });
    expect(reader.calls).toContain(1900);
    expect(Math.min(...reader.calls)).toBe(0);
  });

  it("restarts shownMs when the boot ends", () => {
    const reader = delayed("Silent", 500);
    const phone = createPhone(testConfig({ bootMs: 3000, standbyLine: reader.line }));
    phone.tick(0);
    phone.pressKey("power", 1000);
    phone.tick(3999);
    expect(phone.screen.kind).toBe("boot");
    phone.tick(4000);
    expect(phone.screen).not.toHaveProperty("line");
    phone.tick(4500);
    expect(phone.screen).toMatchObject({ line: "Silent" });
  });

  it("restarts shownMs at every return to standby: C, C held, an application's exit", () => {
    const reader = delayed("Loud", 1000);
    const phone = bootedPhone({ standbyLine: reader.line }, new ExitToStandby("write-message"));
    phone.tick(5000);
    expect(phone.screen).toMatchObject({ line: "Loud" });
    // Menu, C: standby again from 6000.
    phone.pressKey("navi");
    phone.tick(6000);
    phone.pressKey("c");
    expect(phone.screen).not.toHaveProperty("line");
    phone.tick(6999);
    expect(phone.screen).not.toHaveProperty("line");
    phone.tick(7000);
    expect(phone.screen).toMatchObject({ line: "Loud" });
    // C held in a level.
    phone.navigate("menu/phone-book");
    phone.send({ type: "down", key: "c" });
    phone.tick(7800);
    phone.send({ type: "up", key: "c" });
    expect(phone.screen).toMatchObject({ kind: "standby" });
    expect(phone.screen).not.toHaveProperty("line");
    phone.tick(8800);
    expect(phone.screen).toMatchObject({ line: "Loud" });
    // An application's exit({ to: "standby" }).
    phone.navigate("menu/messages/write");
    phone.tick(9000);
    phone.pressKey("c");
    expect(phone.screen).not.toHaveProperty("line");
    phone.tick(9999);
    expect(phone.screen).not.toHaveProperty("line");
    phone.tick(10000);
    expect(phone.screen).toMatchObject({ line: "Loud" });
  });

  it("restarts shownMs when a notice is cleared", () => {
    const reader = delayed("Loud", 1000);
    const phone = bootedPhone({ standbyLine: reader.line });
    phone.setNotice({ text: "1 message received", softkey: "Read" });
    phone.tick(3000);
    expect(phone.screen).toMatchObject({ line: "Loud" });
    phone.pressKey("c");
    expect(phone.screen).not.toHaveProperty("notice");
    expect(phone.screen).not.toHaveProperty("line");
    phone.tick(4000);
    expect(phone.screen).toMatchObject({ line: "Loud" });
    phone.setNotice({ text: "1 message received", softkey: "Read" });
    phone.setNotice(null);
    expect(phone.screen).not.toHaveProperty("line");
    phone.tick(5000);
    expect(phone.screen).toMatchObject({ line: "Loud" });
  });

  it("keeps the line on the standby screen Menu leaves for menuOpenDelayMs", () => {
    const phone = bootedPhone({ standbyLine: () => "Silent", menuOpenDelayMs: 39 });
    phone.tick(2000);
    phone.pressKey("navi");
    expect(phone.screen).toMatchObject({ kind: "standby", leaving: true, line: "Silent" });
  });

  it("emits exactly one snapshot when the line changes, none while it holds", () => {
    const reader = delayed("Silent", 1000);
    const phone = bootedPhone({ standbyLine: reader.line });
    const snaps: PhoneSnapshot[] = [];
    phone.subscribe((snap) => snaps.push(snap));
    for (let t = 1001; t <= 3000; t += 1) phone.tick(t);
    expect(snaps).toHaveLength(1);
    expect(snaps[0]!.screen).toMatchObject({ line: "Silent" });
  });

  it("omits the line when the reader throws or returns a non-string", () => {
    const thrower = bootedPhone({
      standbyLine: () => {
        throw new Error("broken");
      },
    });
    thrower.tick(5000);
    expect(thrower.screen).toMatchObject({ kind: "standby" });
    expect(thrower.screen).not.toHaveProperty("line");
    const odd = bootedPhone({ standbyLine: () => 42 as never });
    odd.tick(5000);
    expect(odd.screen).not.toHaveProperty("line");
  });

  it("is not read outside standby", () => {
    const reader = delayed("Silent", 0);
    const phone = bootedPhone({ standbyLine: reader.line });
    phone.navigate("menu/phone-book");
    const before = reader.calls.length;
    phone.tick(5000);
    expect(phone.screen.kind).toBe("list");
    expect(reader.calls.length).toBe(before);
  });
});
