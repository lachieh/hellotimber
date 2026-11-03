import {
  createSyntheticNetwork,
  describeStockScreen,
  type SyntheticNetwork,
  type SyntheticRing,
} from "@hellotimber/nokia-os";
import type { PhoneKey, PhoneSnapshot } from "@hellotimber/phone-core";
import { hostClock, hostDate, hostTimestamp } from "../../phone/host-clock";
import { imeiForHash } from "../../phone/imei";
import { loadEnglishT9, startStockRuntime, type PhoneRuntime } from "../../phone/stock-phone";
import { appendLog, keyText, type LogEntry, type LogKind } from "./event-log";
import {
  batteryBars,
  DEFAULT_WORLD,
  formatOffset,
  memoryStorage,
  scopedStorage,
  shiftedDate,
  signalBars,
  type EnumerableStorage,
  type WorldSettings,
} from "./world";

/** The emulator keeps its EEPROM apart from the homepage phone's. */
export const EMULATOR_STORAGE_PREFIX = "hellotimber.exp.nokia-emulator/";

/** The emulator's operator line. */
export const EMULATOR_CARRIER = "LACHLAN";

/** What the phone is doing, as the Inspector reads it. */
export interface MachineState {
  readonly poweredOn: boolean;
  readonly path: string;
  /** The screen model's kind (`custom` screens add their application: `custom:stock:snake`). */
  readonly kind: string;
  /** The LCD as text (describeStockScreen). */
  readonly text: string;
}

/** A call the World tab rang. */
export interface RingingCall {
  readonly number: string;
  readonly state: SyntheticRing["state"];
}

export interface EmulatorState {
  /** `starting` until the phone has had its power key held; again after an EEPROM reset. */
  readonly status: "starting" | "running";
  readonly runtime: PhoneRuntime | undefined;
  readonly world: WorldSettings;
  readonly machine: MachineState;
  readonly log: readonly LogEntry[];
  readonly call: RingingCall | undefined;
}

const OFF: MachineState = { poweredOn: false, path: "standby", kind: "off", text: "" };

function machineOf(snapshot: Pick<PhoneSnapshot, "poweredOn" | "path" | "screen">): MachineState {
  const { screen } = snapshot;
  return {
    poweredOn: snapshot.poweredOn,
    path: snapshot.path,
    kind: screen.kind === "custom" ? `custom:${screen.appId}` : screen.kind,
    text: describeStockScreen(screen),
  };
}

function hostStorage(): EnumerableStorage {
  try {
    return window.localStorage;
  } catch {
    return memoryStorage();
  }
}

/**
 * The emulator: one stock phone at a time on its own EEPROM, a synthetic network for the World
 * tab's SMS and calls, the World settings its ports read, and the event log. A React view reads it
 * through `subscribe`/`getState`.
 */
