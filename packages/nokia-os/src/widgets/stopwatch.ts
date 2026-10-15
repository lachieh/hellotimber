// Plan 21 Task 10: the stopwatch screen as a flow widget. Navi starts, stops, and on a stopped
// time opens Options (Start, Reset, Exit); C goes back to the Stopwatch page (it keeps running);
// while running the time is redrawn every STOPWATCH_REDRAW_MS of kernel time (D5's deviation:
// v6.39 adds 0.1 s every ≈93 ms and resynchronises), the stopped time exactly.
import type { PhoneKey } from "@hellotimber/phone-core";
import type { StopwatchModel } from "../display/widgets/stopwatch";
import { formatStopwatch, type StockStopwatch } from "../firmware/features/clock/stopwatch";
import { ALERT_EXIT_MS, StandbyFrame, type AlertStandby } from "../firmware/features/clock/alerts";
import type { Flow, Widget } from "./flow";
import { freshKeys } from "./fresh-keys";
import { OptionListWidget } from "./option-list";
import type { ListNumbering } from "./rows";

/** The running stopwatch's redraw step, kernel time. */
export const STOPWATCH_REDRAW_MS = 100;

/**
 * A reopened screen first shows the time it last showed, until its first redraw this long after
 * (plan21 stopwatch/reentry 89 ms, reentry-standby 78 ms, resume 87 ms).
 */
export const STOPWATCH_STALE_MS = 85;

export function stopwatchWidget(
  stopwatch: StockStopwatch,
  numbering: ListNumbering,
  standby: AlertStandby,
): Widget & { render(): StopwatchModel } {
  let shownFor = 0;
  return {
    render(): StopwatchModel {
      const ms = stopwatch.elapsedMs();
      if (stopwatch.running()) {
        const live = Math.floor(ms / STOPWATCH_REDRAW_MS) * STOPWATCH_REDRAW_MS;
        const stale = shownFor < STOPWATCH_STALE_MS && stopwatch.displayedMs > 0;
        const shown = stale ? stopwatch.displayedMs : live;
        if (!stale) stopwatch.displayedMs = live;
        return { kind: "stopwatch", text: formatStopwatch(shown), softkey: "Stop" };
      }
      stopwatch.displayedMs = ms;
      return {
        kind: "stopwatch",
        text: formatStopwatch(ms),
        softkey: ms === 0 ? "Start" : "Options",
      };
    },
    tick(dtMs: number): void {
      shownFor += dtMs;
    },
    // Navi and C act as they go down (plan21 stopwatch/run 41 ms, c-running 51 ms, both taps).
    onKeyDown(key: PhoneKey, flow: Flow): void {
      if (key === "c") {
        flow.back();
        return;
      }
      if (key !== "navi") return;
      if (stopwatch.running()) stopwatch.stop();
      else if (stopwatch.elapsedMs() === 0) stopwatch.start();
      else flow.push(freshKeys(stopwatchOptions(stopwatch, numbering, standby)));
    },
  };
}

/**
 * Options on a stopped time: Start (resume), Reset, Exit (standby, the time kept; standby drawn
 * without its operator line first, plan21 stopwatch/exit 84 ms).
 */
function stopwatchOptions(
  stopwatch: StockStopwatch,
  numbering: ListNumbering,
  standby: AlertStandby,
): Widget {
  return new OptionListWidget({
    labels: ["Start", "Reset", "Exit"],
    opening: 0,
    softkey: "Select",
    numbering,
    choose: (index, flow) => {
      if (index === 0) {
        stopwatch.start();
        flow.back();
      } else if (index === 1) {
        stopwatch.reset();
        flow.back();
      } else {
        flow.replace(new StandbyFrame(standby, ALERT_EXIT_MS, (f) => f.standby()));
      }
    },
  });
}
