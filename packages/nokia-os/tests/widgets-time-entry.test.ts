// Plan 21 Task 6: the stock time and date entry (D6) against the clock's entry goldens: the
// painter from literal models, then the widget in a flow, keys pressed on the rows their redraw
// starts (plan 14 D8: no redraw latency).
import type { PhoneKey } from "@hellotimber/phone-core";
import { Framebuffer } from "@hellotimber/phone-screen";
import { describe, expect, it } from "vite-plus/test";
import { CLOCK_RECORDINGS } from "../scripts/capture-sets/21-clock-and-reminders.ts";
import { paintWidget, type PromptModel } from "../src/display/widgets";
import { timelineById, timelineByName } from "../src/firmware/timelines";
import { WIDGET_TIMELINE_BY_NODE } from "../src/resources";
import { note } from "../src/widgets/note";
import { accepts, timeEntry, validValue, type EntryMask } from "../src/widgets/time-entry";
import { expectLcd } from "./support/golden.ts";
import { expectFlowTimeline, flowRig } from "./support/flow-rig.ts";
import { goldenImage, loadGolden } from "./support/goldens.ts";

const model = (
  label: string[],
  text: string,
  cursor: number,
  shown: boolean,
  softkey = "OK",
): PromptModel => ({
  kind: "prompt",
  icons: ["prompt/pen"],
  label,
  entry: { kind: "number", text, cursor },
  cursor: shown,
  softkey,
});

function paint(m: PromptModel) {
  const fb = new Framebuffer();
  paintWidget(fb, m);
  return fb;
}

describe("time entry painter", () => {
  it.each([
    ["clock/settings/set-time-keys", "b", model(["Time:"], "10:10", 0, true)],
    ["clock/settings/set-time-keys", "c", model(["Time:"], "10:10", 0, false)],
    ["clock/settings/set-time-keys", "e", model(["Time:"], "00:10", 1, true)],
    ["clock/settings/set-time-keys", "g", model(["Time:"], "09:10", 3, false)],
    ["clock/settings/set-time-keys", "j", model(["Time:"], "09:59", 0, true)],
    ["clock/date/keys", "b", model(["Date:"], "13.10.2026", 0, true)],
    ["clock/countdown/keys", "b", model(["Set timer:"], "hh:mm", 0, true, "Start")],
    ["clock/countdown/keys", "e", model(["Set timer:"], "0h:mm", 1, true, "Start")],
    ["clock/alarm/set", "b", model(["Set alarm time:"], "00:00", 0, true)],
    ["clock/date/3210", "k", model(["Date:"], "31.00.2026", 3, true)],
    ["reminders/add-time-open", "b", model(["Reminder time:"], "hh:mm", 0, false)],
  ] as const)("%s %s", (id, image, m) => {
    expectLcd(paint(m), goldenImage(id, image), `${id} ${image}`);
  });
});

describe("time entry digits", () => {
  const typed = (mask: EntryMask, from: string, keys: string): string => {
    const chars = Array.from(from);
    const positions = Array.from(mask).flatMap((ch, i) => (/[a-z]/.test(ch) ? [i] : []));
    let cursor = positions[0]!;
    for (const k of keys) {
      if (!accepts(mask, chars, cursor, Number(k))) continue;
      chars[cursor] = k;
      cursor = positions.find((p) => p > cursor) ?? positions[0]!;
    }
    return chars.join("");
  };

  it("refuses what a position cannot take (Task 0's values)", () => {
    expect(typed("hh:mm", "10:10", "2500")).toBe("20:00");
    expect(typed("hh:mm", "10:10", "1260")).toBe("12:00");
    expect(typed("hh:mm", "10:10", "2400")).toBe("20:00");
    expect(typed("hh:mm", "10:10", "123")).toBe("12:30");
    expect(typed("hh:mm", "hh:mm", "9959")).toBe("hh:mm");
    expect(typed("hh:mm", "hh:mm", "006")).toBe("00:mm");
    expect(typed("dd.mm.yyyy", "13.10.2026", "00002026")).toBe("02.02.2026");
    expect(typed("dd.mm.yyyy", "13.10.2026", "3210")).toBe("31.00.2026");
    expect(typed("dd.mm.yyyy", "13.10.2026", "1913")).toBe("19.10.2026");
    expect(typed("dd.mm.yyyy", "13.10.2026", "0110200")).toBe("01.10.2006");
  });

  it("checks the whole value on OK", () => {
    expect(validValue("hh:mm", "20:0m")).toBe(false);
    expect(validValue("hh:mm", "23:59")).toBe(true);
    expect(validValue("dd.mm.yyyy", "31.02.2026")).toBe(false);
    expect(validValue("dd.mm.yyyy", "29.02.2026")).toBe(false);
    expect(validValue("dd.mm.yyyy", "29.02.2028")).toBe(true);
    expect(validValue("dd.mm.yyyy", "31.00.2026")).toBe(false);
  });
});

