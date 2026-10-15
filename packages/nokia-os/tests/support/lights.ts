// Plan 25's lights goldens in tests: loading them by id and the comparison tolerances (Task 0).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Phone, PhoneKey } from "@hellotimber/phone-core";
import { readPlanIndex } from "../../scripts/golden-index.ts";
import { parseLightsGolden, type LightsGolden } from "../../scripts/lights-format.ts";
import type { StockCue } from "../../src/firmware/cues";
import { GAMES_LIGHTS_KEY, type StockLightEvent } from "../../src/firmware/features/backlight";
import { StockEeprom } from "../../src/firmware/eeprom";
import { createStockSettings } from "../../src/firmware/settings";
import { createStockPhoneWith, type StockPhoneConfig } from "../../src/firmware/phone";
import { createSyntheticNetwork, type StockStorage } from "../../src/index";
import { RECEIVE_LINK_MS } from "../../src/resources";
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
  /** Every game cue so far, stamped (the games' sounds are not played: lights only). */
  readonly cues: readonly { readonly cue: StockCue; readonly atMs: number }[];
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
  const cues: { cue: StockCue; atMs: number }[] = [];
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
    { seed: SEED_1010, cues: { cue: (cue, atMs) => void cues.push({ cue, atMs }) } },
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
    cues,
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
  /** How long after its key-down an on edge may lag (default KEY_LIGHT_LATENCY_MAX_MS). */
  readonly keyLatencyMaxMs?: number;
  /**
   * An off edge within KEY_OFF_WINDOW_MS after a key-down (a game starting under Lights Off):
   * |Δ| within this (default: `offToleranceMs`).
   */
  readonly keyOffToleranceMs?: number;
}

/** How long after a key-down an off edge counts as that key's (`keyOffToleranceMs`). */
const KEY_OFF_WINDOW_MS = 100;

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
  const keyLatency = tolerance.keyLatencyMaxMs ?? KEY_LIGHT_LATENCY_MAX_MS;
  const keyOffTolerance = tolerance.keyOffToleranceMs ?? offTolerance;
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
      const after = (window: number) => keys.some((k) => k.ms <= row.ms && row.ms - k.ms <= window);
      const byKey = row.on && after(keyLatency);
      const offByKey = !row.on && after(KEY_OFF_WINDOW_MS);
      if (byKey) {
        if (delta > 0) marks.push("✗ after the golden");
        else if (delta < -keyLatency) marks.push("✗ early");
      } else if (
        Math.abs(delta) > (row.on ? onTolerance : offByKey ? keyOffTolerance : offTolerance)
      ) {
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
  // Locked well before the recording, so the lock's light has timed out (Task 8).
  if (/^lights\/keyguard\/(?!lock$|lit\/|power-key-held$)/.test(id)) return ["navi", "*"];
  return [];
}

/**
 * Keys pressed just before a recording (golden time, from its time 0), as the capture script
 * did: the lit keyguard recordings lock ≈4.8 s before (`key menu`, `key *`, 3.5 s, the shot, the
 * fork's 100 ms); the games open Snake II's menu (Games, Snake II, its 7 s intro) right before New
 * game, so the LEDs are lit at New game.
 */
function leadOf(id: string): readonly (readonly [ms: number, key: PhoneKey])[] {
  if (/^lights\/keyguard\/(lit\/|power-key-held$)/.test(id)) {
    return [
      [-4784, "navi"],
      [-4192, "*"],
    ];
  }
  if (/^lights\/(game\/|power-key\/game$)/.test(id)) {
    const keys: PhoneKey[] = ["navi", ...Array<PhoneKey>(7).fill("down"), "navi", "navi"];
    return keys.map((key, i) => [-8000 - 600 * (keys.length - 1 - i), key] as const);
  }
  return [];
}

/**
 * The game recordings' tolerances (D7): Snake II's pause lights 36 ms after its key-down (the
 * game's key scan), and the force at New game and Continue comes at Select's release in nokia-os
 * (plan 23: the tap's 60 ms), 36-38 ms after the key-down in the firmware.
 */
