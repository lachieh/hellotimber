// The host clock (plan 21 Task 13): the browser's local time moved on by the controls (+1 min,
// +10 min, +1 h, reset), so alarms, reminders and the countdown can be tried without waiting. The
// phone reads it as its real-time clock (`StockPhoneConfig.clock`/`date`) on every tick; the
// status line shows it and logs the alerts (a screen over standby that keeps the path `standby`).
import type { ScreenModel } from "@hellotimber/phone-core";
import { html, type DemoPanel } from "../panel";

/** How many alerts the status line lists. */
const ALERT_LOG_LENGTH = 3;

const pad = (n: number): string => String(n).padStart(2, "0");

/** Added to the browser's clock, ms. */
let shiftMs = 0;
let alerts: string[] = [];
let atStandby = false;
let host: { readonly phone?: { readonly path: string } } | undefined;

const now = (): Date => new Date(Date.now() + shiftMs);
/** The host clock in the firmware's 24-hour format (`07:59`). */
const clock = (): string => `${pad(now().getHours())}:${pad(now().getMinutes())}`;
/** The host date as Date setting shows it (`13.10.2026`). */
const date = (): string => {
  const at = now();
  return `${pad(at.getDate())}.${pad(at.getMonth() + 1)}.${at.getFullYear()}`;
};

export const clockPanel: DemoPanel = {
  name: "clock",
  plan: 21,
  mount(slots, demoHost) {
    host = demoHost;
    const controls = html(`
      <fieldset id="host-clock">
        <legend>Host clock</legend>
        <button type="button" data-ms="60000">+1 min</button>
        <button type="button" data-ms="600000">+10 min</button>
        <button type="button" data-ms="3600000">+1 h</button>
        <button type="button" data-ms="reset">Reset</button>
      </fieldset>`);
    for (const button of Array.from(controls.querySelectorAll("button"))) {
      button.addEventListener("click", () => {
        const ms = button.dataset["ms"];
        shiftMs = ms === "reset" ? 0 : shiftMs + Number(ms);
      });
    }
    slots.control(controls);
  },
  // Replaces the phone panel's clock (later panels win): the same strings, shifted.
  config: () => ({ clock, date }),
  beforeRestart() {
    alerts = [];
    atStandby = false;
  },
  screen(screen: ScreenModel) {
    // An alert is a screen of its own over standby: the path stays `standby`.
    const overStandby = host?.phone?.path === "standby" && screen.kind !== "standby";
    if (overStandby && atStandby) alerts = [...alerts, clock()].slice(-ALERT_LOG_LENGTH);
    atStandby = screen.kind === "standby";
  },
  status: () => {
    const minutes = Math.round(shiftMs / 60_000);
    const shift = minutes === 0 ? "" : ` (+${minutes} min)`;
    const log = alerts.length === 0 ? "" : `, alerts at ${alerts.join(" ")}`;
    return `host clock: ${clock()}${shift}${log}`;
  },
};
