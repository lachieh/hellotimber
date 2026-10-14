// Plan 25's lights goldens in tests: loading them by id and the comparison tolerances (Task 0).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Phone, PhoneKey } from "@hellotimber/phone-core";
import { readPlanIndex } from "../../scripts/golden-index.ts";
import { parseLightsGolden, type LightsGolden } from "../../scripts/lights-format.ts";
import type { StockLightEvent } from "../../src/firmware/features/backlight";
import { createStockPhoneWith, type StockPhoneConfig } from "../../src/firmware/phone";
import type { StockStorage } from "../../src/index";
import { SEED_1010, seededStorage } from "./rig.ts";

const GOLDENS = join(import.meta.dirname, "../../goldens");

/**
 * How far an off edge may stray from the golden after power-on alignment: the captured edges lie
 * within 2.9 ms of the fitted light tick, and the two lines may switch one 1 ms grain apart.
 */
export const LIGHT_EDGE_TOLERANCE_MS = 5;

/** The firmware lights the LEDs 14-33 ms after a key-down; nokia-os lights at the key-down (D2). */
export const KEY_LIGHT_LATENCY_MAX_MS = 33;

export function loadLightsGolden(id: string): LightsGolden {
  const file = `${id}.lights.txt`;
  return parseLightsGolden(readFileSync(join(GOLDENS, file), "utf8"), file);
}

/** Plan 25's lights golden ids starting with `prefix`, sorted. */
export function lightsGoldenIds(prefix: string): string[] {
  return readPlanIndex(GOLDENS, "25")
    .filter((entry) => entry.kind === "lights" && entry.id.startsWith(prefix))
    .map((entry) => entry.id);
}

// ---------------------------------------------------------------- driving a phone (Task 4)

/** A stock phone on a virtual clock that records its lights port; idle waits may jump. */
export interface LightsRig {
  readonly phone: Phone;
  readonly now: number;
  /** Every lights event so far. */
  readonly events: readonly StockLightEvent[];
  /** When the kernel powered the phone on (the light tick's anchor), once it has. */
  readonly poweredOnAt: number | undefined;
  /** Ticks to `now + ms`, every `stepMs` (1 by default; lights edges are exact at any step). */
  advance(ms: number, stepMs?: number): void;
  hold(key: PhoneKey): void;
  release(key: PhoneKey): void;
  /** Holds the power key until the kernel powers on, then releases it. */
  powerOn(): void;
}

/** The storage a golden's `state` names: the factory state, or plan 15's seeded EEPROMs. */
export function storageFor(state: string): StockStorage {
  if (state === "factory") return seededStorage({ factory: true });
  if (state === "v639-plan15-welcome-hi") return seededStorage({ welcomeNote: "Hi" });
  if (state === "virgin") return seededStorage();
  throw new Error(`No storage for the golden state "${state}".`);
}

export function lightsRig(config: Partial<StockPhoneConfig> = {}): LightsRig {
  const events: StockLightEvent[] = [];
  const phone = createStockPhoneWith(
    {
      carrier: "Orange F",
      clock: () => "10:10",
      date: () => "13.10.2026",
      ...config,
      lights: {
        change(event) {
          events.push(event);
          config.lights?.change(event);
        },
      },
    },
    { seed: SEED_1010 },
  );
  let now = 0;
  let poweredOnAt: number | undefined;
  phone.subscribe((snapshot) => {
    if (snapshot.poweredOn && poweredOnAt === undefined) poweredOnAt = now;
  });
  phone.tick(now);
  const rig: LightsRig = {
    phone,
    get now() {
      return now;
    },
    events,
    get poweredOnAt() {
      return poweredOnAt;
    },
    advance(ms, stepMs = 1) {
      const end = now + ms;
      while (now < end) {
        now = Math.min(end, now + stepMs);
        phone.tick(now);
      }
    },
    hold: (key) => phone.send({ type: "down", key }),
    release: (key) => phone.send({ type: "up", key }),
    powerOn() {
      rig.hold("power");
      for (let i = 0; i < 5000 && poweredOnAt === undefined; i++) rig.advance(1);
      rig.release("power");
      if (poweredOnAt === undefined) throw new Error("The phone did not power on.");
    },
  };
  return rig;
}

/** A golden's lights as the rig recorded them, in the golden's time (0 = its first key-down). */
export interface RecordedLights {
  readonly originMs: number;
  readonly endMs: number;
  readonly events: readonly StockLightEvent[];
}

/**
 * Advances `rig` (powered on) to the golden's time 0, `powerOnMs` after the power-on, presses its
 * keys (taps of 60 ms unless held) and runs until the recording's end. Every event since the
 * power-on is kept. The clock moves `stepMs` at a time between the keys.
 */
export function replayLights(
  rig: LightsRig,
  golden: LightsGolden,
  { stepMs = 1 }: { stepMs?: number } = {},
): RecordedLights {
  if (rig.poweredOnAt === undefined) throw new Error("Power the rig on first.");
  const origin = rig.poweredOnAt + golden.powerOnMs;
  if (rig.now > origin) {
    throw new Error(`The rig is at ${rig.now} ms, past the golden's time 0 (${origin} ms).`);
  }
  rig.advance(origin - rig.now, stepMs);
  const actions: { ms: number; run: () => void }[] = [];
  for (const k of golden.keys ?? []) {
    const key = k.key as PhoneKey;
    actions.push({ ms: k.ms, run: () => rig.hold(key) });
    actions.push({ ms: k.ms + (k.holdMs ?? 60), run: () => rig.release(key) });
  }
  actions.sort((a, b) => a.ms - b.ms);
  for (const action of actions) {
    rig.advance(origin + action.ms - rig.now, stepMs);
    action.run();
  }
  rig.advance(Math.max(0, origin + golden.endMs - rig.now), stepMs);
  const powered = rig.poweredOnAt;
  return { originMs: origin, endMs: rig.now, events: rig.events.filter((e) => e.atMs >= powered) };
}

