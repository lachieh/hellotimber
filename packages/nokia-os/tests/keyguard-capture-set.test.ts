// Plan 25's capture set on synthetic sources (no REF): the lights goldens built from `.lights.csv`
// and `keys.csv`, the keyguard LCD entries, the shared hint golden, and every family of the plan's
// "Golden pipeline additions" table with its status.
import { createHash } from "node:crypto";
import { describe, expect, it } from "vite-plus/test";
import type { CaptureIo, CaptureSetEntry } from "../scripts/capture-set.ts";
import {
  buildLightsGolden,
  HINT_KEYS,
  keyguardAndBacklight,
  keyguardLcdSet,
  LIGHTS_ENTRIES,
  type LightsCaptureEntry,
} from "../scripts/capture-sets/25-keyguard-and-backlight.ts";
import type { LightsCaptureIo } from "../scripts/lights-format.ts";
import type { RecordingFrame, TreeCaptureIo } from "../scripts/tree-capture-set.ts";

const ENTRY: LightsCaptureEntry = {
  id: "lights/timeout/factory/tap-03",
  dir: "plan25/lights/timeout/factory/tap-03",
  state: "factory",
  status: "pending:25",
  note: "C at standby, LEDs off.",
};

function lightsIo(files: Record<string, string>): LightsCaptureIo {
  return {
    lights: (dir) => files[`${dir}.lights.csv`],
    keys: (dir) => files[`${dir}/keys.csv`],
    sha256: (dir) =>
      createHash("sha256")
        .update(files[`${dir}.lights.csv`] ?? "")
        .update(files[`${dir}/keys.csv`] ?? "")
        .digest("hex"),
  };
}

const LOG = `# power_on_ms=61734.2
t_ms,lcd_led,kbd_led
0.0,0,0
118.0,1,1
15590.6,0,1
15591.6,0,0
`;
const KEYS = "key,down_ms,up_ms\nc,100.0,160.0\nc,1100.4,2700.5\n";
/** A recording whose last frame ends at 17 100.4 ms. */
const FRAMES: TreeCaptureIo = {
  recording: () => [
    { image: "a", startMs: 1, durationMs: 117 },
    { image: "b", startMs: 118, durationMs: 16982.4 },
  ],
  scrollImages: () => undefined,
};

