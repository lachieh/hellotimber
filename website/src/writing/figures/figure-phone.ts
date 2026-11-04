// A phone for a figure: the homepage or the stock firmware, silent, on its own memory, switched on
// and at `start` before anyone sees it. The figures import this lazily: it is the whole OS.
import {
  createFirmwarePhone,
  createMemoryStorage,
  createStockPhone,
  describeFirmwareScreen,
  describeStockScreen,
  firmwarePainter,
  paintStockScreen,
  STOCK_FIRMWARE,
  type T9Dictionary,
} from "@hellotimber/nokia-os";
import type { Phone, PhoneKey } from "@hellotimber/phone-core";
import type { ScreenPainter } from "@hellotimber/phone-screen";
import { homeFirmware } from "../../home/firmware";
import { HOME_SIM } from "../../home/runtime";
import { machineTree, type MachineNode } from "./machine";

export type FigureFirmware = "home" | "stock";

export interface FigurePhoneOptions {
  readonly firmware: FigureFirmware;
  /** A phone path to open once it's on (`menu/writing`); standby without one. */
  readonly start?: string;
  /** T9 English for Write messages; without it the editor is multi-tap only. */
  readonly english?: T9Dictionary;
}

export interface FigurePhone {
  readonly phone: Phone;
  readonly paint: ScreenPainter;
  /** The LCD as text, for the figure's live region. */
  describe(): string;
  /** The firmware's menu tree, `depth` levels deep, as the StateMachine draws it. */
  tree(depth: number): MachineNode[];
  /** Kernel time now: it carries on from the synthetic power-on. */
  readonly clock: { now: number };
  /** Advances kernel time by `ms`, a millisecond at a time. */
  advance(ms: number): void;
}

const CARRIER = "LACHLAN";

export function createFigurePhone({ firmware, start, english }: FigurePhoneOptions): FigurePhone {
  const config = {
    carrier: CARRIER,
    boot: "skip" as const,
    storage: createMemoryStorage(),
    t9: english === undefined ? {} : { english },
  };
  // Site links on the homepage firmware go nowhere in a figure: the list stays, as on the phone.
  const home = firmware === "home" ? homeFirmware(() => {}) : undefined;
  const phone =
    home === undefined
      ? createStockPhone(config)
      : createFirmwarePhone(home, { ...config, sim: HOME_SIM, preload: { snakeLevel: 5 } });
  const clock = { now: 0 };
  const advance = (ms: number) => {
    const end = clock.now + ms;
    while (clock.now < end) phone.tick(++clock.now);
  };
  phone.tick(0);
  phone.send({ type: "down", key: "power" });
  advance(1000);
  phone.send({ type: "up", key: "power" });
  advance(1500);
  if (start !== undefined) {
    phone.navigate(start);
    advance(500);
  }
  const source = home ?? STOCK_FIRMWARE;
  return {
    phone,
    paint: home === undefined ? paintStockScreen : firmwarePainter(home),
    describe: () =>
      home === undefined
        ? describeStockScreen(phone.screen)
        : describeFirmwareScreen(home, phone.screen),
    tree: (depth) => machineTree(source.tree, depth),
    clock,
    advance,
  };
}

/** Presses `key` for `holdMs` of kernel time and lets the phone settle `settleMs` after. */
export function pressFor(figure: FigurePhone, key: PhoneKey, holdMs: number, settleMs = 400): void {
  figure.phone.send({ type: "down", key });
  figure.advance(holdMs);
  figure.phone.send({ type: "up", key });
  figure.advance(settleMs);
}