export interface LightsTolerance {
  /** An on edge no key caused (the boot's frames): |Δ| within this (default LIGHT_EDGE_TOLERANCE_MS). */
  readonly onToleranceMs?: number;
  /** An off edge |Δ| within this (default LIGHT_EDGE_TOLERANCE_MS). */
  readonly offToleranceMs?: number;
}

/**
 * Compares each light's events with the golden's rows in order. An on edge within
 * KEY_LIGHT_LATENCY_MAX_MS after a key-down may lag that key (the firmware's latency, D2); any
 * other edge must lie within its tolerance. Only the recording's span counts: a light lit at its
 * start is a row there, and events after its end are not compared.
 * Fails with a table of every row.
 */
export function expectLightsTimeline(
  recorded: RecordedLights,
  golden: LightsGolden,
  context: string,
  tolerance: LightsTolerance = {},
): void {
  const onTolerance = tolerance.onToleranceMs ?? LIGHT_EDGE_TOLERANCE_MS;
  const offTolerance = tolerance.offToleranceMs ?? LIGHT_EDGE_TOLERANCE_MS;
  const keys = golden.keys ?? [];
  const lines = ["  golden  light    state    actual       Δ"];
  let failed = false;
  for (const light of ["display", "keypad"] as const) {
    const want = golden.rows.filter((row) => row.light === light);
    const mine = recorded.events
      .filter((event) => event.light === light)
      .map((event) => ({ ms: event.atMs - recorded.originMs, on: event.on }));
    // As the capture saw it: lit at the recording's start is a row there, then every change.
    const before = mine.filter((event) => event.ms <= golden.startMs).at(-1);
    const got = [
      ...(before?.on ? [{ ms: golden.startMs, on: true }] : []),
      ...mine.filter((event) => event.ms > golden.startMs && event.ms <= golden.endMs),
    ];
    want.forEach((row, i) => {
      const prefix = `${String(row.ms).padStart(8)}  ${light.padEnd(7)}  ${(row.on ? "on" : "off").padEnd(5)}`;
      const actual = got[i];
      if (actual === undefined) {
        failed = true;
        lines.push(`${prefix}  ${"-".padStart(9)}  ✗ missing`);
        return;
      }
      const delta = actual.ms - row.ms;
      const marks: string[] = [];
      if (actual.on !== row.on) marks.push(`✗ state ${actual.on ? "on" : "off"}`);
      const byKey =
        row.on && keys.some((k) => k.ms <= row.ms && row.ms - k.ms <= KEY_LIGHT_LATENCY_MAX_MS);
      if (byKey) {
        if (delta > 0) marks.push("✗ after the golden");
        else if (delta < -KEY_LIGHT_LATENCY_MAX_MS) marks.push("✗ early");
      } else if (Math.abs(delta) > (row.on ? onTolerance : offTolerance)) {
        marks.push(delta < 0 ? "✗ early" : "✗ late");
      }
      if (marks.length > 0) failed = true;
      lines.push(
        `${prefix}  ${actual.ms.toFixed(1).padStart(9)}  ${(delta >= 0 ? "+" : "") + delta.toFixed(1)} ${marks.join(" ")}`.trimEnd(),
      );
    });
    for (const extra of got.slice(want.length)) {
      failed = true;
      lines.push(
        `${"-".padStart(8)}  ${light.padEnd(7)}  ${"".padEnd(5)}  ${extra.ms.toFixed(1).padStart(9)}  ✗ extra ${extra.on ? "on" : "off"}`,
      );
    }
  }
  if (failed) throw new Error(`${context}: lights differ from ${golden.id}\n${lines.join("\n")}`);
}

// ---------------------------------------------------------------- the generic scenario (Task 4)

/** Where a recording was made, by its id: the keys that reach it from standby. */
function placeOf(id: string): readonly PhoneKey[] {
  if (/^lights\/(keys\/carousel-|power-key\/menu)/.test(id)) return ["navi"];
  if (/^lights\/(keys\/list-|power-key\/list)/.test(id)) return ["navi", "navi"];
  return [];
}

/** The boot frames' on edge: 268 ms after the power-on in nokia-os, 245-272 ms captured. */
export const BOOT_LIGHT_TOLERANCE_MS = 25;

/**
 * A lights golden's scenario: a phone in the golden's state (factory unless it is a boot golden:
 * the light rules do not depend on the state), powered on, taken to where the recording was made
 * (well before time 0, so those keys have timed out), then the golden's keys at its time 0,
 * `powerOnMs` after the power-on.
 */
export function lightsScenario(id: string): void {
  const golden = loadLightsGolden(id);
  const boot = id.startsWith("lights/boot/");
  const rig = lightsRig({ storage: storageFor(boot ? golden.state : "factory") });
  rig.powerOn();
  if (!boot) {
    rig.advance(20_000);
    for (const key of placeOf(id)) {
      rig.hold(key);
      rig.advance(60);
      rig.release(key);
      rig.advance(1500);
    }
  }
  const recorded = replayLights(rig, golden, { stepMs: boot ? 1 : 20 });
  expectLightsTimeline(
    recorded,
    golden,
    id,
    boot ? { onToleranceMs: BOOT_LIGHT_TOLERANCE_MS } : {},
  );
}