describe("lights goldens from LED logs", () => {
  it("aligns the rows of each light on the first key-down, with power-on from the comment", () => {
    const golden = buildLightsGolden(
      ENTRY,
      lightsIo({ [`${ENTRY.dir}.lights.csv`]: LOG, [`${ENTRY.dir}/keys.csv`]: KEYS }),
      FRAMES,
    );
    expect(golden).toMatchObject({
      id: ENTRY.id,
      status: "pending:25",
      source: "captures/6.39/plan25/lights/timeout/factory/tap-03",
      state: "factory",
      powerOnMs: 61834,
      startMs: -100,
      endMs: 17000,
      keys: [
        { ms: 0, key: "c" },
        { ms: 1000, key: "c", holdMs: 1600 },
      ],
      note: ENTRY.note,
      omitted: [],
      rows: [
        { ms: 18, light: "display", on: true },
        { ms: 18, light: "keypad", on: true },
        { ms: 15491, light: "display", on: false },
        { ms: 15492, light: "keypad", on: false },
      ],
    });
    expect(golden.sourceSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("states lights already on at the recording's start as rows at its start", () => {
    const lit = "# power_on_ms=1000.0\nt_ms,lcd_led,kbd_led\n0.0,1,1\n38.0,0,0\n";
    const golden = buildLightsGolden(
      ENTRY,
      lightsIo({
        [`${ENTRY.dir}.lights.csv`]: lit,
        [`${ENTRY.dir}/keys.csv`]: "key,down_ms,up_ms\nmenu,20.0,60.0\n",
      }),
      FRAMES,
    );
    expect(golden.powerOnMs).toBe(1020);
    expect(golden.endMs).toBe(17080);
    expect(golden.keys).toEqual([{ ms: 0, key: "navi" }]);
    expect(golden.rows).toEqual([
      { ms: -20, light: "display", on: true },
      { ms: -20, light: "keypad", on: true },
      { ms: 18, light: "display", on: false },
      { ms: 18, light: "keypad", on: false },
    ]);
  });

  it("uses the recording's start as time 0 without keys", () => {
    const golden = buildLightsGolden(
      ENTRY,
      lightsIo({
        [`${ENTRY.dir}.lights.csv`]: LOG,
        [`${ENTRY.dir}/keys.csv`]: "key,down_ms,up_ms\n",
      }),
      FRAMES,
    );
    expect(golden.keys).toBeUndefined();
    expect(golden.powerOnMs).toBe(61734);
    expect(golden.rows[0]).toEqual({ ms: 118, light: "display", on: true });
  });

  it("throws naming the recording when a file or a column is missing", () => {
    const noFrames: TreeCaptureIo = { recording: () => undefined, scrollImages: () => undefined };
    expect(() =>
      buildLightsGolden(
        ENTRY,
        lightsIo({ [`${ENTRY.dir}.lights.csv`]: LOG, [`${ENTRY.dir}/keys.csv`]: KEYS }),
        noFrames,
      ),
    ).toThrow(`${ENTRY.id}: missing ${ENTRY.dir}/timings.csv`);
    expect(() =>
      buildLightsGolden(ENTRY, lightsIo({ [`${ENTRY.dir}/keys.csv`]: KEYS }), FRAMES),
    ).toThrow(`${ENTRY.id}: missing ${ENTRY.dir}.lights.csv`);
    expect(() =>
      buildLightsGolden(ENTRY, lightsIo({ [`${ENTRY.dir}.lights.csv`]: LOG }), FRAMES),
    ).toThrow(`${ENTRY.id}: missing ${ENTRY.dir}/keys.csv`);
    const noPowerOn = LOG.replace("# power_on_ms=61734.2\n", "");
    expect(() =>
      buildLightsGolden(
        ENTRY,
        lightsIo({ [`${ENTRY.dir}.lights.csv`]: noPowerOn, [`${ENTRY.dir}/keys.csv`]: KEYS }),
        FRAMES,
      ),
    ).toThrow(`${ENTRY.dir}.lights.csv:1: expected "# power_on_ms=<ms>"`);
    const noColumn = LOG.replace("15591.6,0,0", "15591.6,0");
    expect(() =>
      buildLightsGolden(
        ENTRY,
        lightsIo({ [`${ENTRY.dir}.lights.csv`]: noColumn, [`${ENTRY.dir}/keys.csv`]: KEYS }),
        FRAMES,
      ),
    ).toThrow(`${ENTRY.dir}.lights.csv:6: bad row "15591.6,0"`);
  });
});

/** Recordings whose frames are the same for every directory, except `differ`'s. */
function framesIo(differ: readonly string[] = []): TreeCaptureIo {
  const frames = (shift: number): RecordingFrame[] =>
    ["a", "b", "c", "d"].map((image, i) => ({
      image,
      startMs: i === 0 ? 1 : i * 500 + shift,
      durationMs: 500,
    }));
  return {
    recording: (dir) => frames(differ.some((d) => dir.endsWith(d)) ? 9 : 0),
    scrollImages: () => undefined,
  };
}

function byId(entries: readonly CaptureSetEntry[]): Map<string, CaptureSetEntry> {
  return new Map(entries.map((entry) => [entry.id, entry]));
}

describe("keyguard LCD entries", () => {
  it("shares one hint golden among equal recordings and keeps the others apart", () => {
    const entries = byId(keyguardLcdSet(framesIo(["/hint/c", "/hint/up"])));
    const hint = entries.get("keyguard/hint")!;
    expect(hint.prefer.source).toEqual({ kind: "recording", dir: "plan25/keyguard/hint/5" });
    for (const key of HINT_KEYS.filter((k) => k !== "c" && k !== "up")) {
      expect(hint.prefer.note).toContain(key);
    }
    // A group other than 5's is named after its first key in HINT_KEYS order (▲ before C).
    expect(entries.get("keyguard/hint/up")!.prefer.note).toContain("c");
    expect(entries.has("keyguard/hint/c")).toBe(false);
    expect(entries.get("keyguard/hint/pwr")).toBeDefined();
  });

  it("triggers every timeline on its first changed frame", () => {
    for (const entry of keyguardLcdSet(framesIo())) {
      if (entry.kind === "timeline") expect(entry.prefer.triggerFrame, entry.id).toBe(1);
    }
  });
});

describe("plan 25's capture set", () => {
  const anyLog = "# power_on_ms=1000.0\nt_ms,lcd_led,kbd_led\n0.0,0,0\n";
  const io = {
    frames: framesIo(),
    lights: {
      lights: () => anyLog,
      keys: () => "key,down_ms,up_ms\nc,100.0,160.0\n",
      sha256: () => "0".repeat(64),
    },
  } as unknown as CaptureIo;
  const lcd = byId(keyguardAndBacklight.lcd!(io));
  const lights = new Map(keyguardAndBacklight.lights!(io).map((g) => [g.id, g]));
  const status = (id: string): string => (lcd.get(id) ?? lights.get(id))?.status ?? "missing";

  it("lists every row of the plan's table", () => {
    for (const id of [
      "keyguard/lock",
      "keyguard/lock-gap/2000",
      "keyguard/lock-gap/2920",
      "keyguard/lock-gap/2930",
      "keyguard/carousel-star",
      "keyguard/standby",
      "keyguard/standby-message",
      "keyguard/hint",
      "keyguard/unlock-alone",
      "keyguard/unlock",
      "keyguard/unlock-gap/1440",
      "keyguard/unlock-gap/1450",
      "keyguard/emergency/112",
      "keyguard/emergency-call",
      "keyguard/call",
      "keyguard/sms",
      "lights/timeout/virgin/tap-00",
      "lights/timeout/factory/tap-15",
      "lights/timeout/factory/fine-252",
      "lights/timeout/factory/hold-16000",
      "lights/keys/standby-0",
      "lights/keys/list-c-held",
      "lights/boot/power-on",
      "lights/boot/gate",
      "lights/boot/welcome",
      "lights/boot/power-off",
      "lights/power-key/menu",
      "lights/power-key/standby",
      "lights/keyguard/lock",
      "lights/keyguard/hint",
      "lights/keyguard/unlock-alone",
      "lights/keyguard/unlock",
      "lights/keyguard/emergency",
      "lights/game/off/play",
      "lights/game/on/top-score",
      "lights/arrival/sms",
      "lights/arrival/sms-locked",
      "lights/arrival/call",
      "lights/arrival/call-locked",
      "lights/screen-saver",
    ]) {
      expect(status(id), id).not.toBe("missing");
    }
    expect(LIGHTS_ENTRIES.length).toBe(lights.size);
  });

  it("leaves plan 22's screens pending on it and asserts the rest", () => {
    for (const id of [
      "keyguard/carousel-star",
      "keyguard/lock-gap/2930",
      "keyguard/emergency-call",
      "keyguard/call",
      "lights/arrival/call-locked",
      "lights/keyguard/emergency-call",
    ]) {
      expect(status(id), id).toBe("pending:22");
    }
    // Task 4 drives the timeout, key, boot and power-key lights goldens, Task 7 the keyguard's LCD
    // goldens, Task 8 the other lights goldens; the message arrivals since plan 18's merge.
    for (const id of [
      "keyguard/standby-message",
      "keyguard/sms",
      "lights/arrival/sms",
      "lights/arrival/sms-locked",
      "lights/game/off/play",
      "lights/keyguard/hint",
      "lights/screen-saver",
      "lights/timeout/factory/tap-00",
      "lights/boot/gate",
      "lights/power-key/menu",
      "keyguard/lock",
      "keyguard/lock-gap/2920",
      "keyguard/hint",
      "keyguard/standby",
    ]) {
      expect(status(id), id).toBe("asserted");
    }
    expect(status("lights/power-key/game")).toBe("asserted");
    // Task 10: every golden of plan 25's own is driven.
    const statuses = [...lcd.values(), ...lights.values()].map((g) => g.status);
    expect(statuses.filter((s) => s === "pending:25")).toEqual([]);
  });

  it("imports the keyguard sound recordings", () => {
    const sound = {
      events: () =>
        "t_ms,dsp_tone1_hz,dsp_tone2_hz,buzzer_on,buzzer_hz,vibra,buzzer_vol,dsp_level\n1.0,0,0,0,0.0,0,0,0x900F\n",
      keys: () => "key,down_ms,up_ms\nc,100.0,160.0\n",
      sha256: () => "0".repeat(64),
      list: () => [],
    };
    const ids = keyguardAndBacklight.sounds!({ ...io, sound } as CaptureIo).map((g) => g.id);
    expect(ids).toEqual([
      "sound/keyguard/emergency",
      "sound/keyguard/hint-key",
      "sound/keyguard/hint-key-c",
      "sound/keyguard/unlock",
      "sound/keyguard/unlock-alone",
      "sound/note/keypad-locked",
    ]);
  });
});