export class Emulator {
  readonly storage = scopedStorage(hostStorage(), EMULATOR_STORAGE_PREFIX);
  readonly #started = performance.now();
  #state: EmulatorState = {
    status: "starting",
    runtime: undefined,
    world: DEFAULT_WORLD,
    machine: OFF,
    log: [],
    call: undefined,
  };
  readonly #listeners = new Set<() => void>();
  #network: SyntheticNetwork | undefined;
  #ring: SyntheticRing | undefined;
  #generation = 0;
  #heldSince = new Map<PhoneKey, number>();
  #sent = 0;
  #dialled = 0;
  #poweredAt: number | undefined;

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  getState = (): EmulatorState => this.#state;

  /** Milliseconds since the running phone was switched on (0 while it isn't). */
  uptime(): number {
    return this.#poweredAt === undefined ? 0 : performance.now() - this.#poweredAt;
  }

  /** Milliseconds since the emulator started (the log's clock). */
  elapsed(): number {
    return performance.now() - this.#started;
  }

  #set(patch: Partial<EmulatorState>): void {
    this.#state = { ...this.#state, ...patch };
    for (const listener of Array.from(this.#listeners)) listener();
  }

  log(kind: LogKind, text: string, warn = false): void {
    this.#set({
      log: appendLog(this.#state.log, {
        at: this.elapsed(),
        kind,
        text,
        ...(warn ? { warn } : {}),
      }),
    });
  }

  clearLog(): void {
    this.#set({ log: [] });
  }

  /** Power a fresh phone on over the emulator's EEPROM (replacing any running one). */
  async start(): Promise<void> {
    const generation = ++this.#generation;
    this.#state.runtime?.stop();
    this.#ring = undefined;
    this.#poweredAt = undefined;
    this.#set({ status: "starting", runtime: undefined, machine: OFF, call: undefined });
    const network = createSyntheticNetwork();
    this.#network = network;
    this.#sent = 0;
    this.#dialled = 0;
    const world = () => this.#state.world;
    const english = await loadEnglishT9();
    if (generation !== this.#generation) return;
    const starting = startStockRuntime({
      english,
      carrier: EMULATOR_CARRIER,
      storage: this.storage,
      imei: imeiForHash(__BUILD_HASH__),
      clock: () => hostClock(shiftedDate(world().offsetMinutes)),
      date: () => hostDate(shiftedDate(world().offsetMinutes)),
      signal: () => signalBars(world().signalDbm),
      battery: () => batteryBars(world().batteryPercent),
      network,
    });
    this.log("system", "Power key held: booting stock v6.39");
    const runtime = await starting;
    if (generation !== this.#generation) {
      runtime.stop();
      return;
    }
    let last = this.#state.machine;
    // The phone publishes every tick: only a new screen or power state is worth reading.
    let lastScreen: PhoneSnapshot["screen"] | undefined;
    runtime.phone.subscribe((snapshot) => {
      this.#watchNetwork();
      if (snapshot.screen === lastScreen && snapshot.poweredOn === last.poweredOn) return;
      lastScreen = snapshot.screen;
      const machine = machineOf(snapshot);
      if (machine.path !== last.path || machine.kind !== last.kind) {
        this.log("screen", `${machine.path} · ${machine.kind}`);
      }
      if (machine.poweredOn !== last.poweredOn) {
        this.#poweredAt = machine.poweredOn ? performance.now() : undefined;
        this.log("system", machine.poweredOn ? "Powered on" : "Powered off");
      }
      const changed =
        machine.path !== last.path ||
        machine.kind !== last.kind ||
        machine.text !== last.text ||
        machine.poweredOn !== last.poweredOn;
      last = machine;
      if (changed) this.#set({ machine });
    });
    this.#set({
      status: "running",
      runtime,
      machine: machineOf({
        path: runtime.phone.path,
        screen: runtime.phone.screen,
        poweredOn: runtime.phone.screen.kind !== "off",
      }),
    });
  }

  /** Stop the phone (the page is leaving). */
  stop(): void {
    this.#generation++;
    this.#state.runtime?.stop();
    this.#set({ status: "starting", runtime: undefined });
  }

  /** A phone key from the keyboard, the 3D model or the panel. */
  input(key: PhoneKey, action: "down" | "up"): void {
    const runtime = this.#state.runtime;
    if (runtime === undefined) return;
    const now = performance.now();
    if (action === "down") {
      this.#heldSince.set(key, now);
      this.log("key", keyText(key, "down"));
    } else {
      const since = this.#heldSince.get(key);
      this.#heldSince.delete(key);
      this.log("key", keyText(key, "up", since === undefined ? undefined : now - since));
    }
    runtime.input(key, action);
  }

  /** Jump the phone to a menu path (phone-core's `navigate`). */
  navigate(path: string): void {
    const runtime = this.#state.runtime;
    if (runtime === undefined) return;
    if (!this.#state.machine.poweredOn) {
      this.log("system", `Jump to ${path} ignored: the phone is off`, true);
      return;
    }
    this.log("system", `Jump to ${path}`);
    runtime.phone.navigate(path);
  }

  setWorld(patch: Partial<WorldSettings>): void {
    const before = this.#state.world;
    const world = { ...before, ...patch };
    this.#set({ world });
    if (
      patch.batteryPercent !== undefined &&
      batteryBars(world.batteryPercent) !== batteryBars(before.batteryPercent)
    ) {
      this.log(
        "world",
        `Battery ${world.batteryPercent} % (${batteryBars(world.batteryPercent)} bars)`,
        world.batteryPercent < 10,
      );
    }
    if (
      patch.signalDbm !== undefined &&
      signalBars(world.signalDbm) !== signalBars(before.signalDbm)
    ) {
      this.log(
        "world",
        `Signal ${world.signalDbm} dBm (${signalBars(world.signalDbm)} bars)`,
        signalBars(world.signalDbm) === 0,
      );
    }
    if (patch.backlight !== undefined && patch.backlight !== before.backlight) {
      this.log("world", `Backlight ${world.backlight}`);
    }
  }

  /** Log the clock offset once the control settles (a drag sets it many times). */
  commitOffset(): void {
    this.log("world", `Clock offset ${formatOffset(this.#state.world.offsetMinutes)}`);
  }

  /** An SMS arriving from the synthetic network, stamped with the phone's time. */
  incomingSms(number: string, text: string): void {
    const network = this.#network;
    if (network === undefined) return;
    try {
      network.deliver({
        number,
        text,
        sentAt: hostTimestamp(shiftedDate(this.#state.world.offsetMinutes)),
      });
      this.log("net", `Network took SMS from ${number}: “${text}”`);
    } catch (error) {
      this.log(
        "net",
        `SMS refused: ${error instanceof Error ? error.message : String(error)}`,
        true,
      );
    }
  }

  /** Ring the phone from `number` (the synthetic cell). */
  incomingCall(number: string): void {
    const network = this.#network;
    if (network === undefined) return;
    this.#ring?.hangUp();
    this.#ring = network.ring(number);
    this.log("net", `Call from ${number}`);
    this.#set({ call: { number, state: this.#ring.state } });
  }

  /** The far end hangs up. */
  hangUp(): void {
    if (this.#ring === undefined) return;
    this.#ring.hangUp();
    this.#watchNetwork();
  }

  /** Forget everything the phone stored and switch it on again, virgin. */
  async resetEeprom(): Promise<void> {
    this.#state.runtime?.stop();
    const cleared = this.storage.clear();
    this.log("system", `EEPROM reset: ${cleared} record${cleared === 1 ? "" : "s"} cleared`, true);
    await this.start();
  }

  /** Follow the rung call's state and what the phone sent or dialled. */
  #watchNetwork(): void {
    const ring = this.#ring;
    const call = this.#state.call;
    if (ring !== undefined && call !== undefined && ring.state !== call.state) {
      this.log("net", `Call from ${call.number} ${ring.state}`);
      this.#set({ call: { number: call.number, state: ring.state } });
      if (ring.state === "ended") this.#ring = undefined;
    }
    const network = this.#network;
    if (network === undefined) return;
    for (; this.#sent < network.sent.length; this.#sent++) {
      const sms = network.sent[this.#sent]!;
      this.log("net", `Phone sent SMS to ${sms.number}: “${sms.text}”`);
    }
    for (; this.#dialled < network.dialled.length; this.#dialled++) {
      this.log("net", `Phone dialled ${network.dialled[this.#dialled]!.number}`);
    }
  }
}