export const GAME_LIGHTS_TOLERANCE: LightsTolerance = {
  keyLatencyMaxMs: 40,
  keyOffToleranceMs: 25,
};

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
  const game = /^lights\/(game\/|power-key\/game$)/.test(id);
  const storage = storageFor(boot ? golden.state : "factory");
  // Games › Settings › Lights as the recordings had it (D7): factory Off, and the On section
  // chose On.
  if (game && id.startsWith("lights/game/on/")) {
    createStockSettings(new StockEeprom(storage)).choose(GAMES_LIGHTS_KEY, 1);
  }
  const rig = lightsRig({ storage });
  rig.powerOn();
  if (!boot) {
    rig.advance(20_000);
    for (const key of placeOf(id)) {
      rig.hold(key);
      rig.advance(60);
      rig.release(key);
      rig.advance(1500);
    }
    const origin = rig.poweredOnAt! + golden.powerOnMs;
    for (const [ms, key] of leadOf(id)) {
      rig.advance(origin + ms - rig.now, 20);
      rig.hold(key);
      rig.advance(60);
      rig.release(key);
    }
  }
  const recorded = replayLights(rig, golden, { stepMs: boot ? 1 : game ? 1 : 20 });
  expectLightsTimeline(
    recorded,
    golden,
    id,
    boot ? { onToleranceMs: BOOT_LIGHT_TOLERANCE_MS } : game ? GAME_LIGHTS_TOLERANCE : {},
  );
}

// ---------------------------------------------------------------- message arrivals (L7, K7)

/** The SMS the plan 25 arrival captures received (its text and sender are not on screen). */
export const ARRIVING_SMS = {
  number: "0412345678",
  text: "Hello",
  sentAt: { year: 2026, month: 10, day: 13, hour: 10, minute: 10, second: 0 },
} as const;

/**
 * Delivers an SMS through `network` and ticks until it lands (RECEIVE_LINK_MS, rounded up to
 * the rig's 1 ms ticks): the arrival happens on the last tick, so a recording's trigger is the
 * arrival. The plan 25 captures do not log the delivery (their `keys.csv` is empty) and the link
 * time spreads 2141-2464 ms (plan 18 D10), so their goldens are aligned on the arrival.
 */
export function deliverAndLand(
  advance: (ms: number) => void,
  network: ReturnType<typeof createSyntheticNetwork>,
): void {
  network.deliver(ARRIVING_SMS);
  advance(Math.ceil(RECEIVE_LINK_MS));
}

/**
 * `lights/arrival/sms` and `-locked` (L7, K7): an SMS lands at golden time `landsAtMs` on a dark
 * standby, locked well before for `-locked`. The captures do not log the delivery, so it is
 * placed for the arrival to land where the recording's first change is (the unlocked one's LED
 * edge, the locked one's notice in `keyguard/sms`); the goldens pin what the arrival lights and
 * that its timeout runs from the arrival on the power-on's light tick.
 */
export function arrivalLights(id: string, landsAtMs: number): void {
  const golden = loadLightsGolden(id);
  const network = createSyntheticNetwork();
  const rig = lightsRig({ storage: storageFor("factory"), network });
  rig.powerOn();
  rig.advance(20_000);
  if (id.endsWith("-locked")) {
    for (const key of ["navi", "*"] as const) {
      rig.hold(key);
      rig.advance(60);
      rig.release(key);
      rig.advance(1500);
    }
  }
  const powered = rig.poweredOnAt!;
  const origin = powered + golden.powerOnMs;
  rig.advance(origin + landsAtMs - Math.ceil(RECEIVE_LINK_MS) - rig.now, 20);
  deliverAndLand((ms) => rig.advance(ms), network);
  rig.advance(origin + golden.endMs - rig.now, 20);
  const events = rig.events.filter((e) => e.atMs >= powered);
  expectLightsTimeline({ originMs: origin, endMs: rig.now, events }, golden, id);
}
