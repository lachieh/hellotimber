// Plan 30 Task 2: the SIM content capture set on synthetic recordings (no REF).
import { describe, expect, it } from "vite-plus/test";
import type { CaptureIo, CaptureSetEntry } from "../../scripts/capture-set.ts";
import { captureSets } from "../../scripts/capture-registry.ts";
import {
  DONE_TASKS,
  SIM_CONTENT_GOLDEN_SIMS,
  SIM_CONTENT_SIMS,
  SIM_CONTENT_SOUNDS,
  SIM_CONTENT_TASKS,
  SIM_CONTENT_TOOLKITS,
  simContent,
  simContentCard,
  simContentSounds,
} from "../../scripts/capture-sets/30-sim-content.ts";
import {
  EVENTS_HEADER,
  KEYS_HEADER,
  type SoundCaptureIo,
} from "../../scripts/sound-capture-set.ts";
import type { RecordingFrame } from "../../scripts/tree-capture-set.ts";

/** Recordings whose frame 0 repeats once before the screen changes (trigger frame 2). */
const frames: readonly RecordingFrame[] = [
  { image: "a", startMs: 1, durationMs: 40 },
  { image: "a", startMs: 41, durationMs: 40 },
  { image: "b", startMs: 81, durationMs: 400 },
];

const io = {
  frames: { recording: () => frames, scrollImages: () => undefined },
} as unknown as CaptureIo;

const lcd: readonly CaptureSetEntry[] = simContent.lcd!(io);
const byId = new Map(lcd.map((entry) => [entry.id, entry] as const));

describe("SIM content capture set", () => {
  it("registers as plan 30", () => {
    expect(captureSets().filter((set) => set.plan === "30")).toEqual([simContent]);
  });

  it("lists every section of the golden pipeline table, each id once", () => {
    const ids = lcd.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const prefix of [
      "sim/sms-boot-",
      "sim/sms-inbox-",
      "sim/sms-read-",
      "sim/sms-order-",
      "sim/sms-erase",
      "sim/sms-slots-10-",
      "sim/sms-slots-15-",
      "sim/sms-slots-30-",
      "sim/sms-restore-",
      "sim/names-",
      "sim/stk-carousel-",
      "sim/stk-level-",
      "sim/stk-text-",
      "sim/stk-select-",
      "sim/imei-",
    ]) {
      expect(
        ids.some((id) => id.startsWith(prefix)),
        prefix,
      ).toBe(true);
    }
    expect(ids.every((id) => id.startsWith("sim/"))).toBe(true);
    // No golden for what never happens in the emulator or what is another plan's screen.
    expect(ids.some((id) => id.startsWith("sim/stk-call"))).toBe(false);
    expect(ids.some((id) => id.startsWith("sim/lnd"))).toBe(false);
  });

  it("asserts each completed task, including plan 22's *#06#", () => {
    for (const entry of lcd) {
      const task = SIM_CONTENT_TASKS[entry.id]!;
      expect(entry.status, entry.id).toBe(DONE_TASKS.has(task) ? "asserted" : "pending:30");
    }
  });

  it("aligns a recording on its first changed frame", () => {
    const entry = byId.get("sim/stk-text-short-open")!;
    expect(entry.kind).toBe("timeline");
    expect(entry.prefer.source).toEqual({ kind: "recording", dir: "plan30/stk/text/short/open" });
    expect(entry.prefer.triggerFrame).toBe(2);
  });

  it("names a still's shots after their path under the row's directory", () => {
    const entry = byId.get("sim/sms-read-1")!;
    expect(entry.kind).toBe("still");
    expect(entry.prefer.source).toEqual({
      kind: "shots",
      files: [
        ...["01", "02", "03", "04", "05"].map((n) => ({
          file: `plan30/sms/read/1/page/${n}.png`,
          name: `page-${n}`,
        })),
        ...["01", "02", "03"].map((n) => ({
          file: `plan30/sms/read/1/details/${n}.png`,
          name: `details-${n}`,
        })),
      ],
    });
    expect(byId.get("sim/sms-inbox-list")!.prefer.source).toEqual({
      kind: "scroll",
      dir: "plan30/sms/inbox/list",
    });
  });

  it("names every golden's SIM fixture in its note", () => {
    for (const entry of lcd) {
      const { sim } = SIM_CONTENT_GOLDEN_SIMS[entry.id]!;
      expect(entry.prefer.note, entry.id).toContain(
        entry.id.startsWith("sim/imei") ? "IMEI" : `SIM ${sim}`,
      );
    }
  });

  it("states Task 0's fixtures as StockSimCard values, messages by slot", () => {
    const sms = SIM_CONTENT_SIMS.sms;
    expect(sms.id).toBe("sim-1");
    expect(sms.messages.slots).toBe(15);
    // Slots 1, 2, 3, 5, 7, 9: free slots are null.
    expect(sms.messages.entries.map((m) => m?.number ?? null)).toEqual([
      "0400000002",
      "+61412345678",
      "0499000001",
      null,
      "+61400000003",
      null,
      "0412345679",
      null,
      "0400000004",
    ]);
    expect(sms.messages.entries[0]).toEqual({
      number: "0400000002",
      text: "Lunch at 12?",
      sentAt: { year: 2026, month: 10, day: 12, hour: 9, minute: 15, second: 30 },
      read: true,
      centre: "+123456789",
    });
    expect(SIM_CONTENT_SIMS.slots30.messages.entries).toHaveLength(29);
    expect(SIM_CONTENT_SIMS.slots30.messages.entries[28]!.text).toBe("Message 29");
  });

  it("states the applet scripts as StockSimToolkit values", () => {
    expect(SIM_CONTENT_TOOLKITS.main.items).toHaveLength(12);
    expect(SIM_CONTENT_TOOLKITS.main.items[4]).toEqual({
      id: "auto-clear",
      label: "Auto clear",
      steps: [{ kind: "text", text: "Clears itself", clear: "delay" }],
    });
    expect(SIM_CONTENT_TOOLKITS.title14.title).toBe("Portfolio menu");
    expect(simContentCard("stk", "lachlan").toolkit).toBe(SIM_CONTENT_TOOLKITS.lachlan);
    expect(simContentCard("sms", undefined).toolkit).toBeUndefined();
  });

  it("builds the toolkit sound goldens in plan 16's format", () => {
    const sound: SoundCaptureIo = {
      events: () =>
        `${EVENTS_HEADER}\n1.0,0,0,0,0.0,0,0,0x900F\n41.0,900,0,0,0.0,0,0,0x9104\n165.0,0,0,0,0.0,0,0,0x910F`,
      keys: () => `${KEYS_HEADER}\nmenu,0.0,60.0`,
      sha256: () => "0".repeat(64),
    } as unknown as SoundCaptureIo;
    const goldens = simContentSounds(sound);
    expect(goldens.map((g) => g.id)).toEqual(SIM_CONTENT_SOUNDS.map((s) => s.id));
    expect(goldens.every((g) => g.id.startsWith("sound/stk/"))).toBe(true);
    expect(SIM_CONTENT_SOUNDS.every((s) => s.state === "factory")).toBe(true);
  });
});