/** The keys of a recording after its first, each on the row its redraw starts (else +55 ms). */
function keyRows(id: string): { key: PhoneKey; atMs: number }[] {
  const golden = loadGolden(id);
  const rows = golden.timeline!;
  const recording = CLOCK_RECORDINGS.find((r) => r.id === id)!;
  const origin = rows[golden.triggerFrame as number]!.startMs;
  // keys.csv and the golden's rows share the recording's clock
  return recording.keys.slice(1).map(([key, at]) => {
    const row = rows.find((r) => r.startMs > at && r.startMs <= at + 150);
    return {
      key: (key === "menu" ? "navi" : key) as PhoneKey,
      atMs: Math.round((row?.startMs ?? at + 55) - origin),
    };
  });
}

const blinkOf = (node: string) => timelineById(WIDGET_TIMELINE_BY_NODE[node]!, node);

/** Plays golden `id`'s keys on `root` from its trigger and compares the widget's frames. */
function expectEntryFlow(id: string, root: () => ReturnType<typeof timeEntry>, returns: boolean) {
  const golden = loadGolden(id);
  const rig = flowRig(root);
  const keys = keyRows(id);
  const rows = golden.timeline!;
  const origin = rows[golden.triggerFrame as number]!.startMs;
  const end = rows[rows.length - 1]!.startMs - origin;
  const frames: { startMs: number; pixels: Uint8Array }[] = [];
  let shown: Uint8Array | undefined;
  const sample = () => {
    if (rig.exits.length > 0) return;
    const pixels = rig.frame();
    if (shown === undefined || !pixels.every((v, i) => v === shown![i])) {
      frames.push({ startMs: rig.now, pixels });
      shown = pixels;
    }
  };
  sample();
  for (let t = 1; t <= end + 30 && rig.exits.length === 0; t++) {
    rig.advance(1);
    for (const k of keys) if (k.atMs === t) rig.press(k.key);
    sample();
  }
  const exit = rig.exits[0];
  expectFlowTimeline(
    { frames, ...(exit === undefined ? {} : { exitMs: exit.atMs }) },
    golden,
    { returns },
  );
}

const time =
  (initial: string | undefined, done = "time-is-set") =>
  () =>
    timeEntry({
      icons: ["prompt/pen"],
      label: ["Time:"],
      softkey: "OK",
      mask: "hh:mm",
      ...(initial === undefined ? {} : { initial }),
      blink: blinkOf("11-2-2"),
      invalid: timelineByName("invalid-time"),
      done: (_value, flow) =>
        flow.replace(note({ lines: ["Time", "is set"], timeline: timelineByName(done) })),
    });

describe("time entry in a flow", () => {
  it.each(["set-time-keys", "set-time-2500", "set-time-1959", "set-time-123", "set-time-0"])(
    "Set the time: %s",
    (name) => expectEntryFlow(`clock/settings/${name}`, time("10:10"), true),
  );

  it.each(["set-time-c", "set-time-c-typed"])("Set the time: %s goes back", (name) =>
    expectEntryFlow(`clock/settings/${name}`, time("10:10"), true),
  );

  const date = () =>
    timeEntry({
      icons: ["prompt/pen"],
      label: ["Date:"],
      softkey: "OK",
      mask: "dd.mm.yyyy",
      initial: "13.10.2026",
      blink: blinkOf("11-3"),
      invalid: timelineByName("invalid-date"),
      done: (_value, flow) =>
        flow.replace(note({ lines: ["Date", "is set"], timeline: timelineByName("date-is-set") })),
    });

  it.each(["keys", "00002026", "0110200", "1913", "29022028"])("Date setting: %s", (name) =>
    expectEntryFlow(`clock/date/${name}`, date, true),
  );

  it.each(["31022026", "29022026", "31042026", "3210"])("Date setting: %s is invalid", (name) =>
    expectEntryFlow(`clock/date/${name}`, date, false),
  );

  const timer = () =>
    timeEntry({
      icons: ["prompt/pen"],
      label: ["Set timer:"],
      softkey: "Start",
      mask: "hh:mm",
      blink: blinkOf("11-5"),
      invalid: timelineByName("invalid-time"),
      done: (_value, flow) =>
        flow.replace(
          note({ lines: ["Timer", "running"], timeline: timelineByName("timer-running") }),
        ),
    });

  it.each(["keys"])("Set timer: %s", (name) =>
    expectEntryFlow(`clock/countdown/${name}`, timer, true),
  );

  it.each(["0", "006", "2400", "9959"])("Set timer: %s is invalid", (name) =>
    expectEntryFlow(`clock/countdown/${name}`, timer, false),
  );
});
